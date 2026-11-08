import { fileURLToPath } from "url";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";
import {
  connectPrelaunchDatabase,
  resolvePrelaunchTarget,
  safeErrorSummary
} from "./src/lib/prelaunchDatabase.js";

function requireAdminApproval(env) {
  if (env.PRELAUNCH_ADMIN_APPROVED !== "YES") {
    throw new Error("PRELAUNCH_ADMIN_APPROVED=YES is required to create the initial administrator.");
  }
}

function readAdminCredentials(env) {
  const name = typeof env.PRELAUNCH_ADMIN_NAME === "string"
    ? env.PRELAUNCH_ADMIN_NAME.trim()
    : "";
  const email = typeof env.PRELAUNCH_ADMIN_EMAIL === "string"
    ? env.PRELAUNCH_ADMIN_EMAIL.trim().toLowerCase()
    : "";
  const password = typeof env.PRELAUNCH_ADMIN_PASSWORD === "string"
    ? env.PRELAUNCH_ADMIN_PASSWORD
    : "";

  if (!name || !email || !password) {
    throw new Error("PRELAUNCH_ADMIN_NAME, PRELAUNCH_ADMIN_EMAIL, and PRELAUNCH_ADMIN_PASSWORD are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("PRELAUNCH_ADMIN_EMAIL must be a valid email address.");
  }
  const passwordBytes = Buffer.byteLength(password, "utf8");
  if (passwordBytes < 16 || passwordBytes > 72) {
    throw new Error("PRELAUNCH_ADMIN_PASSWORD must be 16-72 UTF-8 bytes.");
  }

  return { name, email, password };
}

export async function createInitialAdmin({
  UserModel = User,
  passwordHasher = bcrypt.hash,
  env = process.env
} = {}) {
  requireAdminApproval(env);
  resolvePrelaunchTarget(env);
  const { name, email, password } = readAdminCredentials(env);
  if (typeof UserModel.createIndexes === "function") {
    await UserModel.createIndexes();
  }
  const existing = await UserModel.findOne({
    $or: [{ role: "admin" }, { email }]
  });
  if (existing) {
    throw new Error("Initial administrator creation is allowed only when no administrator or matching email exists.");
  }

  const passwordHash = await passwordHasher(password, 12);
  try {
    await UserModel.create({
      name,
      email,
      password: passwordHash,
      role: "admin",
      isInitialAdmin: true,
      isEmailVerified: true
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error("Initial administrator creation conflicted with an existing account.");
    }
    throw error;
  }

  return { created: true };
}

export async function run(env = process.env, connect = connectPrelaunchDatabase) {
  requireAdminApproval(env);
  resolvePrelaunchTarget(env);
  readAdminCredentials(env);
  await connect(env);
  try {
    await createInitialAdmin({ env });
    console.log("Initial administrator created.");
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    console.error("Initial administrator creation failed.", safeErrorSummary(error));
    process.exitCode = 1;
  });
}
