import { EJSON } from "bson";

const DRIVER_METADATA_OPTIONS = new Set(["background", "key", "name", "ns", "v"]);
const SERVER_GENERATED_OPTIONS = new Set(["2dsphereIndexVersion", "textIndexVersion"]);
const COLLATION_SERVER_GENERATED_OPTIONS = new Set(["version"]);
const COLLATION_DEFAULTS = {
  caseLevel: false,
  caseFirst: "off",
  strength: 3,
  numericOrdering: false,
  alternate: "non-ignorable",
  maxVariable: "punct",
  normalization: false,
  backwards: false
};

function stableBsonValue(value) {
  const serialized = EJSON.serialize(value, { relaxed: false });
  return stablePlainValue(serialized);
}

function stablePlainValue(value) {
  if (Array.isArray(value)) return value.map(stablePlainValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stablePlainValue(value[key])])
    );
  }
  return value;
}

function bsonEquals(left, right) {
  return JSON.stringify(stableBsonValue(left)) === JSON.stringify(stableBsonValue(right));
}

function orderedKeysEqual(expected, actual) {
  const expectedEntries = Object.entries(expected || {});
  const actualEntries = Object.entries(actual || {});
  return expectedEntries.length === actualEntries.length &&
    expectedEntries.every(([key, value], index) =>
      key === actualEntries[index][0] && bsonEquals(value, actualEntries[index][1])
    );
}

function normalizeCollation(collation, expectedCollation) {
  if (!collation) return collation;
  const normalized = { ...COLLATION_DEFAULTS, ...collation };
  if (!expectedCollation || !Object.hasOwn(expectedCollation, "version")) {
    for (const option of COLLATION_SERVER_GENERATED_OPTIONS) delete normalized[option];
  }
  return normalized;
}

function normalizeOptions(options, { actual, expectedOptions = {} } = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(options || {})) {
    if (DRIVER_METADATA_OPTIONS.has(key)) continue;
    if (actual && SERVER_GENERATED_OPTIONS.has(key) && expectedOptions[key] === undefined) continue;
    normalized[key] = key === "collation"
      ? normalizeCollation(value, expectedOptions.collation)
      : value;
  }
  return stableBsonValue(normalized);
}

function displayValue(value) {
  return EJSON.serialize(value, { relaxed: false });
}

function isImplicitIdIndex(index) {
  return index?.name === "_id_" &&
    orderedKeysEqual({ _id: 1 }, index.key) &&
    index.unique === true;
}

function summarizeOptions(options) {
  return displayValue(options || {});
}

function isTextIndex(keys) {
  return Object.values(keys || {}).includes("text");
}

function normalizedTextOptions(keys, options = {}) {
  if (!isTextIndex(keys)) return options;
  const normalized = { ...options };
  if (normalized.weights === undefined) {
    normalized.weights = Object.fromEntries(
      Object.entries(keys).filter(([, direction]) => direction === "text").map(([field]) => [field, 1])
    );
  }
  if (normalized.default_language === undefined) normalized.default_language = "english";
  if (normalized.language_override === undefined) normalized.language_override = "language";
  return normalized;
}

function textKeysMatch(expectedKeys, actualIndex) {
  const expectedEntries = Object.entries(expectedKeys || {});
  const actualEntries = Object.entries(actualIndex.key || {});
  if (!isTextIndex(expectedKeys)) return orderedKeysEqual(expectedKeys, actualIndex.key);

  const expectedTextFields = expectedEntries
    .filter(([, direction]) => direction === "text")
    .map(([field]) => field)
    .sort();
  const actualUsesInternalTextKeys = actualEntries.some(([field]) => field === "_fts" || field === "_ftsx");
  if (!actualUsesInternalTextKeys) return orderedKeysEqual(expectedKeys, actualIndex.key);

  const actualTextFields = Object.keys(actualIndex.weights || {}).sort();
  const expectedNonText = expectedEntries.filter(([, direction]) => direction !== "text");
  const actualNonText = actualEntries.filter(([field]) => field !== "_fts" && field !== "_ftsx");
  return JSON.stringify(expectedTextFields) === JSON.stringify(actualTextFields) &&
    orderedKeysEqual(Object.fromEntries(expectedNonText), Object.fromEntries(actualNonText));
}

function getIndexOptions(index) {
  const options = {};
  for (const [key, value] of Object.entries(index || {})) {
    if (!DRIVER_METADATA_OPTIONS.has(key)) options[key] = value;
  }
  return options;
}

