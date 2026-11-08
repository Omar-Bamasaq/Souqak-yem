import Notification from "../models/Notification.js";
import AdminNotification from "../models/AdminNotification.js";
import User from "../models/User.js";
import StoreProfile from "../models/StoreProfile.js";
import Order from "../models/Order.js";
import StoreSubscription from "../models/StoreSubscription.js";
import StoreNotificationSubscription from "../models/StoreNotificationSubscription.js";
import { hasStoreFeature } from "../utils/storeFeatureUtils.js";
import { sendPushNotification, sendPushToSubscription } from "./pushService.js";
import { sendStoreOrderEmail } from "../utils/emailSender.js";
import { getFrontendBaseUrl } from "../utils/siteUrl.js";

export const STORE_NOTIFICATION_TYPES = Object.freeze({
  ORDER_NEW: "store_order_new",
  ORDER_CONFIRMED: "store_order_confirmed",
  ORDER_STATUS_CHANGED: "store_order_status_changed",
  ORDER_READY: "store_order_ready",
  ORDER_SHIPPED: "store_order_shipped",
  ORDER_DELIVERED: "store_order_delivered",
  ORDER_CANCELLED: "store_order_cancelled",
  MESSAGE_REPLY: "store_message_reply",
  PRODUCT_RESTOCKED: "store_product_restocked",
  DISCOUNT_ACTIVATED: "store_discount_activated",
  NEW_ARRIVAL: "store_new_arrival",
  CUSTOMER_MESSAGE: "store_customer_message",
  INVENTORY_LOW: "store_inventory_low",
  STORE_UPDATED: "store_store_updated"
});

export function getUserNotificationLink(type, data = {}, link) {
  const requestedLink = link || data.url;
  if (
    typeof requestedLink === "string"
    && requestedLink.startsWith("/")
    && !requestedLink.startsWith("//")
    && !requestedLink.includes("\\")
    && !/[\u0000-\u001f]/.test(requestedLink)
  ) {
    return requestedLink;
  }

  const id = (key) => data[key] == null ? null : encodeURIComponent(String(data[key]));
  switch (type) {
    case "message":
      return id("conversationId") ? `/messages?chat=${id("conversationId")}` : "/notifications";
    case "ad_status":
    case "ad_status_followup":
    case "comment":
    case "favorite":
      return id("adId") ? `/ad/${id("adId")}` : "/notifications";
    case "purchase_approved":
    case "purchase_rejected":
    case "commission_reminder":
      return "/seller/commissions";
    case "verification_approved":
    case "verification_rejected":
    case "verification_expired":
    case "verification_warning":
      return "/account";
    case "order":
      return id("orderId") ? `/orders/${id("orderId")}` : "/orders";
    case "wallet":
      return "/wallet";
    case "wallet_service":
      return id("walletServiceOrderId")
        ? `/wallet-services/${id("walletServiceOrderId")}/payment`
        : "/wallet-services";
    case "store_subscription":
      return data.storeType === "family-production" ? "/my-family-production" : "/my-store";
    case "store_order":
      return data.storeType === "family-production" ? "/my-family-production/orders" : "/my-store/orders";
    case "admin_message":
      return "/messages";
    case "auction":
      return id("auctionId") ? `/auctions/${id("auctionId")}` : "/auctions";
    case "quote_offer":
    case "quote_status":
      return id("quoteRequestId") ? `/quote-requests/${id("quoteRequestId")}` : "/quote-requests";
    case "booking_status":
      return "/bookings";
    case "welcome_promotion_expired":
      return id("adId") ? `/my-ads?welcomePromotion=${id("adId")}` : "/my-ads";
    default:
      return "/notifications";
  }
}

const STORE_NOTIFICATION_PREFERENCE = Object.freeze({
  store_order_confirmed: "orderNotifications",
  store_order_status_changed: "orderNotifications",
  store_order_ready: "orderNotifications",
  store_order_shipped: "orderNotifications",
  store_order_delivered: "orderNotifications",
  store_order_cancelled: "orderNotifications",
  store_message_reply: "messageNotifications",
  store_product_restocked: "marketingNotifications",
  store_discount_activated: "marketingNotifications",
  store_new_arrival: "marketingNotifications"
});

