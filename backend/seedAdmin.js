/*
How to run:
  node seedAdmin.js
*/
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(__dirname, "..", ".env.local");
const backendEnv = join(__dirname, ".env.local");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
dotenv.config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/yemen_market";
  await mongoose.connect(mongoUri);
  const adminEmail = "123@souqak.com";
  const adminPassword = "123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await User.findOne({
    $or: [{ role: "admin" }, { email: adminEmail }]
  });

  if (existingAdmin) {
    existingAdmin.name = "Main Admin";
    existingAdmin.email = adminEmail;
    existingAdmin.password = passwordHash;
    existingAdmin.role = "admin";
    existingAdmin.isEmailVerified = true;
    await existingAdmin.save();
    console.log(`Admin updated: ${existingAdmin.email}`);
  } else {
    const admin = await User.create({
      name: "Main Admin",
      email: adminEmail,
      password: passwordHash,
      role: "admin",
      isEmailVerified: true
    });
    console.log(`Admin created: ${admin.email}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Seeding failed:", err && err.message ? err.message : err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
