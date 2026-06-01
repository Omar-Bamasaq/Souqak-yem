import ActivityLog from "../models/ActivityLog.js";

export const logActivity = async ({
  action,
  entityType,
  entityId,
  performedBy,
  targetUser = null,
  metadata = {},
  req = null
}) => {
  try {
    const logData = {
      action,
      entityType,
      entityId,
      performedBy,
      targetUser,
      metadata
    };

    if (req) {
      logData.ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      logData.userAgent = req.headers["user-agent"];
    }

    await ActivityLog.create(logData);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
