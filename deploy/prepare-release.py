#!/usr/bin/env python3
"""Prepare and test an immutable Souqak release without production privileges."""

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None

REPOSITORY = "https://github.com/Omar-Bamasaq/Souqak-yem.git"
BRANCH = "main"
PUBLIC_SITE_URL = "https://souqak-yem.com"
VITE_API_URL = "https://api.souqak-yem.com/api"
VITE_SOCKET_URL = "https://api.souqak-yem.com"
BACKEND_TESTS = (
    "test/draftActions.test.js",
    "test/indexSchemaIndexes.test.js",
    "test/migrateWalletServiceDraftIndexes.test.js",
    "test/socketAuthorization.test.js",
    "test/privateMessageAttachments.test.js",
    "test/storePublicVisibility.test.js",
)


class PrepareError(Exception):
    pass


def tree_digest(root):
    root = Path(root)
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise PrepareError("Release output contains a symbolic link.")
        if path.is_dir():
            continue
        if not path.is_file():
            raise PrepareError("Release output contains a non-regular file.")
        digest.update(relative.encode("utf-8") + b"\0")
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
    return digest.hexdigest()


def run(command, *, cwd, env=None):
    subprocess.run(command, cwd=cwd, env=env, check=True)


def isolated_environment(home, **values):
    environment = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": str(home),
        "CI": "1",
        "JWT_ACCESS_SECRET": "isolated-deployment-test-access",
        "JWT_REFRESH_SECRET": "isolated-deployment-test-refresh",
    }
    environment.update(values)
    return environment


def prepare(release_id, output_root=None, runner=run):
    if not re.fullmatch(r"[a-f0-9]{40}", release_id or ""):
        raise PrepareError("Provide the full 40-character lowercase commit SHA.")
    if getattr(os, "geteuid", lambda: -1)() == 0:
        raise PrepareError("Prepare releases as souqak, never as root.")

    output_root = Path(output_root or (Path.home() / "deploy" / "prepared"))
    if output_root.is_symlink():
        raise PrepareError("The prepared-release directory must not be a symlink.")
    output_root.mkdir(parents=True, exist_ok=True)
    if output_root.resolve() != output_root.absolute():
        raise PrepareError("The prepared-release path must not contain symlink components.")
    final_directory = output_root / release_id
    if final_directory.exists() or final_directory.is_symlink():
        raise PrepareError("A prepared release with this SHA already exists; preserve and inspect it.")

    lock_path = output_root.parent / ".souqak-prepare.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as lock_file:
        if fcntl is None:
            raise PrepareError("Release preparation requires Ubuntu/Linux file locking.")
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix=f".{release_id}.", dir=output_root) as temporary:
            work = Path(temporary)
            source = work / "source"
            runner(
                ["git", "clone", "--quiet", "--no-checkout", "--single-branch",
                 "--branch", BRANCH, REPOSITORY, str(source)],
                cwd=work,
            )
            runner(["git", "checkout", "--quiet", "--detach", release_id], cwd=source)
            actual = subprocess.check_output(
                ["git", "rev-parse", "--verify", "HEAD"], cwd=source, text=True
            ).strip()
            if actual != release_id:
                raise PrepareError("The checked-out source does not match the requested SHA.")
            runner(
                ["git", "merge-base", "--is-ancestor", release_id, f"origin/{BRANCH}"],
                cwd=source,
            )

            backend = source / "backend"
            frontend = source / "frontend"
            clean_env = isolated_environment(work)
            runner(["npm", "ci", "--no-audit", "--no-fund"], cwd=backend, env=clean_env)
            runner(["node", "--test", *BACKEND_TESTS], cwd=backend, env=clean_env)
            runner(["npm", "ci", "--no-audit", "--no-fund"], cwd=frontend, env=clean_env)
            runner(["npm", "test"], cwd=frontend, env=clean_env)

            frontend_env = isolated_environment(
                work,
                PUBLIC_SITE_URL=PUBLIC_SITE_URL,
                VITE_API_URL=VITE_API_URL,
                VITE_SOCKET_URL=VITE_SOCKET_URL,
                SEO_PRERENDER_DATA_SOURCE="api",
                PRERENDER_DISABLED="false",
                VITE_MAINTENANCE_MODE="false",
            )
            runner(["npm", "run", "build"], cwd=frontend, env=frontend_env)

            dist = frontend / "dist"
            required = ("index.html", "sitemap.xml", "robots.txt", "prerender-manifest.json")
            if not dist.is_dir() or any(not (dist / name).is_file() for name in required):
                raise PrepareError("Frontend build is missing required static or SEO output.")
            (dist / "souqak-release.txt").write_text(release_id + "\n", encoding="utf-8")
            output_frontend = work / "frontend" / "dist"
            output_frontend.parent.mkdir(parents=True)
            shutil.copytree(dist, output_frontend)
            manifest = {
                "schema": 1,
                "repository": REPOSITORY,
                "branch": BRANCH,
                "release": release_id,
                "prepared_at": datetime.now(timezone.utc).isoformat(),
                "checks": {
                    "backend_tests": list(BACKEND_TESTS),
                    "frontend_tests": True,
                    "frontend_build": True,
                },
                "frontend_sha256": tree_digest(output_frontend),
                "backend_image": "built only by the protected activation helper",
            }
            (work / "manifest.json").write_text(
                json.dumps(manifest, sort_keys=True, indent=2) + "\n", encoding="utf-8"
            )
            (work / "readiness.txt").write_text(
                f"READY FOR ADMIN REVIEW\nRelease: {release_id}\n"
                f"Frontend SHA-256: {manifest['frontend_sha256']}\n"
                "No production service, Docker daemon, database, or volume was accessed.\n",
                encoding="utf-8",
            )
            bundle = work / "bundle"
            bundle.mkdir()
            shutil.copy2(work / "manifest.json", bundle / "manifest.json")
            shutil.copy2(work / "readiness.txt", bundle / "readiness.txt")
            shutil.copytree(output_frontend, bundle / "frontend" / "dist")
            os.replace(bundle, final_directory)

    print(f"Prepared release {release_id} at {final_directory}")
    print(f"Frontend SHA-256: {manifest['frontend_sha256']}")
    print("Review readiness.txt and manifest.json. No activation was attempted.")


def main(argv):
    if len(argv) == 2 and argv[0] == "--dry-run":
        if not re.fullmatch(r"[a-f0-9]{40}", argv[1]):
            raise PrepareError("Provide the full 40-character lowercase commit SHA.")
        print(f"Would fetch, test, and build exact commit {argv[1]} from {BRANCH}.")
        print("Would not access Docker, Nginx, production environment files, or services.")
        return 0
    if len(argv) != 2 or argv[0] != "--prepare":
        print("Usage: ./deploy.sh --dry-run <full-commit-sha>", file=sys.stderr)
        print("       ./deploy.sh --prepare <full-commit-sha>", file=sys.stderr)
        return 2
    prepare(argv[1])
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except (PrepareError, OSError, subprocess.CalledProcessError, BlockingIOError) as error:
        print(f"Release preparation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
