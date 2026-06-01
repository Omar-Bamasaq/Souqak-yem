import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const backendEnv = path.join(process.cwd(), ".env.local");
const rootEnv = path.join(process.cwd(), "..", ".env.local");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });
import bcrypt from "bcryptjs";
import { connectDB } from "./src/lib/mongodb.js";
import User from "./src/models/User.js";

async function run() {
  await connectDB();
  const email = process.env.SEED_SELLER_EMAIL || "seller@yemenmarket.com";
  const password = process.env.SEED_SELLER_PASSWORD || "Seller123";
  const phone = process.env.SEED_SELLER_PHONE || "777777777";
  const name = process.env.SEED_SELLER_NAME || "Seller Test";

  const existing = await User.findOne({ email }).lean();
  const hash = await bcrypt.hash(password, 10);
  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  if (!existing) {
    const created = await User.create({
      name,
      email,
      password: hash,
      role: "seller",
      phone,
      isPhoneVerified: true,
      idDocument: "ids/seeded.png",
      identityStatus: "Approved",
      isVerifiedSeller: true,
      verificationExpiresAt: oneYear
    });
    console.log("Seeded seller:", created.email);
  } else {
    await User.updateOne(
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
          verificationExpiresAt: oneYear
        }
      }
    );
    console.log("Updated seller:", email);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
