import mongoose from "mongoose";

const bankSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true },
    accountOwner: { type: String, required: true },
    logo: { type: String },
    accounts: [
      {
        number: { type: String, required: true },
        currency: { type: String, enum: ["YER", "YER_ADEN", "YER_SANAA", "SAR", "USD"], default: "YER" }
      }
    ],
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.models.Bank || mongoose.model("Bank", bankSchema);
