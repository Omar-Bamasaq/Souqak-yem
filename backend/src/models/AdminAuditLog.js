import mongoose from "mongoose";

const AdminAuditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    method: { type: String, required: true },
    route: { type: String, required: true },
    params: { type: Object, default: {} },
    query: { type: Object, default: {} },
    body: { type: Object, default: {} },
    ip: { type: String }
  },
  { timestamps: true }
);

AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });

export default mongoose.models.AdminAuditLog || mongoose.model("AdminAuditLog", AdminAuditLogSchema);

