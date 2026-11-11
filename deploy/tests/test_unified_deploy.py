import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

FILE = Path(__file__).resolve().parents[1] / 'admin' / 'souqak-deploy'
loader = importlib.machinery.SourceFileLoader('unified', str(FILE))
spec = importlib.util.spec_from_loader(loader.name, loader)
app = importlib.util.module_from_spec(spec)
loader.exec_module(app)
RELEASE = 'a' * 40

class UnifiedTests(unittest.TestCase):
    def test_unknown_arguments_are_rejected_before_operations(self):
        for args in ([], ['all', '--yes'], ['rollback'], ['all;id'], ['--help']):
            with self.assertRaises(app.Blocked), mock.patch.object(app, 'lock') as lock:
                app.main(args)
            lock.assert_not_called()

    def test_fixed_sha_and_unprivileged_preparation(self):
        calls = []
        def run(args, **kwargs):
            calls.append((args, kwargs))
        app.all_release(runner=run, verify=lambda: None, resolve=lambda _: RELEASE)
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[0][1], {'user': 'souqak'})
        self.assertIn('--dry-run', calls[1][0])
        self.assertNotIn('--dry-run', calls[2][0])
        for command, _ in calls:
            self.assertIn(RELEASE, command)
            self.assertIn(str(app.PREPARED / RELEASE), command)
            self.assertNotIn('--yes', command)
        self.assertNotIn('input', calls[2][1])

    def test_changed_main_never_activates(self):
        commands = []
        refs = iter([RELEASE, 'b' * 40])
        with self.assertRaisesRegex(app.Blocked, 'changed'):
            app.all_release(runner=lambda c, **k: commands.append(c), verify=lambda: None, resolve=lambda _: next(refs))
        self.assertEqual(len(commands), 1)

    def test_failed_prepare_or_preflight_never_activates(self):
        for fail_step in (1, 2):
            calls = []
            def run(command, **kwargs):
                calls.append(command)
                if len(calls) == fail_step:
                    raise subprocess.CalledProcessError(1, command)
            with self.assertRaises(subprocess.CalledProcessError):
                app.all_release(runner=run, verify=lambda: None, resolve=lambda _: RELEASE)
            self.assertEqual(len(calls), fail_step)

    def test_activation_failure_is_propagated_without_retry_or_cleanup(self):
        calls = []
        def run(command, **kwargs):
            calls.append(command)
            if len(calls) == 3:
                raise subprocess.CalledProcessError(1, command)
        with self.assertRaises(subprocess.CalledProcessError):
            app.all_release(runner=run, verify=lambda: None, resolve=lambda _: RELEASE)
        self.assertEqual(len(calls), 3)  # installed helper owns rollback
        self.assertFalse(any('docker' in c for c in calls))

    def test_changed_tool_blocks_after_prepare(self):
        verify = mock.Mock(side_effect=[None, app.Blocked('changed tool')])
        runner = mock.Mock()
        with self.assertRaises(app.Blocked):
            app.all_release(runner=runner, verify=verify, resolve=lambda _: RELEASE)
        self.assertEqual(runner.call_count, 1)

    def test_invalid_remote_reference_rejected(self):
        for text in ('main\n', 'a'*40+' refs/heads/other\n', RELEASE+' refs/heads/main\n'+RELEASE+' refs/heads/main\n'):
            with self.assertRaises(app.Blocked):
                app.target_sha(lambda *a, **k: text)

    def test_real_flock_rejects_concurrent_operation_and_releases(self):
        with tempfile.TemporaryDirectory() as root:
            real_fstat = os.fstat
            def info(fd):
                st = real_fstat(fd)
                return SimpleNamespace(st_uid=0, st_mode=st.st_mode)
            with mock.patch.object(app, 'STATE', Path(root)), mock.patch.object(app, 'protected'), mock.patch.object(app.os, 'fstat', side_effect=info):
                with app.lock():
                    with self.assertRaisesRegex(app.Blocked, 'running'):
                        with app.lock():
                            self.fail('concurrent lock acquired')
                with app.lock():
                    pass

    def test_compatibility_requires_review_hashes_and_cli(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            contract = root / 'contract.json'
            paths = {name: root / (name+'.py') for name in ('prepare', 'activate')}
            for p in paths.values():
                p.write_text("p.add_argument('--release')\np.add_argument('--bundle')\np.add_argument('--dry-run')\np.add_argument('--rollback')\n")
            review = {k: True for k in ('existing_update_reviewed','immutable_sha','unprivileged_build','interactive_sha_confirmation','validated_local_snapshot','offline_dependencies','no_database_operations','preserve_volumes','automatic_application_rollback','distinct_internal_locks')}
            data = {'schema':1,'approved':True,'entrypoint_strategy':'reviewed-direct-helpers','review':review,'sha256':{n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in paths.items()}}
            contract.write_text(json.dumps(data)); contract.chmod(0o600)
            with mock.patch.object(app,'STATE',root), mock.patch.object(app,'CONTRACT',contract), mock.patch.object(app,'TOOLS',paths), mock.patch.object(app,'protected'):
                self.assertEqual(app.compatibility()['schema'],1)
                paths['prepare'].write_text('changed')
                with self.assertRaisesRegex(app.Blocked,'changed'):
                    app.compatibility()
                data['approved']=False;contract.write_text(json.dumps(data))
                with self.assertRaisesRegex(app.Blocked,'approval'):
                    app.compatibility()

    def test_missing_contract_and_writable_tools_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)/'tool';p.write_text('fixture');p.chmod(0o666)
            with self.assertRaises(app.Blocked):
                app.protected(p)
            with mock.patch.object(app,'STATE',Path(root)), mock.patch.object(app,'CONTRACT',Path(root)/'absent'), mock.patch.object(app,'protected'):
                with self.assertRaises(FileNotFoundError):
                    app.compatibility()

    def test_unsettled_or_missing_activation_blocks_new_operation(self):
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.object(app, 'STATE', Path(directory)), mock.patch.object(app, 'protected'):
                with self.assertRaisesRegex(app.Blocked, 'baseline'):
                    app.settled_state()
                record = Path(directory) / 'last-activation.json'
                for state in ('activating', 'manual-recovery-required', 'unknown'):
                    record.write_text(json.dumps({'schema':1, 'status':state}))
                    with self.assertRaisesRegex(app.Blocked, 'recovery'):
                        app.settled_state()
                record.write_text(json.dumps({'schema':1, 'status':'active'}))
                app.settled_state()
