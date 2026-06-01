
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
// Try both common DB names
const dbNames = ["yemen_market", "yemen-market"];

async function search() {
  for (const dbName of dbNames) {
    const MONGODB_URI = `mongodb://127.0.0.1:27017/${dbName}`;
    try {
      await mongoose.connect(MONGODB_URI);
      console.log(`Searching in ${dbName}...`);
      const Transaction = mongoose.connection.db.collection('transactions');
      const txs = await Transaction.find({ description: { $regex: /تحرير رصيد/ } }).toArray();
      if (txs.length > 0) {
        console.log(`Found in ${dbName}:`, JSON.stringify(txs, null, 2));
      }
      await mongoose.disconnect();
    } catch (err) {
      console.error(`Error in ${dbName}:`, err);
    }
  }
}
search();
