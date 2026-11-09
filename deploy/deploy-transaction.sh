build_backend_image() {
  docker build --pull --tag "$docker_image" \
    --label "com.souqak.release=$release_id" \
    --label "com.souqak.source-commit=$release_id" \
    --file "$temporary_checkout/Dockerfile" "$temporary_checkout"
}

activate_release() {
  activation_started=1
  docker stop --time 30 "$BACKEND_CONTAINER" >/dev/null \
    || { fail "could not stop the current backend cleanly"; return 1; }
  old_backend_stopped=1
  docker rename "$BACKEND_CONTAINER" "$previous_container" >/dev/null \
    || { fail "could not preserve the current backend container"; return 1; }
  old_backend_renamed=1

  docker run --detach \
    --name "$BACKEND_CONTAINER" \
    --restart unless-stopped \
    --init \
    --security-opt no-new-privileges:true \
    --label "com.souqak.release=$release_id" \
    --network "$DOCKER_NETWORK" \
    --publish "127.0.0.1:$BACKEND_PORT:$BACKEND_INTERNAL_PORT" \
    --env-file "$ENV_FILE" \
    --env NODE_ENV=production \
    --env PORT="$BACKEND_INTERNAL_PORT" \
    --mount "type=volume,source=$UPLOADS_VOLUME,target=/app/uploads" \
    --mount "type=volume,source=$PRIVATE_UPLOADS_VOLUME,target=/app/private_uploads" \
    "$docker_image" >/dev/null \
    || { fail "could not start the new backend"; return 1; }
  new_backend_started=1
  wait_for_backend || { fail "new backend did not become ready"; return 1; }

  atomic_frontend_link "$release_directory/frontend/dist" || return 1
  frontend_switched=1
  sudo -n nginx -t >/dev/null || { fail "Nginx configuration check failed after frontend switch"; return 1; }
  sudo -n systemctl reload nginx >/dev/null || { fail "Nginx reload failed after frontend switch"; return 1; }
  wait_for_backend || { fail "backend readiness failed after Nginx reload"; return 1; }
  check_frontend_release "$release_id"
}

restore_after_failed_deploy() {
  local rollback_failed=0 current_release previous_marker
  printf '%s\n' "Deployment failed after activation began; restoring the previous backend and frontend." >&2

  if container_exists "$BACKEND_CONTAINER"; then
    current_release="$(docker inspect --format '{{ index .Config.Labels "com.souqak.release" }}' "$BACKEND_CONTAINER" 2>/dev/null || true)"
    if [[ "$current_release" == "$release_id" ]]; then
      docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1 || rollback_failed=1
    elif ((old_backend_renamed)); then
      rollback_failed=1
    fi
  fi

  if container_exists "$previous_container"; then
    if container_exists "$BACKEND_CONTAINER"; then
      rollback_failed=1
    else
      docker rename "$previous_container" "$BACKEND_CONTAINER" >/dev/null 2>&1 || rollback_failed=1
      if ((rollback_failed == 0)); then
        docker start "$BACKEND_CONTAINER" >/dev/null || rollback_failed=1
      fi
    fi
  elif container_exists "$BACKEND_CONTAINER" && ! container_is_running "$BACKEND_CONTAINER"; then
    docker start "$BACKEND_CONTAINER" >/dev/null || rollback_failed=1
  fi

  if ((frontend_switched)) && [[ -n "$previous_frontend" ]]; then
    atomic_frontend_link "$previous_frontend" || rollback_failed=1
    sudo -n nginx -t >/dev/null 2>&1 || rollback_failed=1
    sudo -n systemctl reload nginx >/dev/null 2>&1 || rollback_failed=1
  fi

  wait_for_backend 60 || rollback_failed=1
  if [[ -n "$previous_frontend" ]]; then
    previous_marker="$(cat "$previous_frontend/souqak-release.txt" 2>/dev/null || true)"
    [[ -n "$previous_marker" ]] || rollback_failed=1
    check_frontend_release "$previous_marker" || rollback_failed=1
  fi

  if ((rollback_failed)); then
    printf '%s\n' "Automatic rollback could not be fully verified; preserved containers and releases require manual inspection." >&2
    return 1
  fi
  printf '%s\n' "Previous application release restored and health-checked." >&2
}
