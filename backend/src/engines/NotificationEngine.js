import Notification from "../models/Notification.js";
import AuditEngine from "./AuditEngine.js";

const NOTIFICATION_TYPES = {
  BROKER_REQUEST: "BROKER_REQUEST",
  BROKER_APPROVED: "BROKER_APPROVED",
  BROKER_REJECTED: "BROKER_REJECTED",
  DEAL_PENDING: "DEAL_PENDING",
  DEAL_CONFIRMED: "DEAL_CONFIRMED",
  COMPLAINT_RECEIVED: "COMPLAINT_RECEIVED",
  COMPLAINT_RESOLVED: "COMPLAINT_RESOLVED",
  ACHIEVEMENT_UNLOCKED: "ACHIEVEMENT_UNLOCKED",
  BADGE_AWARDED: "BADGE_AWARDED"
};

export default class NotificationEngine {
  static async send(toUserId, type, title, body, metadata = {}) {
    const notification = await Notification.create({
      userId: toUserId,
      type,
      title,
      body,
      metadata,
      read: false
    });

    await AuditEngine.log(
      null,
      "SYSTEM",
      "Notification",
      notification._id,
      "NOTIFICATION_SENT",
      null,
      { type, toUserId, title }
    );

    // TODO: Add external channels (Push, SMS, Email) here
    // For now, just store in DB

    return notification;
  }

  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({ _id: notificationId, userId });
    if (!notification) throw new Error("Notification not found");
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    await AuditEngine.log(
      userId,
      "USER",
      "Notification",
      notification._id,
      "NOTIFICATION_READ",
      { read: false },
      { read: true }
    );

    return notification;
  }

  static async getUserNotifications(userId, unreadOnly = false) {
    const filter = { userId };
    if (unreadOnly) filter.read = false;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  }
}