function compareIndex(expected, actual, collectionName) {
  const mismatches = [];
  if (!textKeysMatch(expected.keys, actual)) {
    mismatches.push({
      field: "keys",
      expected: displayValue(expected.keys),
      actual: displayValue(actual.key)
    });
  }

  const expectedIndexOptions = normalizedTextOptions(expected.keys, expected.options || {});
  const actualIndexOptions = getIndexOptions(actual);
  const expectedOptions = normalizeOptions(expectedIndexOptions, { expectedOptions: expectedIndexOptions });
  const actualOptions = normalizeOptions(actualIndexOptions, {
    actual: true,
    expectedOptions: expectedIndexOptions
  });
  if (JSON.stringify(expectedOptions) !== JSON.stringify(actualOptions)) {
    mismatches.push({
      field: "options",
      expected: summarizeOptions(expectedIndexOptions),
      actual: summarizeOptions(actualIndexOptions)
    });
  }

  return mismatches.length
    ? { collectionName, indexName: expected.name, mismatches }
    : null;
}

export async function verifyIndexPlan(plan, db) {
  const expectedCollections = new Map();
  for (const model of plan) {
    const entry = expectedCollections.get(model.collectionName) || [];
    entry.push(...model.indexes);
    expectedCollections.set(model.collectionName, entry);
  }

  const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray();
  const actualCollectionNames = new Set(collectionInfos.map(({ name }) => name));
  const expectedCollectionNames = new Set(expectedCollections.keys());
  const missingCollections = [...expectedCollectionNames]
    .filter((name) => !actualCollectionNames.has(name))
    .sort();
  const unexpectedCollections = [...actualCollectionNames]
    .filter((name) => !expectedCollectionNames.has(name))
    .sort();
  const missingIndexes = [];
  const unexpectedIndexes = [];
  const mismatchedIndexes = [];

  for (const [collectionName, expectedIndexes] of expectedCollections) {
    if (!actualCollectionNames.has(collectionName)) {
      for (const expected of expectedIndexes) {
        missingIndexes.push({ collectionName, indexName: expected.name });
      }
      continue;
    }

    const actualIndexes = await db.collection(collectionName).listIndexes().toArray();
    const actualByName = new Map(actualIndexes.map((index) => [index.name, index]));
    const expectedNames = new Set(expectedIndexes.map((index) => index.name));

    for (const expected of expectedIndexes) {
      const actual = actualByName.get(expected.name);
      if (!actual) {
        missingIndexes.push({ collectionName, indexName: expected.name });
        continue;
      }
      const mismatch = compareIndex(expected, actual, collectionName);
      if (mismatch) mismatchedIndexes.push(mismatch);
    }

    for (const actual of actualIndexes) {
      if (!expectedNames.has(actual.name) && !isImplicitIdIndex(actual)) {
        unexpectedIndexes.push({
          collectionName,
          indexName: actual.name,
          keys: displayValue(actual.key)
        });
      }
    }
  }

  for (const collectionName of unexpectedCollections) {
    const actualIndexes = await db.collection(collectionName).listIndexes().toArray();
    for (const actual of actualIndexes) {
      if (!isImplicitIdIndex(actual)) {
        unexpectedIndexes.push({
          collectionName,
          indexName: actual.name,
          keys: displayValue(actual.key)
        });
      }
    }
  }

  missingCollections.sort();
  unexpectedCollections.sort();
  missingIndexes.sort((left, right) =>
    `${left.collectionName}.${left.indexName}`.localeCompare(`${right.collectionName}.${right.indexName}`)
  );
  unexpectedIndexes.sort((left, right) =>
    `${left.collectionName}.${left.indexName}`.localeCompare(`${right.collectionName}.${right.indexName}`)
  );
  mismatchedIndexes.sort((left, right) =>
    `${left.collectionName}.${left.indexName}`.localeCompare(`${right.collectionName}.${right.indexName}`)
  );

  const success = missingCollections.length === 0 &&
    unexpectedCollections.length === 0 &&
    missingIndexes.length === 0 &&
    unexpectedIndexes.length === 0 &&
    mismatchedIndexes.length === 0;
  return {
    success,
    status: success ? "success" : "failure",
    summary: {
      expectedCollections: expectedCollections.size,
      actualCollections: actualCollectionNames.size,
      missingCollections: missingCollections.length,
      unexpectedCollections: unexpectedCollections.length,
      expectedIndexes: [...expectedCollections.values()].reduce((sum, indexes) => sum + indexes.length, 0),
      missingIndexes: missingIndexes.length,
      unexpectedIndexes: unexpectedIndexes.length,
      mismatchedIndexes: mismatchedIndexes.length
    },
    missingCollections,
    unexpectedCollections,
    missingIndexes,
    unexpectedIndexes,
    mismatchedIndexes
  };
}
