
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://127.0.0.1:27017/yemen_market";

async function search() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Wallet = mongoose.connection.db.collection('wallets');
    const wallets = await Wallet.find({ "balances.availableBalance": 125000 }).toArray();
    console.log("Found wallets with 125k:", JSON.stringify(wallets, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
search();
