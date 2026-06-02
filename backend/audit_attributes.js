
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const REMOTE_URI = process.env.MONGODB_URI;

async function audit() {
  const client = new MongoClient(REMOTE_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const categories = await db.collection("categories").find().toArray();
    const attributes = await db.collection("categoryattributes").find().toArray();
    
    console.log(`Audit: ${categories.length} categories, ${attributes.length} attributes.`);
    
    // Find categories without attributes and without children
    const results = [];
    
    for (const cat of categories) {
      const hasChildren = categories.some(c => String(c.parentId) === String(cat._id));
      const catAttrs = attributes.filter(a => String(a.categoryId) === String(cat._id));
      
      // If it's a leaf category (no children) and has no attributes
      if (!hasChildren && catAttrs.length === 0) {
        results.push({
          name: cat.name,
          slug: cat.slug,
          parentId: cat.parentId
        });
      }
    }
    
    console.log(`Found ${results.length} leaf categories with NO attributes:`);
    results.slice(0, 20).forEach(r => console.log(`- ${r.name} (${r.slug})`));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
audit();
