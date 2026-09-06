import webPush from "web-push";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const vapidEmail = process.env.VAPID_EMAIL?.trim() || "mailto:non.reply.yourplatform@gmail.com";
export const isPushConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (isPushConfigured) {
  webPush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.error("Push notifications are disabled: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required.");
}

/**
 * Send push notification to a specific user
 * @param {string} userId - ID of the user to notify
 * @param {object} payload - Notification data { title, body, icon, url, data }
 */
export const sendPushNotification = async (userId, payload) => {
  try {
    if (!isPushConfigured) {
      return { success: false, reason: "Push service is not configured" };
    }

    const user = await User.findById(userId).select("pushSubscriptions notificationPrefs");
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      return { success: false, reason: "No active subscriptions" };
    }

    // Check notification preferences if needed
    // if (user.notificationPrefs && user.notificationPrefs.message.push === false) return;

    const notificationPayload = JSON.stringify({
      title: payload.title || "سوقك",
      body: payload.body || "",
      icon: payload.icon || "/pwa/icon-192x192.png",
      badge: "/pwa/icon-96x96.png",
      silent: false,
      vibrate: [100, 50, 100],
      data: {
        url: payload.url || "/",
        ...payload.data
      }
    });

    const results = await Promise.allSettled(
      user.pushSubscriptions.map(async (sub) => {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          },
          notificationPayload
        );
        return sub.endpoint;
      })
    );

    // Remove subscriptions rejected by the push provider, including ones
    // invalidated after a VAPID key rotation.
    const resultsWithSubscriptions = results.map((result, index) => ({
      result,
      endpoint: user.pushSubscriptions[index].endpoint
    }));
    const expiredEndpoints = resultsWithSubscriptions
      .filter(({ result }) => {
        const statusCode = result.status === "rejected" ? result.reason?.statusCode : null;
        return statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 410;
      })
      .map(({ endpoint }) => endpoint);

    const failedResults = resultsWithSubscriptions.filter(({ result }) => result.status === "rejected");
    failedResults.forEach(({ result, endpoint }) => {
      console.error("Push delivery failed:", {
        statusCode: result.reason?.statusCode,
        endpoint
      });
    });

    if (expiredEndpoints.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: { $in: expiredEndpoints } } }
      });
    }

    return { 
      success: true, 
      sentCount: results.filter(r => r.status === 'fulfilled').length,
      failedCount: results.filter(r => r.status === 'rejected').length
    };
  } catch (err) {
    console.error("Push Notification Error:", err);
    return { success: false, error: err.message };
  }
};
