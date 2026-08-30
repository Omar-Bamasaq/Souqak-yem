import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

const outputDir = path.join(backendRoot, "exports", "reference-data");
const localEnvPath = path.join(backendRoot, ".env.local");
const localDotenv = dotenv.config({ path: localEnvPath });

const env = {
  ...localDotenv.parsed,
  ...process.env,
};

const localUri =
  process.env.LOCAL_MONGODB_URI ||
  env.LOCAL_MONGODB_URI ||
  env.MONGODB_URI_LOCAL ||
  (localDotenv.parsed && localDotenv.parsed.MONGODB_URI) ||
  "mongodb://127.0.0.1:27017/yemen_market";

const TARGET_COLLECTIONS = [
  {
    name: "governorates",
    label: "المحافظات",
    fileName: "governorates.json",
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
    fileName: "cities.json",
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
    fileName: "categories.json",
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
    fileName: "categoryAttributes.json",
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

function ensureOutputDirectory() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function exportReferenceData() {
  const client = await connect(localUri);

  try {
    const db = client.db();
    console.log("Local DB:", localUri);
    console.log("Output directory:", outputDir);
    ensureOutputDirectory();

    const exportBundle = {
      exportedAt: new Date().toISOString(),
      sourceDatabase: db.databaseName,
      collections: {},
    };

    for (const collection of TARGET_COLLECTIONS) {
      const docs = await db.collection(collection.name).find({}).toArray();
      const prepared = collection.transform(docs);

      exportBundle.collections[collection.name] = prepared;
      writeJson(path.join(outputDir, collection.fileName), prepared);

      console.log(`✓ ${collection.label}: ${prepared.length} document(s) exported to ${collection.fileName}`);
    }

    const settings = await db.collection("systemsettings").findOne({}) || {};
    const prohibitedKeywords = settings.prohibitedKeywords || [];
    exportBundle.collections.systemsettings = { prohibitedKeywords };

    writeJson(path.join(outputDir, "systemSettings.json"), {
      prohibitedKeywords,
      updatedAt: settings.updatedAt || null,
      createdAt: settings.createdAt || null,
    });

    writeJson(path.join(outputDir, "reference-data-export.json"), exportBundle);

    console.log(`✓ الكلمات المحظورة: ${prohibitedKeywords.length} عنصر(ة) تم حفظها في systemSettings.json`);
    console.log("\nExport completed successfully.");
  } finally {
    await client.close();
  }
}

exportReferenceData().catch((error) => {
  console.error("\nExport failed:", error);
  process.exit(1);
});