export async function getStoreNotificationContext(storeProfileId) {
  const store = await StoreProfile.findById(storeProfileId).lean();
  if (!store || store.status !== "active") return null;
  const subscription = await StoreSubscription.findOne({ storeId: store._id })
    .sort({ createdAt: -1, _id: -1 })
    .populate("planId", "type features")
    .lean();
  if (!hasStoreFeature({ status: store.status, subscription }, "notifications")) return null;
  return { store, subscription };
}

export async function sendStorePushToSubscriber(subscriber, payload, pushSender = sendPushToSubscription) {
  if (!subscriber.endpoint || !subscriber.keys?.p256dh || !subscriber.keys?.auth) {
    return { success: false, reason: "No Push subscription" };
  }
  const pushResult = await pushSender(subscriber, payload);
  if (pushResult.expired) {
    await StoreNotificationSubscription.deleteOne({ _id: subscriber._id });
  } else if (pushResult.success) {
    await StoreNotificationSubscription.updateOne(
      { _id: subscriber._id },
      { $set: { lastUsedAt: new Date() } }
    );
  }
  return pushResult;
}

async function saveAndEmitStoreNotification(app, store, recipientId, { type, title, body, link, data }) {
  const entityId = data?.eventId
    || data?.messageId
    || data?.orderId && `${data.orderId}:${data.status || type}`
    || data?.productId
    || data?.adId;
  const eventKey = entityId
    ? `${store._id}:${type}:${entityId}:${recipientId}`.slice(0, 512)
    : null;
  const notification = await Notification.create({
    userId: recipientId,
    storeProfileId: store._id,
    relatedOrderId: data?.orderId || null,
    type,
    title,
    body,
    link,
    eventKey,
    data: { ...data, storeProfileId: String(store._id), storeSlug: store.slug, url: link }
  });
  const io = app ? (typeof app.get === "function" ? app.get("io") : app) : null;
  if (io) {
    try {
      io.to(`user:${recipientId}`).emit("notification:new", { notification: notification.toObject() });
    } catch (error) {
      console.error("Store notification socket delivery failed:", {
        storeProfileId: String(store._id),
        userId: String(recipientId),
        error: error?.message
      });
    }
  }
  return notification;
}

export async function createStoreNotification(app, {
  storeProfileId,
  type,
  title,
  body,
  link,
  data = {},
  recipient = "subscribers",
  recipientUserId = null,
  pushSender = sendPushToSubscription,
  ownerPushSender = sendPushNotification
}) {
  try {
    if (!Object.values(STORE_NOTIFICATION_TYPES).includes(type)) {
      console.error("Unsupported store notification type:", type);
      return [];
    }
    const context = await getStoreNotificationContext(storeProfileId);
    if (!context) return [];
    const { store } = context;
    const safeLink = typeof link === "string" && link.startsWith("/") ? link : `/store/${encodeURIComponent(store.slug)}`;
    const notifications = [];

    if (recipient === "owner") {
      const notification = await saveAndEmitStoreNotification(app, store, store.userId, {
        type, title, body, link: safeLink, data
      });
      notifications.push(notification);
      await ownerPushSender(store.userId, {
        title,
        body,
        url: safeLink,
        data: { ...data, storeProfileId: String(store._id), type }
      });
      return notifications;
    }

    const preference = STORE_NOTIFICATION_PREFERENCE[type];
    if (!preference) {
      console.error("Store notification type has no customer preference group:", type);
      return [];
    }
    const subscribers = StoreNotificationSubscription.find({
      storeProfileId: store._id,
      enabled: true,
      [preference]: true,
      userId: recipientUserId ? { $eq: recipientUserId, $ne: store.userId } : { $ne: store.userId }
    }).cursor({ batchSize: 100 });

    const notifiedUserIds = new Set();
    for await (const subscriber of subscribers) {
      try {
        const subscriberUserId = String(subscriber.userId);
        if (!notifiedUserIds.has(subscriberUserId)) {
          const notification = await saveAndEmitStoreNotification(app, store, subscriber.userId, {
            type, title, body, link: safeLink, data
          });
          notifications.push(notification);
          notifiedUserIds.add(subscriberUserId);
        }
        if (subscriber.endpoint) {
          await sendStorePushToSubscriber(subscriber, {
            title,
            body,
            url: safeLink,
            data: { ...data, storeProfileId: String(store._id), type }
          }, pushSender);
        }
      } catch (error) {
        console.error("Store subscriber notification failed:", {
          storeProfileId: String(store._id),
          userId: String(subscriber.userId),
          type,
          error: error?.message
        });
      }
    }
    return notifications;
  } catch (error) {
    console.error("Store notification creation failed:", {
      storeProfileId: String(storeProfileId),
      type,
      error: error?.message
    });
    return [];
  }
}

