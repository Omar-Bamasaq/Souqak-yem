#!/usr/bin/env python3
"""Root-owned, fixed-policy Souqak activation and rollback helper."""

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath

try:
    import fcntl
except ImportError:
    fcntl = None
try:
    import pwd
except ImportError:
    pwd = None

REPOSITORY = "https://github.com/Omar-Bamasaq/Souqak-yem.git"
BRANCH = "main"
DEPLOY_ROOT = Path("/home/souqak/deploy")
PREPARED_ROOT = DEPLOY_ROOT / "prepared"
MANAGED_RELEASES = DEPLOY_ROOT / "managed-releases"
FRONTEND_LINK = DEPLOY_ROOT / "current-frontend"
ENV_FILE = DEPLOY_ROOT / "souqak" / ".env"
STATE_ROOT = Path("/var/lib/souqak-deploy")
STATE_FILE = STATE_ROOT / "last-activation.json"
LOCK_FILE = STATE_ROOT / "activation.lock"
STAGING_ROOT = STATE_ROOT / "staging"
BUILD_ROOT = Path("/var/lib/souqak-build-work")
BUILD_USER = "souqak-build"
BACKEND = "souqak-backend"
MONGODB = "souqak-mongo-1"
NETWORK = "souqak_default"
DATABASE_VOLUME = "souqak_mongo_data"
UPLOADS_VOLUME = "souqak_uploads_data"
PRIVATE_UPLOADS_VOLUME = "souqak_private_uploads_data"
IMAGE_REPOSITORY = "souqak-backend"
BACKEND_PORT = "5000"
HEALTH_PATH = "/api/health/readiness"
SITE_HOST = "souqak-yem.com"
SITE_HEALTH_URL = "https://souqak-yem.com"
INITIAL_FRONTEND = MANAGED_RELEASES / "legacy-baseline-20261108" / "frontend" / "dist"
MAX_BUNDLE_BYTES = 2 * 1024 * 1024 * 1024
MAX_FILE_BYTES = 256 * 1024 * 1024
REQUIRED_FRONTEND_FILES = (
    "index.html",
    "sitemap.xml",
    "robots.txt",
    "prerender-manifest.json",
    "souqak-release.txt",
)
DRAFT_INDEX_ATTESTATION_VALUES = {
    "FORMAT": "souqak-draft-index-attestation-v1",
    "DATABASE": "suqaq",
    "REPLICA_SET": "rs0",
    "COLLECTION": "draftactions",
    "REQUIRED_INDEXES": (
        "one_incomplete_non_wallet_draft_per_user_type,"
        "one_incomplete_wallet_service_draft_per_service"
    ),
    "REQUIRED_INDEX_SPECIFICATIONS": (
        "one_incomplete_non_wallet_draft_per_user_type|userId:1,type:1|unique|"
        "incomplete non-wallet action types;"
        "one_incomplete_wallet_service_draft_per_service|userId:1,type:1,serviceId:1|"
        "unique|incomplete wallet_service_catalog with serviceId:ObjectId"
    ),
    "LEGACY_USER_TYPE_INDEX": "absent",
    "DUPLICATE_INCOMPLETE_DRAFT_GROUPS": "0",
    "WALLET_SERVICE_ID_ANOMALIES": "0",
}


class DeploymentError(Exception):
    pass


def digest_tree(root):
    root = Path(root)
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        if path.is_symlink():
            raise DeploymentError("A release contains a symbolic link.")
        if path.is_dir():
            continue
        if not path.is_file():
            raise DeploymentError("A release contains a non-regular file.")
        digest.update(path.relative_to(root).as_posix().encode("utf-8") + b"\0")
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
    return digest.hexdigest()


def _copy_open_file(source_fd, target, metadata, total):
    if not stat.S_ISREG(metadata.st_mode):
        raise DeploymentError("The submitted release contains a special file.")
    if metadata.st_size > MAX_FILE_BYTES or total[0] + metadata.st_size > MAX_BUNDLE_BYTES:
        raise DeploymentError("The submitted release exceeds the allowed size.")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(source_fd, flags) if isinstance(source_fd, str) else source_fd
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or (before.st_dev, before.st_ino) != (
            metadata.st_dev, metadata.st_ino
        ):
            raise DeploymentError("A submitted release file changed during snapshot.")
        target.parent.mkdir(parents=True, exist_ok=True)
        output_fd = os.open(
            target,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o600,
        )
        try:
            while True:
                block = os.read(fd, 1024 * 1024)
                if not block:
                    break
                view = memoryview(block)
                while view:
                    written = os.write(output_fd, view)
                    view = view[written:]
                total[0] += len(block)
                if total[0] > MAX_BUNDLE_BYTES:
                    raise DeploymentError("The submitted release exceeds the allowed size.")
        finally:
            os.close(output_fd)
        after = os.fstat(fd)
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise DeploymentError("A submitted release file changed during snapshot.")
    finally:
        os.close(fd)


def _same_inode(left, right):
    return (
        left.st_dev == right.st_dev
        and left.st_ino == right.st_ino
        and stat.S_IFMT(left.st_mode) == stat.S_IFMT(right.st_mode)
    )


def _stable_metadata(before, after):
    return (
        _same_inode(before, after)
        and before.st_size == after.st_size
        and before.st_mtime_ns == after.st_mtime_ns
        and before.st_ctime_ns == after.st_ctime_ns
    )


def _open_pinned_at(parent_fd, name):
    flags = os.O_PATH | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
    fd = os.open(name, flags, dir_fd=parent_fd)
    metadata = os.fstat(fd)
    if stat.S_ISLNK(metadata.st_mode):
        os.close(fd)
        raise DeploymentError("Frontend build output contains a symbolic link.")
    if not (stat.S_ISDIR(metadata.st_mode) or stat.S_ISREG(metadata.st_mode)):
        os.close(fd)
        raise DeploymentError("Frontend build output contains a special file.")
    return fd, metadata


def _open_pinned_directory(path_fd, expected):
    fd = os.open(
        f"/proc/self/fd/{path_fd}",
        os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_CLOEXEC", 0),
    )
    if not _same_inode(expected, os.fstat(fd)):
        os.close(fd)
        raise DeploymentError("Frontend build directory changed while it was opened.")
    return fd


