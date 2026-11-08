import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import mongoose from "mongoose";
import { DATASETS } from "../scripts/lib/productionDataDryRun.js";
import { runDryRun } from "../scripts/importProductionData.mjs";

const enabled = process.env.RUN_IMPORT_DRY_RUN_MONGO_INTEGRATION === "YES";
const localMongoUri = "mongodb://127.0.0.1:27017/admin";
const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;

function objectId() {
  return new mongoose.Types.ObjectId();
}

function createSyntheticBundle() {
  const bundle = {
    governorates: [
      { key: "governorate:alpha", name: "Alpha", slug: "alpha", isActive: true },
      { key: "governorate:beta", name: "Beta", slug: "beta", isActive: true }
    ],
    cities: [
      { key: "city:alpha:old-town", name: "Old Town", governorateKey: "governorate:alpha", isActive: true, isDefault: false },
      { key: "city:alpha:new-town", name: "New Town", governorateKey: "governorate:alpha", isActive: true, isDefault: false }
    ],
    categories: [
      {
        key: "category:root",
        name: "Root",
        slug: "root-category",
        parentKey: null,
        description: "Root category",
        image: "",
        icon: "",
        sortOrder: 1,
        status: "active"
      },
      {
        key: "category:child",
        name: "Child",
        slug: "child-category",
        parentKey: "category:root",
        description: "Child category",
        image: "",
        icon: "",
        sortOrder: 1,
        status: "active"
      },
      {
        key: "category:review",
        name: "Review category",
        slug: "review-category",
        parentKey: null,
        description: "Current source description",
        image: "",
        icon: "",
        sortOrder: 2,
        status: "active"
      }
    ],
    categoryAttributes: [
      {
        key: "category-attribute:child:brand",
        categoryKey: "category:child",
        name: "brand",
        label: "Brand",
        type: "text",
        options: [],
        required: false,
        sortOrder: 1,
        placeholder: "",
        helpText: ""
      },
      {
        key: "category-attribute:child:model",
        categoryKey: "category:child",
        name: "model",
        label: "Model",
        type: "text",
        options: [],
        required: false,
        sortOrder: 2,
        placeholder: "",
        helpText: ""
      }
    ],
    digitalServiceCategories: [
      {
        key: "digital-service-category:software",
        name: "Software",
        slug: "software",
        description: "Software",
        image: "",
        sortOrder: 1,
        isActive: true,
        isArchived: false
      },
      {
        key: "digital-service-category:games",
        name: "Games",
        slug: "games",
        description: "Games",
        image: "",
        sortOrder: 2,
        isActive: true,
        isArchived: false
      }
    ],
    digitalServices: [{
      key: "digital-service:sample-subscription",
      name: "Sample subscription",
      description: "Synthetic only",
      image: "",
      categoryKey: "digital-service-category:software",
      serviceType: "OTHER",
      pricingType: "PACKAGE",
      currency: "USD",
      unitLabel: "unit",
      minimumQuantityEnabled: true,
      maximumQuantityEnabled: true,
      minimumQuantity: 1,
      maximumQuantity: 10,
      customerInfoLabel: "",
      sections: [],
      packages: [{
        id: "sample-package",
        name: "Sample package",
        description: "",
        price: 5,
        currency: "USD",
        isActive: true,
        sortOrder: 0
      }],
      formSchema: [],
      formSchemaVersion: 1,
      serviceVersion: 1,
      versionHistory: [],
      isActive: true,
      isArchived: false,
      sortOrder: 1
    }],
    serviceFeeSettings: [{
      key: "service-fee-settings:wallet-services",
      settingsKey: "wallet-services",
      feeBandVersion: 2,
      feeBands: [{
        currency: "YER_ADEN",
        minimumAmount: 0,
        maximumAmount: MAX_SAFE_AMOUNT,
        feeAmount: 0
      }]
    }]
  };
  const counts = Object.fromEntries(
    DATASETS.map(({ key, file }) => [file, bundle[key].length])
  );
  counts.packages = bundle.digitalServices.reduce(
    (total, service) => total + service.packages.length,
    0
  );
  counts.categoryRoots = bundle.categories.filter((record) => record.parentKey == null).length;
  counts.categoryChildren = bundle.categories.length - counts.categoryRoots;
  bundle.manifest = {
    project: "Souqak",
    sourceDatabase: "yemen_market",
    formatVersion: "1.0.0",
    exportedAt: "2026-01-01T00:00:00.000Z",
    counts,
    files: [
      ...DATASETS.map(({ file }) => ({ filename: file, role: "synthetic integration fixture" })),
      { filename: "manifest.json", role: "synthetic integration fixture" },
      { filename: "export-report.md", role: "synthetic integration fixture" }
    ],
    validation: {
      status: "ready_for_import",
      readyForImportTool: true,
      excludedService: { name: "excluded fixture service" }
    }
  };
  return bundle;
}

