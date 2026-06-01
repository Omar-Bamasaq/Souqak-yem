
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://127.0.0.1:27017/yemen_market";

async function check() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Wallet = mongoose.connection.db.collection('wallets');
    const Transaction = mongoose.connection.db.collection('transactions');

    const userId = new mongoose.Types.ObjectId("69f712149ce7c3542099104a");
    
    const wallet = await Wallet.findOne({ user: userId });
    console.log("Wallet Balances:", JSON.stringify(wallet?.balances, null, 2));

    const txs = await Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(5).toArray();
    console.log("Recent Transactions:", JSON.stringify(txs, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
check();
