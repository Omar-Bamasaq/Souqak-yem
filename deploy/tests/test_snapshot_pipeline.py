import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from unittest import mock

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY / 'admin'))
from snapshot_contract import snapshot_info, MAX_BYTES
spec = importlib.util.spec_from_file_location('activation_seo', DEPLOY / 'admin' / 'activate-release.py')
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)
RELEASE = 'a' * 40

def fixture():
    stamp = datetime.now(timezone.utc)
    cat = {'_id':'b'*24,'slug':'cars','name':'Cars','description':'','image':None,'children':[]}
    return {'metadata':{'source':'isolated-test','sourceDatabase':'mock-only','sourceCommit':RELEASE,'schemaVersion':1,'siteBaseUrl':'https://souqak-yem.com','exportedAt':stamp.isoformat(),'expiresAt':(stamp+timedelta(days=1)).isoformat(),'maxAgeMs':86400000},'categories':[cat],'ads':[],'categorySsgDataBySlug':{'cars':{'category':cat,'breadcrumbs':[],'subcategories':[],'ads':[]}}}

class SnapshotPipelineTests(unittest.TestCase):
    def test_real_validator_in_activation_builder_and_offline_commands(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root); source = root/'source'; frontend = source/'frontend'; frontend.mkdir(parents=True)
            for folder in ('scripts','src/lib'):
                (frontend/folder).mkdir(parents=True,exist_ok=True)
            for file in ('scripts/exportPrerenderSnapshot.mjs','scripts/validatePrerenderSnapshot.mjs','scripts/prerenderRoutes.mjs','src/lib/publicAdIndexing.js','src/lib/siteUrl.js'):
                shutil.copyfile(DEPLOY.parent/'frontend'/file,frontend/file)
            (frontend/'package.json').write_text('{"type":"module"}')
            snapshot = root/'snapshot.json'; snapshot.write_text(json.dumps(fixture()))
            info = snapshot_info(snapshot,RELEASE)
            account = SimpleNamespace(pw_uid=os.getuid(),pw_gid=os.getgid(),pw_dir=str(root/'home'))
            calls=[]
            def runner(command):
                calls.append(command)
                self.assertIn('--property=PrivateNetwork=yes', command)
                start=command.index('env')
                args=command[start+2:]
                environment={}
                while args and '=' in args[0]:
                    key,value=args.pop(0).split('=',1);environment[key]=value
                self.assertEqual(environment['SEO_PRERENDER_DATA_SOURCE'],'local')
                self.assertEqual(environment['SEO_PRERENDER_MAX_AGE_MS'],'86400000')
                working=next(c.split('=',2)[2] for c in command if c.startswith('--property=WorkingDirectory='))
                if args[0]=='node':
                    # Run the actual content validator, not a mocked success.
                    subprocess.run(args,cwd=working,check=True,stdout=subprocess.PIPE)
                elif args[1]=='ci':
                    self.assertIn('--offline',args)
                else:
                    out=Path(working)/'dist';out.mkdir()
                    for name in admin.REQUIRED_FRONTEND_FILES[:-1]:(out/name).write_text('test-only artifact')
            workspace=root/'workspace';workspace.mkdir()
            original_stat=Path.stat
            def fake_stat(path,*a,**k):
                result=original_stat(path,*a,**k)
                if path==workspace:return SimpleNamespace(st_uid=0,st_mode=result.st_mode)
                return result
            with mock.patch.object(Path,'stat',fake_stat),mock.patch.object(admin.os,'chown'),mock.patch.object(admin,'run',side_effect=runner):
                admin.build_frontend_as_builder(source,workspace,account,snapshot,RELEASE,info)
            self.assertEqual(len(calls),3)
            # A valid envelope with invalid content must fail before npm/build.
            broken=fixture();broken['categories']=[];snapshot.write_text(json.dumps(broken))
            info=snapshot_info(snapshot,RELEASE); workspace2=root/'workspace2';workspace2.mkdir()
            with mock.patch.object(Path,'stat',lambda p,*a,**k: SimpleNamespace(st_uid=0,st_mode=original_stat(p,*a,**k).st_mode) if p==workspace2 else original_stat(p,*a,**k)),mock.patch.object(admin.os,'chown'),mock.patch.object(admin,'run',side_effect=runner):
                with self.assertRaises(subprocess.CalledProcessError):
                    admin.build_frontend_as_builder(source,workspace2,account,snapshot,RELEASE,info)

    def test_hash_release_age_size_and_symlink_rejection(self):
        with tempfile.TemporaryDirectory() as root:
            file=Path(root)/'snapshot.json';data=fixture();file.write_text(json.dumps(data));info=snapshot_info(file,RELEASE)
            with self.assertRaises(ValueError):snapshot_info(file,'c'*40)
            file.write_text(json.dumps(data)+' ')
            with self.assertRaises(ValueError):snapshot_info(file,RELEASE,info)
            file.write_text(json.dumps(data))
            with self.assertRaises(ValueError):snapshot_info(file,RELEASE,now=datetime.now(timezone.utc)+timedelta(days=2))
            link=Path(root)/'link';link.symlink_to(file)
            with self.assertRaises((ValueError,OSError)):snapshot_info(link,RELEASE)
            with file.open('wb') as stream:stream.truncate(MAX_BYTES+1)
            with self.assertRaises(ValueError):snapshot_info(file,RELEASE)

    def test_docker_build_has_no_pull_and_no_build_network(self):
        with tempfile.TemporaryDirectory() as root:
            root=Path(root);source=root/'source';(source/'backend/src').mkdir(parents=True)
            for name in ('Dockerfile','backend/package.json','backend/package-lock.json'):(source/name).write_text('test fixture')
            ops=mock.Mock();ops.docker.return_value='node'
            admin.build_backend_image(ops,source,RELEASE)
            command=ops.docker.call_args_list[0].args
            self.assertIn('--pull=false',command);self.assertIn('--network=none',command)

    def test_preparation_runs_real_content_validation_and_local_loader(self):
        import test_prepare_release
        module = test_prepare_release.prepare_module
        for invalid in (False, True):
            with tempfile.TemporaryDirectory() as root:
                calls = []
                def runner(command, *, cwd, env=None):
                    calls.append(command)
                    if command[:2] == ['git', 'clone']:
                        source=Path(command[-1]);(source/'backend').mkdir(parents=True);(source/'frontend').mkdir()
                    if len(command)>2 and command[1]=='scripts/exportPrerenderSnapshot.mjs':
                        if command[2]=='--output':
                            data=fixture()
                            if invalid:data['categories']=[]
                            Path(command[3]).write_text(json.dumps(data))
                        else:
                            subprocess.run(['node',str(DEPLOY.parent/'frontend/scripts/exportPrerenderSnapshot.mjs'),*command[2:]],check=True,stdout=subprocess.PIPE)
                    if command[:3]==['npm','run','build']:
                        # Exercise the actual offline data loader; any fetch fails.
                        script="globalThis.fetch=()=>{throw Error('network forbidden')}; const {getPrerenderData}=await import("+json.dumps((DEPLOY.parent/'frontend/scripts/prerenderData.mjs').as_uri())+"); const d=await getPrerenderData(); if(d.source!=='local'||d.categories.length!==1)throw Error('wrong data');"
                        subprocess.run(['node','--input-type=module','--eval',script],check=True,env={**os.environ,**env},stdout=subprocess.PIPE)
                        dist=Path(cwd)/'dist';dist.mkdir()
                        for name in ('index.html','sitemap.xml','robots.txt','prerender-manifest.json'):(dist/name).write_text('test artifact')
                with mock.patch.object(module.os,'geteuid',return_value=1000),mock.patch.object(module.subprocess,'check_output',return_value=RELEASE+'\n'):
                    if invalid:
                        with self.assertRaises(subprocess.CalledProcessError):module.prepare(RELEASE,Path(root)/'prepared',runner=runner)
                        self.assertFalse((Path(root)/'prepared'/RELEASE).exists())
                        self.assertFalse(any(c[:3]==['npm','run','build'] for c in calls))
                    else:
                        module.prepare(RELEASE,Path(root)/'prepared',runner=runner)
                        manifest=json.loads((Path(root)/'prepared'/RELEASE/'manifest.json').read_text())
                        snapshot_info(Path(root)/'prepared'/RELEASE/'seo-snapshot.json',RELEASE,manifest['seo_snapshot'])
