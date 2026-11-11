import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
import subprocess

DEPLOY = Path(__file__).resolve().parents[1]
loader=importlib.machinery.SourceFileLoader('update_candidate',str(DEPLOY/'admin/souqak-update-candidate'))
spec=importlib.util.spec_from_loader(loader.name,loader)
app=importlib.util.module_from_spec(spec);loader.exec_module(app)
RELEASE='a'*40

def bundle(root,release=RELEASE):
    target=root/release;target.mkdir()
    (target/'manifest.json').write_text(json.dumps({'schema':1,'release':release,'repository':app.REPO,'branch':'main','checks':{'frontend_build':True,'frontend_tests':True},'frontend_sha256':'b'*64}))
    return target

class CandidateTests(unittest.TestCase):
    def test_preparer_constant_and_unknown_args(self):
        self.assertEqual(str(app.PREPARER),'/usr/local/libexec/souqak/prepare-update.py')
        for args in (['all'],['--yes'],['--dry-run','extra']):
            with self.assertRaises(app.Blocked),mock.patch.object(app,'lock') as lock:
                app.main(args)
            lock.assert_not_called()

    def test_fresh_pinned_bundle_and_interactive_engine_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);calls=[]
            def run(args,**kwargs):
                calls.append((args,kwargs))
                if str(app.PREPARER) in args:bundle(root)
            with mock.patch.object(app,'PREPARED',root):
                app.update(runner=run,verify=lambda:None,resolve=lambda _:RELEASE,baseline=lambda:'state')
            self.assertEqual(len(calls),3)
            self.assertEqual(calls[0],(['/usr/bin/python3',str(app.PREPARER)],{'user':'souqak'}))
            self.assertIn('--dry-run',calls[1][0]);self.assertNotIn('--dry-run',calls[2][0])
            self.assertEqual(calls[2][1],{})  # no input/capture that bypasses prompt
            for args,_ in calls[1:]:
                self.assertIn(RELEASE,args);self.assertIn(str(root/RELEASE),args)

    def test_old_bundles_prevent_preparation(self):
        for names in ((RELEASE,),('b'*40,),('b'*40,'c'*40)):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory)
                for name in names:bundle(root,name)
                runner=mock.Mock()
                with mock.patch.object(app,'PREPARED',root),self.assertRaisesRegex(app.Blocked,'Old or multiple'):
                    app.update(runner=runner,verify=lambda:None,resolve=lambda _:RELEASE,baseline=lambda:'state')
                runner.assert_not_called()

    def test_missing_multiple_mismatched_and_symlink_output_rejected(self):
        for mode in ('missing','multiple','wrong','bad-manifest','symlink'):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);calls=[]
                def runner(args,**kwargs):
                    calls.append(args)
                    if mode=='missing':return
                    if mode=='wrong':bundle(root,'b'*40);return
                    if mode=='symlink':(root/RELEASE).symlink_to(root,target_is_directory=True);return
                    path=bundle(root)
                    if mode=='multiple':bundle(root,'c'*40)
                    if mode=='bad-manifest':(path/'manifest.json').write_text('{}')
                with mock.patch.object(app,'PREPARED',root),self.assertRaises(app.Blocked):
                    app.update(runner=runner,verify=lambda:None,resolve=lambda _:RELEASE,baseline=lambda:'state')
                self.assertEqual(len(calls),1)

    def test_changed_sha_or_state_prevents_activation(self):
        for mode in ('sha','state'):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);runner=mock.Mock(side_effect=lambda *a,**k:bundle(root))
                refs=iter([RELEASE,'b'*40 if mode=='sha' else RELEASE]);states=iter(['old','changed'])
                with mock.patch.object(app,'PREPARED',root),self.assertRaises(app.Blocked):
                    app.update(runner=runner,verify=lambda:None,resolve=lambda _:next(refs),baseline=lambda:next(states))
                self.assertEqual(runner.call_count,1)

    def test_failures_propagate_without_retry_or_cleanup(self):
        for step in (1,2,3):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);calls=[]
                def runner(args,**kwargs):
                    calls.append(args)
                    if len(calls)==step:raise subprocess.CalledProcessError(1,args)
                    if len(calls)==1:bundle(root)
                with mock.patch.object(app,'PREPARED',root),self.assertRaises(subprocess.CalledProcessError):
                    app.update(runner=runner,verify=lambda:None,resolve=lambda _:RELEASE,baseline=lambda:'state')
                self.assertEqual(len(calls),step)
                if step>1:self.assertTrue((root/RELEASE).exists())

    def test_plan_never_executes_preparer_or_engine(self):
        with tempfile.TemporaryDirectory() as directory,mock.patch.object(app,'PREPARED',Path(directory)):
            runner=mock.Mock()
            app.update(True,runner,lambda:None,lambda _:RELEASE,lambda:'state')
            runner.assert_not_called()

    def test_unapproved_contract_never_accepts_observed_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            contract=Path(directory)/'contract';contract.write_text('{"schema":1,"approved":false}');contract.chmod(0o600)
            with mock.patch.object(app,'CONTRACT',contract),mock.patch.object(app,'protected'):
                with self.assertRaisesRegex(app.Blocked,'review is incomplete'):app.compatibility()

    def test_unsettled_or_missing_state_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            state=Path(directory)/'state'
            with mock.patch.object(app,'STATE',state),mock.patch.object(app,'protected'):
                with self.assertRaises(OSError):app.state_identity()
                state.write_text('{"schema":1,"status":"activating"}');state.chmod(0o600)
                with self.assertRaisesRegex(app.Blocked,'baseline'):app.state_identity()

    def test_real_shared_flock_contention(self):
        with tempfile.TemporaryDirectory() as directory:
            fstat=os.fstat
            def info(fd):return SimpleNamespace(st_uid=0,st_mode=fstat(fd).st_mode)
            with mock.patch.object(app,'STATE_ROOT',Path(directory)),mock.patch.object(app,'protected'),mock.patch.object(app.os,'fstat',side_effect=info):
                with app.lock():
                    with self.assertRaisesRegex(app.Blocked,'running'):
                        with app.lock():self.fail('concurrent entry')
                with app.lock():pass
