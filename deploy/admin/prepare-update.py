#!/usr/bin/env python3
"""Root-owned bridge from unprivileged release preparation to protected receipts."""

import argparse
import hashlib
import importlib.util
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import pwd
except ImportError:
    pwd = None

DEPLOY_SOURCE_ROOT = Path(__file__).resolve().parents[1]
if str(DEPLOY_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(DEPLOY_SOURCE_ROOT))

ADMIN_HELPER = Path("/usr/local/libexec/souqak/activate-release.py")
PREPARER = Path("/usr/local/libexec/souqak/prepare-release.py")
INSTALLED_PATH = Path("/usr/local/libexec/souqak/prepare-update.py")


class PrepareUpdateError(Exception):
    pass


def load_admin_helper():
    verify_installed_source(ADMIN_HELPER)
    spec = importlib.util.spec_from_file_location("souqak_protected_activation", ADMIN_HELPER)
    if spec is None or spec.loader is None:
        raise PrepareUpdateError("Protected activation helper is unavailable.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_installed_source(path):
    try:
        path = Path(path)
        metadata = path.lstat()
    except OSError as error:
        raise PrepareUpdateError("Managed release source is missing.") from error
    if not path.is_file() or path.is_symlink() or metadata.st_uid != 0 or metadata.st_mode & 0o022:
        raise PrepareUpdateError("Managed release source must be root-owned and non-writable by others.")
    for parent in path.parents:
        try:
            metadata = parent.lstat()
        except OSError as error:
            raise PrepareUpdateError("Managed release source has an unavailable parent path.") from error
        if (
            parent.is_symlink()
            or not parent.is_dir()
            or metadata.st_uid != 0
            or metadata.st_mode & 0o022
        ):
            raise PrepareUpdateError("Managed release source parent paths must be root-owned and protected.")


def verify_protected_directory(path):
    path = Path(path)
    try:
        metadata = path.lstat()
    except OSError as error:
        raise PrepareUpdateError("Protected staging directory is unavailable.") from error
    if (
        path.is_symlink()
        or not stat.S_ISDIR(metadata.st_mode)
        or metadata.st_uid != 0
        or stat.S_IMODE(metadata.st_mode) != 0o700
    ):
        raise PrepareUpdateError("Protected staging directory must be root-owned mode 700.")


def run_isolated_preparation(release, active_release, admin, account, workspace):
    workspace = Path(workspace)
    output_root = workspace / "prepared"
    output_root.mkdir(mode=0o700)
    os.chown(output_root, account.pw_uid, account.pw_gid)
    os.chmod(output_root, 0o700)
    env = {
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "HOME": account.pw_dir,
        "CI": "1",
        "NPM_CONFIG_AUDIT": "false",
    }
    properties = [
        "--quiet",
        "--wait",
        "--pipe",
        "--collect",
        f"--uid={admin.BUILD_USER}",
        "--property=NoNewPrivileges=yes",
        "--property=ProtectSystem=strict",
        "--property=ProtectHome=yes",
        "--property=PrivateTmp=yes",
        "--property=PrivateDevices=yes",
        "--property=ProtectProc=invisible",
        "--property=ProcSubset=pid",
        "--property=RestrictSUIDSGID=yes",
        "--property=CapabilityBoundingSet=",
        "--property=ProtectControlGroups=yes",
        "--property=ProtectKernelTunables=yes",
        "--property=ProtectKernelModules=yes",
        "--property=UMask=0077",
        f"--property=ReadWritePaths={workspace} {account.pw_dir}",
        f"--property=WorkingDirectory={workspace}",
    ]
    command = [
        "systemd-run",
        *properties,
        f"--unit=souqak-prepare-{os.getpid()}",
        "env",
        "-i",
        *[f"{key}={value}" for key, value in env.items()],
        sys.executable,
        str(PREPARER),
        "--prepare",
        release,
        "--after",
        active_release,
        "--output-root",
        str(output_root),
    ]
    try:
        subprocess.run(command, check=True, stdin=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError) as error:
        raise PrepareUpdateError("Isolated, unprivileged release preparation failed.") from error
    return output_root


def publish_validated_bundle(release, admin, builder_uid, builder_root):
    verify_protected_directory(admin.STAGING_ROOT)
    parent = admin.PREPARED_ROOT
    deploy_root = admin.DEPLOY_ROOT
    deploy_metadata = deploy_root.lstat()
    if (
        deploy_root.is_symlink()
        or not stat.S_ISDIR(deploy_metadata.st_mode)
        or deploy_metadata.st_uid != 0
        or deploy_metadata.st_mode & 0o022
        or parent.parent != deploy_root
    ):
        raise PrepareUpdateError("Prepared-release parent must be a protected root-owned directory.")
    if (
        parent.is_symlink()
        or not parent.is_dir()
        or parent.stat().st_uid != pwd.getpwnam("souqak").pw_uid
    ):
        raise PrepareUpdateError("Prepared-release root must be a real souqak-owned directory.")
    if (parent / release).exists() or (parent / release).is_symlink():
        raise PrepareUpdateError("A prepared release with this SHA already exists; preserve and inspect it.")
    with tempfile.TemporaryDirectory(
        prefix=f"publish-{release}.",
        dir=admin.STAGING_ROOT,
    ) as temporary:
        copied_bundle = Path(temporary) / "bundle"
        copied_bundle.mkdir(mode=0o700)
        manifest = admin.snapshot_bundle(
            Path(builder_root) / release,
            copied_bundle,
            release,
            builder_uid,
            prepared_root=builder_root,
            verify_receipts=False,
        )
        evidence = preparation_evidence(release, copied_bundle, manifest)
        staging = Path(tempfile.mkdtemp(prefix=f".{release}.", dir=parent))
        try:
            shutil.copytree(copied_bundle, staging, dirs_exist_ok=True, symlinks=False)
            account = pwd.getpwnam("souqak")
            for path in [*staging.rglob("*"), staging]:
                os.chown(path, account.pw_uid, account.pw_gid, follow_symlinks=False)
                path.chmod(0o700 if path.is_dir() else 0o600)
            import ctypes

            libc = ctypes.CDLL(None, use_errno=True)
            renameat2 = libc.renameat2
            renameat2.argtypes = [
                ctypes.c_int,
                ctypes.c_char_p,
                ctypes.c_int,
                ctypes.c_char_p,
                ctypes.c_uint,
            ]
            if renameat2(
                -100,
                os.fsencode(staging),
                -100,
                os.fsencode(parent / release),
                1,
            ) != 0:
                raise OSError(ctypes.get_errno(), "Exclusive prepared bundle publication failed")
            return evidence
        except (AttributeError, OSError) as error:
            raise PrepareUpdateError("Could not publish the validated bundle atomically.") from error
        finally:
            if staging.exists():
                shutil.rmtree(staging)


def preparation_evidence(release, bundle, manifest):
    manifest_path = Path(bundle) / "manifest.json"
    return {
        "schema": 1,
        "purpose": "completed-protected-preparation",
        "release": release,
        "manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
        "frontend_sha256": manifest["frontend_sha256"],
        "snapshot_sha256": manifest["seo_snapshot"]["sha256"],
    }


def load_preparation_evidence(release, expected, admin):
    root = admin.STATE_ROOT / "preparation-evidence"
    path = root / f"{release}.json"
    if not root.exists() and not root.is_symlink():
        return False
    try:
        admin._receipt_directory(root, require_protected=True)
        return admin._read_receipt(path, require_protected=True) == expected
    except (OSError, admin.DeploymentError):
        return False


def write_preparation_evidence(release, expected, admin):
    root = admin.STATE_ROOT / "preparation-evidence"
    admin._receipt_directory(root, create=True, require_protected=True)
    admin._write_receipt(
        root / f"{release}.json",
        expected,
        require_protected=True,
    )


def issue_receipts(release, admin, *, create):
    if not re.fullmatch(r"[a-f0-9]{40}", release):
        raise PrepareUpdateError("A full lowercase release SHA is required.")
    try:
        submitter_uid = pwd.getpwnam("souqak").pw_uid
        verify_protected_directory(admin.STAGING_ROOT)
        with tempfile.TemporaryDirectory(
            prefix=f"prepare-{release}.",
            dir=admin.STAGING_ROOT,
        ) as temporary:
            copied_bundle = Path(temporary) / "bundle"
            copied_bundle.mkdir(mode=0o700)
            bundle = admin.PREPARED_ROOT / release
            manifest = admin.snapshot_bundle(
                bundle,
                copied_bundle,
                release,
                submitter_uid,
                prepared_root=admin.PREPARED_ROOT,
                verify_receipts=False,
            )
            expected_evidence = preparation_evidence(release, copied_bundle, manifest)
            if create and not load_preparation_evidence(release, expected_evidence, admin):
                raise PrepareUpdateError(
                    "Protected preparation evidence is missing or does not match the candidate."
                )
            admin.seo_receipt(
                release,
                manifest["seo_snapshot"],
                create=create,
            )
            if manifest["schema"] == 2:
                admin.release_receipt(
                    release,
                    copied_bundle,
                    manifest,
                    create=create,
                )
    except (OSError, ValueError, TypeError, KeyError, admin.DeploymentError) as error:
        raise PrepareUpdateError("Prepared release failed validation or protected receipt checks.") from error


def current_active_release(admin):
    backend = admin.parse_container(admin.SystemOps(), admin.BACKEND)
    labels = backend.get("Config", {}).get("Labels", {})
    release = labels.get("com.souqak.release")
    if isinstance(release, str) and re.fullmatch(r"[a-f0-9]{40}|legacy-[a-zA-Z0-9-]+", release):
        return release
    frontend = Path(os.path.realpath(admin.FRONTEND_LINK))
    try:
        frontend = admin.verify_frontend_path(
            frontend,
            admin.MANAGED_RELEASES,
            allow_legacy_renderer=True,
        )
        marker = (frontend / "souqak-release.txt").read_text(encoding="utf-8").strip()
    except (OSError, admin.DeploymentError) as error:
        raise PrepareUpdateError("Active application release identity is unavailable.") from error
    if not re.fullmatch(r"[a-f0-9]{40}|legacy-[a-zA-Z0-9-]+", marker):
        raise PrepareUpdateError("Active application release identity is invalid.")
    return marker


def prepare_or_resume(release, admin):
    if not re.fullmatch(r"[a-f0-9]{40}", release):
        raise PrepareUpdateError("A full lowercase release SHA is required.")
    bundle = admin.PREPARED_ROOT / release
    if bundle.exists() or bundle.is_symlink():
        expected = None
        try:
            with tempfile.TemporaryDirectory(
                prefix=f"verify-{release}.",
                dir=admin.STAGING_ROOT,
            ) as temporary:
                copied = Path(temporary) / "bundle"
                copied.mkdir(mode=0o700)
                manifest = admin.snapshot_bundle(
                    bundle,
                    copied,
                    release,
                    pwd.getpwnam("souqak").pw_uid,
                    prepared_root=admin.PREPARED_ROOT,
                    verify_receipts=False,
                )
                expected = preparation_evidence(release, copied, manifest)
        except (OSError, ValueError, TypeError, KeyError, admin.DeploymentError) as error:
            raise PrepareUpdateError("Existing prepared release failed protected validation.") from error
        if load_preparation_evidence(release, expected, admin):
            issue_receipts(release, admin, create=True)
        else:
            issue_receipts(release, admin, create=False)
        return
    if not bundle.is_symlink():
        active_release = current_active_release(admin)
        verify_installed_source(PREPARER)
        account = admin.preflight_builder()
        build_root = admin.BUILD_ROOT
        if (
            build_root.is_symlink()
            or not build_root.is_dir()
            or build_root.stat().st_uid != 0
            or build_root.stat().st_mode & 0o022
            or build_root.stat().st_mode & 0o005 != 0o005
        ):
            raise PrepareUpdateError("Isolated build workspace root is not protected.")
        workspace = Path(tempfile.mkdtemp(prefix=f"prepare-{release}.", dir=build_root))
        try:
            workspace.chmod(0o700)
            os.chown(workspace, account.pw_uid, account.pw_gid)
            builder_root = run_isolated_preparation(
                release,
                active_release,
                admin,
                account,
                workspace,
            )
            evidence = publish_validated_bundle(release, admin, account.pw_uid, builder_root)
            write_preparation_evidence(release, evidence, admin)
        finally:
            shutil.rmtree(workspace)
    issue_receipts(release, admin, create=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Prepare and receipt a protected Souqak release.")
    parser.add_argument("--prepare", required=True, metavar="SHA")
    args = parser.parse_args(argv)
    if getattr(os, "geteuid", lambda: -1)() != 0 or pwd is None or fcntl is None:
        raise PrepareUpdateError("Protected preparation must run as root on Ubuntu.")
    if Path(__file__).resolve() != INSTALLED_PATH:
        raise PrepareUpdateError("Install and invoke the reviewed protected preparation helper.")
    verify_installed_source(INSTALLED_PATH)
    admin = load_admin_helper()
    state_root = admin.STATE_ROOT
    verify_protected_directory(state_root)
    lock_path = state_root / "preparation.lock"
    lock_fd = os.open(
        lock_path,
        os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    try:
        lock_info = os.fstat(lock_fd)
        if (
            not stat.S_ISREG(lock_info.st_mode)
            or lock_info.st_uid != 0
            or stat.S_IMODE(lock_info.st_mode) != 0o600
        ):
            raise PrepareUpdateError("Preparation lock is not root-owned and protected.")
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        prepare_or_resume(args.prepare, admin)
    finally:
        os.close(lock_fd)
    print("Prepared release passed validation and protected receipt checks.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (PrepareUpdateError, OSError, subprocess.CalledProcessError) as error:
        message = str(error) if isinstance(error, PrepareUpdateError) else "Required protected operation failed."
        print(f"Protected preparation failed: {message}", file=sys.stderr)
        raise SystemExit(1)
