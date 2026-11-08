import mongoose from "mongoose";

const feeBandSchema = new mongoose.Schema({
  currency: { type: String, enum: ["USD", "SAR", "YER_ADEN", "YER_SANAA"], required: true },
  minimumAmount: { type: Number, required: true, min: 0 },
  maximumAmount: { type: Number, required: true, min: 0 },
  feeAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

const walletServiceFeeSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "wallet-services", unique: true },
    feeBands: { type: [feeBandSchema], default: [] },
    feeBandVersion: { type: Number, default: 2 }
  },
  { timestamps: true }
);

export default mongoose.model("WalletServiceFeeSettings", walletServiceFeeSettingsSchema);
