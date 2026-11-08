import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  normalizeFormSchema,
  normalizeWalletServicePackages
} from "../../src/utils/walletServiceDynamicConfig.js";
import {
  normalizeFeeBands,
  WALLET_SERVICE_CURRENCIES
} from "../../src/utils/walletServicePricing.js";

export const DATASETS = Object.freeze([
  { key: "governorates", file: "governorates.json", collection: "governorates" },
  { key: "cities", file: "cities.json", collection: "cities" },
  { key: "categories", file: "categories.json", collection: "categories" },
  { key: "categoryAttributes", file: "category-attributes.json", collection: "categoryattributes" },
  { key: "digitalServiceCategories", file: "digital-service-categories.json", collection: "digitalservicecategories" },
  { key: "digitalServices", file: "digital-services.json", collection: "walletservices" },
  { key: "serviceFeeSettings", file: "service-fee-settings.json", collection: "walletservicefeesettings" }
]);

export const STATUS_NAMES = Object.freeze([
  "new",
  "matched",
  "review",
  "conflict",
  "error",
  "unresolved"
]);

const DATA_FILE_NAMES = DATASETS.map(({ file }) => file);
const EXPECTED_FILE_NAMES = [
  ...DATA_FILE_NAMES,
  "manifest.json",
  "export-report.md"
];
const RESERVED_DATABASE_NAMES = new Set([
  "marketplace",
  "suqaq",
  "yemen_market",
  "yemen-market",
  "yemen-market-beta"
]);
const DATABASE_NAME_PATTERN = /^souqak_prelaunch_[a-z0-9_]{1,46}$/;

