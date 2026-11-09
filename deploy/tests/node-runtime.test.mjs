import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("backend image is non-root and has no Docker socket or production data build inputs", () => {
  const dockerfile = fs.readFileSync(path.join(repositoryRoot, "Dockerfile"), "utf8");
  assert.match(dockerfile, /^USER node$/m);
  assert.doesNotMatch(dockerfile, /docker\.sock|privileged/i);
});

test("protected helper fixes production mounts and isolates its upload check", () => {
  const helper = fs.readFileSync(
    path.join(repositoryRoot, "deploy", "admin", "activate-release.py"),
    "utf8"
  );
  assert.match(helper, /souqak_uploads_data/);
  assert.match(helper, /souqak_private_uploads_data/);
  assert.match(helper, /--network", "none"/);
  assert.match(helper, /--user", "node"/);
  assert.match(helper, /no-new-privileges:true/);
  assert.doesNotMatch(helper, /souqak_mongo_data,target=/);
  assert.doesNotMatch(helper, /docker\\.sock|--privileged/);
});

test("administrative operations require the fixed protected helper and isolated builder", () => {
  const helper = fs.readFileSync(
    path.join(repositoryRoot, "deploy", "admin", "activate-release.py"),
    "utf8"
  );
  assert.match(helper, /Path\("\/usr\/local\/libexec\/souqak\/activate-release\.py"\)/);
  assert.match(helper, /metadata\.st_uid != 0 or metadata\.st_mode & 0o022/);
  assert.match(helper, /BUILD_ROOT = Path\("\/var\/lib\/souqak-build-work"\)/);
  assert.match(helper, /os\.getgrouplist\(BUILD_USER, account\.pw_gid\)/);
  assert.match(helper, /account\.pw_shell not in/);
});

test("legacy volume checker cannot run Docker with caller-controlled arguments", () => {
  const legacyPath = path.join(repositoryRoot, "deploy", "verify-node-volume-access.sh");
  assert.equal(fs.existsSync(legacyPath), false);
});
