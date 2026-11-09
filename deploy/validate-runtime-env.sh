runtime_env_key_counts() {
  local env_file="$1" key_names="$2"
  awk -F= -v key_names="$key_names" '
    BEGIN {
      count = split(key_names, names, " ")
      for (i = 1; i <= count; i++) required[names[i]] = 1
    }
    /^[[:space:]]*#/ { next }
    {
      separator = index($0, "=")
      if (!separator) next
      key = substr($0, 1, separator - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      if (!(key in required)) next

      total++
      value = substr($0, separator + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (value != "" && value != "\"\"" && value != "\047\047") populated++
    }
    END { printf "%d %d\n", total, populated }
  ' "$env_file"
}

require_single_runtime_env_key() {
  local env_file="$1" description="$2" key_names="$3" total populated
  read -r total populated < <(runtime_env_key_counts "$env_file" "$key_names")
  [[ "$total" == "1" && "$populated" == "1" ]] \
    || { fail "the production env file must contain exactly one non-empty $description entry"; return 1; }
}

validate_runtime_env() {
  local env_file="$1"
  require_single_runtime_env_key "$env_file" "MONGODB_URI" "MONGODB_URI" || return 1
  require_single_runtime_env_key "$env_file" "JWT access secret" \
    "JWT_ACCESS_SECRET ACCESS_TOKEN_SECRET JWT_SECRET ACCESS_SECRET" || return 1
  require_single_runtime_env_key "$env_file" "JWT refresh secret" \
    "JWT_REFRESH_SECRET REFRESH_TOKEN_SECRET REFRESH_SECRET"
}
