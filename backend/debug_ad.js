import mongoose from "mongoose";
import dotenv from "dotenv";
import Ad from "./src/models/Ad.js";

import Order from "./src/models/Order.js";

dotenv.config();

const uri = "mongodb://localhost:27017/yemen_market";

async function check() {
  try {
    await mongoose.connect(uri);
    const order = await Order.findById("69e106df69275459f366e01d").populate("ad").lean();
    console.log("ORDER DATA:", JSON.stringify(order, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
