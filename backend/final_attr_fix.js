
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const REMOTE_URI = process.env.MONGODB_URI;

async function finalAuditAndFix() {
  const client = new MongoClient(REMOTE_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const categories = await db.collection("categories").find().toArray();
    const attributes = await db.collection("categoryattributes").find().toArray();
    
    console.log(`Initial: ${categories.length} categories, ${attributes.length} attributes.`);
    
    // 1. Find all parent categories that HAVE attributes in their children
    const parentSlugs = ["cars", "real-estate", "electronics", "furniture", "jobs", "animals", "fashion", "games-entertainment", "services", "tools-equipment", "special-vehicles", "travel-tourism", "stationery-school", "sports-equipment", "health-beauty", "books-magazines", "musical-instruments", "foodstuffs", "home-appliances"];
    
    let fixCount = 0;
    
    for (const slug of parentSlugs) {
      const parent = categories.find(c => c.slug === slug);
      if (!parent) continue;
      
      const children = categories.filter(c => String(c.parentId) === String(parent._id));
      
      // Find a child that HAS attributes to use as a template for siblings
      const childWithAttrs = children.find(c => attributes.some(a => String(a.categoryId) === String(c._id)));
      
      if (childWithAttrs) {
        const templateAttrs = attributes.filter(a => String(a.categoryId) === String(childWithAttrs._id));
        console.log(`\nParent: ${parent.name} (${slug}) - Using ${childWithAttrs.name} as template.`);
        
        const childrenMissingAttrs = children.filter(c => !attributes.some(a => String(a.categoryId) === String(c._id)));
        
        for (const target of childrenMissingAttrs) {
          console.log(`  -> Copying to ${target.name} (${target.slug})`);
          for (const tAttr of templateAttrs) {
            const { _id, ...newData } = tAttr;
            newData.categoryId = target._id;
            await db.collection("categoryattributes").insertOne(newData);
            fixCount++;
          }
        }
      } else {
        // If no child has attributes, maybe the parent should have some? 
        // Or we check the local DB for this specific slug's children.
      }
    }
    
    console.log(`\nFinal Fix Summary: Added ${fixCount} missing attribute links.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
finalAuditAndFix();
