import contextlib
import io
import importlib.util
import os
import stat
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


DEPLOY_ROOT = Path(__file__).resolve().parents[1]
RELEASE = "a" * 40


def load_module(name, relative_path):
    module_path = DEPLOY_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare_update = load_module("souqak_prepare_update", Path("admin") / "prepare-update.py")
check_update = load_module("souqak_check_update", Path("check-update.py"))


class UpdateEntrypointTests(unittest.TestCase):
    def test_receipt_creation_requires_matching_protected_preparation_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            prepared_root = root / "prepared"
            (prepared_root / RELEASE).mkdir(parents=True)
            staging_root = root / "staging"
            staging_root.mkdir()
            admin = mock.Mock(
                PREPARED_ROOT=prepared_root,
                STAGING_ROOT=staging_root,
                DeploymentError=type("DeploymentError", (Exception,), {}),
            )
            admin.snapshot_bundle.return_value = {
                "schema": 1,
                "seo_snapshot": {"sha256": "1" * 64},
            }
            with (
                mock.patch.object(prepare_update, "pwd", SimpleNamespace(
                    getpwnam=lambda _name: SimpleNamespace(pw_uid=1000),
                )),
                mock.patch.object(prepare_update, "verify_protected_directory"),
                mock.patch.object(
                    prepare_update,
                    "preparation_evidence",
                    return_value={"release": RELEASE},
                ),
                mock.patch.object(
                    prepare_update,
                    "load_preparation_evidence",
                    return_value=False,
                ),
                self.assertRaisesRegex(
                    prepare_update.PrepareUpdateError,
                    "Protected preparation evidence is missing",
                ),
            ):
                prepare_update.issue_receipts(RELEASE, admin, create=True)
            admin.seo_receipt.assert_not_called()

    def test_existing_prepared_candidate_resumes_receipts_without_rebuilding(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            prepared_root = root / "prepared"
            (prepared_root / RELEASE).mkdir(parents=True)
            staging_root = root / "staging"
            staging_root.mkdir()
            admin = mock.Mock(
                PREPARED_ROOT=prepared_root,
                STAGING_ROOT=staging_root,
                SNAPSHOT_PATH="seo-snapshot.json",
            )
            with (
                mock.patch.object(prepare_update, "issue_receipts") as issue,
                mock.patch.object(prepare_update, "preparation_evidence", return_value={"release": RELEASE}),
                mock.patch.object(prepare_update, "load_preparation_evidence", return_value=False),
                mock.patch.object(
                    prepare_update,
                    "pwd",
                    SimpleNamespace(getpwnam=lambda _name: SimpleNamespace(pw_uid=1000)),
                ),
                mock.patch.object(prepare_update.subprocess, "run") as run,
            ):
                admin.snapshot_bundle.return_value = {"schema": 1}
                prepare_update.prepare_or_resume(RELEASE, admin)
            run.assert_not_called()
            issue.assert_called_once_with(RELEASE, admin, create=False)

    @unittest.skipUnless(os.name == "posix", "Protected builder ownership checks require POSIX.")
    def test_missing_candidate_uses_exact_sha_under_unprivileged_account(self):
        with tempfile.TemporaryDirectory() as temporary:
            prepared_root = Path(temporary) / "prepared"
            prepared_root.mkdir()
            build_root = Path(temporary) / "build"
            build_root.mkdir()
            build_root.chmod(0o755)  # Match protected build-root access requirements.
            original_stat = Path.stat

            def protected_build_root_stat(path, *args, **kwargs):
                result = original_stat(path, *args, **kwargs)
                if path == build_root:
                    values = list(result)
                    values[4] = 0  # Simulate root ownership in this test only.
                    return os.stat_result(values)
                return result

            admin = mock.Mock(
                PREPARED_ROOT=prepared_root,
                BUILD_ROOT=build_root,
                BUILD_USER="souqak-build",
                SystemOps=mock.Mock(return_value="ops"),
                BACKEND="backend",
            )
            admin.parse_container.return_value = {
                "Config": {"Labels": {"com.souqak.release": "b" * 40}}
            }
            account = SimpleNamespace(pw_uid=1000, pw_gid=1000, pw_dir="/var/lib/souqak-build")
            admin.preflight_builder.return_value = account
            with (
                mock.patch.object(prepare_update, "verify_installed_source"),
                mock.patch.object(prepare_update, "issue_receipts") as issue,
                mock.patch.object(prepare_update, "run_isolated_preparation", return_value=build_root / "prepared") as run,
                mock.patch.object(prepare_update, "publish_validated_bundle", return_value={"release": RELEASE}) as publish,
                mock.patch.object(prepare_update, "write_preparation_evidence") as write_evidence,
                mock.patch.object(prepare_update.os, "chown", create=True),
                mock.patch.object(Path, "stat", protected_build_root_stat),
            ):
                prepare_update.prepare_or_resume(RELEASE, admin)
            self.assertEqual(run.call_args.args[:3], (RELEASE, "b" * 40, admin))
            publish.assert_called_once_with(RELEASE, admin, 1000, build_root / "prepared")
            write_evidence.assert_called_once_with(RELEASE, {"release": RELEASE}, admin)
            issue.assert_called_once_with(RELEASE, admin, create=True)

    def test_invalid_release_is_rejected_before_receipt_work(self):
        admin = mock.Mock()
        with mock.patch.object(prepare_update, "issue_receipts") as issue:
            with self.assertRaisesRegex(prepare_update.PrepareUpdateError, "full lowercase"):
                prepare_update.prepare_or_resume("main", admin)
        issue.assert_not_called()

    def test_dry_run_entrypoint_delegates_only_to_activation_dry_run(self):
        with (
            mock.patch.object(check_update.os, "geteuid", create=True, return_value=0),
            mock.patch.object(check_update, "verify_installed_helper"),
            mock.patch.object(check_update.subprocess, "run", return_value=mock.Mock(returncode=0)) as run,
        ):
            result = check_update.main(["--release", RELEASE])
        self.assertEqual(result, 0)
        command = run.call_args.args[0]
        self.assertIn("--dry-run", command)
        self.assertIn("--release", command)
        self.assertIn(RELEASE, command)
        self.assertNotIn("--prepare", command)
        self.assertTrue(run.call_args.kwargs["check"] is False)

    def test_dry_run_entrypoint_rejects_non_sha_without_invoking_helper(self):
        with (
            mock.patch.object(check_update.os, "geteuid", create=True, return_value=0),
            mock.patch.object(check_update, "verify_installed_helper"),
            mock.patch.object(check_update.subprocess, "run") as run,
            self.assertRaises(SystemExit),
        ):
            check_update.main(["--release", "main"])
        run.assert_not_called()

    def test_check_update_compares_explicit_active_sha_to_main_without_preparing(self):
        with tempfile.TemporaryDirectory() as temporary:
            state = Path(temporary) / "last-activation.json"
            state.write_text(
                '{"status":"active","release":"' + RELEASE + '"}',
                encoding="utf-8",
            )
            latest = "b" * 40
            commands = []

            def fake_run(command, **kwargs):
                commands.append(command)
                if command[-3:] == ["rev-parse", "--verify", "FETCH_HEAD"]:
                    return mock.Mock(stdout=latest + "\n")
                return mock.Mock(stdout="")

            def fake_lstat(*_args):
                return SimpleNamespace(
                    st_uid=0,
                    st_mode=stat.S_IFREG | 0o600,
                    st_size=state.stat().st_size,
                )

            output = io.StringIO()
            with (
                mock.patch.object(check_update, "ACTIVE_STATE", state),
                mock.patch.object(type(state), "lstat", side_effect=fake_lstat),
                mock.patch.object(check_update.subprocess, "run", side_effect=fake_run),
                contextlib.redirect_stdout(output),
            ):
                result = check_update.check_active_against_main()
            self.assertEqual(result, 0)
            self.assertIn("UPDATE_CANDIDATE: " + latest, output.getvalue())
            self.assertTrue(any("merge-base" in command for command in commands))
            self.assertFalse(any("--prepare" in command for command in commands))


if __name__ == "__main__":
    unittest.main()
