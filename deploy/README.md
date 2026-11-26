# Souqak manual release deployment

The workflow has two trust-separated phases. Preparation runs as `souqak` and
never invokes Docker, reads the production `.env`, or changes production. A
human administrator then runs one fixed, root-owned helper. The helper accepts
only a full commit SHA and a bundle below the fixed prepared-release directory;
it does not source repository configuration or run scripts from that bundle.

This workflow has **not** been run on the VPS and is not approved for a live
deployment. The required one-time host transition and acceptance checks below
must be completed first.

The repository helpers may differ from copies already installed on the VPS.
Before a future deployment, the administrator must compare and explicitly
install the reviewed helper revision; no VPS inspection or connection was
performed for this change.

## Trust boundaries and one-time host setup

1. Review and install the managed deployment sources as root-owned files:
   - `deploy/admin/activate-release.py` ->
     `/usr/local/libexec/souqak/activate-release.py`
   - `deploy/admin/prepare-update.py` ->
     `/usr/local/libexec/souqak/prepare-update.py`
   - `deploy/prepare-release.py` ->
     `/usr/local/libexec/souqak/prepare-release.py`
   - `deploy/snapshot_contract.py` -> `/usr/local/libexec/snapshot_contract.py`
   - `deploy/check-update.py` -> `/usr/local/libexec/souqak/check-update.py`
   - `deploy/souqak-update` -> `/usr/local/sbin/souqak-update`

   Install only a reviewed, matching source set; these are managed sources,
   not an instruction to overwrite the currently installed VPS tools
   automatically. Keep the helpers and their parent directories root-owned
   and not writable by `souqak`. Verify the installed files with `sha256sum`
   and compare against hashes independently recorded from the reviewed
   source. Never invoke repository copies as root. The activation helper
   contains fixed container, network, volume, environment-file, port, and
   Nginx paths; it has no generic Docker command or user-supplied
   configuration mode.

   Example installed-file digest check:

   ```bash
   sha256sum \
     /usr/local/libexec/souqak/activate-release.py \
     /usr/local/libexec/souqak/prepare-update.py \
     /usr/local/libexec/souqak/prepare-release.py \
     /usr/local/libexec/snapshot_contract.py \
     /usr/local/libexec/souqak/check-update.py \
     /usr/local/sbin/souqak-update
   ```
2. Create the dedicated, unprivileged `souqak-build` system account with no
   login, no supplementary groups, and no Docker membership. Install Node.js
   and npm for that account. Its home `/var/lib/souqak-build` must be owned by
   it with mode `0700`. Create `/var/lib/souqak-build-work` root-owned,
   non-writable by the builder, and searchable by it (mode `0711`). Keep this
   separate from the builder-owned home and the mode-`0700` state tree.
   Create `/var/lib/souqak-deploy` and its `staging` child root-owned mode
   `0700`. Preparation and activation use distinct root-only locks. The
   preparer executes candidate package/test/build commands in a transient
   systemd unit as `souqak-build`, with `ProtectHome`, no Docker access, and a
   clean environment. A missing systemd, builder account, or protected
   directory is a fail-closed prerequisite, not a reason to run the build as
   root.
3. Perform the filesystem transition in a maintenance window. The existing
   `/home/souqak/deploy` parent and `current-frontend` entry are writable by
   `souqak`, so root must own the parent directory (not recursively change
   ownership of the existing worktree) and make it non-writable by
   group/other. Keep `/home/souqak/deploy/souqak` and `prepared/` owned by
   `souqak`; create `/home/souqak/deploy/managed-releases` root-owned and
   non-writable by `souqak`. Confirm Nginx can traverse every parent directory.
   Copy—not move or overwrite—the current `legacy-baseline-20261108` frontend
   into `managed-releases/legacy-baseline-20261108/frontend/dist`, verify its
   files, and create the root-owned `current-frontend` symlink to that copy.
   Keep the existing served files intact until the symlink and Nginx health
   checks succeed. The helper refuses a writable parent or an unmanaged
   symlink.
4. Keep `/home/souqak/deploy/souqak/.env` owned by `souqak`, mode `0600`.
   Preserve all current keys. The helper reads but never prints or sources
   this file; it requires exactly one non-empty MongoDB URI and one supported
   access and refresh JWT key, `replicaSet=rs0`, and a MongoDB host alias on
   `souqak_default`.
5. Independently verify the production indexes before an update:
   - both unique multiservice wallet-draft indexes match the candidate schema;
   - the old unique `(userId, type)` incomplete-draft index is absent;
   - there are no duplicate/incompatible draft records;
   - the `ConversationMessage` and `SupportMessage` `{ images: 1 }` indexes
     exist or are handled through an approved operational procedure.
   No deployment command runs a migration, seed, import, or index creation.
   After an authorized operator completes this verification, place the
   completed `deploy/draft-index-attestation.example` as
   `/var/lib/souqak-deploy/draft-index-attestation.txt`, with root ownership
   and mode `0600`. Set its schema hash and UTC verification time from the
   actual check. The activation helper rejects missing, stale, mismatched, or
   non-root-protected attestations; this file is an operator attestation, not
   an automated database query.
