#!/usr/bin/env python3
"""Root-owned, fixed-policy Souqak activation and rollback helper."""

import argparse
import glob
import hashlib
import json
import os
import re
import shlex
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

DEPLOY_SOURCE_ROOT = Path(__file__).resolve().parents[1]
if str(DEPLOY_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(DEPLOY_SOURCE_ROOT))
from snapshot_contract import MAX_AGE_MS, SNAPSHOT_PATH, snapshot_info, validate_manifest

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
SEO_RECEIPT_ROOT = STATE_ROOT / "seo-receipts"
RELEASE_RECEIPT_ROOT = STATE_ROOT / "release-receipts"
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
MAX_METADATA_BYTES = 1024 * 1024
REQUIRED_FRONTEND_FILES = (
    "index.html",
    "sitemap.xml",
    "robots.txt",
    "prerender-manifest.json",
    "dynamic-ad-renderer-template.html",
    "souqak-release.txt",
)
LEGACY_FRONTEND_FILES = tuple(
    name for name in REQUIRED_FRONTEND_FILES
    if name != "dynamic-ad-renderer-template.html"
)
REQUIRED_SHARED_RUNTIME_FILES = ("seoRules.mjs",)
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


def digest_shared_runtime(root):
    root = Path(root)
    digest = hashlib.sha256()
    for name in REQUIRED_SHARED_RUNTIME_FILES:
        path = root / name
        if path.is_symlink() or not path.is_file() or path.stat().st_size == 0:
            raise DeploymentError(f"Release is missing a valid shared/{name}.")
        digest.update(name.encode("utf-8") + b"\0")
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


def is_allowed_bundle_path(parts):
    return (
        parts == ("manifest.json",)
        or parts == ("readiness.txt",)
        or parts == (SNAPSHOT_PATH,)
        or parts == ("frontend",)
        or parts == ("frontend", "dist")
        or (len(parts) >= 3 and parts[:2] == ("frontend", "dist"))
        or parts == ("shared",)
        or (
            len(parts) == 2
            and parts[0] == "shared"
            and parts[1] in REQUIRED_SHARED_RUNTIME_FILES
        )
    )


def snapshot_directory(source_fd, destination, relative, total):
    for name in sorted(os.listdir(source_fd)):
        if name in {".", ".."} or "/" in name or "\\" in name:
            raise DeploymentError("The submitted release contains an invalid path.")
        source_stat = os.stat(name, dir_fd=source_fd, follow_symlinks=False)
        target = destination / name
        child_relative = relative / name
        parts = child_relative.parts
        if not is_allowed_bundle_path(parts):
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


