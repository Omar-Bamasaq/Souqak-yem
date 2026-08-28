import mongoose from "mongoose";

const balanceSchema = new mongoose.Schema({
  currency: { type: String, required: true },
  pendingBalance: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 }
}, { _id: false });

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balances: [balanceSchema]
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", walletSchema);
