#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIRECTORY/deploy/prepare-release.py" "$@"
