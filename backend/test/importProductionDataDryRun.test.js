import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DATASETS,
  buildDryRunReport,
  inspectImages,
  loadBundle,
  readReferenceCollections,
  renderMarkdownReport,
  validateBundle,
  validateDryRunTarget
} from "../scripts/lib/productionDataDryRun.js";
import { parseArguments, runDryRun } from "../scripts/importProductionData.mjs";

const exportedServiceName = "Sample service";

function makeBundle() {
  const bundle = {
    governorates: [{
      key: "governorate:one",
      name: "One",
      slug: "one",
      isActive: true
    }],
    cities: [{
      key: "city:one:town",
      name: "Town",
      governorateKey: "governorate:one",
      isActive: true,
      isDefault: false
    }],
    categories: [
      {
        key: "category:root",
        name: "Root",
        slug: "root",
        parentKey: null,
        description: "",
        image: "",
        icon: "",
        sortOrder: 1,
        status: "active"
      },
      {
        key: "category:child",
        name: "Child",
        slug: "child",
        parentKey: "category:root",
        description: "",
        image: "",
        icon: "",
        sortOrder: 1,
        status: "active"
      }
    ],
    categoryAttributes: [{
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
    }],
    digitalServiceCategories: [{
      key: "digital-service-category:software",
      name: "Software",
      slug: "software",
      description: "",
      image: "",
      sortOrder: 1,
      isActive: true,
      isArchived: false
    }],
    digitalServices: [{
      key: "digital-service:sample-service",
      name: exportedServiceName,
      description: "",
      image: "",
      categoryKey: "digital-service-category:software",
      serviceType: "OTHER",
      pricingType: "UNIT",
      currency: "YER_ADEN",
      unitPrice: 100,
      unitLabel: "unit",
      minimumQuantityEnabled: true,
      maximumQuantityEnabled: true,
      minimumQuantity: 1,
      maximumQuantity: 10,
      customerInfoLabel: "",
      sections: [],
      packages: [],
      formSchema: [],
      formSchemaVersion: 1,
      serviceVersion: 1,
      versionHistory: [],
      isActive: false,
      isArchived: false,
      sortOrder: 1
    }],
    serviceFeeSettings: [{
      key: "service-fee-settings:wallet-services",
      settingsKey: "wallet-services",
      feeBandVersion: 2,
      feeBands: []
    }]
  };
  const counts = Object.fromEntries(DATASETS.map(({ key, file }) => [file, bundle[key].length]));
  counts.packages = bundle.digitalServices.reduce((total, service) => total + service.packages.length, 0);
  counts.categoryRoots = bundle.categories.filter((category) => category.parentKey == null).length;
  counts.categoryChildren = bundle.categories.length - counts.categoryRoots;
  bundle.manifest = {
    project: "Souqak",
    sourceDatabase: "yemen_market",
    formatVersion: "1.0.0",
    exportedAt: "2026-01-01T00:00:00.000Z",
    counts,
    files: [
      ...DATASETS.map(({ file }) => ({ filename: file, role: "fixture" })),
      { filename: "manifest.json", role: "fixture" },
      { filename: "export-report.md", role: "fixture" }
    ],
    validation: {
      status: "ready_for_import",
      readyForImportTool: true,
      excludedService: { name: "excluded archived service" }
    }
  };
  return bundle;
}

function makeExisting(bundle) {
  return {
    governorates: [{
      _id: "gov-production",
      name: bundle.governorates[0].name,
      slug: bundle.governorates[0].slug,
      isActive: bundle.governorates[0].isActive
    }],
    cities: [{
      _id: "city-production",
      name: bundle.cities[0].name,
      governorateId: "gov-production",
      isActive: true,
      isDefault: false
    }],
    categories: [
      { _id: "root-production", ...bundle.categories[0], parentId: null },
      {
        _id: "child-production",
        ...bundle.categories[1],
        parentId: "root-production"
      }
    ],
    categoryAttributes: [{
      _id: "attribute-production",
      ...bundle.categoryAttributes[0],
      categoryId: "child-production"
    }],
    digitalServiceCategories: [{
      _id: "digital-category-production",
      ...bundle.digitalServiceCategories[0]
    }],
    digitalServices: [{
      _id: "service-production",
      ...bundle.digitalServices[0],
      categoryId: "digital-category-production"
    }],
    serviceFeeSettings: [{
      _id: "fee-production",
      key: bundle.serviceFeeSettings[0].settingsKey,
      feeBandVersion: bundle.serviceFeeSettings[0].feeBandVersion,
      feeBands: bundle.serviceFeeSettings[0].feeBands
    }]
  };
}

test("validates current export bundle record counts and references", async () => {
  const backendDirectory = path.resolve(import.meta.dirname, "..");
  const bundle = await loadBundle(path.join(backendDirectory, "exports", "production-data"));
  assert.deepEqual(bundle.validation.errors, []);
  assert.match(bundle.fingerprint.bundle, /^[a-f0-9]{64}$/);
  assert.equal(bundle.fingerprint.attestation, "computed_unattested");
  assert.equal(bundle.governorates.length, 21);
  assert.equal(bundle.cities.length, 427);
  assert.equal(bundle.categories.length, 153);
  assert.equal(bundle.categoryAttributes.length, 475);
  assert.equal(bundle.digitalServices.length, 23);
});

