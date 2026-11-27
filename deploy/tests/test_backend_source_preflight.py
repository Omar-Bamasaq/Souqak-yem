import unittest
from pathlib import Path


class BackendSourcePreflightTests(unittest.TestCase):

    def test_source_access_check_precedes_activation(self):
        source = (
            Path(__file__).resolve().parents[1]
            / "admin"
            / "activate-release.py"
        ).read_text(encoding="utf-8")

        start = source.index("def deploy_release(")
        end = source.index("\ndef rollback_release(", start)
        deploy_code = source[start:end]

        build = deploy_code.index(
            "image = build_backend_image(ops, source, release, frontend_dist, manifest)"
        )
        preflight = deploy_code.index(
            "fs.readFileSync('/app/src/config/cors.js')"
        )
        volume_check = deploy_code.index("check_volume_access(ops, image)")
        activation = deploy_code.index("transaction = activate_transaction(")

        self.assertLess(build, preflight)
        self.assertLess(preflight, volume_check)
        self.assertLess(volume_check, activation)

        preflight_code = deploy_code[build:volume_check]
        for required in (
            '"--network", "none"',
            '"--read-only"',
            '"--user", "node"',
            '"--entrypoint", "node"',
        ):
            self.assertIn(required, preflight_code)


if __name__ == "__main__":
    unittest.main()
