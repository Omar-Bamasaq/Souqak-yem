import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const backendEnv = path.join(process.cwd(), ".env.local");
const rootEnv = path.join(process.cwd(), "..", ".env.local");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
import { connectDB } from "./src/lib/mongodb.js";
import Ad from "./src/models/Ad.js";
import User from "./src/models/User.js";

async function pickTargetUser() {
  const email = process.env.BACKFILL_USER_EMAIL || process.env.SEED_SELLER_EMAIL || "seller@yemenmarket.com";
  let user = await User.findOne({ email }).lean();
  if (!user) {
    user = await User.findOne({ role: "seller" }).lean();
  }
  if (!user) {
    user = await User.findOne({ role: "admin" }).lean();
  }
  return user;
}

async function run() {
  await connectDB();
  const target = await pickTargetUser();
  if (!target) {
    console.log("No user found to backfill to.");
    process.exit(0);
  }
  const missing = await Ad.countDocuments({ $or: [{ userId: { $exists: false } }, { userId: null }] });
  console.log("Ads missing userId:", missing);
  if (missing === 0) {
    console.log("No backfill needed.");
    process.exit(0);
  }
  const res = await Ad.updateMany(
    { $or: [{ userId: { $exists: false } }, { userId: null }] },
    { $set: { userId: target._id } }
  );
  console.log(`Backfilled ads with userId=${target._id}:`, res.modifiedCount || res.nModified || 0);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