6. Confirm the current MongoDB container, replica set, and volumes match the
   fixed values in the helper. The helper only inspects MongoDB and never
   starts, stops, recreates, mounts, or modifies its container or data volume.
   It also never removes, prunes, or recreates any volume.

The root helper verifies the prepared manifest, snapshots its files into a
root-owned staging directory without following symlinks, verifies the exact
commit is reachable from GitHub `main`, and requires the operator to type the
full SHA. It independently builds the final frontend from that exact commit
as the isolated builder, so the `souqak`-owned prepared frontend is not
promoted. It builds the backend image from a protected source archive of the
same reviewed commit. The bundle includes the required `shared/seoRules.mjs`
runtime with a manifest hash; activation compares it byte-for-byte with the
module in the approved source archive. The frontend build workspace and the
curated backend Docker context receive only that module from the same commit.
The backend Docker context also receives the empty-root
`frontend/dist/dynamic-ad-renderer-template.html` preserved from the Vite
build before prerendering. It is marked `noindex` if served directly; its
versioned scripts, stylesheets, and module preloads are checked against that
same `frontend/dist` before image creation. The image contains this release
template, while Nginx continues to serve the matching static assets from the
managed frontend release.
The approved commit's Dockerfile is a trusted build input and must be
reviewed; no `.env`, private key, or persistent data enters either build
context.

## Prepare a release (Ubuntu Bash)

The root-owned `prepare-update.py` orchestrates preparation, while the actual
build runs as the dedicated `souqak-build` account in a transient systemd
unit. Supply an explicit full SHA; the wrapper does not guess among multiple
prepared candidates:

```bash
sudo -n /usr/local/libexec/souqak/prepare-update.py --prepare <full-commit-sha>
souqak-update --dry-run <full-commit-sha>
```

Preparation fetches the exact commit, confirms it is on `main` and is a
descendant of the active release when that release has a Git SHA, runs the
backend/frontend tests, exports a public-API Snapshot bound to the exact SHA,
and creates the Vite + prerender/SEO output. It publishes only after secure
staging and validation, then writes protected SEO and release-build receipts.
Receipt creation is idempotent: a retry accepts an existing receipt only
when its complete contents match; it never replaces a mismatched receipt.
If publication and the protected preparation-evidence record completed but
receipt creation was interrupted, rerun `--prepare` for the same SHA to
validate the existing candidate and finish missing receipts. If publication
completed without its evidence record, the operation fails closed and needs
administrator investigation; it does not bless the candidate or overwrite
receipts.

The prepared bundle includes:

```text
/home/souqak/deploy/prepared/<full-commit-sha>/
  manifest.json
  readiness.txt
  seo-snapshot.json
  frontend/dist/
  shared/seoRules.mjs
```

Preparation does not use Docker, change Nginx, read the production `.env`,
connect to MongoDB, or alter a production volume. It does use GitHub and the
public API to retrieve the approved source and public SEO data. The builder
receives a clean environment and no production credentials. The current
orchestrator still allows network access to package downloads and Snapshot
export; per-command network isolation for tests/build has not yet been
implemented or verified on Linux. **Do not install or use this preparer for
production until that remaining isolation gap is resolved.** Review the exact
SHA, build/test output, readiness report, Snapshot, manifest and receipts
before activation. A failed operation does not authorize activation.

The SEO Snapshot receipt is stored under
`/var/lib/souqak-deploy/seo-receipts/<sha>.json`; the schema-2 build evidence
receipt is separately stored under
`/var/lib/souqak-deploy/release-receipts/<sha>.json`. A root-only
preparation-evidence record binds successful preparation to the exact
manifest, Frontend hash, Snapshot hash, and release SHA so an interrupted
receipt creation can be retried without blessing a user-created candidate.

Manifest/Snapshot versions are explicit and are never converted or silently
fallen back:

| Release manifest | Snapshot | Intended use | Required evidence |
|---|---|---|---|
| Schema 1 | Schema 1 | Existing compatible prepared releases and controlled legacy use | Exact release SHA, source commit, Snapshot path/hash/size/freshness, frontend hash and legacy check booleans; SEO receipt |
| Schema 2 | Schema 2 | New SEO releases | Schema-2 checks and test list, release SHA, Snapshot binding, shared runtime hash, final Frontend tree hash, Renderer template and Prerender manifest hashes; SEO receipt plus separate build-evidence receipt |

Schema 1 cannot claim schema-2 Renderer/shared guarantees. New preparation
emits schema 2 only. The activation helper independently validates both
contracts and binds `sourceCommit` to the exact selected release SHA.

