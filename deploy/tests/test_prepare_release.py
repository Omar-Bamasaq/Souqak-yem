import importlib.util
import sys
import json
import os
from datetime import datetime, timezone, timedelta
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / "prepare-release.py"
sys.path.insert(0, str(MODULE_PATH.parent))
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
    def _runner(self, fail_on=None, precreate_output_parent=False):
        calls = []

        def runner(command, *, cwd, env=None):
            calls.append((command, cwd, env))
            if fail_on and command[:2] == fail_on:
                raise subprocess.CalledProcessError(1, command)
            if command[:2] == ["git", "clone"]:
                source = Path(command[-1])
                (source / "backend").mkdir(parents=True)
                (source / "frontend").mkdir()
            if len(command) > 2 and command[1] == "scripts/exportPrerenderSnapshot.mjs" and command[2] == "--output":
                stamp = datetime.now(timezone.utc)
                Path(command[3]).write_text(json.dumps({'metadata': {'sourceCommit': RELEASE, 'schemaVersion': 1, 'siteBaseUrl': 'https://souqak-yem.com', 'exportedAt': stamp.isoformat(), 'expiresAt': (stamp + timedelta(days=1)).isoformat(), 'maxAgeMs': 86400000}}))
            if command[:3] == ["npm", "run", "build"]:
                if precreate_output_parent:
                    (Path(cwd).parents[1] / "frontend").mkdir()
                dist = Path(cwd) / "dist"
                dist.mkdir()
                for name in ("index.html", "sitemap.xml", "robots.txt", "prerender-manifest.json"):
                    (dist / name).write_text("fixture", encoding="utf-8")
            return None

        return runner, calls

    def test_existing_frontend_output_parent_still_prepares_real_bundle_without_docker(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "prepared"
            runner, calls = self._runner(precreate_output_parent=True)
            with (
                mock.patch.object(prepare_module.os, "geteuid", create=True, return_value=1000),
                mock.patch.object(prepare_module, "fcntl", FakeFcntl),
                mock.patch.object(prepare_module.subprocess, "check_output", return_value=RELEASE + "\n"),
            ):
                prepare_module.prepare(RELEASE, output, runner=runner)
            bundle = output / RELEASE
            self.assertTrue((bundle / "manifest.json").is_file())
            self.assertEqual((bundle / "frontend" / "dist" / "index.html").read_text(), "fixture")
            self.assertEqual((bundle / "frontend" / "dist" / "souqak-release.txt").read_text(), RELEASE + "\n")
            self.assertEqual(prepare_module.tree_digest(bundle / "frontend" / "dist"), json.loads((bundle / "manifest.json").read_text())["frontend_sha256"])
            manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["release"], RELEASE)
            self.assertTrue(manifest["checks"]["frontend_build"])
            self.assertFalse(any(command[0][0] == "docker" for command in calls))
            test_call = next(call for call in calls if call[0][:2] == ["node", "--test"])
            self.assertNotIn("MONGODB_URI", test_call[2])
            builds = [env for cmd, cwd, env in calls if cmd[:3] == ["npm", "run", "build"]]
            self.assertEqual(builds[0]['SEO_PRERENDER_DATA_SOURCE'], 'local')
            self.assertEqual(manifest['seo_snapshot']['sha256'], prepare_module.snapshot_info(bundle / 'seo-snapshot.json', RELEASE)['sha256'])
            self.assertTrue(all('--offline' in cmd for cmd, cwd, env in calls if cmd[:2] == ['npm', 'ci']))

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
