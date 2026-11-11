#!/usr/bin/python3
"""Install only a protected, reviewed candidate after compatibility succeeds."""
import importlib.machinery
import importlib.util
import os
from pathlib import Path
import stat
import sys
import tempfile

ROOT = Path('/usr/local/libexec/souqak')
CANDIDATE = ROOT / 'souqak-deploy-candidate'
DESTINATION = Path('/usr/local/sbin/souqak-deploy')

def protected(path):
    for item in (path, *path.parents):
        info = item.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise RuntimeError('Unsafe installation path: ' + str(item))

def install_candidate(candidate, destination, verify, check_only=False):
    protected(candidate)
    protected(destination.parent)
    if not candidate.is_file():
        raise RuntimeError('Candidate must be a regular protected file')
    if destination.exists() or destination.is_symlink():
        raise RuntimeError('Destination exists; preserve and review it separately, never overwrite')
    # No directory creation, temporary output or destination write before the gate.
    verify()
    if check_only:
        return
    data = candidate.read_bytes()
    fd, temporary = tempfile.mkstemp(prefix='.souqak-deploy-', dir=destination.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
            output.flush()
            os.fchmod(output.fileno(), 0o755)
            os.fsync(output.fileno())
        # Exclusive atomic publication; a concurrent installer cannot overwrite.
        os.link(temporary, destination)
    finally:
        os.unlink(temporary)

def main(argv):
    if argv not in ([], ['--check']):
        raise RuntimeError('Usage: install-souqak-deploy.py [--check]')
    if os.geteuid() != 0:
        raise RuntimeError('Root administrative session required')
    protected(Path(__file__))
    protected(CANDIDATE)
    # Load only the pre-reviewed protected candidate, never a checkout module.
    loader = importlib.machinery.SourceFileLoader('reviewed_coordinator', str(CANDIDATE))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    install_candidate(CANDIDATE, DESTINATION, module.compatibility, argv == ['--check'])
    print('Compatibility gate passed; ' + ('no installation performed.' if argv else 'candidate installed.'))

if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        print('Installation blocked: ' + str(error), file=sys.stderr)
        sys.exit(1)
