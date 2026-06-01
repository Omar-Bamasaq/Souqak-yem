import dotenv from "dotenv";
import { connectDB } from "../src/lib/mongodb.js";
import Ad from "../src/models/Ad.js";
import User from "../src/models/User.js";

dotenv.config({ path: process.env.ENV_PATH || ".env.local" });

async function main() {
  await connectDB();
  const ads = await Ad.find({})
    .populate({ path: "userId", select: "name email" })
    .lean();

  let ok = 0;
  let missing = [];

  for (const a of ads) {
    const name = a.userId?.name || null;
    if (name) ok++;
    else {
      const exists = a.userId ? true : false;
      missing.push({
        id: String(a._id),
        userId: String(a.userId || ""),
        exists,
      });
    }
  }

  console.log("Total ads:", ads.length);
  console.log("With user name:", ok);
  if (missing.length) {
    console.log("Missing user names count:", missing.length);
    console.table(missing.slice(0, 20));
  } else {
    console.log("All ads have populated user names.");
  }

  // Additional sanity check: ensure each ad's userId references an existing user
  const ids = ads.map((a) => a.userId).filter(Boolean);
  const uniqueIds = [...new Set(ids.map(String))];
  const users = await User.find({ _id: { $in: uniqueIds } }).select("_id name").lean();
  const userSet = new Set(users.map((u) => String(u._id)));
  const brokenRefs = uniqueIds.filter((id) => !userSet.has(String(id)));
  if (brokenRefs.length) {
    console.log("Broken user references:", brokenRefs.length);
    console.table(brokenRefs.slice(0, 20));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
