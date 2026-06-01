import mongoose from "mongoose";

const userBankAccountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountCurrency: { type: String, required: true }
  },
  { timestamps: true }
);

const UserBankAccount = mongoose.model("UserBankAccount", userBankAccountSchema);
export default UserBankAccount;
