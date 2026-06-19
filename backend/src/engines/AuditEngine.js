import BrokerageAuditLog from "../models/BrokerageAuditLog.js";
import { v4 as uuidv4 } from "uuid";

export default class AuditEngine {
  static async log(
    actorId = null,
    actorType = "SYSTEM",
    entityType,
    entityId,
    action,
    oldState = null,
    newState = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
    idempotencyKey = null
  ) {
    try {
      const auditEntry = await BrokerageAuditLog.create({
        actorId,
        actorType,
        entityType,
        entityId,
        action,
        oldState,
        newState,
        ipAddress,
        userAgent,
        idempotencyKey: idempotencyKey || uuidv4(),
        metadata
      });
      return auditEntry;
    } catch (err) {
      console.error("Failed to log audit entry:", err);
      throw err;
    }
  }

  static async getEntityHistory(entityType, entityId, limit = 100) {
    try {
      const logs = await BrokerageAuditLog.find({ entityType, entityId })
        .sort({ createdAt: -1 })
        .limit(limit);
      return logs;
    } catch (err) {
      console.error("Failed to get entity history:", err);
      throw err;
    }
  }
}
