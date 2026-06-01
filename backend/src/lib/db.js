import mongoose from "mongoose";

let cachedConn = null;
let connecting = null;

export async function connectDB(uri) {
  if (cachedConn) return cachedConn;
  if (!connecting) {
    const mongoUri = uri || process.env.MONGODB_URI || "mongodb://localhost:27017/yemen_market";
    mongoose.connection.on("connected", () => {
      console.log("mongo connected");
    });
    mongoose.connection.on("error", (e) => {
      console.error("mongo error", e && e.message ? e.message : String(e));
    });
    connecting = mongoose.connect(mongoUri, {});
  }
  cachedConn = await connecting;
  return cachedConn;
}

export default connectDB;
