import webPush from "web-push";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:non.reply.yourplatform@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Send push notification to a specific user
 * @param {string} userId - ID of the user to notify
 * @param {object} payload - Notification data { title, body, icon, url, data }
 */
export const sendPushNotification = async (userId, payload) => {
  try {
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
      data: {
        url: payload.url || "/",
        ...payload.data
      }
    });

    const results = await Promise.allSettled(
      user.pushSubscriptions.map(sub => 
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          },
          notificationPayload
        )
      )
    );

    // Clean up expired subscriptions
    const expiredEndpoints = results
      .filter(r => r.status === 'rejected' && (r.reason.statusCode === 410 || r.reason.statusCode === 404))
      .map((r, i) => user.pushSubscriptions[i].endpoint);

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
