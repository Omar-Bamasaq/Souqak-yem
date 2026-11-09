#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
case "$-" in *x*) set +x ;; esac

readonly REPOSITORY_URL="https://github.com/Omar-Bamasaq/Souqak-yem.git"
readonly RELEASE_BRANCH="main"
readonly PROTECTED_WORKTREE="/home/souqak/deploy/souqak"
readonly BACKEND_CONTAINER="souqak-backend"
readonly DATABASE_CONTAINER="souqak-mongo-1"
readonly DOCKER_NETWORK="souqak_default"
readonly DATABASE_VOLUME="souqak_mongo_data"
readonly UPLOADS_VOLUME="souqak_uploads_data"
readonly PRIVATE_UPLOADS_VOLUME="souqak_private_uploads_data"
readonly BACKEND_IMAGE="souqak-backend"
readonly BACKEND_PORT="5000"
readonly BACKEND_INTERNAL_PORT="5000"
readonly BACKEND_HEALTH_PATH="/api/health/readiness"
readonly STATE_FILE_NAME="last-rollback"
readonly DEPLOY_SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

MODE="deploy"
case "${1-}" in
  "") ;;
  --dry-run) MODE="dry-run" ;;
  --rollback) MODE="rollback" ;;
  *)
    printf '%s\n' "Usage: $0 [--dry-run|--rollback]" >&2
    exit 2
    ;;
