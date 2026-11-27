import unittest
from pathlib import Path


class DockerfileRuntimePermissionsTests(unittest.TestCase):

    def test_source_permissions_before_node_runtime(self):
        dockerfile = (
            Path(__file__).resolve().parents[2] / "Dockerfile"
        ).read_text(encoding="utf-8")

        copy_source = "COPY backend/src ./src"
        fix_permissions = "RUN chmod -R u=rwX,go=rX /app/src"
        nonroot_user = "USER node"

        self.assertEqual(dockerfile.count(fix_permissions), 1)
        self.assertLess(
            dockerfile.index(copy_source),
            dockerfile.index(fix_permissions),
        )
        self.assertLess(
            dockerfile.index(fix_permissions),
            dockerfile.index(nonroot_user),
        )


if __name__ == "__main__":
    unittest.main()
