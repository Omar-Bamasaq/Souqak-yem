"""Bounded snapshot envelope validation; full content validation runs unprivileged in Node."""
import hashlib
import json
import os
import re
import stat
from datetime import datetime, timezone
from pathlib import Path

MAX_BYTES = 16 * 1024 * 1024
MAX_AGE_MS = 86400000
SITE = 'https://souqak-yem.com'

def snapshot_info(file, release, expected=None, now=None):
    file = Path(file)
    fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= MAX_BYTES:
            raise ValueError('Snapshot must be a bounded regular file, not a link')
        with os.fdopen(fd, 'rb', closefd=False) as stream:
            raw = stream.read(MAX_BYTES + 1)
        if not raw or len(raw) > MAX_BYTES or len(raw) != info.st_size:
            raise ValueError('Invalid or changing snapshot size')
    finally:
        os.close(fd)
    data = json.loads(raw)
    meta = data.get('metadata', {})
    if not re.fullmatch(r'[a-f0-9]{40}', release) or meta.get('sourceCommit') != release:
        raise ValueError('Snapshot source commit mismatch')
    if meta.get('schemaVersion') != 1 or meta.get('siteBaseUrl') != SITE:
        raise ValueError('Snapshot schema/site mismatch')
    stamp = datetime.fromisoformat(meta['exportedAt'].replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('Snapshot timestamp must have timezone')
    age = ((now or datetime.now(timezone.utc)) - stamp).total_seconds() * 1000
    if age < 0 or age > MAX_AGE_MS or meta.get('maxAgeMs') != MAX_AGE_MS:
        raise ValueError('Snapshot is stale or has invalid lifetime')
    expiry = datetime.fromisoformat(meta['expiresAt'].replace('Z', '+00:00'))
    if (expiry - stamp).total_seconds() * 1000 != MAX_AGE_MS:
        raise ValueError('Snapshot expiry mismatch')
    info = {'path': 'seo-snapshot.json', 'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'sourceCommit': release, 'maxAgeMs': MAX_AGE_MS}
    if expected is not None and expected != info:
        raise ValueError('Snapshot manifest hash/size/commit mismatch')
    return info
