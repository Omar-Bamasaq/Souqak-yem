import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("legacy transaction shell entry point is fail-closed and cannot call Docker", () => {
  const retired = fs.readFileSync(
    path.join(repositoryRoot, "deploy", "deploy-transaction.sh"),
    "utf8"
  );
  assert.match(retired, /Retired/);
  assert.match(retired, /exit 2/);
  assert.doesNotMatch(retired, /\bdocker\b|\bsudo\b|systemctl/);
});
