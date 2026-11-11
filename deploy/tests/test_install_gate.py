import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

DEPLOY=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('install_gate',DEPLOY/'admin/install-souqak-deploy.py')
app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)

class InstallGateTests(unittest.TestCase):
    def test_failed_compatibility_never_writes_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate=Path(directory)/'candidate';candidate.write_text('fixture')
            target=Path(directory)/'installed'
            with mock.patch.object(app,'protected'):
                with self.assertRaisesRegex(RuntimeError,'incompatible'):
                    app.install_candidate(candidate,target,mock.Mock(side_effect=RuntimeError('incompatible')))
            self.assertEqual(sorted(p.name for p in Path(directory).iterdir()),['candidate'])

    def test_check_only_and_exclusive_install(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate=Path(directory)/'candidate';candidate.write_bytes(b'reviewed fixture')
            target=Path(directory)/'installed';verify=mock.Mock()
            with mock.patch.object(app,'protected'):
                app.install_candidate(candidate,target,verify,True)
                self.assertFalse(target.exists())
                app.install_candidate(candidate,target,verify)
                self.assertEqual(target.read_bytes(),candidate.read_bytes())
                with self.assertRaisesRegex(RuntimeError,'exists'):
                    app.install_candidate(candidate,target,verify)
            self.assertEqual(verify.call_count,2)

    def test_observed_identity_is_not_approval(self):
        data=json.loads((DEPLOY/'unified-contract.example.json').read_text())
        self.assertFalse(data['approved'])
        self.assertTrue(data['observed_vps']['identity_only'])
        self.assertFalse(any(data['review'].values()))
        self.assertEqual(data['observed_vps']['tool_sha256']['prepare-update.py'],'206fb08920292a62a664d1847e01616a476d596bd29d1d834e0cc48daf46de31')
        self.assertNotEqual(data['sha256']['prepare'],data['observed_vps']['tool_sha256']['prepare-update.py'])

    def test_actual_compatibility_gate_rejects_observed_hashes_without_approval(self):
        import test_unified_deploy
        coordinator=test_unified_deploy.app
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);candidate=root/'candidate';candidate.write_text('fixture')
            contract=root/'contract.json'
            contract.write_bytes((DEPLOY/'unified-contract.example.json').read_bytes());contract.chmod(0o600)
            with mock.patch.object(app,'protected'),mock.patch.object(coordinator,'protected'),mock.patch.object(coordinator,'STATE',root),mock.patch.object(coordinator,'CONTRACT',contract):
                with self.assertRaisesRegex(coordinator.Blocked,'approval'):
                    app.install_candidate(candidate,root/'installed',coordinator.compatibility)
            self.assertFalse((root/'installed').exists())
