import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const transactionFile = path.join(repositoryRoot, "deploy", "deploy-transaction.sh");
const bash = process.env.BASH || "bash";
const releaseId = "a".repeat(40);

function toBashPath(target) {
  const resolved = path.resolve(target);
  if (process.platform !== "win32") return resolved;
  const drive = resolved[0].toLowerCase();
  return `/${drive}${resolved.slice(2).replaceAll("\\", "/")}`;
}

function simulateFailure(scenario) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `souqak-deploy-${scenario}-`));
  const previousFrontend = path.join(directory, "previous");
  const newFrontend = path.join(directory, "release", "frontend", "dist");
  fs.mkdirSync(previousFrontend);
  fs.mkdirSync(newFrontend, { recursive: true });
  fs.writeFileSync(path.join(previousFrontend, "souqak-release.txt"), "old-release");
  fs.writeFileSync(path.join(newFrontend, "souqak-release.txt"), releaseId);

  const harness = String.raw`
set -u
source "$1"
scenario="$2"
previous_frontend="$3/previous"
new_frontend="$3/release/frontend/dist"
BACKEND_CONTAINER="souqak-backend"
BACKEND_INTERNAL_PORT="5000"
BACKEND_PORT="5000"
BACKEND_HEALTH_PATH="/api/health/readiness"
DOCKER_NETWORK="souqak_default"
ENV_FILE="/unreadable-by-tests"
UPLOADS_VOLUME="souqak_uploads_data"
PRIVATE_UPLOADS_VOLUME="souqak_private_uploads_data"
release_id="$4"
docker_image="souqak-backend:$release_id"
temporary_checkout="$3"
release_directory="$3/release"
previous_container="souqak-backend-rollback-$release_id"
old_backend_stopped=0
old_backend_renamed=0
new_backend_started=0
frontend_switched=0
activation_started=0
deployment_succeeded=0
declare -A exists running labels
exists[$BACKEND_CONTAINER]=1
running[$BACKEND_CONTAINER]=1
labels[$BACKEND_CONTAINER]="old-release"
max_running=1
wait_calls=0
nginx_test_calls=0
nginx_reload_calls=0
operations=""

update_max_running() {
  local count=0 name
  for name in "\${!exists[@]}"; do
    [[ "\${exists[$name]}" == "1" && "\${running[$name]:-0}" == "1" ]] && ((count+=1))
  done
  ((count > max_running)) && max_running=$count
}

docker() {
  operations+="$1 "
  case "$1" in
    build)
      [[ "$scenario" == "backend-build" ]] && return 17
      return 0
      ;;
    stop)
      running[$4]=0
      update_max_running
      return 0
      ;;
    rename)
      [[ "\${exists[$2]:-0}" == "1" && "\${exists[$3]:-0}" != "1" ]] || return 18
      exists[$2]=0
      running[$3]="\${running[$2]}"
      labels[$3]="\${labels[$2]}"
      exists[$3]=1
      unset "running[$2]" "labels[$2]"
      update_max_running
      return 0
      ;;
    run)
      exists[$BACKEND_CONTAINER]=1
      running[$BACKEND_CONTAINER]=1
      labels[$BACKEND_CONTAINER]="$release_id"
      update_max_running
      return 0
      ;;
    inspect)
      if [[ "$2" == "--format" ]]; then
        local format="$3" name="$4"
        [[ "\${exists[$name]:-0}" == "1" ]] || return 1
        case "$format" in
          *State.Running*)
            if [[ "\${running[$name]:-0}" == "1" ]]; then printf 'true\n'; else printf 'false\n'; fi
            ;;
          *com.souqak.release*) printf '%s\n' "\${labels[$name]:-}" ;;
          *) printf '%s\n' "mock-id" ;;
        esac
        return 0
      fi
      [[ "\${exists[$2]:-0}" == "1" ]]
      return $?
      ;;
    rm)
      local name="\${@: -1}"
      unset "exists[$name]" "running[$name]" "labels[$name]"
      return 0
      ;;
    start)
      if [[ "$scenario" == "rollback-fails" && "\${labels[$2]:-}" == "old-release" ]]; then
        return 19
      fi
      [[ "\${exists[$2]:-0}" == "1" ]] || return 1
      running[$2]=1
      update_max_running
      return 0
      ;;
    *) return 0 ;;
  esac
}

container_exists() { docker inspect "$1" >/dev/null 2>&1; }
container_is_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null)" == "true" ]]
}
fail() { printf 'FAIL:%s\n' "$1" >&2; return 1; }
atomic_frontend_link() {
  if [[ "$scenario" == "frontend-switch" && "$1" == "$new_frontend" ]]; then return 1; fi
  CURRENT_FRONTEND="$1"
  return 0
}
wait_for_backend() {
  ((wait_calls+=1))
  [[ "\${running[$BACKEND_CONTAINER]:-0}" == "1" ]] || return 1
  if [[ "\${labels[$BACKEND_CONTAINER]:-}" == "$release_id" ]]; then
    if [[ "$scenario" =~ ^(readiness|rollback-fails)$ && $wait_calls -eq 1 ]]; then return 1; fi
    if [[ "$scenario" == "readiness-after-reload" && $wait_calls -eq 2 ]]; then return 1; fi
  fi
  return 0
}
check_frontend_release() {
  [[ "$(cat "$CURRENT_FRONTEND/souqak-release.txt")" == "$1" ]]
}
sudo() {
  if [[ "$scenario" == "nginx-test" && "$2" == "nginx" && "$3" == "-t" ]]; then
    ((nginx_test_calls+=1))
    ((nginx_test_calls == 1)) && return 20
  fi
  if [[ "$scenario" == "nginx-reload" && "$2" == "systemctl" && "$3" == "reload" ]]; then
    ((nginx_reload_calls+=1))
    ((nginx_reload_calls == 1)) && return 20
  fi
  return 0
}

release_id="$4"
docker_image="souqak-backend:$release_id"
CURRENT_FRONTEND="$previous_frontend"
if [[ "$scenario" == "backend-build" ]]; then
  build_backend_image
  result=$?
  printf 'RESULT build=%s active=%s running=%s frontend=%s max_running=%s operations=%s\n' \
    "$result" "\${labels[$BACKEND_CONTAINER]}" "\${running[$BACKEND_CONTAINER]}" \
    "$CURRENT_FRONTEND" "$max_running" "$operations"
  exit 0
fi

activate_release
deploy_result=$?
if ((deploy_result != 0)); then
  restore_after_failed_deploy
  rollback_result=$?
else
  rollback_result=0
fi
printf 'RESULT deploy=%s rollback=%s active=%s running=%s previous_exists=%s frontend=%s max_running=%s operations=%s\n' \
  "$deploy_result" "$rollback_result" "\${labels[$BACKEND_CONTAINER]:-missing}" \
  "\${running[$BACKEND_CONTAINER]:-0}" "\${exists[$previous_container]:-0}" \
  "$CURRENT_FRONTEND" "$max_running" "$operations"
`.replaceAll("\\${", "${");

  try {
    const result = spawnSync(bash, [
      "-c",
      harness,
      "souqak-deploy-test",
      toBashPath(transactionFile),
      scenario,
      toBashPath(directory),
      releaseId
    ], { encoding: "utf8" });
    assert.equal(result.error, undefined, result.error?.message);
    return { ...result, directory };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function runAndClean(scenario) {
  const result = simulateFailure(scenario);
  const output = `${result.stdout}\n${result.stderr}`;
  fs.rmSync(result.directory, { recursive: true, force: true });
  return output;
}

test("backend image build failure leaves the active backend untouched", () => {
  const output = runAndClean("backend-build");
  assert.match(output, /RESULT build=17 active=old-release running=1/);
  assert.match(output, /max_running=1/);
  assert.doesNotMatch(output, /operations=.*(stop|run|rename)/);
});

for (const scenario of ["readiness", "readiness-after-reload", "nginx-test", "nginx-reload", "frontend-switch"]) {
  test(`${scenario} failure restores the old backend and frontend without overlap`, () => {
    const output = runAndClean(scenario);
    assert.match(output, /RESULT deploy=1 rollback=0 active=old-release running=1 previous_exists=0/);
    assert.match(output, /frontend=.*previous/);
    assert.match(output, /max_running=1/);
  });
}

test("failed rollback preserves the old container and reports that manual recovery is needed", () => {
  const output = runAndClean("rollback-fails");
  assert.match(output, /RESULT deploy=1 rollback=1 active=old-release running=0 previous_exists=0/);
  assert.match(output, /Automatic rollback could not be fully verified/);
  assert.match(output, /max_running=1/);
});
