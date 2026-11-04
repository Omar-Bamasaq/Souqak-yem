import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    cached.conn = null;
    cached.promise = null;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4 to avoid localhost issues
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log("MongoDB Connected Successfully");
    return cached.conn;
  } catch (err) {
    cached.promise = null; // Reset promise so we can retry
    console.error("MongoDB Connection Error Details:", {
      message: err.message,
      code: err.code,
      name: err.name
    });
    throw err;
  }
}
