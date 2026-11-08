import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
const backendEnv = path.join(process.cwd(), ".env.local");
const rootEnv = path.join(process.cwd(), "..", ".env.local");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
import bcrypt from "bcryptjs";
import { connectDB } from "./src/lib/mongodb.js";
import User from "./src/models/User.js";

export function readSellerSeedConfig(env = process.env) {
  const password = env.SEED_SELLER_PASSWORD;
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("SEED_SELLER_PASSWORD is required; provide it securely in the environment.");
  }
  return {
    email: env.SEED_SELLER_EMAIL || "seller@yemenmarket.com",
    password,
    phone: env.SEED_SELLER_PHONE || "777777777",
    name: env.SEED_SELLER_NAME || "Seller Test"
  };
}

export async function run({
  env = process.env,
  connect = connectDB,
  disconnect = () => mongoose.disconnect(),
  UserModel = User,
  hashPassword = bcrypt.hash
} = {}) {
  const { email, password, phone, name } = readSellerSeedConfig(env);
  try {
    await connect();
    const verifiedAt = new Date();
    const existing = await UserModel.findOne({ email }).lean();
    const hash = await hashPassword(password, 10);
    const oneYear = new Date(verifiedAt.getTime() + 365 * 24 * 60 * 60 * 1000);

    if (!existing) {
      const created = await UserModel.create({
        name,
        email,
        password: hash,
        role: "seller",
        phone,
        isPhoneVerified: true,
        idDocument: "ids/seeded.png",
        identityStatus: "Approved",
        isVerifiedSeller: true,
        verificationExpiresAt: oneYear,
        verificationStatus: "verified",
        verificationDate: verifiedAt,
        verificationExpiryDate: oneYear
      });
      console.log("Seeded seller:", created.email);
    } else {
      await UserModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            name,
            password: hash,
            role: "seller",
            phone,
            isPhoneVerified: true,
            idDocument: existing.idDocument || "ids/seeded.png",
            identityStatus: "Approved",
            isVerifiedSeller: true,
            verificationExpiresAt: oneYear,
            verificationStatus: "verified",
            verificationDate: verifiedAt,
            verificationExpiryDate: oneYear
          }
        }
      );
      console.log("Updated seller:", email);
    }
  } finally {
    await disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