def _copy_build_file(parent_fd, name, source_fd, metadata, target, total):
    if metadata.st_size > MAX_FILE_BYTES or total[0] + metadata.st_size > MAX_BUNDLE_BYTES:
        raise DeploymentError("Frontend build output exceeds the allowed size.")
    input_fd = os.open(
        f"/proc/self/fd/{source_fd}",
        os.O_RDONLY | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_CLOEXEC", 0),
    )
    try:
        before = os.fstat(input_fd)
        if not stat.S_ISREG(before.st_mode) or not _same_inode(metadata, before):
            raise DeploymentError("Frontend build file changed while it was opened.")
        target_fd = os.open(
            target,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o600,
        )
        try:
            while True:
                block = os.read(input_fd, 1024 * 1024)
                if not block:
                    break
                view = memoryview(block)
                while view:
                    written = os.write(target_fd, view)
                    view = view[written:]
                total[0] += len(block)
                if total[0] > MAX_BUNDLE_BYTES:
                    raise DeploymentError("Frontend build output exceeds the allowed size.")
        finally:
            os.close(target_fd)
        after = os.fstat(input_fd)
        if not _stable_metadata(before, after):
            raise DeploymentError("Frontend build file changed while it was copied.")
    finally:
        os.close(input_fd)

    current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
    if not _same_inode(metadata, current):
        raise DeploymentError("Frontend build entry was replaced while it was copied.")


def _copy_build_directory(source_fd, target, total):
    source_before = os.fstat(source_fd)
    for name in sorted(os.listdir(source_fd)):
        if name in {".", ".."} or "/" in name or "\0" in name:
            raise DeploymentError("Frontend build output contains an invalid path.")
        entry_fd, entry_stat = _open_pinned_at(source_fd, name)
        try:
            if stat.S_ISDIR(entry_stat.st_mode):
                child_fd = _open_pinned_directory(entry_fd, entry_stat)
                child_target = target / name
                child_target.mkdir(mode=0o700)
                try:
                    _copy_build_directory(child_fd, child_target, total)
                    child_after = os.fstat(child_fd)
                    if not _stable_metadata(entry_stat, child_after):
                        raise DeploymentError("Frontend build directory changed while it was copied.")
                finally:
                    os.close(child_fd)
                current = os.stat(name, dir_fd=source_fd, follow_symlinks=False)
                if not _same_inode(entry_stat, current):
                    raise DeploymentError("Frontend build directory was replaced while it was copied.")
            else:
                _copy_build_file(source_fd, name, entry_fd, entry_stat, target / name, total)
        finally:
            os.close(entry_fd)
    source_after = os.fstat(source_fd)
    if (
        source_before.st_mtime_ns != source_after.st_mtime_ns
        or source_before.st_ctime_ns != source_after.st_ctime_ns
    ):
        raise DeploymentError("Frontend build directory changed while it was copied.")


def copy_frontend_build(source, destination):
    if not all(hasattr(os, name) for name in ("O_PATH", "O_NOFOLLOW", "O_DIRECTORY")):
        raise DeploymentError("Secure frontend promotion requires Linux O_PATH and no-follow support.")
    source = Path(source).absolute()
    try:
        relative = source.relative_to(BUILD_ROOT)
    except ValueError as error:
        raise DeploymentError("Frontend build output is outside the protected build workspace.") from error
    if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
        raise DeploymentError("Frontend build output has an invalid path.")

    current_fd = os.open(
        BUILD_ROOT,
        os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
    )
    directory_fds = [current_fd]
    opened_chain = []
    try:
        root_stat = os.fstat(current_fd)
        if root_stat.st_uid != os.geteuid() or root_stat.st_mode & 0o022:
            raise DeploymentError("Frontend build workspace root must be protected and root-owned.")
        for component in relative.parts:
            next_fd, entry_stat = _open_pinned_at(current_fd, component)
            if not stat.S_ISDIR(entry_stat.st_mode):
                os.close(next_fd)
                raise DeploymentError("Frontend build path contains a non-directory component.")
            try:
                readable_fd = _open_pinned_directory(next_fd, entry_stat)
            finally:
                os.close(next_fd)
            opened_chain.append((current_fd, component, entry_stat))
            directory_fds.append(readable_fd)
            current_fd = readable_fd

        destination = Path(destination)
        destination_fd = os.open(
            destination,
            os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
        )
        try:
            destination_stat = os.fstat(destination_fd)
            if destination_stat.st_uid != os.geteuid() or destination_stat.st_mode & 0o022:
                raise DeploymentError("Frontend release destination must be protected and root-owned.")
            _copy_build_directory(current_fd, destination, [0])
        finally:
            os.close(destination_fd)
        for parent_fd, name, expected in opened_chain:
            current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            if not _same_inode(expected, current):
                raise DeploymentError("Frontend build path was replaced while it was copied.")
    finally:
        for fd in reversed(directory_fds):
            os.close(fd)


def snapshot_directory(source_fd, destination, relative, total):
    for name in sorted(os.listdir(source_fd)):
        if name in {".", ".."} or "/" in name or "\\" in name:
            raise DeploymentError("The submitted release contains an invalid path.")
        source_stat = os.stat(name, dir_fd=source_fd, follow_symlinks=False)
        target = destination / name
        child_relative = relative / name
        parts = child_relative.parts
        allowed = (
            parts == ("manifest.json",)
            or parts == ("readiness.txt",)
            or parts == ("frontend",)
            or parts == ("frontend", "dist")
            or (len(parts) >= 3 and parts[:2] == ("frontend", "dist"))
        )
        if not allowed:
            raise DeploymentError("Prepared bundle contains an unexpected path.")
        if stat.S_ISDIR(source_stat.st_mode):
            child_fd = os.open(
                name,
                os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0),
                dir_fd=source_fd,
            )
            try:
                opened = os.fstat(child_fd)
                if (opened.st_dev, opened.st_ino) != (source_stat.st_dev, source_stat.st_ino):
                    raise DeploymentError("A submitted directory changed during snapshot.")
                target.mkdir(mode=0o700)
                snapshot_directory(child_fd, target, child_relative, total)
            finally:
                os.close(child_fd)
        elif stat.S_ISREG(source_stat.st_mode):
            source_file_fd = os.open(
                name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=source_fd
            )
            _copy_open_file(source_file_fd, target, source_stat, total)
        else:
            raise DeploymentError("The submitted release contains a link or special file.")