const PROJECTIONS = Object.freeze({
  governorates: { name: 1, slug: 1, isActive: 1 },
  cities: { name: 1, governorateId: 1, isActive: 1, isDefault: 1 },
  categories: { name: 1, slug: 1, parentId: 1, image: 1, description: 1, sortOrder: 1, status: 1, icon: 1 },
  categoryattributes: {
    categoryId: 1,
    name: 1,
    label: 1,
    type: 1,
    options: 1,
    required: 1,
    sortOrder: 1,
    placeholder: 1,
    helpText: 1,
    validation: 1
  },
  digitalservicecategories: {
    name: 1,
    slug: 1,
    description: 1,
    image: 1,
    sortOrder: 1,
    isActive: 1,
    isArchived: 1
  },
  walletservices: {
    name: 1,
    description: 1,
    image: 1,
    categoryId: 1,
    serviceType: 1,
    pricingType: 1,
    currency: 1,
    unitPrice: 1,
    packages: 1,
    formSchema: 1,
    isActive: 1,
    isArchived: 1
  },
  walletservicefeesettings: { key: 1, feeBands: 1, feeBandVersion: 1 }
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function sourceId(record) {
  return record?._id == null ? null : String(record._id);
}

function countStatuses(records = []) {
  const counts = Object.fromEntries(STATUS_NAMES.map((status) => [status, 0]));
  for (const record of records) {
    if (Object.hasOwn(counts, record.status)) counts[record.status] += 1;
  }
  return counts;
}

function newGroup(key, file) {
  return { key, file, counts: countStatuses(), records: [] };
}

function addResult(group, result) {
  group.records.push(result);
  group.counts[result.status] += 1;
  return result;
}

function makeError(message, file, recordKey = null) {
  return { status: "error", key: recordKey, file, message };
}

function checkKeyUniqueness(records, label, file, errors) {
  const seen = new Set();
  for (const record of records) {
    if (typeof record?.key !== "string" || !record.key.trim()) {
      errors.push(makeError("المفتاح الثابت مفقود أو غير صالح.", file));
      continue;
    }
    if (seen.has(record.key)) {
      errors.push(makeError(`المفتاح الثابت مكرر ضمن ${label}.`, file, record.key));
    }
    seen.add(record.key);
  }
}

function compareFields(source, existing, fields) {
  return fields
    .filter(([sourceField, targetField = sourceField]) =>
      !sameValue(source[sourceField] ?? null, existing[targetField] ?? null)
    )
    .map(([sourceField, targetField = sourceField]) => ({
      field: sourceField,
      source: source[sourceField] ?? null,
      existing: existing[targetField] ?? null
    }));
}

function findDistinctById(records) {
  return [...new Map(records.map((record) => [sourceId(record), record])).values()];
}

function compareUniqueNaturalKey({
  source,
  candidates,
  identityMatches,
  fields,
  group,
  conflictMessage
}) {
  const matches = findDistinctById(candidates);
  if (matches.length > 1) {
    return addResult(group, {
      key: source.key,
      name: source.name,
      status: "conflict",
      candidates: matches.map(sourceId),
      conflicts: [conflictMessage]
    });
  }
  if (matches.length === 0) {
    return addResult(group, { key: source.key, name: source.name, status: "new" });
  }

  const existing = matches[0];
  const differences = compareFields(source, existing, fields);
  const isExactIdentity = identityMatches(existing);
  return addResult(group, {
    key: source.key,
    name: source.name,
    status: !isExactIdentity ? "review" : differences.length ? "review" : "matched",
    destinationId: sourceId(existing),
    differences,
    ...(isExactIdentity ? {} : { conflicts: ["تطابق أحد مفاتيح الهوية فقط؛ يلزم تأكيد المطابقة."] })
  });
}

function sourceRecords(bundle, key) {
  return Array.isArray(bundle?.[key])
    ? bundle[key].filter((record) => record && typeof record === "object" && !Array.isArray(record))
    : [];
}

function validateRecordFields(bundle, errors) {
  const requiredFields = {
    governorates: ["key", "name"],
    cities: ["key", "name", "governorateKey"],
    categories: ["key", "name", "slug"],
    categoryAttributes: ["key", "categoryKey", "name", "label", "type"],
    digitalServiceCategories: ["key", "name", "slug"],
    digitalServices: ["key", "name", "categoryKey", "serviceType", "pricingType", "currency"],
    serviceFeeSettings: ["key", "settingsKey", "feeBands"]
  };
  for (const [dataset, fields] of Object.entries(requiredFields)) {
    const file = DATASETS.find((item) => item.key === dataset).file;
    for (const record of sourceRecords(bundle, dataset)) {
      const missing = fields.filter((field) => record[field] === undefined || record[field] === null);
      if (missing.length) {
        errors.push(makeError(`حقول مطلوبة مفقودة: ${missing.join(", ")}.`, file, record.key ?? null));
      }
    }
  }
}

function validatePackageRelations(bundle, errors) {
  const governorateKeys = new Set(sourceRecords(bundle, "governorates").map((record) => record.key));
  const categoryKeys = new Set(sourceRecords(bundle, "categories").map((record) => record.key));
  const digitalCategoryKeys = new Set(
    sourceRecords(bundle, "digitalServiceCategories").map((record) => record.key)
  );
  const checks = [
    ["cities", "governorateKey", governorateKeys, "المحافظة"],
    ["categoryAttributes", "categoryKey", categoryKeys, "الفئة"],
    ["digitalServices", "categoryKey", digitalCategoryKeys, "تصنيف الخدمة"]
  ];
  for (const [dataset, field, keys, label] of checks) {
    const file = DATASETS.find((item) => item.key === dataset).file;
    for (const record of sourceRecords(bundle, dataset)) {
      if (record[field] != null && !keys.has(record[field])) {
        errors.push(makeError(`علاقة ${label} غير موجودة في الحزمة: ${record[field]}.`, file, record.key));
      }
    }
  }
  for (const record of sourceRecords(bundle, "categories")) {
    if (record.parentKey != null && !categoryKeys.has(record.parentKey)) {
      errors.push(makeError(`الفئة الأب غير موجودة في الحزمة: ${record.parentKey}.`, "categories.json", record.key));
    }
  }
}

function validateDomainData(bundle, errors) {
  for (const record of sourceRecords(bundle, "governorates")) {
    if (typeof record.name !== "string" || !record.name.trim()
      || (record.slug != null && typeof record.slug !== "string")
      || typeof record.isActive !== "boolean") {
      errors.push(makeError("حقول المحافظة لا تطابق نموذج Mongoose.", "governorates.json", record.key));
    }
  }
  for (const record of sourceRecords(bundle, "cities")) {
    if (typeof record.name !== "string" || !record.name.trim()
      || (record.isActive !== undefined && typeof record.isActive !== "boolean")
      || (record.isDefault !== undefined && typeof record.isDefault !== "boolean")) {
      errors.push(makeError("حقول المدينة لا تطابق نموذج Mongoose.", "cities.json", record.key));
    }
  }
  for (const record of sourceRecords(bundle, "categories")) {
    if (typeof record.name !== "string" || !record.name.trim()
      || typeof record.slug !== "string" || !record.slug
      || !Number.isSafeInteger(record.sortOrder)
      || !["active", "hidden"].includes(record.status)) {
      errors.push(makeError("حقول الفئة لا تطابق نموذج Mongoose.", "categories.json", record.key));
    }
  }
  for (const record of sourceRecords(bundle, "categoryAttributes")) {
    if (!["text", "number", "select", "boolean", "multiselect"].includes(record.type)) {
      errors.push(makeError("نوع خاصية الفئة غير مدعوم في نموذج Mongoose.", "category-attributes.json", record.key));
    }
    if (record.options != null && !Array.isArray(record.options)
      || typeof record.required !== "boolean"
      || !Number.isSafeInteger(record.sortOrder)) {
      errors.push(makeError("خيارات خاصية الفئة يجب أن تكون قائمة.", "category-attributes.json", record.key));
    }
    if (Array.isArray(record.options) && record.options.some((option) => typeof option !== "string")) {
      errors.push(makeError("خيارات خاصية الفئة يجب أن تكون نصوصًا.", "category-attributes.json", record.key));
    }
    if (record.validation != null
      && (typeof record.validation !== "object"
        || Array.isArray(record.validation)
        || Object.keys(record.validation).some((key) => !["min", "max", "pattern"].includes(key))
        || ["min", "max"].some((key) =>
          record.validation[key] !== undefined && !Number.isFinite(record.validation[key])
        )
        || (record.validation.pattern !== undefined && typeof record.validation.pattern !== "string"))) {
      errors.push(makeError("قواعد تحقق خاصية الفئة غير صالحة.", "category-attributes.json", record.key));
    }
  }

  for (const record of sourceRecords(bundle, "digitalServiceCategories")) {
    if (typeof record.name !== "string" || !record.name.trim()
      || typeof record.slug !== "string"
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug)
      || record.slug.length > 80
      || typeof record.isActive !== "boolean"
      || typeof record.isArchived !== "boolean") {
      errors.push(makeError("حقول تصنيف الخدمات لا تطابق نموذج Mongoose.", "digital-service-categories.json", record.key));
    }
  }

  for (const record of sourceRecords(bundle, "digitalServices")) {
    try {
      normalizeFormSchema(record.formSchema || []);
      normalizeWalletServicePackages(record.packages || [], record.currency);
      if (!WALLET_SERVICE_CURRENCIES.includes(record.currency)) {
        throw new Error("عملة الخدمة غير مدعومة.");
      }
      if (typeof record.name !== "string" || !record.name.trim() || record.name.length > 120
        || typeof record.isActive !== "boolean" || typeof record.isArchived !== "boolean"
        || !Number.isSafeInteger(record.serviceVersion) || record.serviceVersion < 1
        || !Number.isSafeInteger(record.formSchemaVersion) || record.formSchemaVersion < 1
        || !Number.isSafeInteger(record.sortOrder)
        || typeof record.unitLabel !== "string" || !record.unitLabel.trim() || record.unitLabel.length > 40
        || typeof record.minimumQuantityEnabled !== "boolean"
        || typeof record.maximumQuantityEnabled !== "boolean"
        || !Number.isInteger(record.minimumQuantity) || record.minimumQuantity < 1
        || !Number.isInteger(record.maximumQuantity) || record.maximumQuantity < 1
        || (record.minimumQuantityEnabled && record.maximumQuantityEnabled
          && record.maximumQuantity < record.minimumQuantity)) {
        throw new Error("حقول الخدمة أو إصداراتها لا تطابق نموذج Mongoose.");
      }
      if (!["AI_TOOL", "GAME_TOPUP", "SOFTWARE", "ENTERTAINMENT", "DIGITAL_CARD", "OTHER"]
        .includes(record.serviceType)) {
        throw new Error("نوع الخدمة غير مدعوم.");
      }
      if (!["FIXED", "UNIT", "PACKAGE"].includes(record.pricingType)) {
        throw new Error("طريقة التسعير غير مدعومة.");
      }
      if (record.pricingType === "FIXED" && !Number.isFinite(record.unitPrice)) {
        throw new Error("سعر الخدمة الثابت غير صالح.");
      }
      if (["FIXED", "UNIT"].includes(record.pricingType)
        && !(record.sections || []).length
        && (!Number.isFinite(record.unitPrice) || record.unitPrice < 0)) {
        throw new Error("سعر الوحدة مطلوب للخدمة دون أقسام.");
      }
      if (record.pricingType === "PACKAGE"
        && (!(record.packages || []).length || (record.sections || []).length)) {
        throw new Error("خدمة الباقات تحتاج باقة واحدة على الأقل ولا تقبل أقسامًا.");
      }
      if (record.pricingType !== "PACKAGE" && (record.packages || []).length) {
        throw new Error("الباقات لا تتوافق مع طريقة التسعير.");
      }
      if (!Array.isArray(record.sections) || record.sections.length > 100
        || record.sections.some((section) =>
          !section || typeof section !== "object" || Array.isArray(section)
          || typeof section.name !== "string" || !section.name.trim()
          || section.name.length > 100 || !Number.isFinite(section.unitPrice)
          || section.unitPrice < 0
        )) {
        throw new Error("أقسام الخدمة غير صالحة.");
      }
      if (record.unitPrice !== undefined && record.unitPrice !== null
        && (!Number.isFinite(record.unitPrice) || record.unitPrice < 0)) {
        throw new Error("سعر الوحدة غير صالح.");
      }
      if (record.pricingType === "PACKAGE" && record.isActive
        && !(record.packages || []).some((item) => item.isActive)) {
        throw new Error("الخدمة النشطة لا تحتوي على باقة نشطة.");
      }
      if (!Array.isArray(record.versionHistory)
        || record.versionHistory.some((entry) =>
          !entry || typeof entry !== "object" || Array.isArray(entry)
          || !Number.isSafeInteger(entry.version) || entry.version < 1
          || !entry.snapshot || typeof entry.snapshot !== "object" || Array.isArray(entry.snapshot)
        )) {
        throw new Error("سجل إصدارات الخدمة غير صالح.");
      }
    } catch (error) {
      errors.push(makeError(error.message, "digital-services.json", record.key));
    }
  }

  for (const record of sourceRecords(bundle, "serviceFeeSettings")) {
    try {
      normalizeFeeBands(record.feeBands || []);
      if (!Number.isSafeInteger(record.feeBandVersion) || record.feeBandVersion < 1) {
        throw new Error("إصدار شرائح الرسوم غير صالح.");
      }
    } catch (error) {
      errors.push(makeError(error.message, "service-fee-settings.json", record.key));
    }
  }
}

export function validateBundle(bundle) {
  const errors = [];
  if (!bundle?.manifest || typeof bundle.manifest !== "object") {
    return { errors: [makeError("ملف manifest.json مفقود أو غير صالح.", "manifest.json")] };
  }
  if (bundle.manifest.project !== "Souqak" || bundle.manifest.sourceDatabase !== "yemen_market") {
    errors.push(makeError("اسم المشروع أو قاعدة المصدر في manifest غير معتمد.", "manifest.json"));
  }
  if (bundle.manifest.validation?.status !== "ready_for_import"
    || bundle.manifest.validation?.readyForImportTool !== true) {
    errors.push(makeError("الحزمة لا تحمل حالة تحقق ready_for_import.", "manifest.json"));
  }
  const declaredNames = Array.isArray(bundle.manifest.files)
    ? bundle.manifest.files.map((file) => file?.filename).filter((filename) => typeof filename === "string")
    : [];
  if (!Array.isArray(bundle.manifest.files)) {
    errors.push(makeError("manifest.files يجب أن تكون قائمة ملفات.", "manifest.json"));
  }
  if (new Set(declaredNames).size !== declaredNames.length) {
    errors.push(makeError("هناك أسماء ملفات مكررة في manifest.files.", "manifest.json"));
  }
  for (const filename of EXPECTED_FILE_NAMES) {
    if (!declaredNames.includes(filename)) {
      errors.push(makeError(`الملف غير مدرج في manifest.files: ${filename}.`, "manifest.json"));
    }
  }

  for (const dataset of DATASETS) {
    const rows = bundle[dataset.key];
    if (!Array.isArray(rows)) {
      errors.push(makeError(`ملف ${dataset.file} مفقود أو لا يحتوي قائمة JSON.`, dataset.file));
      continue;
    }
    for (const [index, record] of rows.entries()) {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        errors.push(makeError("كل سجل في ملف البيانات يجب أن يكون كائن JSON.", dataset.file, String(index)));
      }
    }
    if (bundle.manifest.counts?.[dataset.file] !== rows.length) {
      errors.push(makeError(
        `عدد السجلات لا يطابق manifest: ${rows.length} مقابل ${bundle.manifest.counts?.[dataset.file]}.`,
        dataset.file
      ));
    }
    checkKeyUniqueness(rows, dataset.key, dataset.file, errors);
  }

  const categories = sourceRecords(bundle, "categories");
  const services = sourceRecords(bundle, "digitalServices");
  const packageCount = services.reduce((total, service) =>
    total + (Array.isArray(service.packages) ? service.packages.length : 0), 0);
  const categoryRoots = categories.filter((record) => record.parentKey == null).length;
  const categoryChildren = categories.length - categoryRoots;
  if (bundle.manifest.counts?.packages !== packageCount
    || bundle.manifest.counts?.categoryRoots !== categoryRoots
    || bundle.manifest.counts?.categoryChildren !== categoryChildren) {
    errors.push(makeError("أعداد الباقات أو مستويات الفئات لا تطابق بيانات الحزمة.", "manifest.json"));
  }

  const excludedName = bundle.manifest.validation?.excludedService?.name;
  if (excludedName && services.some((record) => record.name === excludedName)) {
    errors.push(makeError("الخدمة المستبعدة بقرار معتمد موجودة ضمن بيانات الاستيراد.", "digital-services.json"));
  }

  validateRecordFields(bundle, errors);
  validatePackageRelations(bundle, errors);
  validateDomainData(bundle, errors);
  return { errors };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function loadBundle(bundleDirectory) {
  const manifestBuffer = await fs.readFile(path.join(bundleDirectory, "manifest.json"));
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBuffer));
  } catch {
    throw new Error("manifest.json is not valid UTF-8 JSON.");
  }

  const bundle = { manifest };
  const fileHashes = {};
  const errors = [];
  try {
    const reportBuffer = await fs.readFile(path.join(bundleDirectory, "export-report.md"));
    new TextDecoder("utf-8", { fatal: true }).decode(reportBuffer);
    fileHashes["export-report.md"] = sha256(reportBuffer);
  } catch (error) {
    errors.push(makeError(
      error.code === "ENOENT"
        ? "ملف export-report.md غير موجود."
        : "ملف export-report.md ليس UTF-8 صالحًا.",
      "export-report.md"
    ));
  }
  for (const dataset of DATASETS) {
    try {
      const buffer = await fs.readFile(path.join(bundleDirectory, dataset.file));
      fileHashes[dataset.file] = sha256(buffer);
      bundle[dataset.key] = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    } catch (error) {
      if (error.code === "ENOENT") {
        errors.push(makeError(`ملف الحزمة غير موجود: ${dataset.file}.`, dataset.file));
      } else {
        errors.push(makeError(`تعذر قراءة أو تحليل JSON: ${error.message}`, dataset.file));
      }
    }
  }

  const declaredFiles = new Set(Array.isArray(manifest.files)
    ? manifest.files.map((file) => file?.filename).filter((filename) => typeof filename === "string")
    : []);
  for (const filename of [...DATA_FILE_NAMES, "manifest.json", "export-report.md"]) {
    if (!declaredFiles.has(filename)) {
      errors.push(makeError(`الملف غير معلن في manifest.files: ${filename}.`, "manifest.json"));
    }
  }

  const hashNames = Object.keys(fileHashes).sort();
  const fingerprintHash = createHash("sha256");
  for (const filename of hashNames) {
    fingerprintHash.update(filename);
    fingerprintHash.update("\0");
    fingerprintHash.update(fileHashes[filename]);
    fingerprintHash.update("\n");
  }
  const fingerprint = {
    algorithm: "sha256",
    manifest: sha256(manifestBuffer),
    files: fileHashes,
    bundle: fingerprintHash.update("manifest.json\0")
      .update(sha256(manifestBuffer))
      .update("\n")
      .digest("hex"),
    attestation: manifest.integrity?.dataFiles ? "manifest" : "computed_unattested"
  };

  if (manifest.integrity?.dataFiles) {
    for (const filename of DATA_FILE_NAMES) {
      if (manifest.integrity.dataFiles[filename] !== fileHashes[filename]) {
        errors.push(makeError(`SHA-256 لا يطابق بصمة manifest: ${filename}.`, "manifest.json"));
      }
    }
  }
  const validation = validateBundle(bundle);
  return {
    ...bundle,
    validation: { errors: [...errors, ...validation.errors] },
    fingerprint
  };
}

