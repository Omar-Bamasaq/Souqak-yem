# Standalone souqak-update repair candidate

Candidate: `deploy/admin/souqak-update-candidate`. It defines the fixed PREPARER
path and preserves the existing zero-argument / `--dry-run` CLI. It never imports
or executes checkout code as root. It does not replace the three installed tools.
The reported function signatures do not establish CLI semantics or manifest shape;
this is a gated candidate, not an assertion of compatibility with the VPS.

Behavior:

- Holds `/var/lib/souqak-deploy/unified.lock` across the operation, sharing the new
  coordinator's lock. Review the legacy/internal lock paths before enabling it.
- Reads main once as `souqak`, pins the complete SHA, and calls the fixed PREPARER
  **without arguments, as souqak**. This uses the reported old call shape without
  speculatively adding arguments. Review actual main() before authorizing it.
- Refuses non-hidden existing entries in prepared. Does not delete/archive them.
  After preparation requires exactly one new real directory named by the pinned
  SHA and a matching schema-1 manifest with repository/branch/build/test/hash fields.
  Missing, stale, multiple, mismatched and symlink bundles fail closed.
- Verifies tools again; rejects changed main or protected activation state. Calls
  ENGINE `--dry-run --release SHA --bundle PATH`, rechecks state/tools and invokes
  ENGINE with the same SHA/path, inheriting its terminal confirmation and rollback.
- Requires a protected active schema-1 baseline including release and backend ID.
  The engine must independently validate the complete payload and actual runtime
  state, secure-copy the bundle, and implement rollback. Wrapper metadata checks
  never replace those engine checks. No new independent rollback is attempted.
- `--dry-run` is a wrapper plan only: it does not run preparation or the engine.
  It still verifies compatibility, state, main and an empty prepared directory;
  it creates/acquires only the shared lock. No deployment occurs.

## Mandatory compatibility document

After complete source review, a root-owned mode-0600 file is required at
`/var/lib/souqak-deploy/update-candidate-contract.json`. Initial template:

```json
{
  "schema": 1,
  "approved": false,
  "sha256": {
    "prepare-update.py": "206fb08920292a62a664d1847e01616a476d596bd29d1d834e0cc48daf46de31",
    "activate-release.py": "6238de977d6cb12685988c21582a67fb192253ab26b7e2ac43be684e2f32aa74"
  },
  "review": {
    "no_argument_prepare_as_souqak": false,
    "manifest_schema1_verified": false,
    "interactive_sha_confirmation": false,
    "engine_validates_bundle_and_state": false,
    "engine_rollback_preserved": false,
    "offline_snapshot_build_verified": false,
    "no_database_or_volume_changes": false,
    "lock_coexistence_verified": false
  }
}
```

These hashes record reported existing files, not semantic approval. Keep false
until reviewed. If any interface/schema differs, change and test the candidate
instead of approving an incompatible contract. Existing VPS offline-build support
is still unproved. No tools are updated to make this template pass. The root-owned
contract is an administrator attestation, not an automatic proof of the semantics.

## Short installation procedure after review (not executed)

1. Obtain the complete sanitized legacy entrypoint and three helper sources plus
   imported local helpers. Verify actual hashes, no-argument prepare permissions,
   state/manifest format, offline snapshots/cache, confirmation/rollback and lock
   coexistence. Function names alone are insufficient. Reconcile backend and
   frontend release identity without changing the checkout or reading secrets.
2. Back up the existing `/usr/local/sbin/souqak-update` to a new dated root-only
   backup directory; preserve mode/owner/timestamps and verify backup hash against
   the original. Retain the three previous backups. Record applicable sudo policy.
3. Stage the reviewed candidate under `/usr/local/libexec/souqak/`, root-owned 0755
   with protected parents. Do not execute a copy in the writable checkout as root.
   Provision the reviewed contract only after all checks pass. Preserve and review
   existing prepared bundles separately; never clean them automatically.
4. From an authorized root session run that staged candidate with `--dry-run`.
   Any failure stops installation. Test activation/failure/rollback on staging
   before a production replacement. Do not auto-answer the engine's SHA prompt.
5. Only after separate installation approval, copy the same reviewed candidate to
   a new temporary file in `/usr/local/sbin`, set root:root / 0755, verify bytes,
   then atomically rename it to `souqak-update`. Do not replace PREPARER, ENGINE or
   check-update.py. Verify installed hash and run wrapper plan again. Do not run
   a real update as part of installation. Review sudo rules for the preserved CLI.

If installation needs reversal, restore the verified backup atomically with its
original ownership/mode. That restores the known PREPARER defect too: the restored
old updater remains unsafe for use. Tool restoration is not application rollback.

Tests (mock tools and temporary files only):

```sh
python3 -m unittest discover -s deploy/tests -p 'test_*.py'
node --test deploy/tests/*.test.mjs
```