esac
if (($# > 1)); then
  printf '%s\n' "Usage: $0 [--dry-run|--rollback]" >&2
  exit 2
fi

CONFIG_FILE="${SOUQAK_DEPLOY_CONFIG:-/etc/souqak/deploy.conf}"
if [[ ! -r "$CONFIG_FILE" ]]; then
  printf '%s\n' "Deployment config is missing or unreadable: $CONFIG_FILE" >&2
  exit 1
fi

if [[ "$MODE" != "dry-run" ]]; then
  command -v stat >/dev/null || { printf '%s\n' "stat is required to verify deployment config ownership" >&2; exit 1; }
  [[ -f "$CONFIG_FILE" && ! -L "$CONFIG_FILE" ]] \
    || { printf '%s\n' "Deployment config must be a regular, non-symlink file" >&2; exit 1; }
  config_mode="$(stat -c '%a' "$CONFIG_FILE")"
  (( (8#$config_mode & 022) == 0 )) \
    || { printf '%s\n' "Deployment config must not be writable by group or other users" >&2; exit 1; }
  [[ "$(stat -c '%u' "$CONFIG_FILE")" == "0" ]] \
    || { printf '%s\n' "Deployment config must be root-owned" >&2; exit 1; }
fi

# This file is a trusted, root-managed configuration; it contains paths and public URLs only.
source "$CONFIG_FILE"

fail() {
  printf 'Deployment preflight failed: %s\n' "$1" >&2
  return 1
}

require_config() {
  local name
  for name in \
    DEPLOY_ROOT RELEASES_DIR STATE_DIR ENV_FILE MONGODB_URI_HOST \
    NGINX_FRONTEND_LINK NGINX_FRONTEND_HOST FRONTEND_HEALTH_URL \
    PUBLIC_SITE_URL VITE_API_URL VITE_SOCKET_URL DRAFT_INDEX_ATTESTATION_FILE \
    INITIAL_FRONTEND_SOURCE INITIAL_FRONTEND_BASELINE
  do
    if [[ -z "${!name:-}" ]]; then
      fail "required setting $name is not configured"
      return 1
    fi
  done

  case "$DEPLOY_ROOT" in
    /home/souqak/deploy) ;;
    *) fail "DEPLOY_ROOT must be /home/souqak/deploy"; return 1 ;;
  esac
  [[ "$RELEASES_DIR" == "$DEPLOY_ROOT/releases" ]] \
    || { fail "RELEASES_DIR must be $DEPLOY_ROOT/releases"; return 1; }
  [[ "$STATE_DIR" == "$DEPLOY_ROOT/deploy-state" ]] \
    || { fail "STATE_DIR must be $DEPLOY_ROOT/deploy-state"; return 1; }
  [[ "$ENV_FILE" == "$PROTECTED_WORKTREE/.env" ]] \
    || { fail "ENV_FILE must be the existing external production env file"; return 1; }
  [[ "$NGINX_FRONTEND_LINK" == "$DEPLOY_ROOT/current-frontend" ]] \
    || { fail "NGINX_FRONTEND_LINK must be $DEPLOY_ROOT/current-frontend"; return 1; }
  [[ "$INITIAL_FRONTEND_SOURCE" == "$RELEASES_DIR/"*/frontend/dist ]] \
    || { fail "INITIAL_FRONTEND_SOURCE must identify the verified existing frontend release"; return 1; }
  [[ "$INITIAL_FRONTEND_BASELINE" == "$RELEASES_DIR/legacy-baseline-20261108/frontend/dist" ]] \
    || { fail "INITIAL_FRONTEND_BASELINE must use the documented non-destructive baseline path"; return 1; }
  [[ "$DRAFT_INDEX_ATTESTATION_FILE" == "/etc/souqak/draft-index-attestation" ]] \
    || { fail "DRAFT_INDEX_ATTESTATION_FILE must be the root-managed attestation path"; return 1; }
  [[ "$MONGODB_URI_HOST" =~ ^[A-Za-z0-9._-]+$ ]] \
    || { fail "MONGODB_URI_HOST must be a Docker DNS hostname"; return 1; }
  [[ "$NGINX_FRONTEND_HOST" =~ ^[A-Za-z0-9.-]+$ ]] \
    || { fail "NGINX_FRONTEND_HOST must be a hostname"; return 1; }
  [[ "$FRONTEND_HEALTH_URL" == https://* ]] \
    || { fail "FRONTEND_HEALTH_URL must use HTTPS"; return 1; }
  [[ "${FRONTEND_HEALTH_URL#https://}" == "$NGINX_FRONTEND_HOST" \
      || "${FRONTEND_HEALTH_URL#https://}" == "$NGINX_FRONTEND_HOST/" ]] \
    || { fail "FRONTEND_HEALTH_URL host must match NGINX_FRONTEND_HOST"; return 1; }
  [[ "$PUBLIC_SITE_URL" == https://* && "$VITE_API_URL" == https://* && "$VITE_SOCKET_URL" == https://* ]] \
    || { fail "public frontend URLs must use HTTPS"; return 1; }
}

require_config

if [[ "$MODE" == "dry-run" ]]; then
  cat <<PLAN
Dry run only. No network, Docker, Nginx, filesystem, or production service changes will be made.
Would fetch $RELEASE_BRANCH from $REPOSITORY_URL into a new temporary checkout.
Would require a fresh root-managed MongoDB index attestation matching the candidate DraftAction schema.
Would verify and test multiservice wallet-service drafts without a MongoDB URI.
Would build the frontend and validate all static pages, sitemap.xml, robots.txt, and the SEO manifest.
Would build or safely reuse a commit-tagged backend image.
Would verify the existing MongoDB container, network, volumes, Nginx config, and health endpoints.
Would stop and preserve only $BACKEND_CONTAINER, start the new backend on 127.0.0.1:$BACKEND_PORT,
then switch the frontend symlink and reload Nginx. The old backend is stopped first; interruption is expected.
Any failed health or Nginx check would attempt to restore both applications without reverting database data.
Would not invoke Docker Compose, run a migration, or modify MongoDB volumes or replica-set settings.
PLAN
  exit 0
fi

command -v git >/dev/null || { fail "git is required"; exit 1; }
command -v docker >/dev/null || { fail "docker is required"; exit 1; }
command -v curl >/dev/null || { fail "curl is required"; exit 1; }
command -v nginx >/dev/null || { fail "nginx is required"; exit 1; }
command -v systemctl >/dev/null || { fail "systemctl is required"; exit 1; }
command -v npm >/dev/null || { fail "npm is required"; exit 1; }
command -v node >/dev/null || { fail "node is required"; exit 1; }
command -v env >/dev/null || { fail "env is required to isolate production build flags"; exit 1; }
command -v flock >/dev/null || { fail "flock is required"; exit 1; }
command -v stat >/dev/null || { fail "stat is required"; exit 1; }
command -v readlink >/dev/null || { fail "readlink is required"; exit 1; }
command -v realpath >/dev/null || { fail "realpath is required"; exit 1; }
command -v sudo >/dev/null || { fail "sudo is required for Nginx validation and reload"; exit 1; }

if [[ "$(id -u)" -eq 0 ]]; then
  fail "run as the souqak deployment user, not root"
  exit 1
fi
if [[ "$DEPLOY_ROOT" == "$PROTECTED_WORKTREE" || "$DEPLOY_ROOT" == "$PROTECTED_WORKTREE/"* ]]; then
  fail "deployment output must not be inside the existing production worktree"
  exit 1
fi
if [[ ! -f "$ENV_FILE" || ! -r "$ENV_FILE" ]]; then
  fail "the external production env file is missing or unreadable"
  exit 1
fi

env_key_count() {
  grep -cE "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" || true
}

for required_key in MONGODB_URI JWT_SECRET JWT_REFRESH_SECRET; do
  [[ "$(env_key_count "$required_key")" == "1" ]] \
    || { fail "the production env file must contain exactly one $required_key entry"; exit 1; }
done

mongodb_uri="$(awk '
  /^[[:space:]]*MONGODB_URI[[:space:]]*=/ {
    sub(/^[[:space:]]*MONGODB_URI[[:space:]]*=[[:space:]]*/, "")
    value = $0
    count++
  }
  END { if (count != 1) exit 1; print value }
' "$ENV_FILE")" || { fail "could not validate the MongoDB URI"; exit 1; }
mongodb_uri="${mongodb_uri%$'\r'}"
mongodb_uri="${mongodb_uri#\"}"
mongodb_uri="${mongodb_uri%\"}"
mongodb_uri="${mongodb_uri#\'}"
mongodb_uri="${mongodb_uri%\'}"
case "$mongodb_uri" in
  *replicaSet=rs0*) ;;
  *) fail "the MongoDB URI must explicitly select replicaSet=rs0"; exit 1 ;;
esac
uri_authority="${mongodb_uri#*://}"
uri_authority="${uri_authority%%/*}"
uri_authority="${uri_authority%%\?*}"
uri_host="${uri_authority##*@}"
uri_host="${uri_host%%:*}"
[[ "$uri_host" == "$MONGODB_URI_HOST" ]] \
  || { fail "MONGODB_URI_HOST does not match the hostname in the env file"; exit 1; }
unset mongodb_uri uri_authority uri_host

env_mode="$(stat -c '%a' "$ENV_FILE")"
(( (8#$env_mode & 077) == 0 )) \
  || { fail "the production env file must not be accessible to group or other users"; exit 1; }
[[ "$(stat -c '%u' "$ENV_FILE")" == "$(id -u)" ]] \
  || { fail "the production env file must be owned by the souqak deployment user"; exit 1; }
config_mode="$(stat -c '%a' "$CONFIG_FILE")"
(( (8#$config_mode & 022) == 0 )) \
  || { fail "the deployment config must not be writable by group or other users"; exit 1; }
[[ "$(stat -c '%u' "$CONFIG_FILE")" == "0" ]] \
  || { fail "the deployment config must be root-owned"; exit 1; }
if [[ "$MODE" == "deploy" ]]; then
  [[ -f "$DRAFT_INDEX_ATTESTATION_FILE" && -r "$DRAFT_INDEX_ATTESTATION_FILE" ]] \
    || { fail "a separately verified draft-index attestation is required before deployment"; exit 1; }
  attestation_mode="$(stat -c '%a' "$DRAFT_INDEX_ATTESTATION_FILE")"
  (( (8#$attestation_mode & 022) == 0 )) \
    || { fail "the draft-index attestation must not be writable by group or other users"; exit 1; }
  [[ "$(stat -c '%u' "$DRAFT_INDEX_ATTESTATION_FILE")" == "0" ]] \
    || { fail "the draft-index attestation must be root-owned"; exit 1; }
fi

[[ -d "$DEPLOY_ROOT" && -w "$DEPLOY_ROOT" ]] \
  || { fail "deployment root must already exist and be writable"; exit 1; }
mkdir -p "$RELEASES_DIR" "$STATE_DIR"
exec 9>"$DEPLOY_ROOT/.souqak-deploy.lock"
flock -n 9 || { fail "another deployment or rollback is already running"; exit 1; }

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

container_is_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null)" == "true" ]]
}

container_has_network() {
  local container="$1"
  local networks
  networks="$(docker inspect --format '{{range $name, $value := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$container")"
  grep -Fxq "$DOCKER_NETWORK" <<<"$networks"
}

container_mounts() {
  docker inspect --format '{{range .Mounts}}{{printf "%s|%s|%s\n" .Type .Name .Destination}}{{end}}' "$1"
}

container_has_mount() {
  local container="$1" volume="$2" destination="$3" mounts
  mounts="$(container_mounts "$container")"
  grep -Fxq "volume|$volume|$destination" <<<"$mounts"
}

verify_database_container() {
  container_exists "$DATABASE_CONTAINER" || { fail "the existing MongoDB container is missing"; return 1; }
  container_is_running "$DATABASE_CONTAINER" || { fail "the existing MongoDB container is not running"; return 1; }
  [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$DATABASE_CONTAINER")" == "healthy" ]] \
    || { fail "the existing MongoDB container is not healthy"; return 1; }
  container_has_network "$DATABASE_CONTAINER" || { fail "MongoDB is not attached to $DOCKER_NETWORK"; return 1; }
  container_has_mount "$DATABASE_CONTAINER" "$DATABASE_VOLUME" "/data/db" \
    || { fail "MongoDB data volume does not match the configured production volume"; return 1; }

  local aliases
  aliases="$(docker inspect --format '{{with index .NetworkSettings.Networks "souqak_default"}}{{range .Aliases}}{{println .}}{{end}}{{end}}' "$DATABASE_CONTAINER")"
  grep -Fxq "$MONGODB_URI_HOST" <<<"$aliases" \
    || { fail "MONGODB_URI_HOST is not an alias on the existing Docker network"; return 1; }
}

verify_backend_volumes() {
  container_has_network "$BACKEND_CONTAINER" || { fail "the current backend is not attached to $DOCKER_NETWORK"; return 1; }
  [[ "$(docker port "$BACKEND_CONTAINER" "$BACKEND_INTERNAL_PORT/tcp" 2>/dev/null)" == "127.0.0.1:$BACKEND_PORT" ]] \
    || { fail "the existing backend must bind only 127.0.0.1:$BACKEND_PORT"; return 1; }
  container_has_mount "$BACKEND_CONTAINER" "$UPLOADS_VOLUME" "/app/uploads" \
    || { fail "the current backend uploads volume does not match the configured production volume"; return 1; }
  container_has_mount "$BACKEND_CONTAINER" "$PRIVATE_UPLOADS_VOLUME" "/app/private_uploads" \
    || { fail "the current backend private-uploads volume does not match the configured production volume"; return 1; }
}

check_frontend_release() {
  local expected="$1"
  local actual status
  actual="$(curl --silent --show-error --fail --max-time 15 \
    --resolve "$NGINX_FRONTEND_HOST:443:127.0.0.1" \
    "$FRONTEND_HEALTH_URL/souqak-release.txt" 2>/dev/null)" \
    || { fail "Nginx frontend release health check failed"; return 1; }
  status="$(printf '%s' "$actual" | tr -d '\r\n')"
  [[ "$status" == "$expected" ]] \
    || { fail "Nginx is not serving the expected frontend release"; return 1; }
}

wait_for_backend() {
  local attempts="${1:-60}" attempt
  for ((attempt = 0; attempt < attempts; attempt++)); do
    if curl --silent --show-error --fail --max-time 3 \
      "http://127.0.0.1:$BACKEND_PORT$BACKEND_HEALTH_PATH" \
      --output /dev/null 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

atomic_frontend_link() {
  local target="$1"
  local temporary_link="${NGINX_FRONTEND_LINK}.tmp.$$"
  [[ -L "$NGINX_FRONTEND_LINK" ]] \
    || { fail "managed frontend path must already be a symlink; perform the documented one-time Nginx transition first"; return 1; }
  [[ -d "$target" ]] || { fail "frontend release directory is missing"; return 1; }
  validate_frontend_release_path "$target" || return 1
  [[ ! -e "$temporary_link" && ! -L "$temporary_link" ]] \
    || { fail "temporary frontend symlink path is already occupied"; return 1; }
  ln -s "$target" "$temporary_link"
  if ! mv -Tf "$temporary_link" "$NGINX_FRONTEND_LINK"; then
    rm -f -- "$temporary_link"
    fail "could not atomically switch the frontend symlink"
    return 1
  fi
}

validate_frontend_release_path() {
  local target="$1" resolved marker release_directory_name frontend_directory
  resolved="$(realpath -e "$target")" \
    || { fail "frontend release path cannot be resolved"; return 1; }
  [[ "$resolved" == "$RELEASES_DIR/"*/frontend/dist ]] \
    || { fail "frontend release target is outside the releases directory"; return 1; }
  [[ -f "$resolved/index.html" && -f "$resolved/sitemap.xml" \
      && -f "$resolved/robots.txt" && -f "$resolved/souqak-release.txt" ]] \
    || { fail "frontend release is missing required static or SEO files"; return 1; }
  marker="$(cat "$resolved/souqak-release.txt")"
  if [[ "$resolved" == "$INITIAL_FRONTEND_BASELINE" ]]; then
    [[ "$marker" == "legacy-baseline-20261108" ]] \
      || { fail "initial frontend baseline marker is invalid"; return 1; }
  else
    release_directory_name="$(basename "$(dirname "$(dirname "$resolved")")")"
    [[ "$release_directory_name" =~ ^[a-f0-9]{40}$ && "$marker" == "$release_directory_name" \
        && -f "$resolved/prerender-manifest.json" ]] \
      || { fail "frontend release path and release marker do not match"; return 1; }
    frontend_directory="$(dirname "$resolved")"
    node "$frontend_directory/scripts/prerenderBuild.mjs" --validate "$resolved" \
      || { fail "frontend release SEO output failed validation"; return 1; }
  fi
}

verify_nginx_config() {
  local dump
  sudo -n nginx -t >/dev/null \
    || { fail "Nginx syntax validation failed or sudo permission for nginx -t is missing"; return 1; }
  sudo -n -l -- systemctl reload nginx >/dev/null 2>&1 \
    || { fail "non-interactive permission for systemctl reload nginx is missing"; return 1; }
  dump="$(sudo -n nginx -T 2>/dev/null)" || { fail "Nginx configuration could not be inspected"; return 1; }
  grep -Fq "root $NGINX_FRONTEND_LINK;" <<<"$dump" \
    || { fail "Nginx does not use the configured frontend release symlink"; return 1; }
  grep -Fq "server_name $NGINX_FRONTEND_HOST" <<<"$dump" \
    || { fail "Nginx does not declare the configured frontend host"; return 1; }
  grep -Fq "127.0.0.1:$BACKEND_PORT" <<<"$dump" \
    || { fail "Nginx does not proxy to the stable loopback backend port"; return 1; }
  systemctl is-active --quiet nginx || { fail "Nginx is not active"; return 1; }
}

verify_current_services() {
  container_exists "$BACKEND_CONTAINER" || { fail "the existing backend container is missing"; return 1; }
  container_is_running "$BACKEND_CONTAINER" || { fail "the existing backend container is not running"; return 1; }
  current_backend_id="$(docker inspect --format '{{.Id}}' "$BACKEND_CONTAINER")"
  verify_backend_volumes
  wait_for_backend || { fail "the existing backend readiness check failed"; return 1; }
  verify_nginx_config

  [[ -d "$INITIAL_FRONTEND_SOURCE" \
      && -f "$INITIAL_FRONTEND_SOURCE/index.html" \
      && -f "$INITIAL_FRONTEND_SOURCE/sitemap.xml" \
      && -f "$INITIAL_FRONTEND_SOURCE/robots.txt" ]] \
    || { fail "the verified pre-symlink frontend source is missing or incomplete"; return 1; }
  local current_frontend
  [[ -L "$NGINX_FRONTEND_LINK" ]] || { fail "the Nginx frontend root must already be the managed symlink"; return 1; }
  current_frontend="$(readlink -f "$NGINX_FRONTEND_LINK")"
  validate_frontend_release_path "$current_frontend"
  check_frontend_release "$(cat "$current_frontend/souqak-release.txt" 2>/dev/null)" \
    || { fail "the current frontend release marker is invalid"; return 1; }
}

prompt_for_release() {
  local action="$1" identifier="$2" reply
  [[ -t 0 ]] || { fail "activation requires an interactive terminal"; return 1; }
  printf 'Type the full release identifier to %s: ' "$action" >&2
  read -r reply
  [[ "$reply" == "$identifier" ]] || { fail "confirmation did not match"; return 1; }
}

assert_release_has_draft_fix() {
  local source="$1"
  grep -Fq 'one_incomplete_wallet_service_draft_per_service' \
    "$source/backend/src/models/DraftAction.js" \
    || { fail "the release does not define the per-service wallet draft index"; return 1; }
  grep -Fq 'wallet service drafts are unique per service, not per user' \
    "$source/backend/test/draftActions.test.js" \
    || { fail "the release is missing the multiservice draft regression test"; return 1; }
  grep -Fq 'autoIndex: false' "$source/backend/src/models/DraftAction.js" \
    || { fail "automatic draft index creation is not disabled"; return 1; }
  grep -Fq 'autoIndex: false' "$source/backend/src/lib/mongodb.js" \
    || { fail "automatic MongoDB index creation is not disabled"; return 1; }
  grep -Fq 'CMD ["node", "src/index.js"]' "$source/Dockerfile" \
    || { fail "the backend image startup command differs from the reviewed application entry point"; return 1; }
}

volume_is_available() {
  docker volume inspect "$1" >/dev/null 2>&1 \
    || { fail "required persistent Docker volume is missing"; return 1; }
}

. "$DEPLOY_SCRIPT_DIRECTORY/deploy/deploy-transaction.sh"

restore_after_failed_manual_rollback() {
  local rollback_failed=0 current_id
  printf '%s\n' "Rollback failed; restoring the application that was active before rollback began." >&2
  if container_exists "$BACKEND_CONTAINER"; then
    current_id="$(docker inspect --format '{{.Id}}' "$BACKEND_CONTAINER" 2>/dev/null || true)"
    if [[ "$current_id" == "$manual_previous_container_id" ]]; then
      docker stop --time 30 "$BACKEND_CONTAINER" >/dev/null 2>&1 || true
      if container_exists "$previous_container"; then
        rollback_failed=1
      else
        docker rename "$BACKEND_CONTAINER" "$previous_container" >/dev/null 2>&1 || rollback_failed=1
      fi
    fi
  fi
  if container_exists "$failed_container"; then
    if container_exists "$BACKEND_CONTAINER"; then
      rollback_failed=1
    else
      docker rename "$failed_container" "$BACKEND_CONTAINER" >/dev/null 2>&1 || rollback_failed=1
      docker start "$BACKEND_CONTAINER" >/dev/null 2>&1 || rollback_failed=1
    fi
  elif container_exists "$BACKEND_CONTAINER" && ! container_is_running "$BACKEND_CONTAINER"; then
    docker start "$BACKEND_CONTAINER" >/dev/null 2>&1 || rollback_failed=1
  fi
  if [[ -n "$manual_current_frontend" ]]; then
    atomic_frontend_link "$manual_current_frontend" || rollback_failed=1
    sudo -n nginx -t >/dev/null 2>&1 || rollback_failed=1
    sudo -n systemctl reload nginx >/dev/null 2>&1 || rollback_failed=1
  fi
  wait_for_backend 60 || rollback_failed=1
  if [[ -n "$manual_current_frontend" && -f "$manual_current_frontend/souqak-release.txt" ]]; then
    check_frontend_release "$(cat "$manual_current_frontend/souqak-release.txt")" || rollback_failed=1
  fi
  if ((rollback_failed)); then
    printf '%s\n' "Automatic recovery could not be fully verified; inspect service state manually." >&2
  else
    printf '%s\n' "Application state from before rollback restored and health-checked." >&2
  fi
}

release_id=""
release_directory=""
temporary_checkout=""
previous_container=""
previous_frontend=""
manual_current_frontend=""
manual_previous_container_id=""
failed_container=""
recovery_mode="deploy"
current_backend_id=""
old_backend_stopped=0
old_backend_renamed=0
new_backend_started=0
frontend_switched=0
activation_started=0
deployment_succeeded=0

on_exit() {
  local exit_code=$?
  trap - EXIT
  if ((exit_code != 0 && activation_started && !deployment_succeeded)); then
    if [[ "$recovery_mode" == "manual-rollback" ]]; then
      restore_after_failed_manual_rollback || true
    else
      restore_after_failed_deploy || true
    fi
  fi
  if [[ -n "$temporary_checkout" && -d "$temporary_checkout" ]]; then
    rm -rf -- "$temporary_checkout"
  fi
  exit "$exit_code"
}
trap on_exit EXIT

if [[ "$MODE" == "rollback" ]]; then
  [[ -f "$STATE_DIR/$STATE_FILE_NAME" ]] || { fail "no verified previous release is recorded"; exit 1; }
  mapfile -t rollback_state < "$STATE_DIR/$STATE_FILE_NAME"
  ((${#rollback_state[@]} == 3)) || { fail "rollback state is invalid"; exit 1; }
  release_id="${rollback_state[0]}"
  previous_container="${rollback_state[1]}"
  previous_frontend="${rollback_state[2]}"
  [[ "$release_id" =~ ^[a-f0-9]{40}$ ]] || { fail "rollback release identifier is invalid"; exit 1; }
  [[ "$previous_container" == "souqak-backend-rollback-$release_id" ]] \
    || { fail "rollback container name is invalid"; exit 1; }
  [[ "$previous_frontend" == "$RELEASES_DIR/"*/frontend/dist ]] \
    || { fail "previous frontend path is outside the release directory"; exit 1; }
  validate_frontend_release_path "$previous_frontend" || exit 1
  container_exists "$BACKEND_CONTAINER" || { fail "current backend container is missing"; exit 1; }
  container_exists "$previous_container" || { fail "previous backend container is missing"; exit 1; }
  container_is_running "$BACKEND_CONTAINER" || { fail "current backend container is not running"; exit 1; }
  container_is_running "$previous_container" && { fail "previous backend must be stopped before rollback"; exit 1; }
  verify_backend_volumes
  container_has_network "$previous_container" || { fail "previous backend is not on the production network"; exit 1; }
  container_has_mount "$previous_container" "$UPLOADS_VOLUME" "/app/uploads" \
    || { fail "previous backend uploads volume does not match the production volume"; exit 1; }
  container_has_mount "$previous_container" "$PRIVATE_UPLOADS_VOLUME" "/app/private_uploads" \
    || { fail "previous backend private-uploads volume does not match the production volume"; exit 1; }
  [[ "$(docker inspect --format '{{ index .Config.Labels "com.souqak.release" }}' "$BACKEND_CONTAINER")" == "$release_id" ]] \
    || { fail "current backend does not match the recorded release"; exit 1; }
  verify_nginx_config

  [[ -L "$NGINX_FRONTEND_LINK" ]] || { fail "current frontend path is not a symlink"; exit 1; }
  manual_current_frontend="$(readlink -f "$NGINX_FRONTEND_LINK")"
  validate_frontend_release_path "$manual_current_frontend" || exit 1
  check_frontend_release "$(cat "$manual_current_frontend/souqak-release.txt")" || exit 1
  manual_previous_container_id="$(docker inspect --format '{{.Id}}' "$previous_container")"
  failed_container="souqak-backend-rolledback-$release_id"
  container_exists "$failed_container" && { fail "rollback preservation container name is already in use"; exit 1; }
  prompt_for_release "roll back" "$release_id"
  recovery_mode="manual-rollback"
  activation_started=1
  docker stop --time 30 "$BACKEND_CONTAINER" >/dev/null
  docker rename "$BACKEND_CONTAINER" "$failed_container" >/dev/null
  docker rename "$previous_container" "$BACKEND_CONTAINER" >/dev/null
  docker start "$BACKEND_CONTAINER" >/dev/null
  wait_for_backend || { fail "previous backend did not become ready"; exit 1; }
  atomic_frontend_link "$previous_frontend"
  frontend_switched=1
  sudo -n nginx -t >/dev/null
  sudo -n systemctl reload nginx >/dev/null
  check_frontend_release "$(cat "$previous_frontend/souqak-release.txt")"
  deployment_succeeded=1
  rm -f -- "$STATE_DIR/$STATE_FILE_NAME"
  printf 'Rollback complete. Previous application release is active; MongoDB was not changed.\n'
  exit 0
fi

verify_database_container
volume_is_available "$UPLOADS_VOLUME"
volume_is_available "$PRIVATE_UPLOADS_VOLUME"
volume_is_available "$DATABASE_VOLUME"
verify_current_services

temporary_checkout="$(mktemp -d "$DEPLOY_ROOT/.souqak-build.XXXXXX")"
git clone --quiet --depth 1 --single-branch --branch "$RELEASE_BRANCH" \
  "$REPOSITORY_URL" "$temporary_checkout"
release_id="$(git -C "$temporary_checkout" rev-parse --verify HEAD)"
[[ "$release_id" =~ ^[a-f0-9]{40}$ ]] || { fail "GitHub did not return a valid commit identifier"; exit 1; }
node "$DEPLOY_SCRIPT_DIRECTORY/deploy/validate-draft-index-attestation.mjs" \
  "$DRAFT_INDEX_ATTESTATION_FILE" \
  "$temporary_checkout/backend/src/models/DraftAction.js"
release_directory="$RELEASES_DIR/$release_id"
docker_image="$BACKEND_IMAGE:$release_id"
previous_container="souqak-backend-rollback-$release_id"
container_exists "$previous_container" && { fail "rollback container name is already in use"; exit 1; }

assert_release_has_draft_fix "$temporary_checkout"
prompt_for_release "deploy" "$release_id"

(
  cd "$temporary_checkout/backend"
  unset MONGODB_URI DRAFT_INDEX_MIGRATION_URI DRAFT_INDEX_MIGRATION_APPROVED DRAFT_ACTIONS_WRITES_PAUSED
  unset JWT_SECRET JWT_REFRESH_SECRET
  npm ci --omit=dev --no-audit --no-fund
  env -i PATH="$PATH" HOME="$HOME" \
    JWT_SECRET="isolated-deploy-test-access-secret" \
    JWT_REFRESH_SECRET="isolated-deploy-test-refresh-secret" \
    node --test test/draftActions.test.js test/indexSchemaIndexes.test.js test/migrateWalletServiceDraftIndexes.test.js
)

previous_frontend="$(readlink -f "$NGINX_FRONTEND_LINK")"
validate_frontend_release_path "$previous_frontend"

release_already_built=0
if [[ -e "$release_directory" ]]; then
  [[ -d "$release_directory" && ! -L "$release_directory" ]] \
    || { fail "release path is occupied by a non-directory; preserve and inspect it"; exit 1; }
  [[ "$(git -C "$release_directory" rev-parse --verify HEAD 2>/dev/null || true)" == "$release_id" ]] \
    || { fail "existing release directory does not match this source commit; preserve and inspect it"; exit 1; }
  validate_frontend_release_path "$release_directory/frontend/dist"
  release_already_built=1
fi

image_already_built=0
if docker image inspect "$docker_image" >/dev/null 2>&1; then
  image_source_commit="$(docker image inspect --format '{{ index .Config.Labels "com.souqak.source-commit" }}' "$docker_image" 2>/dev/null || true)"
  [[ "$image_source_commit" == "$release_id" ]] \
    || { fail "an image with this release tag exists but its source label cannot be verified; preserve and inspect it"; exit 1; }
  image_already_built=1
fi

(
  cd "$temporary_checkout/frontend"
  unset MONGODB_URI JWT_SECRET JWT_REFRESH_SECRET DRAFT_INDEX_MIGRATION_URI \
    DRAFT_INDEX_MIGRATION_APPROVED DRAFT_ACTIONS_WRITES_PAUSED
  npm ci --no-audit --no-fund
  env -i PATH="$PATH" HOME="$HOME" npm test
  if ((release_already_built == 0)); then
    env -i PATH="$PATH" HOME="$HOME" \
      PUBLIC_SITE_URL="$PUBLIC_SITE_URL" \
      VITE_API_URL="$VITE_API_URL" \
      VITE_SOCKET_URL="$VITE_SOCKET_URL" \
      SEO_PRERENDER_DATA_SOURCE="api" \
      PRERENDER_DISABLED="false" \
      VITE_MAINTENANCE_MODE="false" \
      npm run build
  else
    node scripts/prerenderBuild.mjs --validate "$release_directory/frontend/dist"
  fi
)

if ((image_already_built == 0)); then
  build_backend_image
fi

if ((release_already_built == 0)); then
  printf '%s\n' "$release_id" > "$temporary_checkout/frontend/dist/souqak-release.txt"
  rm -rf -- "$temporary_checkout/backend/node_modules" "$temporary_checkout/frontend/node_modules"
  if ! mv -- "$temporary_checkout" "$release_directory"; then
    fail "could not finalize the verified release; the active services were not changed"
    exit 1
  fi
  temporary_checkout=""
fi

validate_frontend_release_path "$release_directory/frontend/dist"

container_is_running "$BACKEND_CONTAINER" \
  || { fail "the existing backend changed state during the build; no activation was attempted"; exit 1; }
[[ "$(docker inspect --format '{{.Id}}' "$BACKEND_CONTAINER")" == "$current_backend_id" ]] \
  || { fail "the existing backend container changed during the build; no activation was attempted"; exit 1; }
wait_for_backend || { fail "the existing backend stopped passing readiness during the build"; exit 1; }
[[ -L "$NGINX_FRONTEND_LINK" && "$(readlink -f "$NGINX_FRONTEND_LINK")" == "$previous_frontend" ]] \
  || { fail "the frontend symlink changed during the build; no activation was attempted"; exit 1; }
check_frontend_release "$(cat "$previous_frontend/souqak-release.txt")"
verify_nginx_config
container_exists "$previous_container" \
  && { fail "rollback container name became occupied during the build"; exit 1; }

activate_release || exit 1

state_temporary="$STATE_DIR/.last-rollback.$$"
printf '%s\n%s\n%s\n' "$release_id" "$previous_container" "$previous_frontend" > "$state_temporary"
chmod 600 "$state_temporary"
mv -f -- "$state_temporary" "$STATE_DIR/$STATE_FILE_NAME"
deployment_succeeded=1
printf 'Deployment complete: %s. Previous backend and frontend are retained for ./deploy.sh --rollback.\n' "$release_id"
