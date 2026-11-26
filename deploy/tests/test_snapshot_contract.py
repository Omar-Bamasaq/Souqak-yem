import hashlib
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "snapshot_contract.py"
SPEC = importlib.util.spec_from_file_location("souqak_snapshot_contract", MODULE_PATH)
contract = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contract)
RELEASE = "a" * 40
NOW = datetime(2026, 3, 10, 12, tzinfo=timezone.utc)


def write_snapshot(path, schema=2, *, exported_at=None, expires_at=None, source_commit=RELEASE):
    exported_at = exported_at or NOW - timedelta(hours=1)
    expires_at = expires_at or exported_at + timedelta(milliseconds=contract.MAX_AGE_MS)
    metadata = {
        "schemaVersion": schema,
        "siteBaseUrl": contract.SITE,
        "sourceCommit": source_commit,
        "maxAgeMs": contract.MAX_AGE_MS,
        "exportedAt": exported_at.isoformat(),
        "expiresAt": expires_at.isoformat(),
    }
    if schema == 2:
        metadata.update({
            "source": "public-api",
            "sourceDatabase": "not-accessed-public-api",
        })
    path.write_text(json.dumps({"metadata": metadata, "data": {}}), encoding="utf-8")
    return metadata


def manifest_for(snapshot_path, schema, binding):
    checks = (
        {
            "frontend_tests": True,
            "frontend_build": True,
        }
        if schema == 1
        else {
            "backend_tests_passed": True,
            "backend_tests": ["test/example.test.js"],
            "frontend_tests": True,
            "frontend_build": True,
        }
    )
    return {
        "schema": schema,
        "repository": "https://github.com/Omar-Bamasaq/Souqak-yem.git",
        "branch": "main",
        "release": RELEASE,
        **({"prepared_at": NOW.isoformat()} if schema == 2 else {}),
        "checks": checks,
        "frontend_sha256": hashlib.sha256(b"frontend fixture").hexdigest(),
        "seo_snapshot": binding,
        **({
            "shared_sha256": hashlib.sha256(b"shared fixture").hexdigest(),
            "renderer_template_sha256": hashlib.sha256(b"renderer fixture").hexdigest(),
            "prerender_manifest_sha256": hashlib.sha256(b"prerender fixture").hexdigest(),
        } if schema == 2 else {}),
    }


class SnapshotContractTests(unittest.TestCase):
    def test_explicit_legacy_and_seo_contracts_validate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for schema in (1, 2):
                snapshot = root / f"snapshot-{schema}.json"
                write_snapshot(snapshot, schema)
                binding = contract.snapshot_info(snapshot, RELEASE, schema, now=NOW)
                manifest = manifest_for(snapshot, schema, binding)
                self.assertEqual(contract.validate_manifest(manifest, RELEASE, now=NOW), schema)
                self.assertEqual(
                    contract.snapshot_info(snapshot, RELEASE, schema, binding, now=NOW),
                    binding,
                )

    def test_legacy_manifest_keeps_the_existing_minimum_check_contract(self):
        with tempfile.TemporaryDirectory() as temporary:
            snapshot = Path(temporary) / "snapshot.json"
            write_snapshot(snapshot, 1)
            binding = contract.snapshot_info(snapshot, RELEASE, 1, now=NOW)
            manifest = manifest_for(snapshot, 1, binding)
            self.assertNotIn("prepared_at", manifest)
            self.assertNotIn("backend_tests", manifest["checks"])
            self.assertEqual(contract.validate_manifest(manifest, RELEASE, now=NOW), 1)

    def test_boolean_schema_and_wrong_selected_contract_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            snapshot = Path(temporary) / "snapshot.json"
            write_snapshot(snapshot, 1)
            raw = json.loads(snapshot.read_text(encoding="utf-8"))
            raw["metadata"]["schemaVersion"] = True
            snapshot.write_text(json.dumps(raw), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "integer schemaVersion"):
                contract.snapshot_info(snapshot, RELEASE, 1, now=NOW)

            write_snapshot(snapshot, 2)
            with self.assertRaisesRegex(ValueError, "requires an integer schemaVersion"):
                contract.snapshot_info(snapshot, RELEASE, 1, now=NOW)

    def test_wrong_commit_and_expired_or_future_snapshot_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            snapshot = Path(temporary) / "snapshot.json"
            write_snapshot(snapshot, source_commit="b" * 40)
            with self.assertRaisesRegex(ValueError, "source commit mismatch"):
                contract.snapshot_info(snapshot, RELEASE, 2, now=NOW)

            write_snapshot(snapshot, exported_at=NOW - timedelta(days=2))
            with self.assertRaisesRegex(ValueError, "stale"):
                contract.snapshot_info(snapshot, RELEASE, 2, now=NOW)

            write_snapshot(snapshot, exported_at=NOW + timedelta(seconds=1))
            with self.assertRaisesRegex(ValueError, "future-dated"):
                contract.snapshot_info(snapshot, RELEASE, 2, now=NOW)

    def test_manifest_rejects_modified_snapshot_binding_and_unsupported_types(self):
        with tempfile.TemporaryDirectory() as temporary:
            snapshot = Path(temporary) / "snapshot.json"
            write_snapshot(snapshot)
            binding = contract.snapshot_info(snapshot, RELEASE, 2, now=NOW)
            manifest = manifest_for(snapshot, 2, binding)
            manifest["seo_snapshot"]["sha256"] = "0" * 64
            contract.validate_manifest(manifest, RELEASE, now=NOW)
            with self.assertRaisesRegex(ValueError, "manifest hash"):
                contract.snapshot_info(
                    snapshot,
                    RELEASE,
                    2,
                    manifest["seo_snapshot"],
                    now=NOW,
                )

            manifest = manifest_for(snapshot, 2, binding)
            manifest["seo_snapshot"]["bytes"] += 1
            with self.assertRaisesRegex(ValueError, "manifest hash, size"):
                contract.snapshot_info(
                    snapshot,
                    RELEASE,
                    2,
                    manifest["seo_snapshot"],
                    now=NOW,
                )

            manifest = manifest_for(snapshot, 2, binding)
            manifest["seo_snapshot"]["expiresAt"] = "2026-03-11T01:00:00+01:00"
            with self.assertRaisesRegex(ValueError, "manifest hash, size"):
                contract.snapshot_info(
                    snapshot,
                    RELEASE,
                    2,
                    manifest["seo_snapshot"],
                    now=NOW,
                )

            manifest = manifest_for(snapshot, 2, binding)
            manifest["schema"] = True
            with self.assertRaisesRegex(ValueError, "Unsupported release manifest schema"):
                contract.validate_manifest(manifest, RELEASE, now=NOW)

            manifest = manifest_for(snapshot, 2, binding)
            manifest["seo_snapshot"]["path"] = "../snapshot.json"
            with self.assertRaisesRegex(ValueError, "approved fixed path"):
                contract.validate_manifest(manifest, RELEASE, now=NOW)

    def test_snapshot_symlinks_are_rejected_when_supported(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "target.json"
            write_snapshot(target)
            link = root / "link.json"
            try:
                link.symlink_to(target)
            except OSError:
                self.skipTest("Symlink creation is not available in this local environment.")
            with self.assertRaisesRegex(ValueError, "regular file"):
                contract.snapshot_info(link, RELEASE, 2, now=NOW)


if __name__ == "__main__":
    unittest.main()
