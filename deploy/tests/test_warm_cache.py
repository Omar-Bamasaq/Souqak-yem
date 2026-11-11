import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock

spec=importlib.util.spec_from_file_location('warm_cache',Path(__file__).resolve().parents[1]/'warm-npm-cache.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class WarmCacheTests(unittest.TestCase):
    def test_root_rejected_before_writing(self):
        with mock.patch.object(module.os,'geteuid',return_value=0):
            with self.assertRaises(ValueError):module.warm('/unused','/unused')

    def test_connected_warm_verified_offline_install_and_unchanged_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);repo=root/'repo'
            for component in ('backend','frontend'):
                (repo/component).mkdir(parents=True)
                for name in ('package.json','package-lock.json'):(repo/component/name).write_text('{}')
            before={p:p.read_bytes() for p in repo.rglob('*.json')}
            with mock.patch.object(module.os,'geteuid',return_value=1000),mock.patch.object(module.subprocess,'run') as runner:
                module.warm(repo,root/'cache')
            self.assertEqual(runner.call_count,6)
            for index in (0,3):
                self.assertIn('--ignore-scripts',runner.call_args_list[index].args[0])
                self.assertEqual(runner.call_args_list[index+1].args[0][:3],['npm','cache','verify'])
                command=runner.call_args_list[index+2].args[0]
                self.assertIn('--offline',command);self.assertNotIn('--ignore-scripts',command)
            self.assertEqual(before,{p:p.read_bytes() for p in repo.rglob('*.json')})
