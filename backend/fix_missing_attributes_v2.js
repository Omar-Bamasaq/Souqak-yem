
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const LOCAL_URI = "mongodb://127.0.0.1:27017";
const LOCAL_DB_NAME = "yemen_market";
const REMOTE_URI = process.env.MONGODB_URI;

async function migrate() {
  const localClient = new MongoClient(LOCAL_URI);
  const remoteClient = new MongoClient(REMOTE_URI);

  try {
    console.log("Connecting to clients...");
    await localClient.connect();
    await remoteClient.connect();
    console.log("Connected to both databases.");

    const localDb = localClient.db(LOCAL_DB_NAME);
    const remoteDb = remoteClient.db();

    const remoteCategories = await remoteDb.collection("categories").find().toArray();
    const localCategories = await localDb.collection("categories").find().toArray();
    
    const localToRemoteIdMap = new Map();
    for (const localCat of localCategories) {
      const remoteCat = remoteCategories.find(rc => rc.slug === localCat.slug);
      if (remoteCat) {
        localToRemoteIdMap.set(String(localCat._id), String(remoteCat._id));
      }
    }

    const localAttributes = await localDb.collection("categoryattributes").find().toArray();
    console.log(`Auditing ${localAttributes.length} local attributes...`);

    let attrMigrated = 0;
    let attrSkipped = 0;
    let categoryNotMatched = 0;

    for (const localAttr of localAttributes) {
      const remoteCategoryId = localToRemoteIdMap.get(String(localAttr.categoryId));
      
      if (!remoteCategoryId) {
        categoryNotMatched++;
        continue;
      }

      // Check for any attribute in this category with the same LABEL or NAME
      // Local names might be messy, labels are more likely to match user intent
      const existingAttr = await remoteDb.collection("categoryattributes").findOne({
        categoryId: new ObjectId(remoteCategoryId),
        $or: [
          { name: localAttr.name },
          { label: localAttr.label }
        ]
      });

      if (!existingAttr) {
        const { _id, ...attrData } = localAttr;
        attrData.categoryId = new ObjectId(remoteCategoryId);
        
        // Validation of type
        if (!["text", "number", "select", "boolean", "multiselect"].includes(attrData.type)) {
          attrData.type = "text";
        }

        await remoteDb.collection("categoryattributes").insertOne(attrData);
        attrMigrated++;
      } else {
        attrSkipped++;
      }
    }

    console.log(`\n--- Migration Summary ---`);
    console.log(`- ${attrMigrated} attributes migrated.`);
    console.log(`- ${attrSkipped} attributes already exist (matched by name or label).`);
    console.log(`- ${categoryNotMatched} attributes skipped (category slug not found).`);
    console.log(`------------------------\n`);

    // FINAL CHECK: List leaf categories that STILL have no attributes
    const remoteAttributesAfter = await remoteDb.collection("categoryattributes").find().toArray();
    const leafCategoriesWithNoAttrs = remoteCategories.filter(cat => {
      const hasChildren = remoteCategories.some(c => String(c.parentId) === String(cat._id));
      const hasAttrs = remoteAttributesAfter.some(a => String(a.categoryId) === String(cat._id));
      return !hasChildren && !hasAttrs;
    });

    if (leafCategoriesWithNoAttrs.length > 0) {
      console.log(`WARNING: ${leafCategoriesWithNoAttrs.length} leaf categories still have no attributes.`);
      console.log(`Example: ${leafCategoriesWithNoAttrs[0].name} (${leafCategoriesWithNoAttrs[0].slug})`);
      
      console.log("\nAttempting to copy attributes from sibling categories if possible...");
      let copiesMade = 0;
      for (const cat of leafCategoriesWithNoAttrs) {
        if (!cat.parentId) continue;
        
        // Find a sibling with attributes
        const sibling = remoteCategories.find(c => 
          String(c.parentId) === String(cat.parentId) && 
          String(c._id) !== String(cat._id) &&
          remoteAttributesAfter.some(a => String(a.categoryId) === String(c._id))
        );
        
        if (sibling) {
          const siblingAttrs = remoteAttributesAfter.filter(a => String(a.categoryId) === String(sibling._id));
          for (const sAttr of siblingAttrs) {
            const { _id, ...newData } = sAttr;
            newData.categoryId = cat._id;
            await remoteDb.collection("categoryattributes").insertOne(newData);
            copiesMade++;
          }
        }
      }
      console.log(`Applied ${copiesMade} inherited attributes from siblings.`);
    }

  } catch (err) {
    console.error("Migration Failed:", err);
  } finally {
    await localClient.close();
    await remoteClient.close();
  }
}

migrate();