def snapshot_bundle(bundle, destination, expected_release, submitter_uid):
    bundle = Path(bundle)
    if not bundle.is_absolute() or bundle.parent != PREPARED_ROOT:
        raise DeploymentError("Release directory must be a direct child of the prepared-release directory.")
    if bundle.name != expected_release or not re.fullmatch(r"[a-f0-9]{40}", expected_release):
        raise DeploymentError("Release directory does not match the approved full commit SHA.")
    if os.open not in os.supports_dir_fd or not hasattr(os, "O_NOFOLLOW"):
        raise DeploymentError("Secure release snapshot requires Linux openat and O_NOFOLLOW support.")
    if PREPARED_ROOT.is_symlink():
        raise DeploymentError("Prepared-release root must not be a symlink.")
    prepared_fd = os.open(
        PREPARED_ROOT,
        os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0),
    )
    source_fd = None
    try:
        prepared_stat = os.fstat(prepared_fd)
        if prepared_stat.st_uid != submitter_uid:
            raise DeploymentError("Prepared-release root must be owned by souqak.")
        source_fd = os.open(
            bundle.name,
            os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0),
            dir_fd=prepared_fd,
        )
        root_stat = os.fstat(source_fd)
        if root_stat.st_uid != submitter_uid or not stat.S_ISDIR(root_stat.st_mode):
            raise DeploymentError("Prepared release must be a real directory owned by souqak.")
        total = [0]
        snapshot_directory(source_fd, destination, PurePosixPath(), total)
    finally:
        if source_fd is not None:
            os.close(source_fd)
        os.close(prepared_fd)

    manifest_path = destination / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise DeploymentError("Prepared release manifest is missing or invalid.") from error
    if (
        manifest.get("schema") != 1
        or manifest.get("repository") != REPOSITORY
        or manifest.get("branch") != BRANCH
        or manifest.get("release") != expected_release
        or manifest.get("checks", {}).get("frontend_tests") is not True
        or manifest.get("checks", {}).get("frontend_build") is not True
    ):
        raise DeploymentError("Prepared release manifest does not describe the approved source.")
    dist = destination / "frontend" / "dist"
    if any(not (dist / name).is_file() for name in REQUIRED_FRONTEND_FILES):
        raise DeploymentError("Prepared frontend is missing required static or SEO files.")
    if (dist / "souqak-release.txt").read_text(encoding="utf-8").strip() != expected_release:
        raise DeploymentError("Prepared frontend release marker does not match the approved SHA.")
    if digest_tree(dist) != manifest.get("frontend_sha256"):
        raise DeploymentError("Prepared frontend hash does not match its manifest.")
    return manifest


def extract_git_archive(archive, target):
    target.mkdir(mode=0o700, parents=True)
    total = 0
    with tarfile.open(fileobj=archive, mode="r|") as stream:
        for member in stream:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts:
                raise DeploymentError("Approved source archive contains an unsafe path or file type.")
            destination = target.joinpath(*name.parts)
            if member.isdir():
                destination.mkdir(mode=0o700, parents=True, exist_ok=True)
                continue
            if not member.isfile():
                raise DeploymentError("Approved source archive contains an unsafe path or file type.")
            if member.size < 0 or member.size > MAX_FILE_BYTES or total + member.size > MAX_BUNDLE_BYTES:
                raise DeploymentError("Approved source archive exceeds the allowed size.")
            total += member.size
            destination.parent.mkdir(parents=True, exist_ok=True)
            source = stream.extractfile(member)
            if source is None:
                raise DeploymentError("Approved source archive is incomplete.")
            with source, destination.open("xb") as output:
                shutil.copyfileobj(source, output)
            destination.chmod(0o755 if member.mode & 0o111 else 0o644)


def run(command, *, cwd=None, env=None, capture=False, input_data=None):
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            env=env,
            input=input_data,
            text=input_data is not None,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            check=False,
        )
    except OSError as error:
        raise DeploymentError(f"Required operation is unavailable: {Path(command[0]).name}.") from error
    if result.returncode:
        raise DeploymentError(f"Operation failed: {Path(command[0]).name} (exit {result.returncode}).")
    return result.stdout.strip() if capture else ""


class SystemOps:
    def command(self, *args, capture=False):
        return run(list(args), capture=capture)

    def docker(self, *args, capture=False):
        return self.command("docker", *args, capture=capture)

    def wait_backend(self, attempts=60):
        for _ in range(attempts):
            try:
                run(["curl", "--silent", "--show-error", "--fail", "--max-time", "3",
                     f"http://127.0.0.1:{BACKEND_PORT}{HEALTH_PATH}", "--output", os.devnull])
                return True
            except DeploymentError:
                time.sleep(1)
        return False

    def container_exists(self, name):
        try:
            self.docker("inspect", name)
            return True
        except DeploymentError:
            return False

    def container_id(self, name):
        return self.docker("inspect", "--format", "{{.Id}}", name, capture=True)

    def container_running(self, name):
        return self.docker(
            "inspect", "--format", "{{.State.Running}}", name, capture=True
        ) == "true"

    def check_frontend(self, release):
        try:
            result = run([
                "curl", "--noproxy", "*", "--silent", "--show-error", "--fail",
                "--connect-timeout", "5", "--max-time", "15",
                "--resolve", f"{SITE_HOST}:443:127.0.0.1",
                f"{SITE_HEALTH_URL}/souqak-release.txt",
            ], capture=True)
            return result.strip() == release
        except DeploymentError:
            return False

    def reload_nginx(self):
        self.command("nginx", "-t")
        self.command("systemctl", "reload", "nginx")


def activate_transaction(
    ops,
    *,
    release,
    image,
    old_backend_id,
    previous_container,
    previous_frontend,
    new_frontend,
    switch_frontend,
    health_attempts=60,
):
    stopped = False
    renamed = False
    started = False
    switched = False
    try:
        ops.docker("stop", "--time", "30", BACKEND)
        stopped = True
        ops.docker("rename", BACKEND, previous_container)
        renamed = True
        started = True
        ops.docker(
            "run", "--detach",
            "--name", BACKEND,
            "--restart", "unless-stopped",
            "--init",
            "--security-opt", "no-new-privileges:true",
            "--user", "node",
            "--label", f"com.souqak.release={release}",
            "--network", NETWORK,
            "--publish", f"127.0.0.1:{BACKEND_PORT}:5000",
            "--env-file", str(ENV_FILE),
            "--env", "NODE_ENV=production",
            "--env", "PORT=5000",
            "--mount", f"type=volume,source={UPLOADS_VOLUME},target=/app/uploads",
            "--mount", f"type=volume,source={PRIVATE_UPLOADS_VOLUME},target=/app/private_uploads",
            image,
        )
        if not ops.wait_backend(health_attempts):
            raise DeploymentError("New backend failed its readiness check.")
        switched = True
        switch_frontend(new_frontend)
        if not ops.check_frontend(release):
            ops.reload_nginx()
            if not ops.check_frontend(release):
                raise DeploymentError("Nginx did not serve the new frontend after reload.")
        return {"stopped": stopped, "renamed": renamed, "started": started, "switched": switched}
    except Exception as error:
        rollback_ok = restore_transaction(
            ops,
            release=release,
            old_backend_id=old_backend_id,
            previous_container=previous_container,
            previous_frontend=previous_frontend,
            new_frontend=new_frontend,
            switch_frontend=switch_frontend,
            stopped=stopped,
            renamed=renamed,
            started=started,
            switched=switched,
        )
        if rollback_ok:
            raise DeploymentError(f"Activation failed and the previous application was restored: {error}") from error
        raise DeploymentError(
            f"Activation failed and automatic restoration was incomplete; manual recovery is required: {error}"
        ) from error


