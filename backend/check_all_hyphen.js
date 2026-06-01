
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://localhost:27017/yemen-market";

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