/**
 * Global notification helper to handle Database storage, Socket.io emission, and Push notifications.
 * @param {object} app - The Express app instance (to get Socket.io)
 * @param {object} params - Notification parameters
 * @param {string} params.userId - Target user ID
 * @param {string} params.type - Notification type
 * @param {string} params.title - Title (Arabic)
 * @param {string} params.body - Body (Arabic)
 * @param {object} [params.data] - Additional metadata
 * @param {string} [params.link] - Same-origin relative destination for in-app and push
 * @param {string} [params.eventKey] - Optional idempotency key for scheduled notifications
 * @param {boolean} [params.push=true] - Whether to send a push notification (if enabled in user prefs)
 * @param {boolean} [params.force=false] - If true, ignores user preferences and sends anyway
 */
export const createNotification = async (app, {
  userId,
  type,
  title,
  body,
  data = {},
  link,
  eventKey,
  push = true,
  force = false
}) => {
  try {
    const user = await User.findById(userId).select("notificationPrefs name").lean();
    if (!user) return null;

    const prefs = user.notificationPrefs || {};
    const typePrefs = prefs[type] || { inApp: true, push: true };
    
    const inAppEnabled = force || typePrefs.inApp !== false;
    const pushEnabled = force || (push && typePrefs.push !== false);
    const notificationLink = getUserNotificationLink(type, data, link);
    const dedupeKey = typeof eventKey === "string" && eventKey ? eventKey.slice(0, 512) : null;
    let notif = null;

    // 1. Create in DB (In-App)
    let duplicateNotification = false;
    if (inAppEnabled) {
      if (dedupeKey) {
        notif = await Notification.findOne({ userId, eventKey: dedupeKey }).lean();
        duplicateNotification = Boolean(notif);
      }

      if (!notif) {
        try {
          notif = await Notification.create({
            userId,
            type,
            title,
            body,
            data: { ...data, url: notificationLink },
            link: notificationLink,
            eventKey: dedupeKey
          });
        } catch (notificationError) {
          if (!dedupeKey || notificationError?.code !== 11000) throw notificationError;
          notif = await Notification.findOne({ userId, eventKey: dedupeKey }).lean();
          if (!notif) throw notificationError;
          duplicateNotification = true;
        }
      }

      // 2. Emit via Socket.io for real-time
      const io = app ? (typeof app.get === 'function' ? app.get("io") : app) : null;
      if (io && !duplicateNotification) {
        try {
          io.to(`user:${userId}`).emit("notification:new", {
            notification: typeof notif.toObject === "function" ? notif.toObject() : notif
          });
        } catch (socketError) {
          console.error("User notification socket delivery failed:", {
            userId: String(userId),
            type,
            error: socketError?.message
          });
        }
      }
    }

    // 3. Send Push Notification
    if (pushEnabled && !duplicateNotification) {
      await sendPushNotification(userId, {
        title,
        body,
        url: notificationLink,
        preferenceKey: type,
        data: { ...data, type, url: notificationLink }
      });
    }

    return notif;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

export async function createStoreOrderStatusNotification(app, {
  store,
  order,
  notificationSender = createNotification
}) {
  const status = order.status;
  const title = status === "processing"
    ? "تم تأكيد طلبك"
    : status === "completed"
      ? "اكتمل طلبك"
      : status === "cancelled"
        ? "تم إلغاء طلبك"
        : "تحديث حالة الطلب";
  const body = status === "processing"
    ? "أكد المتجر طلبك وبدأ تجهيزه."
    : status === "completed"
      ? "أكمل المتجر تجهيز طلبك."
      : status === "cancelled"
        ? "تم إلغاء طلبك من المتجر."
        : "تم تحديث حالة طلبك من المتجر.";
  return notificationSender(app, {
    userId: order.buyer,
    type: "order",
    title,
    body,
    link: `/orders/${order._id}`,
    eventKey: `store-order-status:${order._id}:${status}`,
    data: { orderId: String(order._id), status, storeProfileId: String(store._id) },
    email: false
  });
}

export const createStoreOrderNotification = async (app, { store, order, buyerName }) => {
  const existing = await Notification.findOne({
    type: STORE_NOTIFICATION_TYPES.ORDER_NEW,
    relatedOrderId: order._id
  }).lean();
  if (existing) return existing;
  const [notification] = await createStoreNotification(app, {
    storeProfileId: store._id,
    recipient: "owner",
    type: STORE_NOTIFICATION_TYPES.ORDER_NEW,
    title: "طلب جديد",
    body: `لديك طلب جديد${buyerName ? ` من ${buyerName}` : ""} بقيمة ${Number(order.total).toLocaleString("ar")} ${order.currency}.`,
    link: store.storeType === "family-production" ? "/my-family-production/orders" : "/my-store/orders",
    data: {
      orderId: String(order._id),
      storeType: store.storeType || "store"
    }
  });
  return notification || null;
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendStoreOrderEmailNotification(store, order, emailSender = sendStoreOrderEmail) {
  const recipient = String(store?.notificationEmail || "").trim().toLowerCase();
  if (!recipient || !store?._id || !store?.userId || !order?._id) return false;
  if (recipient.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    console.error("Store order email skipped for invalid profile address:", {
      orderId: String(order._id),
      storeProfileId: String(store._id)
    });
    return false;
  }

  const attemptedAt = new Date();
  const claim = await Order.updateOne({
    _id: order._id,
    orderType: "store",
    storeProfileId: store._id,
    seller: store.userId,
    storeOwnerEmailNotificationAttemptedAt: null
  }, {
    $set: { storeOwnerEmailNotificationAttemptedAt: attemptedAt }
  });
  if (claim.modifiedCount !== 1) return false;

  const orderId = String(order._id);
  const link = store.storeType === "family-production" ? "/my-family-production/orders" : "/my-store/orders";
  try {
    const sent = await emailSender({
      to: recipient,
      subject: "طلب جديد في ملفك - سوقك",
      text: `وصل طلب جديد إلى ${store.storeName || "ملفك"}. رقم الطلب: ${orderId}.`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; color: #1e293b;">
          <h2>لديك طلب جديد</h2>
          <p>وصل طلب جديد إلى ${escapeHtml(store.storeName || "ملفك")}.</p>
          <p>رقم الطلب: <strong>${escapeHtml(orderId)}</strong></p>
          <p><a href="${escapeHtml(getFrontendBaseUrl())}${link}">عرض الطلبات</a></p>
        </div>
      `
    });
    if (!sent) {
      console.error("Store order email delivery failed:", { orderId, storeProfileId: String(store._id) });
      return false;
    }
    await Order.updateOne(
      { _id: order._id, storeProfileId: store._id },
      { $set: { storeOwnerEmailNotificationSentAt: new Date() } }
    );
    return true;
  } catch (error) {
    console.error("Store order email delivery failed:", {
      orderId,
      storeProfileId: String(store._id),
      error: error?.message
    });
    return false;
  }
}

/**
 * Global admin notification helper to handle Database storage, Socket.io emission, and Push notifications to all admins.
 * @param {object} app - The Express app instance (to get Socket.io)
 * @param {object} params - Notification parameters
 * @param {string} params.type - Notification type
 * @param {string} params.title - Title (Arabic)
 * @param {string} params.message - Body (Arabic)
 * @param {string} params.link - Link to navigate to when clicked
 * @param {object} [params.data] - Additional metadata
 */
export const createAdminNotification = async (app, { type, title, message, link, data }) => {
  try {
    // 1. Create in DB
    const adminNotif = await AdminNotification.create({
      type,
      title,
      message,
      link,
      data
    });

    // 2. Emit via Socket.io for real-time
    const io = app ? (typeof app.get === 'function' ? app.get("io") : app) : null;
    if (io?.to) {
      io.to("role:admin").emit("admin_notification:new", adminNotif.toObject());
    }

    // 3. Send Push Notification to all admins
    const admins = await User.find({
      role: "admin",
      isDisabled: { $ne: true },
      isDeleted: { $ne: true }
    }).select("_id");
    for (const admin of admins) {
      await sendPushNotification(admin._id, {
        title,
        body: message,
        url: link,
        data: { ...data, type }
      });
    }

    return adminNotif;
  } catch (error) {
    console.error("Error creating admin notification:", error);
    return null;
  }
};