function resolveGovId(record, governorateResults) {
  const result = governorateResults.get(record.governorateKey);
  if (!result || !result.destinationId) return null;
  return result.destinationId;
}

function classifyGovernorates(bundle, existing) {
  const group = newGroup("governorates", "governorates.json");
  const results = new Map();
  for (const source of sourceRecords(bundle, "governorates")) {
    const nameMatches = existing.filter((record) => record.name === source.name);
    const slugMatches = source.slug
      ? existing.filter((record) => record.slug === source.slug)
      : [];
    const candidates = findDistinctById([...nameMatches, ...slugMatches]);
    const result = compareUniqueNaturalKey({
      source,
      candidates,
      identityMatches: (record) => record.name === source.name && record.slug === source.slug,
      fields: [["name"], ["slug"], ["isActive"]],
      group,
      conflictMessage: "أكثر من سجل يستخدم اسم المحافظة أو slug نفسه."
    });
    if (candidates.length === 1 && (nameMatches.length || slugMatches.length)) {
      results.set(source.key, result);
    }
  }
  return { group, results };
}

function classifyCities(bundle, existing, governorateResults) {
  const group = newGroup("cities", "cities.json");
  for (const source of sourceRecords(bundle, "cities")) {
    const effectiveSource = {
      ...source,
      isActive: source.isActive ?? true,
      isDefault: source.isDefault ?? false
    };
    const governorateId = resolveGovId(source, governorateResults);
    if (!governorateId) {
      addResult(group, {
        key: source.key,
        name: source.name,
        status: "unresolved",
        unresolvedRelations: [{ field: "governorateKey", key: source.governorateKey }]
      });
      continue;
    }
    const candidates = existing.filter((record) =>
      String(record.governorateId) === governorateId && record.name === source.name
    ).map((record) => ({
      ...record,
      isActive: record.isActive ?? true,
      isDefault: record.isDefault ?? false
    }));
    compareUniqueNaturalKey({
      source: effectiveSource,
      candidates,
      identityMatches: (record) =>
        String(record.governorateId) === governorateId && record.name === source.name,
      fields: [["name"], ["isActive"], ["isDefault"]].filter(([field]) =>
        !candidates[0] || candidates[0][field] !== undefined
      ),
      group,
      conflictMessage: "تكرار مدينة داخل المحافظة المستهدفة؛ راجع المجموعة أو الفهرس الفريد."
    });
  }
  return group;
}