The bundle is untrusted input even when its hashes match. The administrator
helper snapshots it, rejects symlinks/special files/path escapes, validates
the SHA, frontend hash, shared-runtime hash, and test/build evidence, then
independently builds the production frontend from the verified source commit.

## Manual activation (Ubuntu root session)

After review, from a root administrative session:

```bash
/usr/local/libexec/souqak/activate-release.py \
  --dry-run \
  --release <full-commit-sha> \
  --bundle /home/souqak/deploy/prepared/<full-commit-sha>

/usr/local/libexec/souqak/activate-release.py \
  --release <full-commit-sha> \
  --bundle /home/souqak/deploy/prepared/<full-commit-sha>
```

The helper takes a root-only lock, verifies the existing backend, MongoDB,
named volumes, runtime environment, Nginx root/proxy, readiness endpoint, and
protected current frontend before the operator confirms the SHA. It builds
the candidate image with a full-SHA tag and checks the `node` user and upload
volume access before stopping the current backend. It uses only:

- backend container `souqak-backend`, rollback containers with a fixed prefix;
- network `souqak_default`;
- volumes `souqak_uploads_data` and `souqak_private_uploads_data`;
- loopback port `127.0.0.1:5000`;
- the existing external `.env`;
- `--user node`, `--restart unless-stopped`, `--init`, and
  `no-new-privileges`; no privileged mode or Docker socket mount.

The old backend is stopped before the replacement starts, so a short API
interruption is expected. Two production backend versions are never run at
once; in-flight requests, WebSockets, scheduled jobs, and transactions may be
interrupted. Schedule a maintenance window and inspect the application's
graceful-shutdown/financial-job behavior before approving the first rollout.

`current-frontend` is replaced atomically. Changing only its target normally
does not require an Nginx reload because the Nginx configuration is unchanged;
the helper checks the served release marker and reloads only if the expected
release is not served. Before any reload it runs `nginx -t`; it never edits
the site configuration. A reload failure triggers restoration and an explicit
manual-recovery error if restoration cannot be verified.

After success, verify the site and API from an independent client, confirm the
new release marker and Backend readiness, and review root journal/syslog
entries. Logs contain release IDs and outcomes only, never environment values.

## Rollback (Ubuntu root session)

The helper stores the active and previous backend container IDs, release
identifiers, and protected frontend paths in root-only state. Rollback uses
the already-recorded stopped container and protected frontend and does not
re-validate a prepared bundle or require shared files in a legacy release.
It refuses to roll back if a container ID, release, or path differs from that
record:

```bash
/usr/local/libexec/souqak/activate-release.py \
  --dry-run --rollback --release <currently-active-full-commit-sha>
/usr/local/libexec/souqak/activate-release.py \
  --rollback --release <currently-active-full-commit-sha>
```

Rollback retains the failed/current backend under a fixed name and starts the
recorded stopped backend, then restores its frontend and health-checks both.
The previously active frontend is checked against the legacy required-file
contract, so it does not need the new dynamic-renderer template or shared
runtime; candidate releases still require the complete new output.
It never rolls back database state or touches MongoDB/uploads volumes. If
Docker, Nginx, or health checks fail, available containers and releases are
preserved and the helper reports that manual recovery is needed; no script can
guarantee availability when the host refuses the recovery operations.

## Future updates and local validation

For each update: review the source on `main`; run the root-owned preparer for
one explicit SHA; inspect its manifest, receipts, and outputs; run the
protected dry-run; then activate only after operator approval.
`check-update.py` without arguments compares the protected active SHA with
GitHub `main`; `check-update.py --release <sha>` validates one already
prepared candidate without preparing it. `souqak-update <sha>` is a
convenience command that prepares and then activates that exact SHA; it does
not select a candidate automatically. `souqak-update --rollback <sha>`
invokes the protected rollback record. No command restores MongoDB.

Nginx SEO routing/configuration changes belong to the later 9.4 operation.
Stage and validate an immutable config with `nginx -t`, switch it only with
the matching Frontend/Backend release, and retain the prior config for
explicit restoration. The current rollback record restores only the Backend
container and Frontend release; it does not restore an independently changed
Nginx configuration or environment file. Keep both unchanged in this stage.

Locally, with Python 3, Node.js, npm, and Bash installed:

```bash
bash -n deploy.sh
bash -n deploy/deploy-transaction.sh
bash -n deploy/souqak-update
python3 -m unittest discover -s deploy/tests -p "test_*.py"
node --test deploy/tests/*.test.mjs
```

Tests use mocks and temporary directories. They do not prove Linux ownership,
systemd sandbox, Docker daemon, Nginx, or production permissions. Those remain
one-time VPS acceptance checks. Successful local tests do not approve a
production deployment.
