#!/usr/bin/env python3
"""Warm lockfile artifacts without lifecycle scripts; verify installs offline in scratch dirs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def warm(repository, cache):
    if os.geteuid() == 0:
        raise ValueError('Run as an unprivileged build account, never root')
    repository, cache = Path(repository).resolve(), Path(cache).resolve()
    cache.mkdir(parents=True, exist_ok=True)
    results = {}
    with tempfile.TemporaryDirectory(prefix='souqak-cache-check-') as temporary:
        for component in ('backend', 'frontend'):
            source = repository / component
            target = Path(temporary) / component
            target.mkdir()
            for name in ('package.json', 'package-lock.json'):
                shutil.copyfile(source / name, target / name)
            common = ['npm', 'ci', '--cache', str(cache), '--no-audit', '--no-fund']
            # Integrity is enforced by npm's package-lock; never disable TLS or scripts
            # during the offline acceptance install. Only warming suppresses scripts.
            subprocess.run([*common, '--ignore-scripts'], cwd=target, check=True)
            subprocess.run(['npm', 'cache', 'verify', '--cache', str(cache)], cwd=target, check=True)
            subprocess.run([*common, '--offline'], cwd=target, check=True)
            results[component] = hashlib.sha256((target / 'package-lock.json').read_bytes()).hexdigest()
    print(json.dumps({'lockfiles_sha256': results, 'offline_npm_install': 'passed',
                      'note': 'npm offline mode tested; OS network isolation and Docker cache are separate checks'}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', required=True)
    parser.add_argument('--cache', required=True)
    args = parser.parse_args()
    warm(args.repository, args.cache)
