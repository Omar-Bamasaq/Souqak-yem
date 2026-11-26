"""Strict release-time validators for legacy and SEO Snapshot contracts."""

import hashlib
import json
import os
import re
import stat
from datetime import datetime, timedelta, timezone
from pathlib import Path

MAX_BYTES = 16 * 1024 * 1024
MAX_AGE_MS = 86_400_000
SITE = "https://souqak-yem.com"
SNAPSHOT_PATH = "seo-snapshot.json"
SHA256_PATTERN = re.compile(r"[a-f0-9]{64}\Z")
RELEASE_PATTERN = re.compile(r"[a-f0-9]{40}\Z")


def _record(value):
    return isinstance(value, dict)


def _timestamp(value, label):
    if not isinstance(value, str):
        raise ValueError(f"Snapshot {label} must be a timezone-aware ISO timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"Snapshot {label} is invalid") from error
    if parsed.tzinfo is None:
        raise ValueError(f"Snapshot {label} must include a timezone")
    return parsed


def _read_snapshot(file):
    file = Path(file)
    before_path = file.lstat()
    if not stat.S_ISREG(before_path.st_mode) or stat.S_ISLNK(before_path.st_mode):
        raise ValueError("Snapshot must be a regular file, not a link")
    if not 0 < before_path.st_size <= MAX_BYTES:
        raise ValueError("Snapshot size is outside the allowed limit")

    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    fd = os.open(file, flags)
    try:
        before = os.fstat(fd)
        if (
            not stat.S_ISREG(before.st_mode)
            or (before.st_dev, before.st_ino) != (before_path.st_dev, before_path.st_ino)
            or not 0 < before.st_size <= MAX_BYTES
        ):
            raise ValueError("Snapshot changed while it was opened")
        chunks = []
        remaining = MAX_BYTES + 1
        while remaining:
            chunk = os.read(fd, min(1024 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        after = os.fstat(fd)
        if (
            len(raw) != before.st_size
            or len(raw) > MAX_BYTES
            or (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
            != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)
        ):
            raise ValueError("Snapshot is incomplete or changed while it was read")
    finally:
        os.close(fd)

    try:
        data = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Snapshot is not valid UTF-8 JSON") from error
    if not _record(data) or not _record(data.get("metadata")):
        raise ValueError("Snapshot metadata is missing or invalid")
    return raw, data["metadata"]


def _validate_v1(metadata, release, now):
    if type(metadata.get("schemaVersion")) is not int or metadata["schemaVersion"] != 1:
        raise ValueError("Snapshot schema 1 requires an integer schemaVersion")
    if metadata.get("siteBaseUrl") != SITE:
        raise ValueError("Snapshot schema 1 site URL mismatch")
    if metadata.get("sourceCommit") != release:
        raise ValueError("Snapshot source commit mismatch")
    if type(metadata.get("maxAgeMs")) is not int or metadata["maxAgeMs"] != MAX_AGE_MS:
        raise ValueError("Snapshot schema 1 lifetime mismatch")

    exported_at = _timestamp(metadata.get("exportedAt"), "exportedAt")
    expires_at = _timestamp(metadata.get("expiresAt"), "expiresAt")
    age_ms = (now - exported_at).total_seconds() * 1000
    lifetime_ms = (expires_at - exported_at).total_seconds() * 1000
    if age_ms < 0 or age_ms > MAX_AGE_MS or lifetime_ms != MAX_AGE_MS:
        raise ValueError("Snapshot schema 1 is stale, future-dated, or has an invalid expiry")

    return {
        "path": SNAPSHOT_PATH,
        "sha256": None,
        "bytes": None,
        "sourceCommit": release,
        "maxAgeMs": MAX_AGE_MS,
    }


def _validate_v2(metadata, release, now):
    if type(metadata.get("schemaVersion")) is not int or metadata["schemaVersion"] != 2:
        raise ValueError("Snapshot schema 2 requires an integer schemaVersion")
    if metadata.get("siteBaseUrl") != SITE:
        raise ValueError("Snapshot schema 2 site URL mismatch")
    if metadata.get("sourceCommit") != release:
        raise ValueError("Snapshot source commit mismatch")
    if metadata.get("source") != "public-api" or metadata.get("sourceDatabase") != "not-accessed-public-api":
        raise ValueError("Snapshot schema 2 source is invalid")
    if type(metadata.get("maxAgeMs")) is not int or metadata["maxAgeMs"] != MAX_AGE_MS:
        raise ValueError("Snapshot schema 2 lifetime mismatch")

    exported_at = _timestamp(metadata.get("exportedAt"), "exportedAt")
    expires_at = _timestamp(metadata.get("expiresAt"), "expiresAt")
    if exported_at.utcoffset() != timedelta(0) or expires_at.utcoffset() != timedelta(0):
        raise ValueError("Snapshot schema 2 timestamps must be UTC")
    age_ms = (now - exported_at).total_seconds() * 1000
    lifetime_ms = (expires_at - exported_at).total_seconds() * 1000
    if age_ms < 0 or age_ms > MAX_AGE_MS or lifetime_ms != MAX_AGE_MS:
        raise ValueError("Snapshot schema 2 is stale, future-dated, or has an invalid expiry")

    return {
        "path": SNAPSHOT_PATH,
        "sha256": None,
        "bytes": None,
        "sourceCommit": release,
        "maxAgeMs": MAX_AGE_MS,
        "schemaVersion": 2,
        "expiresAt": expires_at.isoformat(),
    }


def snapshot_info(file, release, schema_version, expected=None, now=None):
    """Return a manifest binding after applying the explicitly selected schema."""
    if not isinstance(release, str) or not RELEASE_PATTERN.fullmatch(release):
        raise ValueError("Snapshot release must be a full lowercase commit SHA")
    if type(schema_version) is not int or schema_version not in {1, 2}:
        raise ValueError("Unsupported Snapshot schema version")
    raw, metadata = _read_snapshot(file)
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        raise ValueError("Snapshot validation time must be timezone-aware")
    if schema_version == 1:
        binding = _validate_v1(metadata, release, current_time)
    else:
        binding = _validate_v2(metadata, release, current_time)
    if type(metadata.get("schemaVersion")) is not int or metadata["schemaVersion"] != schema_version:
        raise ValueError("Snapshot schema does not match the explicitly selected contract")
    binding["sha256"] = hashlib.sha256(raw).hexdigest()
    binding["bytes"] = len(raw)
    if expected is not None:
        if not _record(expected) or expected != binding:
            raise ValueError("Snapshot manifest hash, size, expiry, or source binding mismatch")
    return binding


def validate_manifest(manifest, release, *, now=None):
    """Validate either manifest schema without coercion or implicit fallback."""
    if not _record(manifest):
        raise ValueError("Release manifest must be an object")
    schema = manifest.get("schema")
    if type(schema) is not int or schema not in {1, 2}:
        raise ValueError("Unsupported release manifest schema")
    if (
        not isinstance(release, str)
        or not RELEASE_PATTERN.fullmatch(release)
        or manifest.get("release") != release
        or manifest.get("repository") != "https://github.com/Omar-Bamasaq/Souqak-yem.git"
        or manifest.get("branch") != "main"
    ):
        raise ValueError("Release manifest does not describe the approved source SHA")
    current_time = now or datetime.now(timezone.utc)
    if schema == 2:
        prepared_at = _timestamp(manifest.get("prepared_at"), "prepared_at")
        if prepared_at > current_time:
            raise ValueError("Release manifest is future-dated")
    checks = manifest.get("checks")
    if not _record(checks):
        raise ValueError("Release checks are missing")
    if schema == 1:
        if any(checks.get(name) is not True for name in ("frontend_tests", "frontend_build")):
            raise ValueError("Legacy release manifest does not prove all required checks")
    else:
        test_names = checks.get("backend_tests")
        if (
            checks.get("backend_tests_passed") is not True
            or checks.get("frontend_tests") is not True
            or checks.get("frontend_build") is not True
            or not isinstance(test_names, list)
            or not test_names
            or any(not isinstance(name, str) or not name for name in test_names)
            or len(set(test_names)) != len(test_names)
        ):
            raise ValueError("SEO release manifest does not prove all required checks")

    for key in ("frontend_sha256",):
        if not isinstance(manifest.get(key), str) or not SHA256_PATTERN.fullmatch(manifest[key]):
            raise ValueError(f"Release manifest {key} is invalid")
    if schema == 2:
        for key in ("shared_sha256", "renderer_template_sha256", "prerender_manifest_sha256"):
            if not isinstance(manifest.get(key), str) or not SHA256_PATTERN.fullmatch(manifest[key]):
                raise ValueError(f"Release manifest {key} is invalid")

    snapshot = manifest.get("seo_snapshot")
    if not _record(snapshot):
        raise ValueError("Release manifest has no Snapshot binding")
    expected_snapshot_schema = 1 if schema == 1 else 2
    if type(snapshot.get("schemaVersion", expected_snapshot_schema)) is not int:
        raise ValueError("Snapshot schema version must be an integer")
    if snapshot.get("schemaVersion", expected_snapshot_schema) != expected_snapshot_schema:
        raise ValueError("Manifest and Snapshot contract versions do not match")
    if snapshot.get("path") != SNAPSHOT_PATH:
        raise ValueError("Manifest Snapshot path is not the approved fixed path")
    if not isinstance(snapshot.get("sha256"), str) or not SHA256_PATTERN.fullmatch(snapshot["sha256"]):
        raise ValueError("Manifest Snapshot SHA-256 is invalid")
    if type(snapshot.get("bytes")) is not int or not 0 < snapshot["bytes"] <= MAX_BYTES:
        raise ValueError("Manifest Snapshot byte size is invalid")
    if snapshot.get("sourceCommit") != release:
        raise ValueError("Manifest Snapshot source commit mismatch")
    if type(snapshot.get("maxAgeMs")) is not int or snapshot["maxAgeMs"] != MAX_AGE_MS:
        raise ValueError("Manifest Snapshot lifetime mismatch")
    if schema == 1:
        expected_keys = {"path", "sha256", "bytes", "sourceCommit", "maxAgeMs"}
        if set(snapshot) != expected_keys:
            raise ValueError("Legacy Snapshot binding contains unsupported fields")
    else:
        if (
            snapshot.get("schemaVersion") != 2
            or set(snapshot) != {
                "path", "sha256", "bytes", "sourceCommit", "maxAgeMs",
                "schemaVersion", "expiresAt",
            }
        ):
            raise ValueError("SEO Snapshot binding is incomplete or contains unsupported fields")
        _timestamp(snapshot.get("expiresAt"), "manifest Snapshot expiresAt")
    return schema
