import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / "prepare-release.py"
SPEC = importlib.util.spec_from_file_location("souqak_prepare_release", MODULE_PATH)
prepare_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prepare_module)
RELEASE = "a" * 40


class FakeFcntl:
    LOCK_EX = 1
    LOCK_NB = 2

    @staticmethod
    def flock(_file, _flags):
        return None


class PrepareReleaseTests(unittest.TestCase):
    def _runner(self, fail_on=None, shared_content="export const releaseFixture = true;\n"):
        calls = []

        def runner(command, *, cwd, env=None):
            calls.append((command, cwd, env))
            if fail_on and command[:2] == fail_on:
                raise subprocess.CalledProcessError(1, command)
            if command[:2] == ["git", "clone"]:
                source = Path(command[-1])
                (source / "backend").mkdir(parents=True)
                frontend = source / "frontend"
                frontend.mkdir()
                (frontend / ".env.production").write_text(
                    "VITE_PUBLIC_FIXTURE=https://example.invalid\n",
                    encoding="utf-8",
                )
                shared = source / "shared"
                shared.mkdir()
                if shared_content is not None:
                    (shared / "seoRules.mjs").write_text(shared_content, encoding="utf-8")
            if command[:2] == ["node", "--check"] and "syntax-error" in Path(command[-1]).read_text(encoding="utf-8"):
                raise subprocess.CalledProcessError(1, command)
            if command[:2] == ["node", "scripts/exportPrerenderSnapshot.mjs"]:
                snapshot_path = Path(command[command.index("--output") + 1])
                exported_at = datetime.now(timezone.utc)
                snapshot_path.write_text(json.dumps({"metadata": {
                    "schemaVersion": 2,
                    "siteBaseUrl": "https://souqak-yem.com",
                    "sourceCommit": env["SEO_EXPORT_SOURCE_COMMIT"],
                    "source": "public-api",
                    "sourceDatabase": "not-accessed-public-api",
                    "maxAgeMs": 86_400_000,
                    "exportedAt": exported_at.isoformat(),
                    "expiresAt": (exported_at + timedelta(days=1)).isoformat(),
                }, "data": {}}), encoding="utf-8")
            if command[:3] == ["npm", "run", "build"]:
                self.assertTrue((Path(cwd).parent / "shared" / "seoRules.mjs").is_file())
                self.assertFalse((Path(cwd) / ".env.production").exists())
                dist = Path(cwd) / "dist"
                dist.mkdir()
                (dist / "assets").mkdir()
                (dist / "assets" / "app-a1.js").write_text("app", encoding="utf-8")
                (dist / "assets" / "app-b2.css").write_text("body{}", encoding="utf-8")
                (dist / "index.html").write_text(
                    '<html><head><link rel="stylesheet" href="/assets/app-b2.css"></head>'
                    '<body><script type="module" src="/assets/app-a1.js"></script></body></html>',
                    encoding="utf-8",
                )
                (dist / "sitemap.xml").write_text("<urlset></urlset>", encoding="utf-8")
                (dist / "robots.txt").write_text("User-agent: *", encoding="utf-8")
                (dist / "prerender-manifest.json").write_text(json.dumps({
                    "version": 1,
                    "source": "local",
                    "siteBaseUrl": "https://souqak-yem.com",
                }), encoding="utf-8")
                (dist / "dynamic-ad-renderer-template.html").write_text(
                    '<html><head><meta name="robots" content="noindex,nofollow"/>'
                    '<link rel="stylesheet" href="/assets/app-b2.css"></head>'
                    '<body><div id="root"></div><script type="module" src="/assets/app-a1.js"></script></body></html>',
                    encoding="utf-8",
                )
            return None

        return runner, calls

    def test_success_prepares_an_immutable_sha_bundle_without_docker(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "prepared"
            runner, calls = self._runner()
            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                prepare_module.prepare(RELEASE, output, runner=runner)
            bundle = output / RELEASE
            self.assertTrue((bundle / "manifest.json").is_file())
            self.assertTrue((bundle / "frontend" / "dist" / "index.html").is_file())
            self.assertTrue((bundle / "shared" / "seoRules.mjs").is_file())
            manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["schema"], 2)
            self.assertEqual(manifest["release"], RELEASE)
            self.assertTrue(manifest["checks"]["backend_tests_passed"])
            self.assertTrue(manifest["checks"]["frontend_build"])
            self.assertTrue(manifest["shared_sha256"])
            self.assertFalse((bundle / "shared" / "seo-policy.md").exists())
            self.assertFalse(any(path.name.startswith(".env") for path in bundle.rglob("*")))
            self.assertFalse(any(command[0][0] == "docker" for command in calls))
            self.assertTrue(any(command[0][:2] == ["node", "--check"] for command in calls))
            test_call = next(call for call in calls if call[0][:2] == ["node", "--test"])
            self.assertNotIn("MONGODB_URI", test_call[2])

    def test_missing_shared_runtime_fails_before_preparing_a_bundle(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "prepared"
            runner, _ = self._runner(shared_content=None)
            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                with self.assertRaisesRegex(prepare_module.PrepareError, "shared/seoRules.mjs"):
                    prepare_module.prepare(RELEASE, output, runner=runner)
            self.assertFalse((output / RELEASE).exists())

    def test_invalid_shared_runtime_fails_node_validation(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "prepared"
            runner, _ = self._runner(shared_content="syntax-error")
            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                with self.assertRaisesRegex(prepare_module.PrepareError, "syntax validation"):
                    prepare_module.prepare(RELEASE, output, runner=runner)
            self.assertFalse((output / RELEASE).exists())

    def test_failed_backend_test_never_publishes_a_ready_bundle(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "prepared"
            runner, _ = self._runner(fail_on=["node", "--test"])
            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    prepare_module.prepare(RELEASE, output, runner=runner)
            self.assertFalse((output / RELEASE).exists())

    def test_rejects_moving_branch_and_short_identifiers(self):
        with self.assertRaisesRegex(prepare_module.PrepareError, "full 40-character"):
            prepare_module.prepare("main", output_root=Path(tempfile.gettempdir()) / "never-created")

    def test_rejects_active_or_older_candidate_sha(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "prepared"
            runner, _ = self._runner()
            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                with self.assertRaisesRegex(prepare_module.PrepareError, "already the active release"):
                    prepare_module.prepare(RELEASE, output, runner=runner, active_release=RELEASE)
                self.assertFalse((output / RELEASE).exists())

            active = "b" * 40

            def reject_older(command, *, cwd, env=None):
                if command[:2] == ["git", "merge-base"] and command[2:] == [
                    "--is-ancestor", active, RELEASE
                ]:
                    raise subprocess.CalledProcessError(1, command)
                return runner(command, cwd=cwd, env=env)

            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    prepare_module.prepare(
                        RELEASE,
                        output,
                        runner=reject_older,
                        active_release=active,
                    )
            self.assertFalse((output / RELEASE).exists())

    def test_digest_rejects_symbolic_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "target"
            target.write_text("data", encoding="utf-8")
            link = root / "link"
            try:
                link.symlink_to(target)
            except OSError:
                self.skipTest("Symlink creation is not available in this local Windows environment.")
            with self.assertRaisesRegex(prepare_module.PrepareError, "symbolic link"):
                prepare_module.tree_digest(root)


if __name__ == "__main__":
    unittest.main()