def snapshot_bundle(
    bundle,
    destination,
    expected_release,
    submitter_uid,
    *,
    prepared_root=None,
    verify_receipts=True,
):
    bundle = Path(bundle)
    allowed_root = Path(prepared_root or PREPARED_ROOT)
    if not bundle.is_absolute() or bundle.parent != allowed_root:
        raise DeploymentError("Release directory must be a direct child of the prepared-release directory.")
    if bundle.name != expected_release or not re.fullmatch(r"[a-f0-9]{40}", expected_release):
        raise DeploymentError("Release directory does not match the approved full commit SHA.")
    if os.open not in os.supports_dir_fd or not hasattr(os, "O_NOFOLLOW"):
        raise DeploymentError("Secure release snapshot requires Linux openat and O_NOFOLLOW support.")
    if allowed_root.is_symlink():
        raise DeploymentError("Prepared-release root must not be a symlink.")
    prepared_fd = os.open(
        allowed_root,
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

    manifest = validate_prepared_snapshot(destination, expected_release)
    if verify_receipts:
        try:
            seo_receipt(expected_release, manifest["seo_snapshot"])
            if manifest["schema"] == 2:
                release_receipt(expected_release, destination, manifest)
        except (OSError, ValueError, TypeError, KeyError) as error:
            raise DeploymentError("Prepared release does not match protected receipts.") from error
    return manifest


def validate_prepared_snapshot(destination, expected_release):
    destination = Path(destination)
    manifest_path = destination / "manifest.json"
    try:
        manifest_stat = manifest_path.lstat()
        if (
            not stat.S_ISREG(manifest_stat.st_mode)
            or stat.S_ISLNK(manifest_stat.st_mode)
            or manifest_stat.st_size > MAX_METADATA_BYTES
        ):
            raise ValueError("Manifest must be a bounded regular file.")
        manifest_bytes = manifest_path.read_bytes()
        manifest = json.loads(manifest_bytes)
        schema = validate_manifest(manifest, expected_release)
    except (OSError, ValueError, TypeError) as error:
        raise DeploymentError("Prepared release manifest is missing or invalid.") from error
    dist = destination / "frontend" / "dist"
    required_frontend = REQUIRED_FRONTEND_FILES if schema == 2 else LEGACY_FRONTEND_FILES
    if dist.is_symlink() or not dist.is_dir() or any(
        (dist / name).is_symlink() or not (dist / name).is_file()
        for name in required_frontend
    ):
        raise DeploymentError("Prepared frontend is missing required static or SEO files.")
    try:
        release_marker = (dist / "souqak-release.txt").read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError) as error:
        raise DeploymentError("Prepared frontend release marker is missing or invalid.") from error
    if release_marker != expected_release:
        raise DeploymentError("Prepared frontend release marker does not match the approved SHA.")
    if digest_tree(dist) != manifest.get("frontend_sha256"):
        raise DeploymentError("Prepared frontend hash does not match its manifest.")
    if schema == 2:
        shared = destination / "shared"
        if shared.is_symlink() or not shared.is_dir():
            raise DeploymentError("Prepared release is missing the required shared runtime directory.")
        shared_files = set()
        for path in shared.rglob("*"):
            if path.is_symlink():
                raise DeploymentError("Prepared shared runtime contains a symbolic link.")
            if path.is_file():
                shared_files.add(path.relative_to(shared).as_posix())
            elif not path.is_dir():
                raise DeploymentError("Prepared shared runtime contains a special file.")
        if shared_files != set(REQUIRED_SHARED_RUNTIME_FILES):
            raise DeploymentError(
                "Prepared shared runtime is missing required shared/seoRules.mjs or contains unexpected files."
            )
        if digest_shared_runtime(shared) != manifest.get("shared_sha256"):
            raise DeploymentError("Prepared shared runtime hash does not match its manifest.")
        template = dist / "dynamic-ad-renderer-template.html"
        prerender_manifest = dist / "prerender-manifest.json"
        if prerender_manifest.stat().st_size > MAX_METADATA_BYTES:
            raise DeploymentError("Prepared prerender manifest exceeds the metadata size limit.")
        if (
            hashlib.sha256(template.read_bytes()).hexdigest() != manifest["renderer_template_sha256"]
            or hashlib.sha256(prerender_manifest.read_bytes()).hexdigest()
            != manifest["prerender_manifest_sha256"]
        ):
            raise DeploymentError("Prepared renderer or prerender manifest hash does not match.")
        try:
            prerender_data = json.loads(prerender_manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise DeploymentError("Prepared prerender manifest is invalid.") from error
        if (
            prerender_data.get("version") != 1
            or prerender_data.get("source") != "local"
            or prerender_data.get("siteBaseUrl") != "https://souqak-yem.com"
        ):
            raise DeploymentError("Prepared prerender output does not match the local approved Snapshot.")
        try:
            validate_frontend_index(dist)
            validate_renderer_template(dist)
        except (OSError, ValueError) as error:
            raise DeploymentError("Prepared renderer template or hashed assets are invalid.") from error
    elif (destination / "shared").exists() or (destination / "shared").is_symlink():
        raise DeploymentError("Legacy release manifest must not contain new shared-runtime fields.")
    try:
        snapshot_info(
            destination / SNAPSHOT_PATH,
            expected_release,
            schema,
            manifest["seo_snapshot"],
        )
    except (OSError, ValueError, TypeError, KeyError) as error:
        raise DeploymentError("Prepared SEO Snapshot is invalid or does not match its manifest.") from error
    return manifest


def _receipt_directory(path, *, create=False, require_protected=True):
    path = Path(path)
    if create:
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
    for item in (path, *path.parents):
        metadata = item.lstat()
        if (
            stat.S_ISLNK(metadata.st_mode)
            or not stat.S_ISDIR(metadata.st_mode)
            or (require_protected and (
                metadata.st_uid != 0 or metadata.st_mode & 0o077
            ))
        ):
            raise DeploymentError("Receipt directory is not protected.")
    if require_protected and stat.S_IMODE(path.stat().st_mode) != 0o700:
        raise DeploymentError("Receipt directory must be root-owned mode 700.")
    return path


def _read_receipt(path, *, require_protected=True):
    path = Path(path)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    fd = os.open(path, flags)
    try:
        metadata = os.fstat(fd)
        if (
            not stat.S_ISREG(metadata.st_mode)
            or metadata.st_size > 16 * 1024
            or (require_protected and (
                metadata.st_uid != 0 or stat.S_IMODE(metadata.st_mode) != 0o600
            ))
        ):
            raise DeploymentError("Receipt must be a protected bounded regular file.")
        raw = os.read(fd, 16 * 1024 + 1)
        after = os.fstat(fd)
        if (
            len(raw) != metadata.st_size
            or len(raw) > 16 * 1024
            or (metadata.st_dev, metadata.st_ino, metadata.st_size, metadata.st_mtime_ns)
            != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
        ):
            raise DeploymentError("Receipt changed while it was read.")
    finally:
        os.close(fd)
    try:
        receipt = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DeploymentError("Protected receipt is invalid.") from error
    if not isinstance(receipt, dict):
        raise DeploymentError("Protected receipt is invalid.")
    return receipt


def _write_receipt(path, expected, *, require_protected=True):
    path = Path(path)
    directory = _receipt_directory(
        path.parent,
        create=True,
        require_protected=require_protected,
    )
    if path.exists() or path.is_symlink():
        if _read_receipt(path, require_protected=require_protected) != expected:
            raise DeploymentError("Existing protected receipt does not match this release.")
        return

    temporary = directory / f".{path.name}.new-{os.getpid()}"
    payload = (json.dumps(expected, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(temporary, flags, 0o600)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path, follow_symlinks=False)
        except FileExistsError:
            if _read_receipt(path, require_protected=require_protected) != expected:
                raise DeploymentError("Existing protected receipt does not match this release.")
        if hasattr(os, "O_DIRECTORY"):
            directory_fd = os.open(
                directory,
                os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0),
            )
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def seo_receipt(
    release,
    expected,
    *,
    create=False,
    receipt_root=None,
    require_protected=True,
):
    """Receipt scope is only the exact Snapshot binding; it does not attest tests."""
    if not re.fullmatch(r"[a-f0-9]{40}", release):
        raise DeploymentError("Invalid SEO provenance release.")
    directory = Path(receipt_root or SEO_RECEIPT_ROOT)
    _receipt_directory(directory, require_protected=require_protected)
    path = directory / f"{release}.json"
    if create:
        _write_receipt(path, expected, require_protected=require_protected)
    elif _read_receipt(path, require_protected=require_protected) != expected:
        raise DeploymentError("SEO Snapshot differs from root-issued provenance.")


def release_receipt(
    release,
    bundle_root,
    manifest,
    *,
    create=False,
    receipt_root=None,
    require_protected=True,
):
    """Separate protected build evidence, bound to the exact manifest bytes."""
    if manifest.get("schema") != 2 or manifest.get("release") != release:
        raise DeploymentError("Only a validated SEO release can have build evidence.")
    manifest_path = Path(bundle_root) / "manifest.json"
    metadata = manifest_path.lstat()
    if (
        stat.S_ISLNK(metadata.st_mode)
        or not stat.S_ISREG(metadata.st_mode)
        or metadata.st_size > MAX_METADATA_BYTES
    ):
        raise DeploymentError("Release manifest must be a regular file.")
    checks = manifest["checks"]
    expected = {
        "schema": 1,
        "purpose": "release-build-evidence",
        "release": release,
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "frontend_sha256": manifest["frontend_sha256"],
        "shared_sha256": manifest["shared_sha256"],
        "checks": {
            "backend_tests_passed": checks["backend_tests_passed"],
            "frontend_tests": checks["frontend_tests"],
            "frontend_build": checks["frontend_build"],
        },
    }
    directory = Path(receipt_root or RELEASE_RECEIPT_ROOT)
    _receipt_directory(directory, require_protected=require_protected)
    path = directory / f"{release}.json"
    if create:
        _write_receipt(path, expected, require_protected=require_protected)
    elif _read_receipt(path, require_protected=require_protected) != expected:
        raise DeploymentError("Release manifest or test evidence differs from protected provenance.")


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
    switch_previous_frontend=None,
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
            switch_previous_frontend=switch_previous_frontend,
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
    switch_previous_frontend=None,
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
            (switch_previous_frontend or switch_frontend)(previous_frontend)
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


def validate_seo_env_settings(contents):
    seo_values = {}
    seo_numeric_limits = {
        "SEO_RENDER_CACHE_AD_TTL_MS": 86_400_000,
        "SEO_RENDER_CACHE_CATEGORY_TTL_MS": 86_400_000,
        "SEO_RENDER_CACHE_STORE_TTL_MS": 86_400_000,
        "SEO_RENDER_CACHE_AUCTION_TTL_MS": 86_400_000,
        "SEO_RENDER_CACHE_MAX_ENTRIES": 100_000,
        "SEO_RENDER_CACHE_MAX_BYTES": 512 * 1024 * 1024,
        "SEO_RENDER_CACHE_MAX_ITEM_BYTES": 8 * 1024 * 1024,
        "SEO_RENDER_CACHE_MAX_IN_FLIGHT": 5_000,
        "SEO_SITEMAP_CACHE_TTL_MS": 5 * 60_000,
    }
    seo_boolean_values = {"1", "true", "yes", "on", "0", "false", "no", "off"}
    for line in contents.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator:
            continue
        key = key.strip()
        if key == "SEO_RENDER_CACHE_ENABLED" or key in seo_numeric_limits:
            seo_values.setdefault(key, []).append(value.strip().strip("\"'"))
    for key, entries in seo_values.items():
        if len(entries) != 1:
            raise DeploymentError(f"Production environment contains duplicate {key} settings.")
        value = entries[0]
        if not value:
            continue
        if key == "SEO_RENDER_CACHE_ENABLED":
            if value.lower() not in seo_boolean_values:
                raise DeploymentError("Production SEO cache enabled setting must be a boolean.")
            continue
        if not re.fullmatch(r"[0-9]+", value):
            raise DeploymentError(f"Production {key} must be a positive integer.")
        number = int(value)
        if number <= 0 or number > seo_numeric_limits[key]:
            raise DeploymentError(f"Production {key} is outside the supported range.")


def validate_env_file(path, submitter_uid):
    path = Path(path)
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != submitter_uid or metadata.st_mode & 0o077:
        raise DeploymentError("Production environment file must be a regular souqak-owned mode-600 file.")
    contents = path.read_text(encoding="utf-8")
    values = {}
    for line in contents.splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() in {
            "MONGODB_URI", "JWT_ACCESS_SECRET", "ACCESS_TOKEN_SECRET", "JWT_SECRET", "ACCESS_SECRET",
            "JWT_REFRESH_SECRET", "REFRESH_TOKEN_SECRET", "REFRESH_SECRET",
        }:
            values.setdefault(key.strip(), []).append(value.strip().strip("\"'"))
    validate_seo_env_settings(contents)
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


def verify_frontend_files(path, *, allow_legacy_renderer=False):
    required_files = (
        LEGACY_FRONTEND_FILES
        if allow_legacy_renderer
        else REQUIRED_FRONTEND_FILES
    )
    for name in required_files:
        if not (path / name).is_file():
            raise DeploymentError("Frontend release is missing required static or SEO files.")


def verify_frontend_path(path, allowed_root, *, allow_legacy_renderer=False):
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
    verify_frontend_files(resolved, allow_legacy_renderer=allow_legacy_renderer)
    return resolved


def atomic_symlink(target, link=FRONTEND_LINK, *, allow_legacy_renderer=False):
    target = Path(target)
    link = Path(link)
    if link.parent.stat().st_uid != 0 or link.parent.stat().st_mode & 0o022:
        raise DeploymentError("Nginx symlink parent must be root-owned and not group/other writable.")
    if not link.is_symlink():
        raise DeploymentError("The configured Nginx frontend path must already be a managed symlink.")
    verify_frontend_path(
        target,
        MANAGED_RELEASES,
        allow_legacy_renderer=allow_legacy_renderer,
    )
    temporary = link.with_name(link.name + f".new-{os.getpid()}")
    if temporary.exists() or temporary.is_symlink():
        raise DeploymentError("Temporary Nginx symlink path is already occupied.")
    os.symlink(target, temporary)
    os.replace(temporary, link)


def validate_manifest_in_source(source, release, schema_version=2):
    model = source / "backend" / "src" / "models" / "DraftAction.js"
    tests = source / "backend" / "test" / "draftActions.test.js"
    if not model.is_file() or not tests.is_file():
        raise DeploymentError("Approved source is missing the multiservice draft model or regression tests.")
    if "one_incomplete_wallet_service_draft_per_service" not in model.read_text(encoding="utf-8"):
        raise DeploymentError("Approved source does not contain the expected multiservice draft index.")
    if "wallet service drafts are unique per service, not per user" not in tests.read_text(encoding="utf-8"):
        raise DeploymentError("Approved source is missing the multiservice draft regression test.")
    dockerfile = source / "Dockerfile"
    if (
        not dockerfile.is_file()
        or not (source / "frontend" / "package-lock.json").is_file()
        or not (source / "frontend" / "index.html").is_file()
    ):
        raise DeploymentError("Approved source is missing the reviewed application build files.")
    try:
        dockerfile_text = dockerfile.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise DeploymentError("Approved source Dockerfile is missing or invalid.") from error
    if schema_version == 2:
        if "COPY shared/seoRules.mjs /shared/seoRules.mjs" not in dockerfile_text:
            raise DeploymentError("Approved Dockerfile does not include the required shared SEO runtime.")
        if "COPY frontend/index.html ./frontend/index.html" not in dockerfile_text:
            raise DeploymentError("Approved Dockerfile does not include the release frontend renderer template.")
        digest_shared_runtime(source / "shared")


def validate_shared_matches_source(bundle_root, source, manifest):
    bundle_digest = digest_shared_runtime(Path(bundle_root) / "shared")
    source_digest = digest_shared_runtime(Path(source) / "shared")
    if (
        bundle_digest != manifest.get("shared_sha256")
        or source_digest != manifest.get("shared_sha256")
    ):
        raise DeploymentError("Prepared shared runtime does not match the approved source commit.")


def dockerfile_copy_sources(dockerfile):
    """Return local COPY inputs, rejecting unsupported or ambiguous syntax."""
    contents = Path(dockerfile).read_text(encoding="utf-8")
    logical_lines = []
    pending = ""
    for line in contents.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        pending += stripped[:-1] + " " if stripped.endswith("\\") else stripped
        if not stripped.endswith("\\"):
            logical_lines.append(pending.strip())
            pending = ""
    if pending:
        raise DeploymentError("Dockerfile ends with an incomplete COPY instruction.")

    sources = []
    for line in logical_lines:
        if not re.match(r"^COPY(?:\s|$)", line, flags=re.IGNORECASE):
            continue
        argument = line.split(None, 1)[1]
        if argument.startswith("["):
            try:
                values = json.loads(argument)
            except json.JSONDecodeError as error:
                raise DeploymentError("Dockerfile contains invalid JSON COPY syntax.") from error
            if not isinstance(values, list) or len(values) < 2 or any(
                not isinstance(value, str) for value in values
            ):
                raise DeploymentError("Dockerfile contains unsupported JSON COPY syntax.")
            copy_sources = values[:-1]
        else:
            try:
                values = shlex.split(argument, posix=True)
            except ValueError as error:
                raise DeploymentError("Dockerfile contains invalid COPY syntax.") from error
            values = [value for value in values if not value.startswith("--")]
            if len(values) < 2:
                raise DeploymentError("Dockerfile contains incomplete COPY syntax.")
            copy_sources = values[:-1]
        if any(value == "." for value in copy_sources):
            raise DeploymentError("Dockerfile may not copy the full build context.")
        sources.extend(copy_sources)
    return tuple(sources)


def validate_docker_build_context(context):
    context = Path(context).resolve(strict=True)
    dockerfile = context / "Dockerfile"
    if dockerfile.is_symlink() or not dockerfile.is_file():
        raise DeploymentError("Restricted Docker context has no regular Dockerfile.")
    sources = dockerfile_copy_sources(dockerfile)
    if not sources:
        raise DeploymentError("Dockerfile has no verifiable COPY inputs.")
    for source in sources:
        if source.startswith("/") or "\\" in source or ".." in PurePosixPath(source).parts:
            raise DeploymentError("Dockerfile COPY input escapes the restricted build context.")
        matches = glob.glob(str(context / source), recursive=False)
        if not matches:
            raise DeploymentError(f"Dockerfile COPY input is missing from restricted context: {source}.")
        for match in matches:
            candidate = Path(match)
            if candidate.is_symlink() or context not in candidate.resolve(strict=True).parents:
                raise DeploymentError("Dockerfile COPY input is a link or outside the build context.")
            entries = [candidate, *candidate.rglob("*")] if candidate.is_dir() else [candidate]
            if any(
                entry.is_symlink() or not (entry.is_file() or entry.is_dir())
                for entry in entries
            ):
                raise DeploymentError("Dockerfile COPY input contains a link or special file.")
    return sources


def validate_final_frontend(frontend_dist, release, manifest):
    frontend_dist = Path(frontend_dist)
    required = REQUIRED_FRONTEND_FILES if manifest["schema"] == 2 else LEGACY_FRONTEND_FILES
    for name in required:
        path = frontend_dist / name
        if path.is_symlink() or not path.is_file():
            raise DeploymentError("Rebuilt frontend is missing required release artifacts.")
    marker = frontend_dist / "souqak-release.txt"
    marker_value = marker.read_text(encoding="utf-8").strip()
    if marker_value != release:
        raise DeploymentError("Rebuilt frontend release marker does not match its SHA.")
    if digest_tree(frontend_dist) != manifest["frontend_sha256"]:
        raise DeploymentError("Rebuilt frontend artifacts differ from the prepared manifest.")
    if manifest["schema"] == 2:
        template = frontend_dist / "dynamic-ad-renderer-template.html"
        prerender_manifest = frontend_dist / "prerender-manifest.json"
        if (
            hashlib.sha256(template.read_bytes()).hexdigest() != manifest["renderer_template_sha256"]
            or hashlib.sha256(prerender_manifest.read_bytes()).hexdigest()
            != manifest["prerender_manifest_sha256"]
        ):
            raise DeploymentError("Rebuilt Renderer or Prerender manifest differs from the release.")
        try:
            data = json.loads(prerender_manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise DeploymentError("Rebuilt Prerender manifest is invalid.") from error
        if (
            data.get("version") != 1
            or data.get("source") != "local"
            or data.get("siteBaseUrl") != "https://souqak-yem.com"
        ):
            raise DeploymentError("Rebuilt Prerender manifest is not bound to the local public Snapshot.")
        validate_frontend_index(frontend_dist)
        validate_renderer_template(frontend_dist)


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
    verify_frontend_path(
        previous_frontend,
        MANAGED_RELEASES,
        allow_legacy_renderer=True,
    )
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


def fetch_approved_source(release, staging, *, schema_version=2, active_release=None):
    repository = staging / "repository"
    repository.mkdir(mode=0o700)
    run(["git", "init", "--quiet", str(repository)])
    run(["git", "-C", str(repository), "remote", "add", "origin", REPOSITORY])
    run(["git", "-C", str(repository), "fetch", "--quiet", "--no-tags", "origin", "main"])
    commit = run(["git", "-C", str(repository), "rev-parse", "--verify", f"{release}^{{commit}}"], capture=True)
    if commit != release:
        raise DeploymentError("The requested SHA is not an exact commit in the approved repository.")
    run(["git", "-C", str(repository), "merge-base", "--is-ancestor", release, "FETCH_HEAD"])
    if active_release and re.fullmatch(r"[a-f0-9]{40}", active_release):
        if active_release == release:
            raise DeploymentError("Candidate release is already active.")
        active_commit = run(
            ["git", "-C", str(repository), "rev-parse", "--verify", f"{active_release}^{{commit}}"],
            capture=True,
        )
        if active_commit != active_release:
            raise DeploymentError("Active release is not present in the approved source history.")
        run([
            "git", "-C", str(repository), "merge-base", "--is-ancestor",
            active_release, release,
        ])
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
    validate_manifest_in_source(staging / "source", release, schema_version)
    return staging / "source"


def validate_hashed_frontend_html(frontend_dist, filename, *, require_renderer_shell):
    frontend_dist = Path(frontend_dist)
    html_file = frontend_dist / filename
    if html_file.is_symlink() or not html_file.is_file():
        raise DeploymentError(f"Built frontend is missing required HTML: {filename}.")
    try:
        contents = html_file.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise DeploymentError(f"Built frontend HTML is unreadable: {filename}.") from error
    scripts = re.findall(
        r"<script\b(?=[^>]*\btype=[\"']module[\"'])[^>]*\bsrc=[\"']([^\"']+)[\"']",
        contents,
        flags=re.IGNORECASE,
    )
    stylesheets = re.findall(
        r"<link\b(?=[^>]*\brel=[\"']stylesheet[\"'])[^>]*\bhref=[\"']([^\"']+)[\"']",
        contents,
        flags=re.IGNORECASE,
    )
    module_preloads = re.findall(
        r"<link\b(?=[^>]*\brel=[\"']modulepreload[\"'])[^>]*\bhref=[\"']([^\"']+)[\"']",
        contents,
        flags=re.IGNORECASE,
    )
    local_stylesheets = [asset for asset in stylesheets if asset.startswith("/assets/")]
    external_stylesheets = [asset for asset in stylesheets if not asset.startswith("/assets/")]
    valid_font_stylesheets = []
    for asset in external_stylesheets:
        parsed = urllib.parse.urlsplit(asset)
        if (
            parsed.scheme == "https"
            and parsed.netloc == "fonts.googleapis.com"
            and parsed.path == "/css2"
            and bool(parsed.query)
            and not parsed.fragment
        ):
            valid_font_stylesheets.append(asset)
    assets = scripts + local_stylesheets + module_preloads
    renderer_shell_valid = not require_renderer_shell or (
        re.search(
            r"<meta\b(?=[^>]*\bname=[\"']robots[\"'])[^>]*\bcontent=[\"']noindex,nofollow[\"']",
            contents,
            flags=re.IGNORECASE,
        )
        and re.search(
            r"<div\b(?=[^>]*\bid=[\"']root[\"'])[^>]*>\s*</div>",
            contents,
            flags=re.IGNORECASE,
        )
    )
    if (
        not scripts
        or any(not re.fullmatch(r"/assets/[a-z\d._-]+\.(?:js|css)", asset, flags=re.IGNORECASE) for asset in assets)
        or any(not asset.lower().endswith(".css") for asset in local_stylesheets)
        or len(valid_font_stylesheets) != len(external_stylesheets)
        or any(not asset.lower().endswith(".js") for asset in scripts + module_preloads)
        or not renderer_shell_valid
    ):
        raise DeploymentError(f"Built frontend HTML contains invalid or unversioned app assets: {filename}.")
    for asset in assets:
        asset_file = frontend_dist / asset.lstrip("/")
        if asset_file.is_symlink() or not asset_file.is_file() or asset_file.stat().st_size == 0:
            raise DeploymentError(f"Built frontend asset is missing or invalid: {asset}.")
    return html_file


def validate_renderer_template(frontend_dist):
    return validate_hashed_frontend_html(
        frontend_dist,
        "dynamic-ad-renderer-template.html",
        require_renderer_shell=True,
    )


def validate_frontend_index(frontend_dist):
    return validate_hashed_frontend_html(
        frontend_dist,
        "index.html",
        require_renderer_shell=False,
    )


def ensure_release_marker(frontend_dist, release):
    marker = Path(frontend_dist) / "souqak-release.txt"
    try:
        metadata = marker.lstat()
    except FileNotFoundError:
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
        try:
            fd = os.open(marker, flags, 0o600)
        except FileExistsError as error:
            raise DeploymentError("Frontend release marker changed during validation.") from error
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            output.write(release + "\n")
            output.flush()
            os.fsync(output.fileno())
        metadata = marker.lstat()
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise DeploymentError("Frontend release marker must be a regular file.")
    if marker.read_text(encoding="utf-8").strip() != release:
        raise DeploymentError("Frontend release marker does not match the reviewed release SHA.")


def build_backend_image(ops, source, release, frontend_dist, manifest):
    context = source.parent / "backend-build-context"
    context.mkdir(mode=0o700)
    shutil.copy2(source / "Dockerfile", context / "Dockerfile")
    docker_sources = dockerfile_copy_sources(context / "Dockerfile")
    if manifest["schema"] == 2:
        expected_sources = {
            "backend/package.json",
            "backend/package-lock.json",
            "backend/src",
            "shared/seoRules.mjs",
            "frontend/index.html",
        }
        if set(docker_sources) != expected_sources:
            raise DeploymentError("Reviewed Dockerfile COPY inputs differ from the curated SEO build context.")
    backend_context = context / "backend"
    backend_context.mkdir()
    shutil.copy2(source / "backend" / "package.json", backend_context / "package.json")
    shutil.copy2(source / "backend" / "package-lock.json", backend_context / "package-lock.json")
    shutil.copytree(
        source / "backend" / "src",
        backend_context / "src",
        ignore=ignore_build_secrets,
    )
    if "shared/seoRules.mjs" in docker_sources:
        shared_context = context / "shared"
        shared_context.mkdir()
        for name in REQUIRED_SHARED_RUNTIME_FILES:
            shutil.copy2(source / "shared" / name, shared_context / name)
    if "frontend/index.html" in docker_sources:
        renderer_template = validate_renderer_template(frontend_dist)
        if manifest["schema"] == 2 and hashlib.sha256(
            renderer_template.read_bytes()
        ).hexdigest() != manifest["renderer_template_sha256"]:
            raise DeploymentError("Backend Renderer template differs from the prepared Frontend build.")
        frontend_context = context / "frontend"
        frontend_context.mkdir()
        shutil.copy2(renderer_template, frontend_context / "index.html")
    validate_docker_build_context(context)
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
    labels = ops.docker(
        "image", "inspect", "--format", "{{json .Config.Labels}}", image, capture=True
    )
    try:
        labels = json.loads(labels)
    except (TypeError, json.JSONDecodeError) as error:
        raise DeploymentError("Built backend image labels are invalid.") from error
    if (
        labels.get("com.souqak.release") != release
        or labels.get("com.souqak.source-commit") != release
    ):
        raise DeploymentError("Built backend image identity does not match the reviewed release SHA.")
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
        frontend_workspace = None
        try:
            bundle_snapshot = staging / "bundle"
            bundle_snapshot.mkdir(mode=0o700)
            manifest = snapshot_bundle(bundle, bundle_snapshot, release, submitter_uid)
            backend, mongo, previous_frontend = validate_production_layout(ops, submitter_uid)
            active_release = (
                previous_frontend / "souqak-release.txt"
            ).read_text(encoding="utf-8").strip()
            source = fetch_approved_source(
                release,
                staging,
                schema_version=manifest["schema"],
                active_release=active_release,
            )
            if manifest["schema"] == 2:
                validate_shared_matches_source(bundle_snapshot, source, manifest)
            validate_draft_index_attestation(
                STATE_ROOT / "draft-index-attestation.txt",
                source / "backend" / "src" / "models" / "DraftAction.js",
            )
            confirm(release, digest_tree(bundle_snapshot))
            if manifest["schema"] == 2:
                builder = preflight_builder()
                frontend_workspace = Path(tempfile.mkdtemp(prefix=f"{release}-", dir=BUILD_ROOT))
                frontend_dist = build_frontend_as_builder(
                    source,
                    frontend_workspace,
                    builder,
                    bundle_snapshot / SNAPSHOT_PATH,
                    release,
                    manifest["seo_snapshot"],
                )
            else:
                frontend_dist = bundle_snapshot / "frontend" / "dist"
            ensure_release_marker(frontend_dist, release)
            validate_final_frontend(frontend_dist, release, manifest)
            image = build_backend_image(ops, source, release, frontend_dist, manifest)
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
                    switch_previous_frontend=lambda target: atomic_symlink(
                        target,
                        allow_legacy_renderer=True,
                    ),
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
                    switch_previous_frontend=lambda target: atomic_symlink(
                        target,
                        allow_legacy_renderer=True,
                    ),
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
            if frontend_workspace is not None and frontend_workspace.exists():
                if frontend_workspace.parent != BUILD_ROOT:
                    raise DeploymentError("Frontend build workspace escaped its protected parent.")
                shutil.rmtree(frontend_workspace)
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
        previous_frontend = verify_frontend_path(
            state["previous_frontend"],
            MANAGED_RELEASES,
            allow_legacy_renderer=True,
        )
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
            atomic_symlink(previous_frontend, allow_legacy_renderer=True)
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
        bundle_root = Path(directory)
        manifest = snapshot_bundle(bundle, bundle_root, release, submitter_uid)
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
        validate_manifest_in_source(source_root, release, manifest["schema"])
        if manifest["schema"] == 2:
            validate_shared_matches_source(bundle_root, source_root, manifest)
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


def build_frontend_as_builder(source, workspace, account, snapshot, release, seo_binding):
    try:
        snapshot_info(snapshot, release, seo_binding["schemaVersion"], seo_binding)
    except (OSError, ValueError, TypeError, KeyError) as error:
        raise DeploymentError("Protected frontend build Snapshot is invalid.") from error
    if workspace.is_symlink() or not workspace.is_dir() or workspace.stat().st_uid != 0:
        raise DeploymentError("Build workspace must be a new root-created directory.")
    frontend = copy_frontend_sources(source, workspace)
    local_snapshot = workspace / SNAPSHOT_PATH
    shutil.copyfile(snapshot, local_snapshot)
    try:
        snapshot_info(local_snapshot, release, seo_binding["schemaVersion"], seo_binding)
    except (OSError, ValueError, TypeError, KeyError) as error:
        raise DeploymentError("Frontend build Snapshot changed during staging.") from error
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
        "SEO_PRERENDER_DATA_SOURCE": "local",
        "SEO_PRERENDER_SNAPSHOT_PATH": str(local_snapshot),
        "SEO_PRERENDER_MAX_AGE_MS": str(MAX_AGE_MS),
        "SOUQAK_BUILD_ID": release,
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
        ["node", "scripts/exportPrerenderSnapshot.mjs", "--validate", str(local_snapshot)],
        ["node", "--check", str(workspace / "shared" / "seoRules.mjs")],
        ["npm", "ci", "--no-audit", "--no-fund"],
        ["npm", "run", "build"],
        ["node", "scripts/prerenderBuild.mjs", "--validate", str(frontend / "dist")],
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


def copy_frontend_sources(source, workspace):
    frontend = Path(workspace) / "frontend"
    shutil.copytree(
        Path(source) / "frontend",
        frontend,
        symlinks=False,
        ignore=ignore_build_secrets,
    )
    shared_context = Path(workspace) / "shared"
    shared_context.mkdir()
    for name in REQUIRED_SHARED_RUNTIME_FILES:
        source_file = Path(source) / "shared" / name
        if source_file.is_symlink() or not source_file.is_file() or source_file.stat().st_size == 0:
            raise DeploymentError(f"Approved source is missing a valid shared/{name}.")
        shutil.copy2(source_file, shared_context / name)
    return frontend


def ignore_build_secrets(_directory, names):
    return {
        name for name in names
        if name in {".env", ".envrc", ".npmrc"}
        or name.startswith(".env.")
        or name.lower().endswith((".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"))
    }


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
