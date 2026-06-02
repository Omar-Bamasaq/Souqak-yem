
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const REMOTE_URI = process.env.MONGODB_URI;

async function checkFurniture() {
  const client = new MongoClient(REMOTE_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const categories = await db.collection("categories").find({
      $or: [{ slug: "furniture" }, { parentId: { $exists: true } }]
    }).toArray();
    
    const furniture = categories.find(c => c.slug === "furniture");
    if (furniture) {
      const subs = categories.filter(c => String(c.parentId) === String(furniture._id));
      console.log(`Furniture Subs found: ${subs.length}`);
      for (const s of subs) {
        const attrs = await db.collection("categoryattributes").find({ categoryId: s._id }).toArray();
        console.log(`- ${s.name} (${s._id}): ${attrs.length} attrs`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
checkFurniture();
