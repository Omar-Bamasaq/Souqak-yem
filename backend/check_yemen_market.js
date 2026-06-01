
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://127.0.0.1:27017/yemen-market";

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Transaction = mongoose.connection.db.collection('transactions');
    const txs = await Transaction.find({ amount: { $in: [125000, -125000] } }).toArray();
    console.log("Transactions with 125k:", JSON.stringify(txs, null, 2));

    const Wallet = mongoose.connection.db.collection('wallets');
    const wallets = await Wallet.find({ "balances.availableBalance": { $gt: 0 } }).toArray();
    console.log("Positive Wallets:", JSON.stringify(wallets, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
check();
