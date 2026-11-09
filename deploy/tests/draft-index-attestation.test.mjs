import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDraftIndexAttestation } from "../validate-draft-index-attestation.mjs";

test("draft index attestation must match the candidate schema and explicitly verified database state", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "souqak-index-attestation-"));
  const schemaPath = path.join(directory, "DraftAction.js");
  const attestationPath = path.join(directory, "attestation.txt");
  const schema = "schema fixture";
  const schemaHash = createHash("sha256").update(schema).digest("hex");
  fs.writeFileSync(schemaPath, schema);
  fs.writeFileSync(attestationPath, [
    "FORMAT=souqak-draft-index-attestation-v1",
    "DATABASE=suqaq",
    "REPLICA_SET=rs0",
    "COLLECTION=draftactions",
    "REQUIRED_INDEXES=one_incomplete_non_wallet_draft_per_user_type,one_incomplete_wallet_service_draft_per_service",
    "REQUIRED_INDEX_SPECIFICATIONS=one_incomplete_non_wallet_draft_per_user_type|userId:1,type:1|unique|incomplete non-wallet action types;one_incomplete_wallet_service_draft_per_service|userId:1,type:1,serviceId:1|unique|incomplete wallet_service_catalog with serviceId:ObjectId",
    "LEGACY_USER_TYPE_INDEX=absent",
    "DUPLICATE_INCOMPLETE_DRAFT_GROUPS=0",
    "WALLET_SERVICE_ID_ANOMALIES=0",
    `SCHEMA_SHA256=${schemaHash}`,
    "VERIFIED_AT_UTC=2026-11-09T00:00:00.000Z"
  ].join("\n"));

  try {
    assert.equal(validateDraftIndexAttestation({
      attestationPath,
      schemaPath,
      now: Date.parse("2026-11-09T01:00:00.000Z")
    }), true);
    assert.throws(() => validateDraftIndexAttestation({
      attestationPath,
      schemaPath,
      now: Date.parse("2026-11-20T00:00:00.000Z")
    }), /expired/);
    fs.writeFileSync(attestationPath, fs.readFileSync(attestationPath, "utf8").replace(
      "LEGACY_USER_TYPE_INDEX=absent",
      "LEGACY_USER_TYPE_INDEX=present"
    ));
    assert.throws(() => validateDraftIndexAttestation({
      attestationPath,
      schemaPath,
      now: Date.parse("2026-11-09T01:00:00.000Z")
    }), /required MongoDB draft indexes/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
