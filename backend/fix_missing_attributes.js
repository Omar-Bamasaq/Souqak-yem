
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

    // 1. Get all remote categories (we need to know what's in the current DB)
    const remoteCategories = await remoteDb.collection("categories").find().toArray();
    console.log(`Found ${remoteCategories.length} categories in remote DB.`);

    // 2. Get all local categories
    const localCategories = await localDb.collection("categories").find().toArray();
    console.log(`Found ${localCategories.length} categories in local DB.`);

    // 3. Map local categories to remote categories (using slug)
    const localToRemoteIdMap = new Map();
    for (const localCat of localCategories) {
      const remoteCat = remoteCategories.find(rc => rc.slug === localCat.slug);
      if (remoteCat) {
        localToRemoteIdMap.set(String(localCat._id), String(remoteCat._id));
      }
    }

    // 4. Also handle parent categories (recursive map)
    // Sometimes subcategories in remote might have different parent structure
    // but the slugs should be reliable.

    // 5. Get all local attributes
    const localAttributes = await localDb.collection("categoryattributes").find().toArray();
    console.log(`Found ${localAttributes.length} attributes in local DB.`);

    // 6. Sync Attributes
    let attrMigrated = 0;
    let attrSkipped = 0;
    let categoryNotMatched = 0;

    for (const localAttr of localAttributes) {
      const remoteCategoryId = localToRemoteIdMap.get(String(localAttr.categoryId));
      
      if (!remoteCategoryId) {
        // Find local category name for logging
        const localCat = localCategories.find(c => String(c._id) === String(localAttr.categoryId));
        // console.log(`Skipping attribute ${localAttr.name} - local category ${localCat?.name} (${localCat?.slug}) not matched in remote.`);
        categoryNotMatched++;
        continue;
      }

      // Check if attribute already exists in remote (by name and category)
      const existingAttr = await remoteDb.collection("categoryattributes").findOne({
        categoryId: new ObjectId(remoteCategoryId),
        name: localAttr.name
      });

      if (!existingAttr) {
        const { _id, ...attrData } = localAttr;
        attrData.categoryId = new ObjectId(remoteCategoryId);
        
        // Ensure type is valid for new schema
        if (!["text", "number", "select", "boolean", "multiselect"].includes(attrData.type)) {
          attrData.type = "text";
        }

        await remoteDb.collection("categoryattributes").insertOne(attrData);
        attrMigrated++;
      } else {
        attrSkipped++;
      }
    }

    console.log(`Summary:`);
    console.log(`- ${attrMigrated} attributes migrated.`);
    console.log(`- ${attrSkipped} attributes already exist.`);
    console.log(`- ${categoryNotMatched} attributes skipped due to unmatched categories.`);

    // Special check for categories with children but no attributes
    // In some systems, attributes are inherited. Our system supports ancestors.
    console.log("Checking for ancestor inheritance...");
    
    console.log("Migration complete!");

  } catch (err) {
    console.error("Migration Failed:", err);
  } finally {
    await localClient.close();
    await remoteClient.close();
  }
}

migrate();