def restore_transaction(
    ops,
    *,
    release,
    old_backend_id,
    previous_container,
    previous_frontend,
    new_frontend,
    switch_frontend,
    stopped,
    renamed,
    started,
    switched,
):
    failed = False
    if started:
        try:
            if ops.container_exists(BACKEND):
                current_id = ops.docker("inspect", "--format", "{{.Id}}", BACKEND, capture=True)
                current_release = ops.docker(
                    "inspect", "--format",
                    '{{ index .Config.Labels "com.souqak.release" }}',
                    BACKEND, capture=True,
                )
                if current_id != old_backend_id and current_release == release:
                    ops.docker("rm", "-f", BACKEND)
                elif current_id != old_backend_id:
                    failed = True
        except Exception:
            failed = True
    if renamed:
        try:
            if ops.docker("inspect", "--format", "{{.Id}}", previous_container, capture=True) != old_backend_id:
                failed = True
            else:
                ops.docker("rename", previous_container, BACKEND)
                ops.docker("start", BACKEND)
        except Exception:
            failed = True
    elif stopped:
        try:
            ops.docker("start", BACKEND)
        except Exception:
            failed = True
    if switched:
        try:
            switch_frontend(previous_frontend)
            if not ops.check_frontend(Path(previous_frontend).joinpath("souqak-release.txt").read_text().strip()):
                ops.reload_nginx()
                if not ops.check_frontend(Path(previous_frontend).joinpath("souqak-release.txt").read_text().strip()):
                    failed = True
        except Exception:
            failed = True
    try:
        if not ops.wait_backend(60):
            failed = True
    except Exception:
        failed = True
    return not failed


def validate_env_file(path, submitter_uid):
    path = Path(path)
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != submitter_uid or metadata.st_mode & 0o077:
        raise DeploymentError("Production environment file must be a regular souqak-owned mode-600 file.")
    contents = path.read_text(encoding="utf-8")
    values = {}
    for line in contents.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator:
            continue
        key = key.strip()
        if key in {
            "MONGODB_URI", "JWT_ACCESS_SECRET", "ACCESS_TOKEN_SECRET", "JWT_SECRET", "ACCESS_SECRET",
            "JWT_REFRESH_SECRET", "REFRESH_TOKEN_SECRET", "REFRESH_SECRET",
        }:
            values.setdefault(key, []).append(value.strip().strip("\"'"))
    def exactly_one(label, keys):
        found = [(key, value) for key in keys for value in values.get(key, []) if value]
        if len(found) != 1:
            raise DeploymentError(f"Production environment must contain exactly one non-empty {label}.")
        return found[0][1]
    uri = exactly_one("MongoDB URI", ("MONGODB_URI",))
    exactly_one("JWT access secret", ("JWT_ACCESS_SECRET", "ACCESS_TOKEN_SECRET", "JWT_SECRET", "ACCESS_SECRET"))
    exactly_one("JWT refresh secret", ("JWT_REFRESH_SECRET", "REFRESH_TOKEN_SECRET", "REFRESH_SECRET"))
    parsed = urllib.parse.urlsplit(uri)
    if (
        parsed.scheme not in {"mongodb", "mongodb+srv"}
        or not parsed.hostname
        or urllib.parse.parse_qs(parsed.query).get("replicaSet") != ["rs0"]
    ):
        raise DeploymentError("MongoDB URI does not select the configured rs0 replica set.")
    return parsed.hostname


def verify_frontend_path(path, allowed_root):
    path = Path(path)
    if path.is_symlink() or not path.is_dir():
        raise DeploymentError("Frontend release must be a real directory.")
    resolved = path.resolve(strict=True)
    if allowed_root.resolve(strict=True) not in resolved.parents:
        raise DeploymentError("Frontend release is outside the protected release directory.")
    for entry in [resolved, *resolved.rglob("*")]:
        mode = entry.lstat().st_mode
        if stat.S_ISLNK(mode) or entry.lstat().st_uid != 0 or mode & 0o022:
            raise DeploymentError("Protected frontend files must be root-owned and not group/other writable.")
        if stat.S_ISDIR(mode) and not mode & 0o005:
            raise DeploymentError("Nginx must be able to traverse protected frontend directories.")
        if stat.S_ISREG(mode) and not mode & 0o004:
            raise DeploymentError("Nginx must be able to read protected frontend files.")
        if not stat.S_ISDIR(mode) and not stat.S_ISREG(mode):
            raise DeploymentError("Protected frontend contains a special file.")
    for name in REQUIRED_FRONTEND_FILES:
        if not (resolved / name).is_file():
            raise DeploymentError("Frontend release is missing required static or SEO files.")
    return resolved


def atomic_symlink(target, link=FRONTEND_LINK):
    target = Path(target)
    link = Path(link)
    if link.parent.stat().st_uid != 0 or link.parent.stat().st_mode & 0o022:
        raise DeploymentError("Nginx symlink parent must be root-owned and not group/other writable.")
    if not link.is_symlink():
        raise DeploymentError("The configured Nginx frontend path must already be a managed symlink.")
    verify_frontend_path(target, MANAGED_RELEASES)
    temporary = link.with_name(link.name + f".new-{os.getpid()}")
    if temporary.exists() or temporary.is_symlink():
        raise DeploymentError("Temporary Nginx symlink path is already occupied.")
    os.symlink(target, temporary)
    os.replace(temporary, link)


def validate_manifest_in_source(source, release):
    model = source / "backend" / "src" / "models" / "DraftAction.js"
    tests = source / "backend" / "test" / "draftActions.test.js"
    if not model.is_file() or not tests.is_file():
        raise DeploymentError("Approved source is missing the multiservice draft model or regression tests.")
    if "one_incomplete_wallet_service_draft_per_service" not in model.read_text(encoding="utf-8"):
        raise DeploymentError("Approved source does not contain the expected multiservice draft index.")
    if "wallet service drafts are unique per service, not per user" not in tests.read_text(encoding="utf-8"):
        raise DeploymentError("Approved source is missing the multiservice draft regression test.")
    if not (source / "Dockerfile").is_file() or not (source / "frontend" / "package-lock.json").is_file():
        raise DeploymentError("Approved source is missing the reviewed application build files.")


def validate_draft_index_attestation(attestation_path, schema_path, now=None, require_protected=True):
    attestation_path = Path(attestation_path)
    try:
        metadata = attestation_path.lstat()
    except OSError as error:
        raise DeploymentError("Required protected draft index attestation is missing or unavailable.") from error
    if not stat.S_ISREG(metadata.st_mode):
        raise DeploymentError("Draft index attestation must be a regular, non-symlink file.")
    if require_protected and (
        metadata.st_uid != 0 or stat.S_IMODE(metadata.st_mode) != 0o600
    ):
        raise DeploymentError("Draft index attestation must be root-owned mode 600.")

    entries = {}
    for line in attestation_path.read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        key, separator, value = line.partition("=")
        if not separator or not key or key in entries:
            raise DeploymentError("Draft index attestation has an invalid or duplicate field.")
        entries[key] = value
    required_keys = set(DRAFT_INDEX_ATTESTATION_VALUES) | {
        "SCHEMA_SHA256",
        "VERIFIED_AT_UTC",
    }
    if set(entries) != required_keys or any(
        entries[key] != value for key, value in DRAFT_INDEX_ATTESTATION_VALUES.items()
    ):
        raise DeploymentError("Draft index attestation does not verify the required database indexes.")

    schema_digest = hashlib.sha256(Path(schema_path).read_bytes()).hexdigest()
    if entries["SCHEMA_SHA256"] != schema_digest:
        raise DeploymentError("Draft index attestation does not match the approved release schema.")
    timestamp = entries["VERIFIED_AT_UTC"]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z", timestamp):
        raise DeploymentError("Draft index attestation timestamp is invalid.")
    try:
        verified_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError as error:
        raise DeploymentError("Draft index attestation timestamp is invalid.") from error
    now = now or datetime.now(timezone.utc)
    if verified_at > now or now - verified_at > timedelta(days=7):
        raise DeploymentError("Draft index attestation is expired or from the future.")


