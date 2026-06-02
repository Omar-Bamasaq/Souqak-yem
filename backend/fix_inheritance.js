
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const REMOTE_URI = process.env.MONGODB_URI;

async function finalFix() {
  const client = new MongoClient(REMOTE_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const categories = await db.collection("categories").find().toArray();
    const attributes = await db.collection("categoryattributes").find().toArray();
    
    console.log(`Initial: ${categories.length} categories, ${attributes.length} attributes.`);
    
    let fixCount = 0;
    
    for (const cat of categories) {
      const hasChildren = categories.some(c => String(c.parentId) === String(cat._id));
      const catAttrs = attributes.filter(a => String(a.categoryId) === String(cat._id));
      
      if (!hasChildren && catAttrs.length === 0) {
        // Find closest ancestor with attributes
        let currentParentId = cat.parentId;
        let ancestorAttrs = [];
        
        while (currentParentId) {
          ancestorAttrs = attributes.filter(a => String(a.categoryId) === String(currentParentId));
          if (ancestorAttrs.length > 0) break;
          
          const parent = categories.find(c => String(c._id) === String(currentParentId));
          currentParentId = parent ? parent.parentId : null;
        }
        
        if (ancestorAttrs.length > 0) {
          console.log(`Inheriting ${ancestorAttrs.length} attributes for ${cat.name} from ancestor.`);
          for (const a of ancestorAttrs) {
            const { _id, ...newData } = a;
            newData.categoryId = cat._id;
            await db.collection("categoryattributes").insertOne(newData);
            fixCount++;
          }
        }
      }
    }
    
    console.log(`Fixed ${fixCount} missing attribute links via inheritance.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
finalFix();
