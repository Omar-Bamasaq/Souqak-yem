import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["verification", "featured"], required: true },
    durationInDays: { type: Number, required: true },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: ["YER_ADEN", "YER_SANAA", "SAR", "USD"], default: "YER_ADEN" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Plan", planSchema);