def write_state(state):
    STATE_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if STATE_ROOT.stat().st_uid != 0 or STATE_ROOT.stat().st_mode & 0o077:
        raise DeploymentError("Protected deployment state must be root-owned and mode 700.")
    temporary = STATE_FILE.with_name(STATE_FILE.name + f".new-{os.getpid()}")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(state, output, sort_keys=True)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, STATE_FILE)
    finally:
        if temporary.exists():
            temporary.unlink()


def parse_container(ops, name):
    raw = ops.docker("inspect", name, capture=True)
    try:
        records = json.loads(raw)
        if len(records) != 1:
            raise ValueError
        return records[0]
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise DeploymentError("Docker returned invalid container metadata.") from error


def validate_production_layout(ops, submitter_uid):
    for path in (DEPLOY_ROOT, MANAGED_RELEASES):
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise DeploymentError("Deployment root and managed releases must be real root-owned protected directories.")
    if not FRONTEND_LINK.is_symlink():
        raise DeploymentError("The Nginx frontend path must be a managed symlink before transition.")
    previous_frontend = Path(os.path.realpath(FRONTEND_LINK))
    verify_frontend_path(previous_frontend, MANAGED_RELEASES)
    uri_host = validate_env_file(ENV_FILE, submitter_uid)

    mongo = parse_container(ops, MONGODB)
    backend = parse_container(ops, BACKEND)
    if not mongo.get("State", {}).get("Running") or mongo.get("State", {}).get("Health", {}).get("Status") != "healthy":
        raise DeploymentError("Existing MongoDB container is not healthy.")
    if not backend.get("State", {}).get("Running"):
        raise DeploymentError("Existing backend is not running.")
    mongo_mounts = {
        (mount.get("Type"), mount.get("Name"), mount.get("Destination"))
        for mount in mongo.get("Mounts", [])
    }
    if ("volume", DATABASE_VOLUME, "/data/db") not in mongo_mounts:
        raise DeploymentError("MongoDB data volume does not match the fixed production volume.")
    network_data = mongo.get("NetworkSettings", {}).get("Networks", {}).get(NETWORK)
    if not network_data or uri_host not in network_data.get("Aliases", []):
        raise DeploymentError("MongoDB URI host is not an alias on the fixed production network.")
    backend_mounts = {
        (mount.get("Type"), mount.get("Name"), mount.get("Destination"))
        for mount in backend.get("Mounts", [])
    }
    if not {
        ("volume", UPLOADS_VOLUME, "/app/uploads"),
        ("volume", PRIVATE_UPLOADS_VOLUME, "/app/private_uploads"),
    }.issubset(backend_mounts):
        raise DeploymentError("Current backend upload volumes do not match the fixed production volumes.")
    if NETWORK not in backend.get("NetworkSettings", {}).get("Networks", {}):
        raise DeploymentError("Current backend is not attached to the fixed production network.")
    published = backend.get("NetworkSettings", {}).get("Ports", {}).get("5000/tcp", [])
    if not any(item.get("HostIp") == "127.0.0.1" and item.get("HostPort") == BACKEND_PORT for item in published):
        raise DeploymentError("Current backend must bind only to the fixed loopback port.")
    if backend.get("Config", {}).get("User") != "node":
        raise DeploymentError("Current backend must run as the non-root node user.")
    for volume in (DATABASE_VOLUME, UPLOADS_VOLUME, PRIVATE_UPLOADS_VOLUME):
        ops.docker("volume", "inspect", volume)
    nginx_config = ops.command("nginx", "-T", capture=True)
    if f"root {FRONTEND_LINK};" not in nginx_config or f"127.0.0.1:{BACKEND_PORT}" not in nginx_config:
        raise DeploymentError("Nginx does not use the fixed frontend link and backend loopback port.")
    ops.command("systemctl", "is-active", "--quiet", "nginx")
    ops.command("nginx", "-t")
    if not ops.wait_backend(1):
        raise DeploymentError("Current backend readiness check failed.")
    if not ops.check_frontend(previous_frontend.joinpath("souqak-release.txt").read_text().strip()):
        raise DeploymentError("Current frontend health marker did not match its protected release.")
    return backend, mongo, previous_frontend