test("classifies exact reference matches without proposing updates", () => {
  const bundle = makeBundle();
  const report = buildDryRunReport(bundle, makeExisting(bundle), {
    generatedAt: "2026-01-01T00:00:00.000Z",
    target: { databaseName: "souqak_prelaunch_test", host: "127.0.0.1", port: "27018" }
  });
  for (const dataset of [
    "governorates",
    "cities",
    "categories",
    "categoryAttributes",
    "digitalServiceCategories",
    "serviceFeeSettings"
  ]) {
    assert.ok(report.groups[dataset].counts.matched > 0, dataset);
  }
  assert.equal(report.groups.digitalServices.counts.review, 1);
  assert.equal(report.groups.digitalServices.records[0].candidates[0].destinationId, "service-production");
  assert.equal(report.groups.digitalServices.records[0].destinationId, undefined);
  assert.equal(report.writeOperations, 0);
  assert.equal(report.readyForImport, false);
});

test("does not choose a service candidate based only on its name", () => {
  const bundle = makeBundle();
  const existing = makeExisting(bundle);
  existing.digitalServices = [{
    _id: "name-only-candidate",
    name: exportedServiceName,
    serviceType: "GAME_TOPUP",
    pricingType: "PACKAGE",
    currency: "USD",
    categoryId: "different-category",
    packages: []
  }];
  const report = buildDryRunReport(bundle, existing);
  const result = report.groups.digitalServices.records[0];
  assert.equal(result.status, "conflict");
  assert.equal(result.candidates.length, 0);
  assert.equal(result.nameOnlyCandidates[0].destinationId, "name-only-candidate");
  assert.equal(result.destinationId, undefined);
});

test("marks child relations unresolved when their parents are new", () => {
  const bundle = makeBundle();
  const report = buildDryRunReport(bundle, {
    governorates: [],
    cities: [],
    categories: [],
    categoryAttributes: [],
    digitalServiceCategories: [],
    digitalServices: [],
    serviceFeeSettings: []
  });
  assert.equal(report.groups.governorates.counts.new, 1);
  assert.equal(report.groups.cities.counts.unresolved, 1);
  assert.equal(report.groups.categories.counts.new, 1);
  assert.equal(report.groups.categories.counts.unresolved, 1);
  assert.equal(report.groups.categoryAttributes.counts.unresolved, 1);
  assert.ok(report.unresolvedRelations.some((item) => item.field === "parentKey"));
});

test("reports fee setting differences for review instead of replacing", () => {
  const bundle = makeBundle();
  const existing = makeExisting(bundle);
  existing.serviceFeeSettings[0].feeBandVersion = 1;
  const report = buildDryRunReport(bundle, existing);
  assert.equal(report.groups.serviceFeeSettings.counts.review, 1);
  assert.equal(report.groups.serviceFeeSettings.records[0].differences[0].field, "feeBandVersion");
});

test("rejects malformed package relationships and manifest totals", () => {
  const bundle = makeBundle();
  bundle.cities[0].governorateKey = "missing-governorate";
  bundle.manifest.counts.packages = 7;
  const { errors } = validateBundle(bundle);
  assert.ok(errors.some((error) => error.file === "cities.json"));
  assert.ok(errors.some((error) => error.file === "manifest.json"));
});

test("accepts only explicitly approved local prelaunch targets", () => {
  const target = validateDryRunTarget({
    uri: "mongodb://127.0.0.1:27018/souqak_prelaunch_test",
    databaseName: "souqak_prelaunch_test",
    approval: "YES"
  });
  assert.equal(target.hostname, "127.0.0.1");
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://db.example.com:27018/souqak_prelaunch_test",
    databaseName: "souqak_prelaunch_test",
    approval: "YES"
  }));
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://localhost:27018/souqak_prelaunch_test",
    databaseName: "souqak_prelaunch_test",
    approval: "YES"
  }));
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://127.0.0.1:27017/souqak_prelaunch_test",
    databaseName: "souqak_prelaunch_test",
    approval: "YES"
  }));
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://user:password@127.0.0.1:27018/souqak_prelaunch_test",
    databaseName: "souqak_prelaunch_test",
    approval: "YES"
  }));
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://127.0.0.1:27018/souqak_prelaunch_test?authSource=admin",
    databaseName: "souqak_prelaunch_test",
    approval: "YES"
  }));
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://127.0.0.1:27018/yemen_market",
    databaseName: "yemen_market",
    approval: "YES"
  }));
  assert.throws(() => validateDryRunTarget({
    uri: "mongodb://127.0.0.1:27018/souqak_prelaunch_test",
    databaseName: "souqak_prelaunch_test",
    approval: "YES",
    nodeEnv: "Production"
  }));
});

test("keeps write modes unavailable and reports outside the source bundle", () => {
  assert.throws(() => parseArguments(["--apply"]), /not implemented or available/);
  assert.throws(() => parseArguments(["--write"]), /not implemented or available/);
});

