import importlib.util
import io
import json
import os
import tarfile
import tempfile
import unittest
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / "admin" / "activate-release.py"
SPEC = importlib.util.spec_from_file_location("souqak_admin_deploy", MODULE_PATH)
admin = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(admin)
RELEASE = "a" * 40


class FakeOps:
    def __init__(self, fail=None):
        self.fail = fail
        self.containers = {
            admin.BACKEND: {"id": "old-id", "running": True, "release": "old-release"}
        }
        self.frontend = "old-frontend"
        self.max_running = 1
        self.reloads = 0
        self.database_id = "mongo-id"
        self.volume_names = {
            admin.DATABASE_VOLUME,
            admin.UPLOADS_VOLUME,
            admin.PRIVATE_UPLOADS_VOLUME,
        }

    def _active(self):
        self.max_running = max(
            self.max_running,
            sum(1 for item in self.containers.values() if item["running"]),
        )

    def docker(self, *args, capture=False):
        action = args[0]
        if action == "stop":
            self.containers[args[-1]]["running"] = False
        elif action == "rename":
            old, new = args[1:]
            if old not in self.containers or new in self.containers:
                raise admin.DeploymentError("rename rejected")
            self.containers[new] = self.containers.pop(old)
        elif action == "run":
            if self.fail == "start":
                raise admin.DeploymentError("simulated start failure")
            self.containers[admin.BACKEND] = {
                "id": "new-id",
                "running": True,
                "release": RELEASE,
            }
        elif action == "inspect":
            name = args[-1]
            if name not in self.containers:
                raise admin.DeploymentError("missing")
            if "--format" in args:
                fmt = args[args.index("--format") + 1]
                item = self.containers[name]
                if fmt == "{{.Id}}":
                    return item["id"]
                if "State.Running" in fmt:
                    return "true" if item["running"] else "false"
                if "com.souqak.release" in fmt:
                    return item["release"]
            return "[]"
        elif action == "rm":
            self.containers.pop(args[-1])
        elif action == "start":
            name = args[-1]
            if self.fail == "restore" and self.containers[name]["release"] == "old-release":
                raise admin.DeploymentError("simulated restore failure")
            self.containers[name]["running"] = True
        self._active()
        return "ok" if capture else ""

    def container_exists(self, name):
        return name in self.containers

    def container_id(self, name):
        if name not in self.containers:
            raise admin.DeploymentError("missing container")
        return self.containers[name]["id"]

    def container_running(self, name):
        return self.containers[name]["running"]

    def wait_backend(self, attempts=60):
        if not self.containers.get(admin.BACKEND, {}).get("running"):
            return False
        if self.fail == "health" and self.containers[admin.BACKEND]["release"] == RELEASE:
            return False
        return True

    def check_frontend(self, release):
        if self.fail in {"frontend-health", "nginx"} and release == RELEASE:
            return False
        return release == self.frontend

    def reload_nginx(self):
        self.reloads += 1
        if self.fail == "nginx":
            raise admin.DeploymentError("simulated nginx reload failure")


def switch_for(ops):
    def switch(target):
        if ops.fail == "frontend-switch" and str(target) != "old-frontend":
            raise admin.DeploymentError("simulated frontend switch failure")
        if isinstance(target, str):
            ops.frontend = target
        else:
            ops.frontend = (
                "new-frontend"
                if Path(target).name == "dist" and RELEASE in str(target)
                else Path(target).joinpath("souqak-release.txt").read_text().strip()
            )
    return switch


