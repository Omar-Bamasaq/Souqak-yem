import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import {
  connectPrelaunchDatabase,
  resolvePrelaunchTarget,
  safeErrorSummary
} from "../lib/prelaunchDatabase.js";

const MODEL_DIRECTORY = new URL("../models/", import.meta.url);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function inferredIndexName(keys) {
  return Object.entries(keys).map(([field, direction]) => `${field}_${direction}`).join("_");
}

function isTextIndex(keys) {
  return Object.values(keys).includes("text");
}

function getIndexDefinitions(model) {
  const schema = model.schema;
  if (schema.discriminatorMapping?.value !== undefined) {
    throw new Error(`Model ${model.modelName} uses discriminator index decoration, which is not supported by the prelaunch index plan.`);
  }
  if (Object.keys(schema.options.writeConcern || {}).length > 0) {
    throw new Error(`Model ${model.modelName} has schema writeConcern options that are not supported by the prelaunch index plan.`);
  }

  return schema.indexes().map(([keys, sourceOptions = {}]) => {
    const options = { ...sourceOptions };
    delete options._autoIndex;
    if (!isTextIndex(keys) && schema.options.collation && options.collation === undefined) {
      options.collation = schema.options.collation;
    }
    return [keys, options];
  });
}

function withoutBackground(options) {
  const normalized = { ...options };
  delete normalized.background;
  return normalized;
}

function canCoexistAsPartialIndexes(left, right) {
  const leftOptions = withoutBackground(left.options);
  const rightOptions = withoutBackground(right.options);
  const leftPartial = leftOptions.partialFilterExpression;
  const rightPartial = rightOptions.partialFilterExpression;
  if (!leftPartial || !rightPartial || stableStringify(leftPartial) === stableStringify(rightPartial)) {
    return false;
  }
  delete leftOptions.partialFilterExpression;
  delete rightOptions.partialFilterExpression;
  delete leftOptions.name;
  delete rightOptions.name;
  return left.name !== right.name && stableStringify(leftOptions) === stableStringify(rightOptions);
}

export function buildIndexPlan(models = Object.values(mongoose.models)) {
  const plan = [];
  for (const model of models) {
    if (!model?.schema || typeof model.createIndexes !== "function") continue;

    const indexesByName = new Map();
    const indexesByKeys = new Map();
    const indexes = [];
    for (const [keys, options] of getIndexDefinitions(model)) {
      const name = options.name || inferredIndexName(keys);
      const entry = { keys, name, options };
      const sameName = indexesByName.get(name);
      if (sameName && stableStringify(sameName.keys) !== stableStringify(keys)) {
        throw new Error(`Model ${model.modelName} declares conflicting definitions for index ${name}.`);
      }
      indexesByName.set(name, entry);

      const keySignature = stableStringify(keys);
      const sameKeys = indexesByKeys.get(keySignature) || [];
      const duplicate = sameKeys.find((previous) =>
        stableStringify(withoutBackground(previous.options)) ===
        stableStringify(withoutBackground(options))
      );
      if (duplicate) continue;
      for (const previous of sameKeys) {
        if (!canCoexistAsPartialIndexes(previous, entry)) {
          throw new Error(`Model ${model.modelName} has incompatible indexes on ${keySignature}.`);
        }
      }
      sameKeys.push(entry);
      indexesByKeys.set(keySignature, sameKeys);
      indexes.push(entry);
    }

    plan.push({
      modelName: model.modelName,
      collectionName: model.collection.name,
      indexes
    });
  }
  return plan.sort((left, right) => left.modelName.localeCompare(right.modelName));
}

export async function loadApplicationModels() {
  const directoryPath = fileURLToPath(MODEL_DIRECTORY);
  const files = (await fs.readdir(directoryPath))
    .filter((file) => file.endsWith(".js"))
    .sort();
  for (const file of files) {
    await import(new URL(file, MODEL_DIRECTORY));
  }
  return Object.values(mongoose.models);
}

export function summarizeIndexPlan(plan) {
  const indexes = plan.flatMap((model) => model.indexes);
  return {
    models: plan.length,
    collections: new Set(plan.map((model) => model.collectionName)).size,
    indexes: indexes.length,
    uniqueIndexes: indexes.filter(({ options }) => options.unique === true).length,
    compoundIndexes: indexes.filter(({ keys }) => Object.keys(keys).length > 1).length,
    specializedIndexes: indexes.filter(({ options }) =>
      ["collation", "partialFilterExpression", "sparse", "expireAfterSeconds", "weights", "default_language"]
        .some((option) => options[option] !== undefined)
    ).length
  };
}

export async function assertDatabaseHasNoDocuments(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith("system.")) {
      throw new Error(`Refusing index creation because unexpected system collection ${name} exists.`);
    }
    const count = await db.collection(name).countDocuments({});
    if (count > 0) {
      throw new Error(`Refusing index creation because collection ${name} is not empty.`);
    }
  }
}

export function toMongoIndexSpecifications(indexes) {
  return indexes.map(({ keys, name, options = {} }) => ({
    ...options,
    key: keys,
    name
  }));
}

export async function applyIndexPlan(plan, db = mongoose.connection.db) {
  await assertDatabaseHasNoDocuments(db);
  for (const item of plan) {
    if (item.indexes.length === 0) continue;
    try {
      await db.collection(item.collectionName).createIndexes(
        toMongoIndexSpecifications(item.indexes)
      );
    } catch (error) {
      const summary = safeErrorSummary(error);
      console.error(`Index creation failed for model ${item.modelName}.`, summary);
      throw new Error(`Index creation failed for model ${item.modelName} (code ${summary.code ?? "unknown"}).`);
    }
  }
}

export async function run({ apply = false, env = process.env } = {}) {
  const plan = buildIndexPlan(await loadApplicationModels());
  const summary = summarizeIndexPlan(plan);
  if (!apply) {
    console.log(JSON.stringify({
      mode: "plan-only",
      summary,
      models: plan
    }, null, 2));
    return summary;
  }
  if (env.PRELAUNCH_INDEXES_APPROVED !== "YES") {
    throw new Error("PRELAUNCH_INDEXES_APPROVED=YES is required to create indexes.");
  }

  const target = resolvePrelaunchTarget(env);
  await connectPrelaunchDatabase(env);
  try {
    if (mongoose.connection.name !== target.databaseName) {
      throw new Error("Connected database does not match the approved prelaunch target.");
    }
    await applyIndexPlan(plan);
    console.log(`Created reviewed indexes for ${summary.models} models in ${target.databaseName}.`);
  } finally {
    await mongoose.disconnect();
  }
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const apply = process.argv.includes("--apply");
  run({ apply }).catch((error) => {
    console.error("Prelaunch index operation failed.", safeErrorSummary(error));
    process.exitCode = 1;
  });
}
