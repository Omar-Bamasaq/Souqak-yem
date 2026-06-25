import Notification from "../models/Notification.js";
import AdminNotification from "../models/AdminNotification.js";
import User from "../models/User.js";
import { sendPushNotification } from "./pushService.js";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * Global notification helper to handle Database storage, Socket.io emission, and Push notifications.
 * @param {object} app - The Express app instance (to get Socket.io)
 * @param {object} params - Notification parameters
 * @param {string} params.userId - Target user ID
 * @param {string} params.type - Notification type
 * @param {string} params.title - Title (Arabic)
 * @param {string} params.body - Body (Arabic)
 * @param {object} [params.data] - Additional metadata
 * @param {boolean} [params.push=true] - Whether to send a push notification (if enabled in user prefs)
 * @param {boolean} [params.email=false] - Whether to send an email notification (if enabled in user prefs)
 * @param {boolean} [params.force=false] - If true, ignores user preferences and sends anyway
 */
export const createNotification = async (app, { userId, type, title, body, data, push = true, email = false, force = false }) => {
  try {
    const user = await User.findById(userId).select("email notificationPrefs name").lean();
    if (!user) return null;

    const prefs = user.notificationPrefs || {};
    // Get prefs for this specific type (default to true for inApp/push, false for email unless specified)
    const typePrefs = prefs[type] || { inApp: true, push: true, email: (type === 'order' || type === 'wallet') };
    
    const inAppEnabled = force || typePrefs.inApp !== false;
    const pushEnabled = force || (push && typePrefs.push !== false);
    
    // logic fix: respect the 'email' parameter if it's explicitly provided
    let emailEnabled = force || (typePrefs.email === true);
    if (email === false) emailEnabled = false; // explicitly disabled in call
    if (email === true) emailEnabled = true; // explicitly enabled in call
    let notif = null;

    // 1. Create in DB (In-App)
    if (inAppEnabled) {
      notif = await Notification.create({
        userId,
        type,
        title,
        body,
        data
      });

      // 2. Emit via Socket.io for real-time
      const io = app ? (typeof app.get === 'function' ? app.get("io") : app) : null;
      if (io) {
        io.to(`user:${userId}`).emit("notification:new", {
          notification: notif.toObject()
        });
      }
    }

    // 3. Send Push Notification
    if (pushEnabled) {
      await sendPushNotification(userId, {
        title,
        body,
        data: { ...data, type }
      });
    }

    // 4. Send Email Notification
    if (emailEnabled && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: `${title} - سوقك`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px; margin: auto;">
              <h2 style="color: #2563eb;">${title}</h2>
              <p style="font-size: 16px; color: #333;">مرحباً <strong>${user.name}</strong>،</p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="http://localhost:5173/notifications" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">عرض الإشعارات</a>
              </div>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; margin-top: 10px;">تحياتنا،<br>فريق منصة سوقك</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Email notification failed in service:", emailErr);
      }
    }

    return notif;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

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
    if (io) {
      io.emit("admin_notification:new", adminNotif.toObject());
    }

    // 3. Send Push Notification to all admins
    const admins = await User.find({ role: "admin" }).select("_id");
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