test("reads only allow-listed reference collections using find projections", async () => {
  const calls = [];
  const fakeDb = {
    collection(name) {
      return {
        find(filter, options) {
          calls.push({ name, filter, options });
          return { toArray: async () => [] };
        }
      };
    }
  };
  const result = await readReferenceCollections(fakeDb);
  assert.equal(calls.length, 7);
  assert.deepEqual(calls.map((call) => call.name), DATASETS.map((dataset) => dataset.collection));
  assert.ok(calls.every((call) => Object.keys(call.filter).length === 0));
  assert.ok(calls.every((call) => call.options.projection));
  assert.equal(Object.hasOwn(result, "digitalServices"), true);
});

test("checks image availability without changing paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-import-preview-"));
  try {
    await fs.mkdir(path.join(root, "uploads"), { recursive: true });
    await fs.writeFile(path.join(root, "uploads", "present.webp"), "fixture");
    const bundle = makeBundle();
    bundle.categories[0].image = "/uploads/present.webp";
    bundle.categories[1].image = "/uploads/missing.webp";
    bundle.digitalServiceCategories[0].image = "/uploads/../../outside.webp";
    const result = await inspectImages(bundle, root);
    assert.equal(result.checked, 3);
    assert.equal(result.present, 1);
    assert.equal(result.missing.length, 1);
    assert.equal(result.invalid.length, 1);
    assert.equal(bundle.categories[0].image, "/uploads/present.webp");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("produces a readable report and computes a deterministic data fingerprint", async () => {
  const bundle = makeBundle();
  const report = buildDryRunReport(bundle, null, { generatedAt: "2026-01-01T00:00:00.000Z" });
  const markdown = renderMarkdownReport(report);
  assert.match(markdown, /Dry Run|dry_run/);
  assert.match(markdown, /unresolved/);

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-fingerprint-"));
  try {
    for (const dataset of DATASETS) {
      await fs.writeFile(path.join(temp, dataset.file), "[]", "utf8");
    }
    await fs.writeFile(path.join(temp, "export-report.md"), "fixture", "utf8");
    const manifest = {
      project: "Souqak",
      sourceDatabase: "yemen_market",
      validation: { status: "ready_for_import", readyForImportTool: true },
      counts: {},
      files: [
        ...DATASETS.map(({ file }) => ({ filename: file })),
        { filename: "manifest.json" },
        { filename: "export-report.md" }
      ]
    };
    for (const dataset of DATASETS) manifest.counts[dataset.file] = 0;
    manifest.counts.packages = 0;
    manifest.counts.categoryRoots = 0;
    manifest.counts.categoryChildren = 0;
    await fs.writeFile(path.join(temp, "manifest.json"), JSON.stringify(manifest), "utf8");
    const loaded = await loadBundle(temp);
    const expectedHash = createHash("sha256");
    for (const dataset of [...Object.keys(loaded.fingerprint.files)].sort()) {
      expectedHash.update(dataset).update("\0").update(loaded.fingerprint.files[dataset]).update("\n");
    }
    expectedHash.update("manifest.json\0")
      .update(loaded.fingerprint.manifest)
      .update("\n");
    assert.equal(loaded.fingerprint.bundle, expectedHash.digest("hex"));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("writes offline preview reports outside the bundle without connecting", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-offline-run-"));
  const bundleDirectory = path.join(root, "bundle");
  const reportDirectory = path.join(root, "reports");
  try {
    await fs.mkdir(bundleDirectory, { recursive: true });
    const bundle = makeBundle();
    for (const dataset of DATASETS) {
      await fs.writeFile(
        path.join(bundleDirectory, dataset.file),
        `${JSON.stringify(bundle[dataset.key])}\n`,
        "utf8"
      );
    }
    await fs.writeFile(path.join(bundleDirectory, "manifest.json"), JSON.stringify(bundle.manifest), "utf8");
    await fs.writeFile(path.join(bundleDirectory, "export-report.md"), "fixture report", "utf8");

    const report = await runDryRun({
      argv: ["--bundle-dir", bundleDirectory, "--report-dir", reportDirectory],
      env: {},
      log() {}
    });
    assert.equal(report.databaseConnected, false);
    assert.equal(report.writeOperations, 0);
    assert.equal(report.readyForImport, false);
    const files = await fs.readdir(reportDirectory);
    assert.equal(files.length, 2);
    const jsonFile = files.find((filename) => filename.endsWith(".json"));
    const markdownFile = files.find((filename) => filename.endsWith(".md"));
    assert.ok(jsonFile);
    assert.ok(markdownFile);
    const savedReport = JSON.parse(await fs.readFile(path.join(reportDirectory, jsonFile), "utf8"));
    assert.equal(savedReport.databaseConnected, false);
    assert.match(await fs.readFile(path.join(reportDirectory, markdownFile), "utf8"), /dry_run/);
    assert.deepEqual((await fs.readdir(bundleDirectory)).sort(), [
      ...DATASETS.map(({ file }) => file),
      "export-report.md",
      "manifest.json"
    ].sort());
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