function categoryOrder(bundle) {
  const records = sourceRecords(bundle, "categories");
  const byKey = new Map(records.map((record) => [record.key, record]));
  const ordered = [];
  const states = new Map();
  const cyclic = new Set();
  function visit(record) {
    const state = states.get(record.key);
    if (state === "done") return;
    if (state === "visiting") {
      cyclic.add(record.key);
      return;
    }
    states.set(record.key, "visiting");
    if (record.parentKey && byKey.has(record.parentKey)) {
      visit(byKey.get(record.parentKey));
      if (states.get(record.parentKey) === "visiting") cyclic.add(record.key);
    }
    states.set(record.key, "done");
    ordered.push(record);
  }
  for (const record of records) visit(record);
  return { ordered, cyclic };
}

function classifyCategories(bundle, existing) {
  const group = newGroup("categories", "categories.json");
  const results = new Map();
  const { ordered, cyclic } = categoryOrder(bundle);
  for (const source of ordered) {
    if (cyclic.has(source.key)) {
      results.set(source.key, addResult(group, {
        key: source.key,
        name: source.name,
        status: "unresolved",
        unresolvedRelations: [{ field: "parentKey", key: source.parentKey }],
        conflicts: ["دورة في علاقات الفئات."]
      }));
      continue;
    }
    const parentResult = source.parentKey == null ? null : results.get(source.parentKey);
    if (source.parentKey != null && (!parentResult || !parentResult.destinationId)) {
      results.set(source.key, addResult(group, {
        key: source.key,
        name: source.name,
        status: "unresolved",
        unresolvedRelations: [{ field: "parentKey", key: source.parentKey }]
      }));
      continue;
    }
    const parentId = parentResult?.destinationId ?? null;
    const slugMatches = existing.filter((record) => record.slug === source.slug);
    const sameNameSameParent = existing.filter((record) =>
      record.name === source.name && (record.parentId == null ? null : String(record.parentId)) === parentId
    );
    const candidates = findDistinctById([...slugMatches, ...sameNameSameParent]);
    if (slugMatches.length === 1
      && (slugMatches[0].parentId == null ? null : String(slugMatches[0].parentId)) !== parentId) {
      results.set(source.key, addResult(group, {
        key: source.key,
        name: source.name,
        status: "conflict",
        candidates: [sourceId(slugMatches[0])],
        conflicts: ["slug الفئة موجود لكن ارتباط الفئة الأب مختلف."]
      }));
      continue;
    }
    const result = compareUniqueNaturalKey({
      source,
      candidates,
      identityMatches: (record) =>
        record.slug === source.slug
        && (record.parentId == null ? null : String(record.parentId)) === parentId,
      fields: [["name"], ["slug"], ["description"], ["image"], ["icon"], ["sortOrder"], ["status"]],
      group,
      conflictMessage: "تطابق slug أو الاسم والأب مع أكثر من فئة إنتاجية."
    });
    if (candidates.length === 1 && !slugMatches.length) {
      result.status = "conflict";
      result.conflicts = ["اسم الفئة والأب متطابقان لكن slug مختلف؛ لا توجد مطابقة آلية آمنة."];
      group.counts.review -= 1;
      group.counts.conflict += 1;
    }
    results.set(source.key, result);
  }
  return { group, results };
}

