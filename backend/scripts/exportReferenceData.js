import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

const localEnvPath = path.join(backendRoot, ".env.local");
const remoteEnvPath = path.join(backendRoot, ".env");

const localDotenv = dotenv.config({ path: localEnvPath });
const remoteDotenv = dotenv.config({ path: remoteEnvPath });

const env = {
  ...localDotenv.parsed,
  ...remoteDotenv.parsed,
  ...process.env,
};

const localUri =
  process.env.LOCAL_MONGODB_URI ||
  env.LOCAL_MONGODB_URI ||
  env.MONGODB_URI_LOCAL ||
  (localDotenv.parsed && localDotenv.parsed.MONGODB_URI) ||
  "mongodb://127.0.0.1:27017/yemen_market";

const remoteUri =
  process.env.REMOTE_MONGODB_URI ||
  env.REMOTE_MONGODB_URI ||
  (remoteDotenv.parsed && remoteDotenv.parsed.MONGODB_URI) ||
  process.env.MONGODB_URI;

if (!remoteUri) {
  throw new Error("REMOTE_MONGODB_URI or .env MONGODB_URI is required for the destination database.");
}

const TARGET_COLLECTIONS = [
  {
    name: "governorates",
    label: "المحافظات",
    transform: (docs) => docs.map(({ _id, name, slug, isActive, createdAt, updatedAt }) => ({
      _id,
      name,
      slug,
      isActive,
      createdAt,
      updatedAt,
    })),
  },
  {
    name: "cities",
    label: "المدن",
    transform: (docs) => docs.map(({ _id, name, governorateId, isActive, createdAt, updatedAt }) => ({
      _id,
      name,
      governorateId,
      isActive,
      createdAt,
      updatedAt,
    })),
  },
  {
    name: "categories",
    label: "الفئات",
    transform: (docs) => docs.map(({ _id, name, slug, image, parentId, description, sortOrder, status, adCount, icon, createdAt, updatedAt }) => ({
      _id,
      name,
      slug,
      image,
      parentId,
      description,
      sortOrder,
      status,
      adCount,
      icon,
      createdAt,
      updatedAt,
    })),
  },
  {
    name: "categoryattributes",
    label: "خصائص الفئات",
    transform: (docs) => docs.map(({ _id, categoryId, name, label, type, options, required, sortOrder, placeholder, helpText, validation, createdAt, updatedAt }) => ({
      _id,
      categoryId,
      name,
      label,
      type,
      options,
      required,
      sortOrder,
      placeholder,
      helpText,
      validation,
      createdAt,
      updatedAt,
    })),
  },
];

async function connect(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

async function exportTargetCollections() {
  const localClient = await connect(localUri);
  const remoteClient = await connect(remoteUri);

  try {
    const localDb = localClient.db();
    const remoteDb = remoteClient.db();

    console.log("\n[1/3] Local DB:", localClient.options?.srvHost || localUri);
    console.log("[2/3] Remote DB:", remoteClient.options?.srvHost || remoteUri);
    console.log("\n[3/3] Exporting only reference data...\n");

    for (const collection of TARGET_COLLECTIONS) {
      const docs = await localDb.collection(collection.name).find({}).toArray();
      const prepared = collection.transform(docs);

      const remoteCollection = remoteDb.collection(collection.name);
      await remoteCollection.deleteMany({});
      if (prepared.length > 0) {
        await remoteCollection.insertMany(prepared, { ordered: false });
      }

      console.log(`✓ ${collection.label}: ${prepared.length} document(s) copied.`);
    }

    const localSettings = await localDb.collection("systemsettings").findOne({});
    const remoteSettingsCollection = remoteDb.collection("systemsettings");
    const existingSettings = await remoteSettingsCollection.findOne({});

    const prohibitedKeywords = localSettings?.prohibitedKeywords || [];
    const mergedSettings = {
      ...(existingSettings || {}),
      ...(localSettings || {}),
      prohibitedKeywords,
    };

    if (existingSettings && existingSettings._id) {
      mergedSettings._id = existingSettings._id;
    }

    await remoteSettingsCollection.replaceOne(
      { _id: mergedSettings._id || new ObjectId() },
      mergedSettings,
      { upsert: true }
    );

    console.log(`✓ الكلمات المحظورة: ${prohibitedKeywords.length} عنصر(ة) تم تحديثها في systemsettings.`);
    console.log("\nExport completed successfully.");
  } finally {
    await localClient.close();
    await remoteClient.close();
  }
}

exportTargetCollections().catch((error) => {
  console.error("\nExport failed:", error);
  process.exit(1);
});
