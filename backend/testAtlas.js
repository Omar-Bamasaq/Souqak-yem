
import mongoose from "mongoose";

const uri = "mongodb+srv://Omar:Om737338834er@cluster0.hmoanxo.mongodb.net/yemen_market?retryWrites=true&w=majority&appName=Cluster0";

async function test() {
  try {
    console.log("Testing Atlas connection...");
    await mongoose.connect(uri);
    console.log("Atlas Connected Successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Atlas Connection Failed:", err.message);
    process.exit(1);
  }
}

test();
