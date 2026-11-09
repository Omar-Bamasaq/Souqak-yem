import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const deployScript = path.join(repositoryRoot, "deploy.sh");
const prepareScript = path.join(repositoryRoot, "deploy", "prepare-release.py");
const python = process.env.PYTHON || "python";
const release = "a".repeat(40);

test("preparation dry-run requires a full immutable SHA and contacts no production tools", () => {
  const markerFile = path.join(repositoryRoot, "deploy", `.dry-run-${process.pid}`);
  const result = spawnSync(python, [prepareScript, "--dry-run", release], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, DOCKER_MARKER: markerFile }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /exact commit/);
  assert.match(result.stdout, /Would not access Docker/);
  assert.equal(fs.existsSync(markerFile), false);
});

test("preparation rejects short or moving branch references", () => {
  const result = spawnSync(python, [prepareScript, "--prepare", "main"], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /full 40-character lowercase commit SHA/);
});

test("deploy.sh delegates only to the non-administrative preparation tool", () => {
  const script = fs.readFileSync(deployScript, "utf8");
  assert.match(script, /exec python3 .*prepare-release\.py/);
  assert.doesNotMatch(script, /\bdocker\b|\bsudo\b|\bnginx\b|source\s+/i);
});
