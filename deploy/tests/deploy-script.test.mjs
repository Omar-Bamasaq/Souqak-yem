import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const deployScript = path.join(repositoryRoot, "deploy.sh");
const bash = process.env.BASH || "bash";

function runDeploy(args, configPath) {
  return spawnSync(bash, [deployScript, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, SOUQAK_DEPLOY_CONFIG: configPath }
  });
}

function withConfig(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "souqak-deploy-test-"));
  const configPath = path.join(directory, "deploy.conf");
  fs.writeFileSync(configPath, [
    'DEPLOY_ROOT="/home/souqak/deploy"',
    'RELEASES_DIR="/home/souqak/deploy/releases"',
    'STATE_DIR="/home/souqak/deploy/deploy-state"',
    'ENV_FILE="/home/souqak/deploy/souqak/.env"',
    'DRAFT_INDEX_ATTESTATION_FILE="/etc/souqak/draft-index-attestation"',
    'MONGODB_URI_HOST="mongo"',
    'NGINX_FRONTEND_LINK="/home/souqak/deploy/current-frontend"',
    'NGINX_FRONTEND_HOST="souqak-yem.com"',
    'FRONTEND_HEALTH_URL="https://souqak-yem.com"',
    'INITIAL_FRONTEND_SOURCE="/home/souqak/deploy/releases/wallet-drafts-20261108/frontend/dist"',
    'INITIAL_FRONTEND_BASELINE="/home/souqak/deploy/releases/legacy-baseline-20261108/frontend/dist"',
    'PUBLIC_SITE_URL="https://souqak-yem.com"',
    'VITE_API_URL="https://api.souqak-yem.com/api"',
    'VITE_SOCKET_URL="https://api.souqak-yem.com"'
  ].join("\n"));
  try {
    return run(configPath, directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("dry-run prints the release plan without contacting deployment tools or revealing env contents", () => {
  withConfig((configPath, directory) => {
    const markerFile = path.join(directory, "commands.log");
    const fakeBin = path.join(directory, "bin");
    fs.mkdirSync(fakeBin);
    for (const command of ["git", "docker", "curl", "nginx", "systemctl", "npm", "node"]) {
      const commandPath = path.join(fakeBin, command);
      fs.writeFileSync(commandPath, `#!/bin/sh\nprintf '%s\\n' '${command}' >> '${markerFile}'\n`);
      fs.chmodSync(commandPath, 0o755);
    }

    const result = spawnSync(bash, [deployScript, "--dry-run"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        SOUQAK_DEPLOY_CONFIG: configPath
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dry run only/);
    assert.match(result.stdout, /Would not invoke Docker Compose/);
    assert.doesNotMatch(result.stdout + result.stderr, /MONGODB_URI=|JWT_SECRET=/);
    assert.equal(fs.existsSync(markerFile), false);
  });
});

test("dry-run rejects a config that points deployment output at the production worktree", () => {
  withConfig((configPath) => {
    const source = fs.readFileSync(configPath, "utf8")
      .replace("/home/souqak/deploy/releases", "/home/souqak/deploy/souqak/releases");
    fs.writeFileSync(configPath, source);
    const result = runDeploy(["--dry-run"], configPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RELEASES_DIR must/);
  });
});

test("unknown modes are rejected before deployment configuration is loaded", () => {
  const result = spawnSync(bash, [deployScript, "--apply"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, SOUQAK_DEPLOY_CONFIG: "missing-config" }
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