function createTargetFixture(bundle) {
  const alphaId = objectId();
  const rootId = objectId();
  const childId = objectId();
  const reviewCategoryId = objectId();
  const softwareId = objectId();
  const cityId = objectId();
  const attributeId = objectId();
  const serviceIds = [objectId(), objectId()];
  const existingPackage = {
    id: "sample-package",
    name: "Sample package",
    description: "",
    price: 5,
    currency: "USD",
    isActive: true,
    sortOrder: 0
  };
  return {
    governorates: [{
      _id: alphaId,
      name: "Alpha",
      slug: "alpha",
      isActive: true
    }],
    cities: [{
      _id: cityId,
      name: "Old Town",
      governorateId: alphaId,
      isActive: true,
      isDefault: false
    }],
    categories: [
      {
        _id: rootId,
        name: "Root",
        slug: "root-category",
        parentId: null,
        description: "Root category",
        image: "",
        icon: "",
        sortOrder: 1,
        status: "active",
        adCount: 0
      },
      {
        _id: childId,
        name: "Child",
        slug: "child-category",
        parentId: rootId,
        description: "Child category",
        image: "",
        icon: "",
        sortOrder: 1,
        status: "active",
        adCount: 0
      },
      {
        _id: reviewCategoryId,
        name: "Review category",
        slug: "review-category",
        parentId: null,
        description: "Existing production-style description",
        image: "",
        icon: "",
        sortOrder: 2,
        status: "active",
        adCount: 0
      }
    ],
    categoryAttributes: [{
      _id: attributeId,
      categoryId: childId,
      name: "brand",
      label: "Brand",
      type: "text",
      options: [],
      required: false,
      sortOrder: 1,
      placeholder: "",
      helpText: ""
    }],
    digitalServiceCategories: [{
      _id: softwareId,
      name: "Software",
      slug: "software",
      description: "Software",
      image: "",
      sortOrder: 1,
      isActive: true,
      isArchived: false
    }],
    digitalServices: serviceIds.map((_id) => ({
      _id,
      name: bundle.digitalServices[0].name,
      description: "Synthetic existing service",
      image: "",
      categoryId: softwareId,
      serviceType: "OTHER",
      pricingType: "PACKAGE",
      currency: "USD",
      packages: [existingPackage],
      formSchema: [],
      isActive: true,
      isArchived: false
    })),
    serviceFeeSettings: [{
      _id: objectId(),
      key: "wallet-services",
      feeBandVersion: 1,
      feeBands: [{
        currency: "YER_ADEN",
        minimumAmount: 0,
        maximumAmount: MAX_SAFE_AMOUNT,
        feeAmount: 1
      }]
    }]
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    if (value._bsontype === "ObjectId") return value.toHexString();
    if (Buffer.isBuffer(value)) return value.toString("base64");
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function summarizeSnapshot(snapshot) {
  const collectionCounts = Object.fromEntries(
    Object.entries(snapshot).map(([name, value]) => [name, value.count])
  );
  return {
    collectionCounts,
    documentTotal: Object.values(snapshot).reduce((total, value) => total + value.count, 0),
    indexTotal: Object.values(snapshot).reduce((total, value) => total + value.indexes.length, 0)
  };
}

async function databaseSnapshot(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const result = {};
  for (const { name } of collections.sort((left, right) => left.name.localeCompare(right.name))) {
    const collection = db.collection(name);
    const documents = await collection.find({}).sort({ _id: 1 }).toArray();
    const indexes = await collection.listIndexes().toArray();
    result[name] = {
      count: await collection.countDocuments({}),
      documents: stable(documents),
      indexes: stable(indexes)
    };
  }
  return result;
}

async function writeSyntheticBundle(directory, bundle, { invalidRelation = false } = {}) {
  const output = structuredClone(bundle);
  if (invalidRelation) output.cities[0].governorateKey = "governorate:missing";
  for (const dataset of DATASETS) {
    await fs.writeFile(
      path.join(directory, dataset.file),
      `${JSON.stringify(output[dataset.key], null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  }
  await fs.writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(output.manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  await fs.writeFile(path.join(directory, "export-report.md"), "# Synthetic integration fixture\n", {
    encoding: "utf8",
    flag: "wx"
  });
}

function createLoopbackProxy() {
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: "127.0.0.1", port: 27017 });
    client.pipe(upstream);
    upstream.pipe(client);
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", close);
    upstream.on("error", close);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve({ server, port: server.address().port });
    });
  });
}

async function getUnusedDatabaseName(adminDb) {
  const names = new Set((await adminDb.admin().listDatabases({ nameOnly: true })).databases
    .map((database) => database.name));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const candidate = `souqak_prelaunch_import_test_${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate an unused test database name.");
}

test("MongoDB integration dry-run is read-only against fresh synthetic local database", {
  skip: !enabled && "Set RUN_IMPORT_DRY_RUN_MONGO_INTEGRATION=YES to run against local MongoDB."
}, async () => {
  const setup = new mongoose.Mongoose();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-import-mongo-test-"));
  let proxy;
  let databaseName;
  let testDb;
  try {
    await setup.connect(localMongoUri, {
      directConnection: true,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 5000
    });
    databaseName = await getUnusedDatabaseName(setup.connection.db);
    testDb = setup.connection.useDb(databaseName).db;
    const bundle = createSyntheticBundle();
    const fixture = createTargetFixture(bundle);

    for (const dataset of DATASETS) {
      await testDb.collection(dataset.collection).insertMany(fixture[dataset.key]);
    }
    await testDb.collection("governorates").createIndex({ name: 1 }, { unique: true });
    await testDb.collection("governorates").createIndex({ slug: 1 }, { unique: true, sparse: true });
    await testDb.collection("cities").createIndex(
      { governorateId: 1, name: 1 },
      { unique: true }
    );
    await testDb.collection("categories").createIndex({ slug: 1 }, { unique: true });
    await testDb.collection("categories").createIndex({ parentId: 1, sortOrder: 1 });
    await testDb.collection("categoryattributes").createIndex(
      { categoryId: 1, name: 1 },
      { unique: true }
    );
    await testDb.collection("digitalservicecategories").createIndex({ slug: 1 }, { unique: true });
    await testDb.collection("walletservicefeesettings").createIndex({ key: 1 }, { unique: true });
    await testDb.collection("walletservices").createIndex({ categoryId: 1, isActive: 1, isArchived: 1, sortOrder: 1 });

    const before = await databaseSnapshot(testDb);
    const bundleDirectory = path.join(tempRoot, "valid-bundle");
    const reportDirectory = path.join(tempRoot, "valid-reports");
    await fs.mkdir(bundleDirectory);
    await writeSyntheticBundle(bundleDirectory, bundle);
    proxy = await createLoopbackProxy();

    const report = await runDryRun({
      argv: ["--bundle-dir", bundleDirectory, "--report-dir", reportDirectory],
      env: {
        IMPORT_DRY_RUN_MONGODB_URI: `mongodb://127.0.0.1:${proxy.port}/${databaseName}?directConnection=true`,
        IMPORT_DRY_RUN_DATABASE_NAME: databaseName,
        IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED: "YES",
        NODE_ENV: "test"
      },
      log() {}
    });
    const after = await databaseSnapshot(testDb);

    assert.equal(report.databaseConnected, true);
    assert.equal(report.target.databaseName, databaseName);
    assert.equal(report.writeOperations, 0);
    assert.deepEqual(after, before, "all collection documents and indexes must remain byte-equivalent");
    assert.deepEqual(Object.keys(after).sort(), DATASETS.map((item) => item.collection).sort());

    assert.equal(report.groups.governorates.counts.matched, 1);
    assert.equal(report.groups.governorates.counts.new, 1);
    assert.equal(report.groups.cities.counts.matched, 1);
    assert.equal(report.groups.cities.counts.new, 1);
    assert.equal(report.groups.categories.counts.matched, 2);
    assert.equal(report.groups.categories.counts.review, 1);
    assert.equal(report.groups.categoryAttributes.counts.matched, 1);
    assert.equal(report.groups.categoryAttributes.counts.new, 1);
    assert.equal(report.groups.digitalServiceCategories.counts.matched, 1);
    assert.equal(report.groups.digitalServiceCategories.counts.new, 1);
    assert.equal(report.groups.digitalServices.counts.review, 1);
    assert.equal(report.groups.digitalServices.records[0].candidates.length, 2);
    assert.equal(report.groups.digitalServices.records[0].destinationId, undefined);
    assert.equal(report.groups.serviceFeeSettings.counts.review, 1);
    assert.ok(report.groups.serviceFeeSettings.records[0].differences.length > 0);

    const invalidBundleDirectory = path.join(tempRoot, "invalid-bundle");
    const invalidReportDirectory = path.join(tempRoot, "invalid-reports");
    await fs.mkdir(invalidBundleDirectory);
    await fs.mkdir(invalidReportDirectory);
    await writeSyntheticBundle(invalidBundleDirectory, bundle, { invalidRelation: true });
    const invalidReport = await runDryRun({
      argv: ["--bundle-dir", invalidBundleDirectory, "--report-dir", invalidReportDirectory],
      env: {
        IMPORT_DRY_RUN_MONGODB_URI: `mongodb://127.0.0.1:${proxy.port}/${databaseName}?directConnection=true`,
        IMPORT_DRY_RUN_DATABASE_NAME: databaseName,
        IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED: "YES",
        NODE_ENV: "test"
      },
      log() {}
    });
    const afterInvalidRun = await databaseSnapshot(testDb);
    assert.equal(invalidReport.databaseConnected, false);
    assert.ok(invalidReport.bundle.validation.errors.some((error) =>
      error.file === "cities.json" && error.message.includes("governorate:missing")
    ));
    assert.deepEqual(afterInvalidRun, before);

    for (const [label, expected, actual] of [
      ["initial", before, before],
      ["after valid run", before, after],
      ["after invalid relation run", before, afterInvalidRun]
    ]) {
      assert.deepEqual(actual, expected, `${label}: database snapshot`);
    }

    const reports = await fs.readdir(reportDirectory);
    assert.equal(reports.length, 2, "the preview writes only filesystem reports, outside MongoDB");
    assert.equal((await testDb.listCollections({}, { nameOnly: true }).toArray()).length, 7);
    console.log(JSON.stringify({
      databaseName,
      databasePort: proxy.port,
      beforeAfterEqual: true,
      before: summarizeSnapshot(before),
      after: summarizeSnapshot(after),
      indexesUnchanged: true,
      validScenarioCounts: Object.fromEntries(Object.entries(report.groups).map(([name, group]) => [name, group.counts])),
      serviceCandidates: report.groups.digitalServices.records[0].candidates.map((candidate) => candidate.destinationId),
      invalidRelationErrors: invalidReport.bundle.validation.errors.length,
      invalidRunDatabaseConnected: invalidReport.databaseConnected,
      reportFilesOutsideDatabase: reports.length,
      writeOperations: report.writeOperations
    }, null, 2));
  } finally {
    if (proxy?.server) await new Promise((resolve) => proxy.server.close(resolve));
    if (setup.connection.readyState !== 0) await setup.disconnect();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
