import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const helperPath = path.join(repositoryRoot, "deploy", "validate-runtime-env.sh");
const bash = process.env.BASH || (process.platform === "win32"
  ? "C:\\Program Files\\Git\\bin\\bash.exe"
  : "bash");
const accessKeys = ["JWT_ACCESS_SECRET", "ACCESS_TOKEN_SECRET", "JWT_SECRET", "ACCESS_SECRET"];
const refreshKeys = ["JWT_REFRESH_SECRET", "REFRESH_TOKEN_SECRET", "REFRESH_SECRET"];

function toBashPath(target) {
  const resolved = path.resolve(target);
  if (process.platform !== "win32") return resolved;
  return `/${resolved[0].toLowerCase()}${resolved.slice(2).replaceAll("\\", "/")}`;
}

function runValidation(contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "souqak-runtime-env-test-"));
  const envFile = path.join(directory, "production.env");
  fs.writeFileSync(envFile, contents);
  try {
    return spawnSync(bash, [
      "-c",
      'source "$1"; fail() { printf "FAIL:%s\\n" "$1" >&2; return 1; }; validate_runtime_env "$2"',
      "runtime-env-test",
      toBashPath(helperPath),
      envFile
    ], { encoding: "utf8" });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const accessKey of accessKeys) {
  for (const refreshKey of refreshKeys) {
    test(`accepts supported JWT key names ${accessKey} and ${refreshKey}`, () => {
      const result = runValidation([
        "MONGODB_URI=mongodb://mongo/suqaq?replicaSet=rs0",
        `${accessKey}=test-access-value`,
        `${refreshKey}=test-refresh-value`
      ].join("\n"));
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /test-(?:access|refresh)-value/);
    });
  }
}

test("rejects missing or empty MongoDB and JWT runtime settings without printing values", () => {
  const invalidFiles = [
    "JWT_ACCESS_SECRET=test-access-value\nJWT_REFRESH_SECRET=test-refresh-value\n",
    "MONGODB_URI=mongodb://mongo/suqaq?replicaSet=rs0\nJWT_REFRESH_SECRET=test-refresh-value\n",
    "MONGODB_URI=mongodb://mongo/suqaq?replicaSet=rs0\nJWT_ACCESS_SECRET=\nJWT_REFRESH_SECRET=test-refresh-value\n",
    "MONGODB_URI=mongodb://mongo/suqaq?replicaSet=rs0\nJWT_ACCESS_SECRET=test-access-value\nJWT_REFRESH_SECRET=\"\"\n"
  ];
  for (const contents of invalidFiles) {
    const result = runValidation(contents);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /test-(?:access|refresh)-value/);
  }
});

test("rejects duplicate supported aliases instead of relying on secret precedence", () => {
  const result = runValidation([
    "MONGODB_URI=mongodb://mongo/suqaq?replicaSet=rs0",
    "JWT_ACCESS_SECRET=test-access-value",
    "JWT_SECRET=another-test-access-value",
    "JWT_REFRESH_SECRET=test-refresh-value"
  ].join("\n"));
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /test-(?:access|refresh)-value/);
});
