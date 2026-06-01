
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGODB_URI = "mongodb://127.0.0.1:27017/yemen_market";

async function restore() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Wallet = mongoose.connection.db.collection('wallets');
    const userId = new mongoose.Types.ObjectId("69f712149ce7c3542099104a");

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      console.log("Wallet not found");
      return;
    }

    let balances = wallet.balances || [];
    let adenBalance = balances.find(b => b.currency === 'YER_ADEN');

    if (adenBalance) {
      adenBalance.availableBalance = 125000;
    } else {
      balances.push({
        currency: 'YER_ADEN',
        availableBalance: 125000,
        pendingBalance: 0
      });
    }

    // Ensure YER is 0 or removed if that's what we want
    let yerBalance = balances.find(b => b.currency === 'YER');
    if (yerBalance) {
      yerBalance.availableBalance = 0;
    }

    await Wallet.updateOne({ _id: wallet._id }, { $set: { balances: balances } });
    console.log("Wallet restored successfully with 125,000 YER_ADEN");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
restore();