function classifyCategoryAttributes(bundle, existing, categoryResults) {
  const group = newGroup("categoryAttributes", "category-attributes.json");
  for (const source of sourceRecords(bundle, "categoryAttributes")) {
    const categoryResult = categoryResults.get(source.categoryKey);
    if (!categoryResult?.destinationId) {
      addResult(group, {
        key: source.key,
        name: source.name,
        status: "unresolved",
        unresolvedRelations: [{ field: "categoryKey", key: source.categoryKey }]
      });
      continue;
    }
    const candidates = existing.filter((record) =>
      String(record.categoryId) === categoryResult.destinationId && record.name === source.name
    );
    compareUniqueNaturalKey({
      source,
      candidates,
      identityMatches: (record) =>
        String(record.categoryId) === categoryResult.destinationId && record.name === source.name,
      fields: [
        ["name"], ["label"], ["type"], ["options"], ["required"], ["sortOrder"],
        ["placeholder"], ["helpText"], ["validation"]
      ],
      group,
      conflictMessage: "توجد تعريفات خصائص مكررة للفئة والاسم نفسيهما."
    });
  }
  return group;
}

function classifyDigitalCategories(bundle, existing) {
  const group = newGroup("digitalServiceCategories", "digital-service-categories.json");
  const results = new Map();
  for (const source of sourceRecords(bundle, "digitalServiceCategories")) {
    const candidates = existing.filter((record) => record.slug === source.slug);
    const result = compareUniqueNaturalKey({
      source,
      candidates,
      identityMatches: (record) => record.slug === source.slug,
      fields: [
        ["name"], ["slug"], ["description"], ["image"], ["sortOrder"], ["isActive"], ["isArchived"]
      ],
      group,
      conflictMessage: "slug تصنيف الخدمات الرقمية مكرر في قاعدة الهدف."
    });
    if (candidates.length === 1) results.set(source.key, result);
  }
  return { group, results };
}

