import mongoose from "mongoose";

const dailyVisitorSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, index: true },
    visitorKey: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ipHash: { type: String, default: null },
    userAgentHash: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

dailyVisitorSchema.index({ dateKey: 1, visitorKey: 1 }, { unique: true });

export default mongoose.models.DailyVisitor || mongoose.model("DailyVisitor", dailyVisitorSchema);
