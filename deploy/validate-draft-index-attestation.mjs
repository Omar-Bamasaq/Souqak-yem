import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_VALUES = {
  FORMAT: "souqak-draft-index-attestation-v1",
  DATABASE: "suqaq",
  REPLICA_SET: "rs0",
  COLLECTION: "draftactions",
  REQUIRED_INDEXES: [
    "one_incomplete_non_wallet_draft_per_user_type",
    "one_incomplete_wallet_service_draft_per_service"
  ].join(","),
  REQUIRED_INDEX_SPECIFICATIONS: [
    "one_incomplete_non_wallet_draft_per_user_type|userId:1,type:1|unique|incomplete non-wallet action types",
    "one_incomplete_wallet_service_draft_per_service|userId:1,type:1,serviceId:1|unique|incomplete wallet_service_catalog with serviceId:ObjectId"
  ].join(";"),
  LEGACY_USER_TYPE_INDEX: "absent",
  DUPLICATE_INCOMPLETE_DRAFT_GROUPS: "0",
  WALLET_SERVICE_ID_ANOMALIES: "0"
};
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseAttestation(contents) {
  const entries = new Map();
  for (const line of contents.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) throw new Error("Index attestation has an invalid line.");
    const key = line.slice(0, separator);
    if (entries.has(key)) throw new Error("Index attestation contains a duplicate field.");
    entries.set(key, line.slice(separator + 1));
  }
  return entries;
}

export function validateDraftIndexAttestation({
  attestationPath,
  schemaPath,
  now = Date.now()
}) {
  if (!attestationPath || !schemaPath) {
    throw new TypeError("An index attestation and candidate schema path are required.");
  }

  const entries = parseAttestation(fs.readFileSync(attestationPath, "utf8"));
  for (const [key, expected] of Object.entries(REQUIRED_VALUES)) {
    if (entries.get(key) !== expected) {
      throw new Error("Index attestation does not verify the required MongoDB draft indexes.");
    }
  }

  const schemaHash = createHash("sha256").update(fs.readFileSync(schemaPath)).digest("hex");
  if (entries.get("SCHEMA_SHA256") !== schemaHash) {
    throw new Error("Index attestation was not verified against this release's DraftAction schema.");
  }

  const verifiedAt = entries.get("VERIFIED_AT_UTC");
  if (!verifiedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(verifiedAt)) {
    throw new Error("Index attestation has no valid UTC verification timestamp.");
  }
  const verifiedAtMs = Date.parse(verifiedAt);
  if (!Number.isFinite(verifiedAtMs) || verifiedAtMs > now || now - verifiedAtMs > MAX_AGE_MS) {
    throw new Error("Index attestation is expired or has an invalid timestamp.");
  }

  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [attestationPath, schemaPath] = process.argv.slice(2);
  try {
    validateDraftIndexAttestation({ attestationPath, schemaPath });
    console.log("Draft index attestation verified.");
  } catch (error) {
    console.error(`Draft index verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