function serviceCandidateSignals(source, target, resolvedCategoryId) {
  const sourcePackageIds = new Set((source.packages || []).map((item) => item.id));
  const targetPackageIds = new Set((target.packages || []).map((item) => item.id));
  const packageOverlap = [...sourcePackageIds].filter((id) => targetPackageIds.has(id));
  const signals = {
    sameName: source.name === target.name,
    sameServiceType: source.serviceType === target.serviceType,
    samePricingType: source.pricingType === target.pricingType,
    sameCurrency: source.currency === target.currency,
    sameCategory: Boolean(resolvedCategoryId)
      && String(target.categoryId || "") === resolvedCategoryId,
    packageIdOverlap: packageOverlap
  };
  const score = Number(signals.sameName)
    + Number(signals.sameServiceType)
    + Number(signals.samePricingType)
    + Number(signals.sameCurrency)
    + Number(signals.sameCategory)
    + Math.min(packageOverlap.length, 3);
  return { signals, score, strong: score >= 3 && (signals.sameName || packageOverlap.length > 0) };
}

function classifyDigitalServices(bundle, existing, categoryResults) {
  const group = newGroup("digitalServices", "digital-services.json");
  for (const source of sourceRecords(bundle, "digitalServices")) {
    const categoryResult = categoryResults.get(source.categoryKey);
    const resolvedCategoryId = categoryResult?.destinationId ?? null;
    const scored = existing.map((target) => ({
      destinationId: sourceId(target),
      name: target.name,
      ...serviceCandidateSignals(source, target, resolvedCategoryId)
    }));
    const candidates = scored.filter((candidate) => candidate.strong)
      .sort((left, right) => right.score - left.score);
    const nameOnlyCandidates = scored.filter((candidate) =>
      candidate.signals.sameName && !candidate.strong
    );
    const unresolvedRelations = resolvedCategoryId
      ? []
      : [{ field: "categoryKey", key: source.categoryKey }];
    addResult(group, {
      key: source.key,
      name: source.name,
      status: candidates.length ? "review" : "conflict",
      candidates,
      nameOnlyCandidates,
      unresolvedRelations,
      conflicts: candidates.length
        ? ["مرشحو الخدمة للعرض فقط؛ لم تُعتمد مطابقة تلقائية لغياب مفتاح فريد في النموذج."]
        : ["تعذر تحديد هوية الخدمة بأمان؛ يلزم تعيين يدوي ولا يُعتد بالاسم وحده."]
    });
  }
  return group;
}

function classifyFeeSettings(bundle, existing) {
  const group = newGroup("serviceFeeSettings", "service-fee-settings.json");
  for (const source of sourceRecords(bundle, "serviceFeeSettings")) {
    const candidates = existing.filter((record) => record.key === source.settingsKey);
    compareUniqueNaturalKey({
      source,
      candidates,
      identityMatches: (record) => record.key === source.settingsKey,
      fields: [["settingsKey", "key"], ["feeBandVersion"], ["feeBands"]],
      group,
      conflictMessage: "يوجد أكثر من سجل إعداد رسوم بالمفتاح نفسه."
    });
  }
  return group;
}

function normalizeExisting(existing = {}) {
  return Object.fromEntries(DATASETS.map(({ key }) => [
    key,
    Array.isArray(existing[key]) ? existing[key] : []
  ]));
}

export function buildDryRunReport(bundle, existing = null, options = {}) {
  const validation = bundle.validation || validateBundle(bundle);
  if (!existing) {
    const groups = {};
    for (const dataset of DATASETS) {
      const group = newGroup(dataset.key, dataset.file);
      for (const record of sourceRecords(bundle, dataset.key)) {
        addResult(group, {
          key: record.key,
          name: record.name,
          status: "unresolved",
          conflicts: ["לא توجد قاعدة هدف متصلة؛ لم تتم مطابقة السجل."]
        });
      }
      groups[dataset.key] = group;
    }
    if (validation.errors.length) {
      groups.bundle = newGroup("bundle", "manifest.json");
      for (const error of validation.errors) addResult(groups.bundle, error);
    }
    return {
      mode: "dry_run",
      databaseConnected: false,
      target: null,
      generatedAt: options.generatedAt || new Date().toISOString(),
      bundle: {
        project: bundle.manifest?.project ?? null,
        sourceDatabase: bundle.manifest?.sourceDatabase ?? null,
        formatVersion: bundle.manifest?.formatVersion ?? null,
        exportedAt: bundle.manifest?.exportedAt ?? null,
        fingerprint: bundle.fingerprint || null,
        validation: {
          status: validation.errors.length ? "failed" : "passed",
          errors: validation.errors
        }
      },
      groups,
      totalCounts: countStatuses(Object.values(groups).flatMap((group) => group.records)),
      unresolvedRelations: [],
      images: options.images || { checked: 0, present: 0, missing: [], invalid: [], external: [] },
      warnings: [
        "لم يُحدد هدف محلي؛ تم فحص الحزمة فقط ولم تُنفذ مطابقة مع قاعدة بيانات.",
        ...(options.warnings || [])
      ],
      writeOperations: 0,
      readyForImport: false
    };
  }
  const target = normalizeExisting(existing || {});
  const groups = {};
  const governorates = classifyGovernorates(bundle, target.governorates);
  groups.governorates = governorates.group;
  groups.cities = classifyCities(bundle, target.cities, governorates.results);
  const categories = classifyCategories(bundle, target.categories);
  groups.categories = categories.group;
  groups.categoryAttributes = classifyCategoryAttributes(
    bundle,
    target.categoryAttributes,
    categories.results
  );
  const digitalCategories = classifyDigitalCategories(bundle, target.digitalServiceCategories);
  groups.digitalServiceCategories = digitalCategories.group;
  groups.digitalServices = classifyDigitalServices(
    bundle,
    target.digitalServices,
    digitalCategories.results
  );
  groups.serviceFeeSettings = classifyFeeSettings(bundle, target.serviceFeeSettings);

  if (validation.errors.length) {
    groups.bundle = newGroup("bundle", "manifest.json");
    for (const error of validation.errors) addResult(groups.bundle, error);
  }

  const totalCounts = countStatuses(Object.values(groups).flatMap((group) => group.records));
  const errors = validation.errors;
  const unresolvedRelations = Object.values(groups).flatMap((group) =>
    group.records.flatMap((record) => (record.unresolvedRelations || []).map((relation) => ({
      dataset: group.key,
      key: record.key,
      ...relation
    })))
  );
  return {
    mode: "dry_run",
    databaseConnected: true,
    target: options.target || null,
    generatedAt: options.generatedAt || new Date().toISOString(),
    bundle: {
      project: bundle.manifest?.project ?? null,
      sourceDatabase: bundle.manifest?.sourceDatabase ?? null,
      formatVersion: bundle.manifest?.formatVersion ?? null,
      exportedAt: bundle.manifest?.exportedAt ?? null,
      fingerprint: bundle.fingerprint || null,
      validation: {
        status: errors.length ? "failed" : "passed",
        errors
      }
    },
    groups,
    totalCounts,
    unresolvedRelations,
    images: options.images || { checked: 0, present: 0, missing: [], invalid: [], external: [] },
    warnings: options.warnings || [],
    writeOperations: 0,
    readyForImport: errors.length === 0
      && totalCounts.error === 0
      && totalCounts.review === 0
      && totalCounts.conflict === 0
      && totalCounts.unresolved === 0
      && (options.images?.missing?.length || 0) === 0
      && (options.images?.invalid?.length || 0) === 0
  };
}

