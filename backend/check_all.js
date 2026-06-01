
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://127.0.0.1:27017/yemen_market";

async function checkAll() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Wallet = mongoose.connection.db.collection('wallets');
    const wallets = await Wallet.find({ "balances.availableBalance": { $gt: 0 } }).toArray();
    console.log("Wallets with positive balance:", JSON.stringify(wallets, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
checkAll();
