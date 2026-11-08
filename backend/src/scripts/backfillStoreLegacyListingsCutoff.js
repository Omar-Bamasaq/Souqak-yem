import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import StoreProfile from "../models/StoreProfile.js";

dotenv.config({ path: process.env.ENV_PATH || ".env.local" });

async function main() {
  await connectDB();
  const cutoff = new Date();
  const result = await StoreProfile.updateMany(
    { legacyListingsCutoffAt: { $exists: false } },
    { $set: { legacyListingsCutoffAt: cutoff } }
  );

  console.log(`Initialized legacy listing cutoff for ${result.modifiedCount} store(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Store legacy listing cutoff migration failed:", error);
  await mongoose.disconnect();
  process.exitCode = 1;
});