def fetch_approved_source(release, staging):
    repository = staging / "repository"
    repository.mkdir(mode=0o700)
    run(["git", "init", "--quiet", str(repository)])
    run(["git", "-C", str(repository), "remote", "add", "origin", REPOSITORY])
    run(["git", "-C", str(repository), "fetch", "--quiet", "--no-tags", "origin", "main"])
    commit = run(["git", "-C", str(repository), "rev-parse", "--verify", f"{release}^{{commit}}"], capture=True)
    if commit != release:
        raise DeploymentError("The requested SHA is not an exact commit in the approved repository.")
    run(["git", "-C", str(repository), "merge-base", "--is-ancestor", release, "FETCH_HEAD"])
    archive = subprocess.Popen(
        ["git", "-C", str(repository), "archive", "--format=tar", release],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        extract_git_archive(archive.stdout, staging / "source")
        _, error = archive.communicate()
        if archive.returncode:
            raise DeploymentError("Could not extract the approved Git source archive.")
    finally:
        if archive.stdout:
            archive.stdout.close()
    validate_manifest_in_source(staging / "source", release)
    return staging / "source"


def build_backend_image(ops, source, release):
    context = source.parent / "backend-build-context"
    context.mkdir(mode=0o700)
    shutil.copy2(source / "Dockerfile", context / "Dockerfile")
    backend_context = context / "backend"
    backend_context.mkdir()
    shutil.copy2(source / "backend" / "package.json", backend_context / "package.json")
    shutil.copy2(source / "backend" / "package-lock.json", backend_context / "package-lock.json")
    shutil.copytree(source / "backend" / "src", backend_context / "src")
    image = f"{IMAGE_REPOSITORY}:{release}"
    ops.docker(
        "build", "--pull",
        "--tag", image,
        "--label", f"com.souqak.release={release}",
        "--label", f"com.souqak.source-commit={release}",
        "--file", str(context / "Dockerfile"),
        str(context),
    )
    configured_user = ops.docker(
        "image", "inspect", "--format", "{{.Config.User}}", image, capture=True
    )
    if configured_user != "node":
        raise DeploymentError("Built backend image does not run as the non-root node user.")
    return image


def check_volume_access(ops, image):
    source = (
        "const fs=require('node:fs');"
        "for(const p of ['/app/uploads','/app/private_uploads']){"
        "const s=fs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink())process.exit(2);"
        "fs.accessSync(p,fs.constants.W_OK|fs.constants.X_OK);"
        "for(const n of p.endsWith('private_uploads')?['message-attachments','auction-documents']:['avatars','receipts','ids','logos']){"
        "const q=p+'/'+n;try{const x=fs.lstatSync(q);if(!x.isDirectory()||x.isSymbolicLink())process.exit(3);"
        "fs.accessSync(q,fs.constants.W_OK|fs.constants.X_OK);}catch(e){if(e.code!=='ENOENT')throw e;}}}"
    )
    ops.docker(
        "run", "--rm", "--network", "none", "--user", "node",
        "--mount", f"type=volume,source={UPLOADS_VOLUME},target=/app/uploads",
        "--mount", f"type=volume,source={PRIVATE_UPLOADS_VOLUME},target=/app/private_uploads",
        "--entrypoint", "node", image, "-e", source,
    )


def verify_database_unchanged(ops, original_id):
    current = parse_container(ops, MONGODB)
    if current.get("Id") != original_id or not current.get("State", {}).get("Running"):
        raise DeploymentError("MongoDB container identity changed unexpectedly; manual inspection is required.")
    mounts = {
        (mount.get("Type"), mount.get("Name"), mount.get("Destination"))
        for mount in current.get("Mounts", [])
    }
    if ("volume", DATABASE_VOLUME, "/data/db") not in mounts:
        raise DeploymentError("MongoDB data volume changed unexpectedly; manual inspection is required.")


def confirm_release(release, bundle_digest):
    if not sys.stdin.isatty():
        raise DeploymentError("Activation requires an interactive administrative terminal.")
    print(f"Approved source commit: {release}")
    print(f"Prepared bundle SHA-256: {bundle_digest}")
    reply = input("Type the full source commit SHA to activate: ").strip()
    if reply != release:
        raise DeploymentError("Release confirmation did not match.")


def deploy_release(release, bundle, ops=None, confirm=confirm_release):
    ops = ops or SystemOps()
    if fcntl is None or pwd is None:
        raise DeploymentError("Protected activation requires Ubuntu Linux file and account controls.")
    try:
        submitter_uid = pwd.getpwnam("souqak").pw_uid
    except KeyError as error:
        raise DeploymentError("The souqak deployment account is missing.") from error
    preflight_builder()
    if not STATE_ROOT.is_dir() or STATE_ROOT.stat().st_uid != 0 or STATE_ROOT.stat().st_mode & 0o077:
        raise DeploymentError("Protected deployment state must be pre-created root-owned mode 700.")
    if LOCK_FILE.is_symlink():
        raise DeploymentError("Deployment lock must not be a symlink.")
    lock_fd = os.open(LOCK_FILE, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(lock_fd, "a+b") as lock:
        if os.fstat(lock.fileno()).st_uid != 0:
            raise DeploymentError("Deployment lock must be root-owned.")
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if not STAGING_ROOT.is_dir() or STAGING_ROOT.stat().st_uid != 0 or STAGING_ROOT.stat().st_mode & 0o077:
            raise DeploymentError("Protected staging directory must be pre-created root-owned mode 700.")
        build_root_mode = stat.S_IMODE(BUILD_ROOT.stat().st_mode) if BUILD_ROOT.is_dir() else 0
        if (
            not BUILD_ROOT.is_dir()
            or BUILD_ROOT.stat().st_uid != 0
            or build_root_mode & 0o022
            or build_root_mode & 0o005 != 0o005
        ):
            raise DeploymentError("Isolated build workspace parent must be root-owned and protected.")
        staging = Path(tempfile.mkdtemp(prefix=f"{release}.", dir=STAGING_ROOT))
        try:
            bundle_snapshot = staging / "bundle"
            bundle_snapshot.mkdir(mode=0o700)
            manifest = snapshot_bundle(bundle, bundle_snapshot, release, submitter_uid)
            backend, mongo, previous_frontend = validate_production_layout(ops, submitter_uid)
            source = fetch_approved_source(release, staging)
            validate_draft_index_attestation(
                STATE_ROOT / "draft-index-attestation.txt",
                source / "backend" / "src" / "models" / "DraftAction.js",
            )
            confirm(release, digest_tree(bundle_snapshot))
            builder = preflight_builder()
            frontend_workspace = Path(tempfile.mkdtemp(prefix=f"{release}-", dir=BUILD_ROOT))
            frontend_dist = build_frontend_as_builder(source, frontend_workspace, builder)
            image = build_backend_image(ops, source, release)
            check_volume_access(ops, image)
            release_directory = MANAGED_RELEASES / release
            if release_directory.exists() or release_directory.is_symlink():
                raise DeploymentError("Protected release path already exists; preserve and inspect it.")
            release_directory.mkdir(mode=0o755)
            frontend_target = release_directory / "frontend" / "dist"
            frontend_target.parent.mkdir(mode=0o755)
            copy_frontend_build(frontend_dist, frontend_target)
            (frontend_target / "souqak-release.txt").write_text(release + "\n", encoding="utf-8")
            for path in [release_directory, *release_directory.rglob("*")]:
                os.chown(path, 0, 0)
                if path.is_dir():
                    path.chmod(0o755)
                elif path.name == "souqak-release.txt":
                    path.chmod(0o644)
                else:
                    path.chmod(0o644)
            verify_frontend_path(frontend_target, MANAGED_RELEASES)
            current_release = backend.get("Config", {}).get("Labels", {}).get("com.souqak.release", "legacy")
            previous_container = f"souqak-backend-rollback-{release}"
            if ops.container_exists(previous_container):
                raise DeploymentError("A rollback container with this release identifier already exists.")
            if ops.container_id(BACKEND) != backend.get("Id"):
                raise DeploymentError("Active backend changed during release preparation.")
            verify_database_unchanged(ops, mongo.get("Id"))
            state = {
                "schema": 1,
                "status": "activating",
                "release": release,
                "previous_release": (previous_frontend / "souqak-release.txt").read_text(encoding="utf-8").strip(),
                "backend_id": backend.get("Id"),
                "previous_container": previous_container,
                "previous_container_id": backend.get("Id"),
                "previous_frontend": str(previous_frontend),
                "new_frontend": str(frontend_target),
                "image": image,
                "database_container_id": mongo.get("Id"),
            }
            write_state(state)
            try:
                transaction = activate_transaction(
                    ops,
                    release=release,
                    image=image,
                    old_backend_id=backend.get("Id"),
                    previous_container=previous_container,
                    previous_frontend=previous_frontend,
                    new_frontend=frontend_target,
                    switch_frontend=atomic_symlink,
                )
            except DeploymentError as error:
                state["status"] = (
                    "failed-restored"
                    if "previous application was restored" in str(error)
                    else "manual-recovery-required"
                )
                write_state(state)
                raise
            try:
                verify_database_unchanged(ops, mongo.get("Id"))
                state["status"] = "active"
                state["active_backend_id"] = ops.container_id(BACKEND)
                write_state(state)
            except Exception:
                restore_transaction(
                    ops,
                    release=release,
                    old_backend_id=backend.get("Id"),
                    previous_container=previous_container,
                    previous_frontend=previous_frontend,
                    new_frontend=frontend_target,
                    switch_frontend=atomic_symlink,
                    stopped=transaction["stopped"],
                    renamed=transaction["renamed"],
                    started=transaction["started"],
                    switched=transaction["switched"],
                )
                raise
            print(f"Release {release} activated. MongoDB and persistent volumes were not replaced.")
            print(f"Previous application retained in {previous_container} for explicit rollback.")
        except Exception:
            raise
        finally:
            shutil.rmtree(staging, ignore_errors=True)
            workspace = locals().get("frontend_workspace")
            if workspace and Path(workspace).is_dir() and not Path(workspace).is_symlink():
                shutil.rmtree(workspace, ignore_errors=True)


def rollback_release(release, ops=None, confirm=confirm_release):
    ops = ops or SystemOps()
    if fcntl is None:
        raise DeploymentError("Protected rollback requires Ubuntu Linux file locking.")
    if not STATE_ROOT.is_dir() or STATE_ROOT.stat().st_uid != 0 or STATE_ROOT.stat().st_mode & 0o077:
        raise DeploymentError("Protected deployment state must be root-owned mode 700.")
    if LOCK_FILE.is_symlink() or STATE_FILE.is_symlink():
        raise DeploymentError("Protected rollback state must not contain symlinks.")
    lock_fd = os.open(LOCK_FILE, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(lock_fd, "a+b") as lock:
        if os.fstat(lock.fileno()).st_uid != 0:
            raise DeploymentError("Deployment lock must be root-owned.")
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = validate_rollback_record(release, ops)
        previous = state["previous_container"]
        if ops.container_running(previous):
            raise DeploymentError("Recorded previous backend must be stopped before rollback.")
        previous_frontend = verify_frontend_path(state["previous_frontend"], MANAGED_RELEASES)
        active_frontend = verify_frontend_path(state["new_frontend"], MANAGED_RELEASES)
        if not FRONTEND_LINK.is_symlink() or Path(os.path.realpath(FRONTEND_LINK)) != active_frontend:
            raise DeploymentError("Current Nginx frontend does not match the protected rollback record.")
        confirm(release, "protected rollback record")
        failed_container = f"souqak-backend-failed-{release}"
        if ops.container_exists(failed_container):
            raise DeploymentError("Rollback preservation container name is already occupied.")
        current_id = state["active_backend_id"]
        previous_marker = (previous_frontend / "souqak-release.txt").read_text(encoding="utf-8").strip()
        try:
            ops.docker("stop", "--time", "30", BACKEND)
            ops.docker("rename", BACKEND, failed_container)
            ops.docker("rename", previous, BACKEND)
            ops.docker("start", BACKEND)
            if not ops.wait_backend(60):
                raise DeploymentError("Previous backend did not become ready.")
            atomic_symlink(previous_frontend)
            if not ops.check_frontend(previous_marker):
                ops.reload_nginx()
                if not ops.check_frontend(previous_marker):
                    raise DeploymentError("Previous frontend did not become healthy after reload.")
            state["status"] = "rolled-back"
            state["failed_container"] = failed_container
            write_state(state)
        except Exception as error:
            recovered = False
            try:
                if ops.container_exists(BACKEND) and ops.container_id(BACKEND) == state["previous_container_id"]:
                    ops.docker("stop", "--time", "30", BACKEND)
                    ops.docker("rename", BACKEND, previous)
                if ops.container_exists(failed_container) and not ops.container_exists(BACKEND):
                    ops.docker("rename", failed_container, BACKEND)
                if ops.container_exists(BACKEND) and ops.container_id(BACKEND) == current_id:
                    if not ops.container_running(BACKEND):
                        ops.docker("start", BACKEND)
                atomic_symlink(active_frontend)
                active_marker = (active_frontend / "souqak-release.txt").read_text(encoding="utf-8").strip()
                if not ops.wait_backend(60):
                    raise DeploymentError("Pre-rollback backend did not recover.")
                if not ops.check_frontend(active_marker):
                    ops.reload_nginx()
                    if not ops.check_frontend(active_marker):
                        raise DeploymentError("Pre-rollback frontend did not recover.")
                recovered = ops.container_id(BACKEND) == current_id
            except Exception:
                recovered = False
            raise DeploymentError(
                ("Rollback failed; the prior active application was restored."
                 if recovered else
                 "Rollback failed and automatic restoration was incomplete; inspect preserved containers, "
                 "the frontend link, and protected state manually.")
                + f" Cause: {error}"
            ) from error
        if ops.container_id(BACKEND) == current_id:
            raise DeploymentError("Rollback did not change the active backend as expected.")
        print("Application rollback completed. Database state was not reverted.")


def validate_rollback_record(release, ops):
    try:
        state_stat = STATE_FILE.lstat()
    except OSError as error:
        raise DeploymentError("No valid protected activation record is available.") from error
    if (
        state_stat.st_uid != 0
        or stat.S_IMODE(state_stat.st_mode) != 0o600
        or stat.S_ISLNK(state_stat.st_mode)
    ):
        raise DeploymentError("Protected activation record must be root-owned and mode 600.")
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise DeploymentError("No valid protected activation record is available.") from error
    if state.get("schema") != 1 or state.get("status") != "active" or state.get("release") != release:
        raise DeploymentError("Rollback release does not match the protected active-release record.")
    if ops.container_id(BACKEND) != state.get("active_backend_id"):
        raise DeploymentError("Active backend identity differs from the protected rollback record.")
    previous = state.get("previous_container")
    if not previous or ops.container_id(previous) != state.get("previous_container_id"):
        raise DeploymentError("Previous backend identity differs from the protected rollback record.")
    return state


def dry_run_release(release, bundle, ops=None):
    ops = ops or SystemOps()
    if pwd is None:
        raise DeploymentError("Protected dry-run requires Ubuntu Linux account controls.")
    submitter_uid = pwd.getpwnam("souqak").pw_uid
    preflight_builder()
    with tempfile.TemporaryDirectory(prefix="souqak-dry-run-") as directory:
        snapshot_bundle(bundle, Path(directory), release, submitter_uid)
        backend, mongo, _ = validate_production_layout(ops, submitter_uid)
        source_root = Path(directory) / "source-check"
        repository = Path(directory) / "repository"
        repository.mkdir()
        run(["git", "init", "--quiet", str(repository)])
        run(["git", "-C", str(repository), "remote", "add", "origin", REPOSITORY])
        run(["git", "-C", str(repository), "fetch", "--quiet", "--no-tags", "origin", "main"])
        if run(["git", "-C", str(repository), "rev-parse", "--verify", f"{release}^{{commit}}"], capture=True) != release:
            raise DeploymentError("The requested SHA is not present in the approved repository.")
        run(["git", "-C", str(repository), "merge-base", "--is-ancestor", release, "FETCH_HEAD"])
        archive = subprocess.Popen(
            ["git", "-C", str(repository), "archive", "--format=tar", release],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            extract_git_archive(archive.stdout, source_root)
            archive.communicate()
            if archive.returncode:
                raise DeploymentError("Could not inspect the approved source archive.")
        finally:
            if archive.stdout:
                archive.stdout.close()
        validate_manifest_in_source(source_root, release)
        validate_draft_index_attestation(
            STATE_ROOT / "draft-index-attestation.txt",
            source_root / "backend" / "src" / "models" / "DraftAction.js",
        )
        print(f"Dry run passed read-only checks for {release}.")
        print(f"Backend and MongoDB were inspected; current backend ID: {backend.get('Id')}.")
        print(f"MongoDB ID: {mongo.get('Id')}. No container, link, volume, or service was changed.")


def preflight_builder():
    if pwd is None:
        raise DeploymentError("The isolated builder account must be provisioned on Ubuntu.")
    try:
        account = pwd.getpwnam(BUILD_USER)
        souqak = pwd.getpwnam("souqak")
    except KeyError as error:
        raise DeploymentError("The isolated souqak-build account must be provisioned first.") from error
    if account.pw_uid in {0, souqak.pw_uid}:
        raise DeploymentError("The frontend builder must be a separate unprivileged account.")
    if set(os.getgrouplist(BUILD_USER, account.pw_gid)) != {account.pw_gid}:
        raise DeploymentError("The isolated frontend builder must have no supplementary groups.")
    if account.pw_shell not in {"/usr/sbin/nologin", "/sbin/nologin", "/bin/false"}:
        raise DeploymentError("The isolated frontend builder must not have an interactive login shell.")
    home = Path(account.pw_dir)
    home_stat = home.lstat()
    if home_stat.st_uid != account.pw_uid or home_stat.st_mode & 0o077:
        raise DeploymentError("The isolated frontend builder home must be private and builder-owned.")
    return account


def build_frontend_as_builder(source, workspace, account):
    if workspace.is_symlink() or not workspace.is_dir() or workspace.stat().st_uid != 0:
        raise DeploymentError("Build workspace must be a new root-created directory.")
    frontend = workspace / "frontend"
    shutil.copytree(source / "frontend", frontend, symlinks=False)
    for path in [workspace, *workspace.rglob("*")]:
        os.chown(path, account.pw_uid, account.pw_gid)
        if path.is_dir():
            path.chmod(0o700)
        else:
            path.chmod(0o700 if path.stat().st_mode & 0o111 else 0o600)
    env = {
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "HOME": account.pw_dir,
        "CI": "1",
        "PUBLIC_SITE_URL": "https://souqak-yem.com",
        "VITE_API_URL": "https://api.souqak-yem.com/api",
        "VITE_SOCKET_URL": "https://api.souqak-yem.com",
        "SEO_PRERENDER_DATA_SOURCE": "api",
        "PRERENDER_DISABLED": "false",
        "VITE_MAINTENANCE_MODE": "false",
    }
    unit_prefix = f"souqak-build-{os.getpid()}"
    properties = [
        "--quiet",
        "--wait",
        "--pipe",
        "--collect",
        f"--uid={BUILD_USER}",
        "--property=NoNewPrivileges=yes",
        "--property=ProtectSystem=strict",
        "--property=ProtectHome=yes",
        "--property=PrivateTmp=yes",
        "--property=PrivateDevices=yes",
        "--property=RestrictSUIDSGID=yes",
        f"--property=ReadWritePaths={workspace} {account.pw_dir}",
        f"--property=WorkingDirectory={frontend}",
    ]
    for step, command in enumerate((
        ["npm", "ci", "--no-audit", "--no-fund"],
        ["npm", "run", "build"],
    )):
        environment = ["env", "-i", *[f"{key}={value}" for key, value in env.items()]]
        run([
            "systemd-run", *properties, f"--unit={unit_prefix}-{step}",
            *environment, *command,
        ])
    dist = frontend / "dist"
    if any(not (dist / name).is_file() for name in REQUIRED_FRONTEND_FILES[:-1]):
        raise DeploymentError("Isolated frontend build is missing required static or SEO output.")
    return dist


def main(argv=None):
    parser = argparse.ArgumentParser(description="Protected manual Souqak activation.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--rollback", action="store_true")
    parser.add_argument("--release", required=True, help="full approved 40-character commit SHA")
    parser.add_argument("--bundle", help="prepared release directory directly under prepared/")
    args = parser.parse_args(argv)
    if getattr(os, "geteuid", lambda: -1)() != 0:
        raise DeploymentError("Run this installed helper from an administrative root session.")
    installed = Path(__file__).resolve()
    if installed != Path("/usr/local/libexec/souqak/activate-release.py"):
        raise DeploymentError("Install the reviewed helper at its fixed root-owned path before use.")
    for path in (installed, *installed.parents):
        metadata = path.lstat()
        if metadata.st_uid != 0 or metadata.st_mode & 0o022:
            raise DeploymentError("Administrative helper and parent paths must be root-owned and protected.")
    if not re.fullmatch(r"[a-f0-9]{40}", args.release):
        raise DeploymentError("Release identifier must be a full lowercase commit SHA.")
    if args.rollback:
        if args.bundle:
            raise DeploymentError("Rollback does not accept a bundle path.")
        if args.dry_run:
            validate_rollback_record(args.release, SystemOps())
            print(f"Dry run passed protected rollback-record checks for {args.release}.")
            return 0
        rollback_release(args.release)
        return 0
    if not args.bundle:
        raise DeploymentError("A prepared bundle path is required.")
    bundle = Path(args.bundle)
    if not bundle.is_absolute() or bundle.parent != PREPARED_ROOT:
        raise DeploymentError("Bundle path must be a direct child of the fixed prepared-release directory.")
    if args.dry_run:
        dry_run_release(args.release, bundle)
        return 0
    deploy_release(args.release, bundle)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (DeploymentError, OSError, subprocess.CalledProcessError, BlockingIOError) as error:
        print(f"Souqak administrative deployment stopped: {error}", file=sys.stderr)
        raise SystemExit(1)
