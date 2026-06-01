
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://localhost:27017/yemen-market";

async function checkTxs() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Transaction = mongoose.connection.db.collection('transactions');
    const txs = await Transaction.find({ amount: { $in: [125000, -125000] } }).toArray();
    console.log("Recent Transactions (125k):", JSON.stringify(txs, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
checkTxs();
