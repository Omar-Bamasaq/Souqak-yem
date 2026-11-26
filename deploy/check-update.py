#!/usr/bin/env python3
"""Read-only entry point for the protected activation helper's dry-run checks."""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPOSITORY = "https://github.com/Omar-Bamasaq/Souqak-yem.git"
ACTIVE_STATE = Path("/var/lib/souqak-deploy/last-activation.json")
ACTIVATOR = Path("/usr/local/libexec/souqak/activate-release.py")
PREPARED_ROOT = Path("/home/souqak/deploy/prepared")
INSTALLED_PATH = Path("/usr/local/libexec/souqak/check-update.py")


def verify_installed_helper():
    if Path(__file__).resolve() != INSTALLED_PATH:
        raise RuntimeError("Install and invoke the reviewed protected checker.")
    for path in (INSTALLED_PATH, *INSTALLED_PATH.parents):
        metadata = path.lstat()
        if (
            path.is_symlink()
            or metadata.st_uid != 0
            or metadata.st_mode & 0o022
        ):
            raise RuntimeError("Protected checker paths must be root-owned and non-writable by others.")


def check_active_against_main():
    metadata = ACTIVE_STATE.lstat()
    if (
        ACTIVE_STATE.is_symlink()
        or not ACTIVE_STATE.is_file()
        or metadata.st_uid != 0
        or metadata.st_mode & 0o077
        or metadata.st_size > 16 * 1024
    ):
        raise RuntimeError("Protected active-release state is unavailable.")
    try:
        state = json.loads(ACTIVE_STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise RuntimeError("Protected active-release state is invalid.") from error
    active = state.get("release") if isinstance(state, dict) and state.get("status") == "active" else None
    if not isinstance(active, str) or not re.fullmatch(r"[a-f0-9]{40}", active):
        raise RuntimeError("No active Git release SHA is recorded.")

    def git(directory, *arguments):
        return subprocess.run(
            ["git", "-C", str(directory), *arguments],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    try:
        with tempfile.TemporaryDirectory(prefix="souqak-check-update-") as temporary:
            repository = Path(temporary)
            git(repository, "init", "--quiet")
            git(repository, "remote", "add", "origin", REPOSITORY)
            git(repository, "fetch", "--quiet", "--no-tags", "origin", "main")
            latest = git(repository, "rev-parse", "--verify", "FETCH_HEAD")
            if not re.fullmatch(r"[a-f0-9]{40}", latest):
                raise RuntimeError("GitHub main returned an invalid commit SHA.")
            if active != latest:
                git(repository, "fetch", "--quiet", "--no-tags", "origin", active)
                git(repository, "merge-base", "--is-ancestor", active, latest)
    except (OSError, subprocess.CalledProcessError) as error:
        raise RuntimeError("GitHub main is unavailable or is not a descendant of the active release.") from error

    print(f"ACTIVE: {active}")
    print(f"GITHUB_MAIN: {latest}")
    print("UPDATE: NOT_REQUIRED" if active == latest else f"UPDATE_CANDIDATE: {latest}")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check updates or validate one explicit prepared release.")
    parser.add_argument("--release", help="full lowercase 40-character prepared release SHA")
    args = parser.parse_args(argv)
    if getattr(os, "geteuid", lambda: -1)() != 0:
        parser.error("run through the managed sudo wrapper")
    try:
        verify_installed_helper()
    except (OSError, RuntimeError) as error:
        parser.error(str(error))
    if args.release is None:
        try:
            return check_active_against_main()
        except (OSError, RuntimeError) as error:
            print(f"Update check failed: {error}", file=sys.stderr)
            return 1
    if not re.fullmatch(r"[a-f0-9]{40}", args.release):
        parser.error("release must be a full lowercase 40-character SHA")
    bundle = PREPARED_ROOT / args.release
    try:
        return subprocess.run(
            [
                sys.executable,
                str(ACTIVATOR),
                "--dry-run",
                "--release",
                args.release,
                "--bundle",
                str(bundle),
            ],
            check=False,
        ).returncode
    except OSError as error:
        print(f"Protected release check could not start: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