export function validateDryRunTarget({ uri, databaseName, approval, nodeEnv = "" }) {
  if (typeof uri !== "string" || !uri.trim()
    || typeof databaseName !== "string" || !databaseName.trim()
    || approval !== "YES") {
    throw new Error("A local target URI, database name, and IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED=YES are required.");
  }
  if (String(nodeEnv).toLowerCase() === "production") {
    throw new Error("Dry-run target connections are disabled when NODE_ENV=production.");
  }
  if (!DATABASE_NAME_PATTERN.test(databaseName) || RESERVED_DATABASE_NAMES.has(databaseName)) {
    throw new Error("Dry-run connections are restricted to explicitly named souqak_prelaunch_* databases.");
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("The dry-run target URI is invalid.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "mongodb:"
    || !["127.0.0.1", "[::1]"].includes(hostname)
    || !parsed.port
    || parsed.port === "27017"
    || parsed.host.includes(",")
    || parsed.username
    || parsed.password
    || [...parsed.searchParams.keys()].some((key) => key !== "directConnection")
    || (parsed.searchParams.has("directConnection")
      && parsed.searchParams.get("directConnection") !== "true")
    || parsed.searchParams.has("replicaSet")
    || parsed.searchParams.has("loadBalanced")
    || parsed.searchParams.get("directConnection") === "false"
    || parsed.searchParams.has("dbName")
    || parsed.hash) {
    throw new Error("Dry-run database connections are restricted to one direct local, non-default MongoDB endpoint.");
  }
  let uriDatabaseName;
  try {
    uriDatabaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("The dry-run target URI has an invalid database path.");
  }
  if (uriDatabaseName !== databaseName || RESERVED_DATABASE_NAMES.has(uriDatabaseName)) {
    throw new Error("The URI database path must match the approved local prelaunch database name.");
  }
  return {
    uri,
    databaseName,
    hostname,
    port: parsed.port
  };
}

export async function readReferenceCollections(db) {
  const result = {};
  for (const dataset of DATASETS) {
    const projection = PROJECTIONS[dataset.collection];
    result[dataset.key] = await db.collection(dataset.collection)
      .find({}, { projection })
      .toArray();
  }
  return result;
}

function imageEntries(bundle) {
  const candidates = [
    ["categories", "image"],
    ["digitalServiceCategories", "image"],
    ["digitalServices", "image"]
  ];
  return candidates.flatMap(([dataset, field]) =>
    sourceRecords(bundle, dataset)
      .filter((record) => typeof record[field] === "string" && record[field].trim())
      .map((record) => ({
        dataset,
        key: record.key,
        name: record.name,
        path: record[field]
      }))
  );
}

export async function inspectImages(bundle, backendDirectory) {
  const report = { checked: 0, present: 0, missing: [], invalid: [], external: [] };
  const uploadsDirectory = path.resolve(backendDirectory, "uploads");
  for (const entry of imageEntries(bundle)) {
    report.checked += 1;
    if (/^https?:\/\//i.test(entry.path)) {
      report.external.push({ ...entry, reason: "مسار خارجي؛ لا يمكن التحقق منه محليًا." });
      continue;
    }
    if (!entry.path.startsWith("/uploads/") || entry.path.includes("\0")) {
      report.invalid.push({ ...entry, reason: "مسار الصورة ليس مسار uploads محليًا معتمدًا." });
      continue;
    }
    const resolved = path.resolve(backendDirectory, `.${entry.path}`);
    const relative = path.relative(uploadsDirectory, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      report.invalid.push({ ...entry, reason: "مسار الصورة يخرج عن مجلد uploads." });
      continue;
    }
    try {
      const actualPath = await fs.realpath(resolved);
      const actualRelative = path.relative(uploadsDirectory, actualPath);
      if (actualRelative.startsWith("..") || path.isAbsolute(actualRelative)) {
        report.invalid.push({ ...entry, reason: "مسار الصورة يشير إلى ملف خارج مجلد uploads." });
        continue;
      }
      const stat = await fs.stat(actualPath);
      if (!stat.isFile()) throw new Error("ليس ملفًا.");
      report.present += 1;
    } catch {
      report.missing.push({ ...entry, reason: "ملف الصورة غير موجود محليًا." });
    }
  }
  return report;
}

function markdownCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderMarkdownReport(report) {
  const lines = [
    "# تقرير معاينة استيراد بيانات سوقك",
    "",
    `- الوضع: \`${report.mode}\``,
    `- وقت الإنشاء: ${report.generatedAt}`,
    `- قاعدة الهدف: ${report.target?.databaseName || "لم يتم الاتصال بقاعدة بيانات"}`,
    `- اتصال قاعدة البيانات: ${report.databaseConnected ? "نعم (هدف محلي معتمد)" : "لا"}`,
    `- عدد عمليات الكتابة: ${report.writeOperations}`,
    `- بصمة الحزمة SHA-256: \`${report.bundle.fingerprint?.bundle || "غير متاحة"}\``,
    `- حالة البصمة: \`${report.bundle.fingerprint?.attestation || "غير متاحة"}\``,
    `- حالة تحقق الحزمة: \`${report.bundle.validation.status}\``,
    "",
    "## النتائج حسب المجموعة",
    "",
    "| المجموعة | جديد | مطابق | مراجعة | تعارض | خطأ | علاقة غير محلولة |",
    "|---|---:|---:|---:|---:|---:|---:|"
  ];
  for (const [key, group] of Object.entries(report.groups)) {
    const unresolvedRelations = group.records.reduce(
      (total, record) => total + (record.unresolvedRelations || []).length,
      0
    );
    lines.push(
      `| ${markdownCell(key)} | ${group.counts.new} | ${group.counts.matched} | ${group.counts.review} | ${group.counts.conflict} | ${group.counts.error} | ${unresolvedRelations} |`
    );
  }
  lines.push("", "## العلاقات غير المحلولة", "");
  if (report.unresolvedRelations.length) {
    lines.push(...report.unresolvedRelations.map((item) =>
      `- ${markdownCell(item.dataset)} / \`${markdownCell(item.key)}\`: ${markdownCell(item.field)} → \`${markdownCell(item.key)}\``
    ));
  } else {
    lines.push("- لا توجد علاقات غير محلولة.");
  }
  lines.push(
    "",
    "## الصور",
    "",
    `- ملفات مفحوصة: ${report.images.checked}؛ موجودة: ${report.images.present}؛ مفقودة: ${report.images.missing.length}؛ غير صالحة: ${report.images.invalid.length}؛ خارجية غير قابلة للتحقق محليًا: ${report.images.external.length}.`,
  );
  for (const [label, entries] of [
    ["مفقودة", report.images.missing],
    ["غير صالحة", report.images.invalid],
    ["خارجية", report.images.external]
  ]) {
    if (entries.length) {
      lines.push(`- ${label}: ${entries.map((entry) => `\`${markdownCell(entry.path)}\` (${markdownCell(entry.name || entry.key)})`).join("، ")}.`);
    }
  }
  lines.push("", "## أخطاء الحزمة", "");
  if (report.bundle.validation.errors.length) {
    lines.push(...report.bundle.validation.errors.map((error) =>
      `- ${markdownCell(error.file)}${error.key ? ` / ${markdownCell(error.key)}` : ""}: ${markdownCell(error.message)}`
    ));
  } else {
    lines.push("- لا توجد أخطاء تحقق في ملفات الحزمة.");
  }
  lines.push("", "## تحذيرات", "");
  if (report.warnings.length) {
    lines.push(...report.warnings.map((warning) => `- ${markdownCell(warning)}`));
  } else {
    lines.push("- لا توجد.");
  }
  lines.push("", "## تفاصيل الحالات", "");
  for (const [key, group] of Object.entries(report.groups)) {
    lines.push(`### ${key}`, "");
    const interesting = group.records.filter((record) => record.status !== "matched");
    if (!interesting.length) {
      lines.push("- جميع السجلات مطابقة.", "");
      continue;
    }
    for (const record of interesting) {
      const detail = [
        `\`${record.key || "?"}\``,
        `الحالة: **${record.status}**`,
        record.name ? `الاسم: ${markdownCell(record.name)}` : "",
        record.destinationId ? `معرّف الهدف: \`${record.destinationId}\`` : "",
        record.candidates?.length ? `مرشحون: ${record.candidates.map((item) => `\`${item.destinationId || item}\``).join(", ")}` : "",
        record.nameOnlyCandidates?.length
          ? `تطابق اسم فقط (غير كافٍ): ${record.nameOnlyCandidates.map((item) => `\`${item.destinationId}\``).join(", ")}`
          : "",
        record.differences?.length ? `اختلافات: ${record.differences.map((item) => markdownCell(item.field)).join(", ")}` : "",
        record.conflicts?.length ? `التعارضات: ${record.conflicts.map(markdownCell).join("; ")}` : "",
        record.unresolvedRelations?.length
          ? `علاقات غير محلولة: ${record.unresolvedRelations.map((item) => `${item.field}=${item.key}`).join(", ")}`
          : ""
      ].filter(Boolean);
      lines.push(`- ${detail.join("؛")}`);
    }
    lines.push("");
  }
  lines.push(
    "## القرار",
    "",
    report.readyForImport
      ? "المعاينة لا تحتوي تعارضات أو علاقات غير محلولة، لكن هذه الأداة لا تنفذ الكتابة أو الاستيراد."
      : "لم تُعتمد الجاهزية للاستيراد. عالج التعارضات والعلاقات غير المحلولة يدويًا. هذه الأداة لا تنفذ الكتابة أو الاستيراد.",
    ""
  );
  return lines.join("\n");
}
