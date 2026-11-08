# Production data import preview

`importProductionData.mjs` is a dry-run-only preview tool. It validates the
bundle in `backend/exports/production-data/`, computes SHA-256 fingerprints, and
writes timestamped JSON and Markdown reports under `backend/exports/import-preview/`.
It does not modify the source bundle.

Run bundle validation without connecting to MongoDB:

```powershell
node .\scripts\importProductionData.mjs
```

Database comparison is optional and requires all three environment variables:

- `IMPORT_DRY_RUN_MONGODB_URI`
- `IMPORT_DRY_RUN_DATABASE_NAME`, with a `souqak_prelaunch_*` name
- `IMPORT_DRY_RUN_LOCAL_TARGET_APPROVED=YES`

Only a single, direct loopback MongoDB endpoint on an explicitly specified
non-default port is accepted. Production database names, remote hosts, and
`NODE_ENV=production` are rejected. Use a MongoDB account granted read-only
access to the approved local prelaunch database. The tool reads only the
reference-data collections and uses `find` queries with field projections.

The bundle currently has no trusted checksum/signature in its manifest. The
reports therefore include a computed fingerprint marked
`computed_unattested`; it identifies the bytes inspected but cannot prove who
produced them.

Write/import options such as `--apply` and `--write` are intentionally
unavailable. The isolated unit tests can be run with:

```powershell
node --test .\test\importProductionDataDryRun.test.js
```