class AdminDeploymentTests(unittest.TestCase):
    def make_frontend_copy_fixture(self, root):
        build_root = root / "build"
        source = build_root / "release" / "frontend" / "dist"
        destination = root / "protected" / "dist"
        source.mkdir(parents=True)
        destination.mkdir(parents=True)
        build_root.chmod(0o711)
        destination.chmod(0o700)
        return build_root, source, destination

    def run_activation(self, fail=None):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        previous = root / "previous" / "frontend" / "dist"
        candidate = root / RELEASE / "frontend" / "dist"
        previous.mkdir(parents=True)
        candidate.mkdir(parents=True)
        (previous / "souqak-release.txt").write_text("old-release", encoding="utf-8")
        (candidate / "souqak-release.txt").write_text(RELEASE, encoding="utf-8")
        ops = FakeOps(fail=fail)

        def switch(target):
            if fail == "frontend-switch" and Path(target) == candidate:
                raise admin.DeploymentError("simulated frontend switch failure")
            ops.frontend = (Path(target) / "souqak-release.txt").read_text(encoding="utf-8").strip()

        def activate():
            return admin.activate_transaction(
                ops,
                release=RELEASE,
                image=f"{admin.IMAGE_REPOSITORY}:{RELEASE}",
                old_backend_id="old-id",
                previous_container=f"souqak-backend-rollback-{RELEASE}",
                previous_frontend=previous,
                new_frontend=candidate,
                switch_frontend=switch,
            )

        return temporary, ops, activate

    def test_activation_success_keeps_one_backend_and_uses_fixed_production_settings(self):
        temporary, ops, activate = self.run_activation()
        with temporary:
            result = activate()
            self.assertTrue(result["started"])
            self.assertEqual(ops.max_running, 1)
            self.assertEqual(ops.containers[admin.BACKEND]["release"], RELEASE)
            self.assertFalse(ops.containers[f"souqak-backend-rollback-{RELEASE}"]["running"])

    def test_backend_start_failure_restores_old_backend(self):
        temporary, ops, activate = self.run_activation(fail="start")
        with temporary, self.assertRaisesRegex(admin.DeploymentError, "previous application was restored"):
            activate()
        self.assertEqual(ops.containers[admin.BACKEND]["id"], "old-id")
        self.assertTrue(ops.containers[admin.BACKEND]["running"])
        self.assertEqual(ops.max_running, 1)

    def test_backend_health_failure_restores_old_backend(self):
        temporary, ops, activate = self.run_activation(fail="health")
        with temporary, self.assertRaisesRegex(admin.DeploymentError, "previous application was restored"):
            activate()
        self.assertEqual(ops.containers[admin.BACKEND]["id"], "old-id")

    def test_frontend_switch_failure_restores_old_backend_and_link(self):
        temporary, ops, activate = self.run_activation(fail="frontend-switch")
        with temporary, self.assertRaisesRegex(admin.DeploymentError, "previous application was restored"):
            activate()
        self.assertEqual(ops.frontend, "old-release")
        self.assertEqual(ops.containers[admin.BACKEND]["id"], "old-id")

    def test_nginx_failure_attempts_application_rollback_and_reports_outcome(self):
        temporary, ops, activate = self.run_activation(fail="nginx")
        with temporary, self.assertRaisesRegex(admin.DeploymentError, "previous application was restored"):
            activate()
        self.assertEqual(ops.containers[admin.BACKEND]["id"], "old-id")
        self.assertGreaterEqual(ops.reloads, 1)

    def test_failed_rollback_is_reported_as_manual_recovery(self):
        temporary, ops, activate = self.run_activation()
        # A failed new backend followed by a failed old-container start is fail-closed.
        original_run = ops.docker
        def fail_new_and_restore(*args, **kwargs):
            if args[0] == "run" or (args[0] == "start" and args[-1] == admin.BACKEND):
                raise admin.DeploymentError("simulated failure")
            return original_run(*args, **kwargs)
        ops.docker = fail_new_and_restore
        with temporary, self.assertRaisesRegex(admin.DeploymentError, "manual recovery is required"):
            activate()

    def test_rollback_record_rejects_mismatched_release_or_container_id(self):
        if os.name != "posix":
            self.skipTest("Protected Unix file ownership and mode checks are Linux-specific.")
        with tempfile.TemporaryDirectory() as temporary:
            state_path = Path(temporary) / "state.json"
            state_path.write_text(json.dumps({
                "schema": 1, "status": "active", "release": RELEASE,
                "active_backend_id": "expected-active",
                "previous_container": "previous",
                "previous_container_id": "expected-previous",
            }))
            state_path.chmod(0o600)
            fake = mock.Mock()
            fake.container_id.side_effect = ["wrong-active", "expected-previous"]
            with mock.patch.object(admin, "STATE_FILE", state_path):
                with self.assertRaisesRegex(admin.DeploymentError, "Active backend identity"):
                    admin.validate_rollback_record(RELEASE, fake)
                with self.assertRaisesRegex(admin.DeploymentError, "does not match"):
                    admin.validate_rollback_record("b" * 40, fake)

    def test_bundle_path_is_fixed_and_symlinks_are_rejected(self):
        if os.open not in os.supports_dir_fd or not hasattr(os, "O_NOFOLLOW"):
            self.skipTest("Secure openat snapshot is Linux-only.")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "prepared"
            root.mkdir()
            release_dir = root / RELEASE
            release_dir.mkdir()
            outside = Path(temporary) / "outside"
            outside.mkdir()
            with mock.patch.object(admin, "PREPARED_ROOT", root):
                with self.assertRaisesRegex(admin.DeploymentError, "direct child"):
                    admin.snapshot_bundle(outside / "release", Path(temporary) / "snapshot", RELEASE, os.getuid())
            link = release_dir / "outside-link"
            try:
                link.symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("Symlink creation is not available in this local Windows environment.")
            fd = os.open(release_dir, os.O_RDONLY | os.O_DIRECTORY)
            try:
                with self.assertRaisesRegex(admin.DeploymentError, "link or special file"):
                    admin.snapshot_directory(fd, Path(temporary) / "snapshot", Path(), [0])
            finally:
                os.close(fd)

    def test_git_archive_rejects_symlink_members(self):
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode="w") as stream:
            member = tarfile.TarInfo("frontend/link")
            member.type = tarfile.SYMTYPE
            member.linkname = "../../outside"
            stream.addfile(member)
        archive.seek(0)
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(admin.DeploymentError, "unsafe path or file type"):
                admin.extract_git_archive(archive, Path(temporary) / "source")

    def test_database_volume_is_never_an_application_mount(self):
        helper = MODULE_PATH.read_text(encoding="utf-8")
        self.assertNotIn(f"{admin.DATABASE_VOLUME},target=", helper)
        self.assertIn(admin.UPLOADS_VOLUME, helper)
        self.assertIn("/app/uploads", helper)
        self.assertIn(admin.PRIVATE_UPLOADS_VOLUME, helper)
        self.assertIn("/app/private_uploads", helper)

    def test_draft_index_attestation_must_match_schema_and_fresh_verified_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            schema = Path(temporary) / "DraftAction.js"
            attestation = Path(temporary) / "draft-index-attestation.txt"
            schema.write_text("candidate schema", encoding="utf-8")
            values = {
                **admin.DRAFT_INDEX_ATTESTATION_VALUES,
                "SCHEMA_SHA256": sha256(schema.read_bytes()).hexdigest(),
                "VERIFIED_AT_UTC": "2026-11-09T00:00:00.000Z",
            }
            attestation.write_text(
                "".join(f"{key}={value}\n" for key, value in values.items()),
                encoding="utf-8",
            )
            other_schema = Path(temporary) / "other-schema.js"
            other_schema.write_text("different schema", encoding="utf-8")
            now = datetime(2026, 11, 9, 1, tzinfo=timezone.utc)
            admin.validate_draft_index_attestation(
                attestation, schema, now=now, require_protected=False
            )
            with self.assertRaisesRegex(admin.DeploymentError, "match the approved release schema"):
                admin.validate_draft_index_attestation(
                    attestation, other_schema,
                    now=now, require_protected=False
                )
            with self.assertRaisesRegex(admin.DeploymentError, "expired"):
                admin.validate_draft_index_attestation(
                    attestation, schema,
                    now=datetime(2026, 11, 20, tzinfo=timezone.utc),
                    require_protected=False,
                )

    def test_draft_index_attestation_rejects_unverified_index_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            schema = Path(temporary) / "DraftAction.js"
            attestation = Path(temporary) / "draft-index-attestation.txt"
            schema.write_text("candidate schema", encoding="utf-8")
            values = {
                **admin.DRAFT_INDEX_ATTESTATION_VALUES,
                "LEGACY_USER_TYPE_INDEX": "present",
                "SCHEMA_SHA256": sha256(schema.read_bytes()).hexdigest(),
                "VERIFIED_AT_UTC": "2026-11-09T00:00:00.000Z",
            }
            attestation.write_text(
                "".join(f"{key}={value}\n" for key, value in values.items()),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(admin.DeploymentError, "required database indexes"):
                admin.validate_draft_index_attestation(
                    attestation,
                    schema,
                    now=datetime(2026, 11, 9, 1, tzinfo=timezone.utc),
                    require_protected=False,
                )

    @unittest.skipUnless(
        os.name == "posix"
        and hasattr(os, "O_PATH")
        and hasattr(os, "O_NOFOLLOW")
        and os.open in os.supports_dir_fd,
        "Secure O_PATH/openat copy is Linux-specific.",
    )
    def test_frontend_copy_rejects_direct_and_nested_symlinks(self):
        for nested in (False, True):
            with self.subTest(nested=nested), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                build_root, source, destination = self.make_frontend_copy_fixture(root)
                outside = root / "outside-secret.txt"
                outside.write_text("outside", encoding="utf-8")
                link_parent = source
                if nested:
                    link_parent = source / "assets"
                    link_parent.mkdir()
                (link_parent / "linked-file").symlink_to(outside)
                with mock.patch.object(admin, "BUILD_ROOT", build_root):
                    with self.assertRaisesRegex(admin.DeploymentError, "symbolic link"):
                        admin.copy_frontend_build(source, destination)
                self.assertFalse((destination / "linked-file").exists())
                self.assertFalse((destination / "assets" / "linked-file").exists())

    @unittest.skipUnless(
        os.name == "posix"
        and hasattr(os, "O_PATH")
        and hasattr(os, "O_NOFOLLOW")
        and os.open in os.supports_dir_fd,
        "Secure O_PATH/openat copy is Linux-specific.",
    )
    def test_frontend_copy_rejects_symlink_escape_and_source_outside_build_root(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            build_root, source, destination = self.make_frontend_copy_fixture(root)
            outside = root / "outside"
            outside.mkdir()
            (source / "escape").symlink_to(outside, target_is_directory=True)
            with mock.patch.object(admin, "BUILD_ROOT", build_root):
                with self.assertRaisesRegex(admin.DeploymentError, "symbolic link"):
                    admin.copy_frontend_build(source, destination)
                with self.assertRaisesRegex(admin.DeploymentError, "outside the protected build workspace"):
                    admin.copy_frontend_build(outside, destination)

    @unittest.skipUnless(
        os.name == "posix"
        and hasattr(os, "O_PATH")
        and hasattr(os, "O_NOFOLLOW")
        and os.open in os.supports_dir_fd,
        "Secure O_PATH/openat copy is Linux-specific.",
    )
    def test_frontend_copy_rejects_special_files_and_copies_only_regular_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            build_root, source, destination = self.make_frontend_copy_fixture(root)
            (source / "index.html").write_text("index", encoding="utf-8")
            os.mkfifo(source / "pipe")
            with mock.patch.object(admin, "BUILD_ROOT", build_root):
                with self.assertRaisesRegex(admin.DeploymentError, "special file"):
                    admin.copy_frontend_build(source, destination)
            os.unlink(source / "pipe")
            (destination / "index.html").unlink()
            with mock.patch.object(admin, "BUILD_ROOT", build_root):
                admin.copy_frontend_build(source, destination)
            copied = destination / "index.html"
            self.assertEqual(copied.read_text(encoding="utf-8"), "index")
            self.assertEqual(copied.stat().st_uid, os.geteuid())
            self.assertEqual(copied.stat().st_mode & 0o777, 0o600)

    @unittest.skipUnless(
        os.name == "posix"
        and hasattr(os, "O_PATH")
        and hasattr(os, "O_NOFOLLOW")
        and os.open in os.supports_dir_fd,
        "Secure O_PATH/openat copy is Linux-specific.",
    )
    def test_frontend_copy_detects_replacement_after_entry_is_pinned(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            build_root, source, destination = self.make_frontend_copy_fixture(root)
            asset = source / "asset.js"
            asset.write_text("approved", encoding="utf-8")
            outside = root / "outside-secret.js"
            outside.write_text("not-approved", encoding="utf-8")
            original_open = admin._open_pinned_at
            replaced = False

            def replace_after_open(parent_fd, name):
                nonlocal replaced
                result = original_open(parent_fd, name)
                if name == "asset.js" and not replaced:
                    replaced = True
                    asset.unlink()
                    asset.symlink_to(outside)
                return result

            with mock.patch.object(admin, "BUILD_ROOT", build_root):
                with mock.patch.object(admin, "_open_pinned_at", side_effect=replace_after_open):
                    with self.assertRaisesRegex(admin.DeploymentError, "replaced while it was copied"):
                        admin.copy_frontend_build(source, destination)
            self.assertTrue(replaced)
            self.assertEqual((destination / "asset.js").read_text(encoding="utf-8"), "approved")


if __name__ == "__main__":
    unittest.main()
