import mongoose from "mongoose";

const AUDIT_ACTION_TYPES = [
  // Campaign
  "CAMPAIGN_CREATED",
  "CAMPAIGN_ACTIVATED",
  "CAMPAIGN_SUSPENDED",
  "CAMPAIGN_DEAL_CONFIRMED",
  "CAMPAIGN_EXPIRED",
  "CAMPAIGN_DELETED",

  // Membership
  "MEMBERSHIP_REQUEST_SENT",
  "MEMBERSHIP_AUTO_ACTIVATED",
  "MEMBERSHIP_APPROVED",
  "MEMBERSHIP_REJECTED",
  "MEMBERSHIP_ACTIVATED",
  "MEMBERSHIP_INACTIVATED",
  "MEMBERSHIP_WITHDRAWN",
  "MEMBERSHIP_BANNED",
  "MEMBERSHIP_EXPIRED",

  // Evidence
  "EVIDENCE_CREATED",
  "EVIDENCE_VERIFIED",
  "EVIDENCE_REJECTED",
  "EVIDENCE_USED_IN_DEAL",

  // Deal
  "DEAL_PENDING_BROKER_CONFIRM",
  "DEAL_PENDING_BUYER_CONFIRM",
  "DEAL_CONFIRMED",
  "DEAL_REJECTED",
  "DEAL_UNDER_DISPUTE",
  "DEAL_ARCHIVED",

  // Complaint
  "COMPLAINT_CREATED",
  "COMPLAINT_RESOLVED",
  "COMPLAINT_REJECTED",

  // Review
  "REVIEW_CREATED",
  "REVIEW_APPROVED",
  "REVIEW_REJECTED",

  // Reputation
  "REPUTATION_UPDATED",

  // Achievements & Badges
  "ACHIEVEMENT_UNLOCKED",
  "BADGE_AWARDED",

  // Config
  "CONFIG_CREATED",
  "CONFIG_UPDATED",

  // Moderation
  "USER_SUSPENDED",
  "USER_BANNED"
];

const BrokerageAuditLogSchema = new mongoose.Schema(
  {
    // Who or what triggered this
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorType: { type: String, enum: ["USER", "SYSTEM", "MODERATOR", "ADMIN"], default: "SYSTEM" },
    
    // What entity it affects
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },

    action: { type: String, enum: AUDIT_ACTION_TYPES, required: true },

    // Before and After state snapshots
    oldState: { type: mongoose.Schema.Types.Mixed, default: null },
    newState: { type: mongoose.Schema.Types.Mixed, default: null },

    // Additional metadata
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    idempotencyKey: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

BrokerageAuditLogSchema.index({ entityType: 1, entityId: 1 });
BrokerageAuditLogSchema.index({ actorId: 1, createdAt: -1 });
BrokerageAuditLogSchema.index({ action: 1, createdAt: -1 });
BrokerageAuditLogSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

BrokerageAuditLogSchema.pre("save", function(next) {
  // Immutable
  if (!this.isNew) {
    const err = new Error("Cannot update or delete existing audit log entries");
    next(err);
  } else {
    next();
  }
});

BrokerageAuditLogSchema.pre("findOneAndUpdate", function(next) {
  const err = new Error("Cannot update or delete existing audit log entries");
  next(err);
});

BrokerageAuditLogSchema.pre("findOneAndDelete", function(next) {
  const err = new Error("Cannot update or delete existing audit log entries");
  next(err);
});

BrokerageAuditLogSchema.pre("deleteOne", function(next) {
  const err = new Error("Cannot update or delete existing audit log entries");
  next(err);
});

BrokerageAuditLogSchema.pre("deleteMany", function(next) {
  const err = new Error("Cannot update or delete existing audit log entries");
  next(err);
});

export default mongoose.models.BrokerageAuditLog || mongoose.model("BrokerageAuditLog", BrokerageAuditLogSchema);
