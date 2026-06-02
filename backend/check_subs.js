
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const REMOTE_URI = process.env.MONGODB_URI;

async function checkSubcategories() {
  const client = new MongoClient(REMOTE_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const categories = await db.collection("categories").find().toArray();
    const attributes = await db.collection("categoryattributes").find().toArray();
    
    // Check "Electronics" subcategories
    const electronics = categories.find(c => c.slug === "electronics");
    if (electronics) {
      console.log(`\nChecking subcategories of ${electronics.name}:`);
      const subs = categories.filter(c => String(c.parentId) === String(electronics._id));
      for (const s of subs) {
        const catAttrs = attributes.filter(a => String(a.categoryId) === String(s._id));
        console.log(`- ${s.name} (${s.slug}): ${catAttrs.length} attributes`);
      }
    }

    // Check "Furniture" subcategories
    const furniture = categories.find(c => c.slug === "furniture");
    if (furniture) {
      console.log(`\nChecking subcategories of ${furniture.name}:`);
      const subs = categories.filter(c => String(c.parentId) === String(furniture._id));
      for (const s of subs) {
        const catAttrs = attributes.filter(a => String(a.categoryId) === String(s._id));
        console.log(`- ${s.name} (${s.slug}): ${catAttrs.length} attributes`);
      }
    }

    // Check "Cars" subcategories
    const cars = categories.find(c => c.slug === "cars");
    if (cars) {
      console.log(`\nChecking subcategories of ${cars.name}:`);
      const subs = categories.filter(c => String(c.parentId) === String(cars._id));
      for (const s of subs) {
        const catAttrs = attributes.filter(a => String(a.categoryId) === String(s._id));
        console.log(`- ${s.name} (${s.slug}): ${catAttrs.length} attributes`);
      }
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
checkSubcategories();
