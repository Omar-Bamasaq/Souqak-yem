import mongoose from "mongoose";

const CONFIG_CATEGORIES = [
  "SECURITY",
  "REWARDS",
  "CAMPAIGNS",
  "TRUST",
  "FRAUD",
  "RETENTION",
  "NOTIFICATIONS",
  "ANALYTICS",
  "MEMBERSHIPS",
  "DEALS",
  "REVIEWS"
];

const BrokerageConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    category: { type: String, enum: CONFIG_CATEGORIES, required: true },

    value: { type: mongoose.Schema.Types.Mixed, required: true },
    type: { 
      type: String, 
      enum: ["STRING", "NUMBER", "BOOLEAN", "JSON"], 
      required: true 
    },

    description: { type: String, maxLength: 500, default: null },

    // Versioning
    version: { type: Number, default: 1 },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

BrokerageConfigSchema.index({ category: 1 });

export default mongoose.models.BrokerageConfig || mongoose.model("BrokerageConfig", BrokerageConfigSchema);
