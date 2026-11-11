# Souqak manual release deployment

The workflow has two trust-separated phases. Preparation runs as `souqak` and
never invokes Docker, reads the production `.env`, or changes production. A
human administrator then runs one fixed, root-owned helper. The helper accepts
only a full commit SHA and a bundle below the fixed prepared-release directory;
it does not source repository configuration or run scripts from that bundle.

This workflow has **not** been run on the VPS and is not approved for a live
deployment. The required one-time host transition and acceptance checks below
must be completed first.

## Trust boundaries and one-time host setup

1. Review and install `deploy/admin/activate-release.py` manually as root at
   `/usr/local/libexec/souqak/activate-release.py`. The installed copy, its
   parent directories, `/var/lib/souqak-deploy`, and the protected release
   directories must be root-owned and not writable by `souqak`. Never invoke
   the repository copy with root privileges. The helper contains fixed
   container, network, volume, environment-file, port, and Nginx paths; it has
   no generic Docker command or user-supplied configuration mode.
2. Create the dedicated, unprivileged `souqak-build` system account with no
   login, no supplementary groups, and no Docker membership. Install Node.js
   and npm for that account. Its home `/var/lib/souqak-build` must be owned by
   it with mode `0700`. Create `/var/lib/souqak-build-work` root-owned,
   non-writable by the builder, and searchable by it (mode `0711`). Keep this
   separate from the builder-owned home and the mode-`0700` state tree.
   Create `/var/lib/souqak-deploy` and its `staging` child root-owned mode
   `0700`. The helper executes frontend dependency installation/build only
   inside transient systemd scopes as `souqak-build`, with no production
   secrets or Docker access. A missing systemd, builder account, or protected
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
same reviewed commit. The approved commit's Dockerfile is a trusted build
input and must be reviewed; no `.env` or persistent data enters its build
context.

## Prepare a release (Ubuntu Bash)

Run as `souqak`, from a reviewed local checkout or installed copy of this
preparation tool. Supply the complete 40-character SHA of a commit already
reviewed for `main`:

```bash
./deploy.sh --dry-run <full-commit-sha>
./deploy.sh --prepare <full-commit-sha>
```

Preparation fetches that immutable commit, confirms it is on `main`, runs the
isolated backend regression suites and frontend tests, builds the full Vite +
prerender/SEO output, and writes:

```text
/home/souqak/deploy/prepared/<full-commit-sha>/
  manifest.json
  readiness.txt
  frontend/dist/
```

It uses no Docker, Nginx, production `.env`, MongoDB, or production volume.
It does not change the active backend or `current-frontend`. A test/build
failure leaves no ready bundle. The prerender build uses the public API URL;
it makes public read requests only and does not receive runtime secrets. Review
the exact SHA, all test output, the readiness report, and the frontend build
before asking an administrator to activate it.

The bundle is untrusted input even when its hashes match. The administrator
helper snapshots it, rejects symlinks/special files/path escapes, validates
the SHA and file hashes, then independently builds the production frontend
from the verified source commit.

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
identifiers, and protected frontend paths in root-only state. It refuses to
roll back if a container ID, release, or path differs from that record:

```bash
/usr/local/libexec/souqak/activate-release.py \
  --dry-run --rollback --release <currently-active-full-commit-sha>
/usr/local/libexec/souqak/activate-release.py \
  --rollback --release <currently-active-full-commit-sha>
```

Rollback retains the failed/current backend under a fixed name and starts the
recorded stopped backend, then restores its frontend and health-checks both.
It never rolls back database state or touches MongoDB/uploads volumes. If
Docker, Nginx, or health checks fail, available containers and releases are
preserved and the helper reports that manual recovery is needed; no script can
guarantee availability when the host refuses the recovery operations.

## Future updates and local validation

For each update: review and merge the source to `main`; run one preparation
command as `souqak`; inspect its SHA/readiness output; ask the administrator
to run the two activation commands; perform external health checks. Keep the
previous release until the observation period ends. No automatic deployment,
GitHub action, Docker-group membership, or broad sudo rule is part of this
workflow.

Locally, with Python 3, Node.js, npm, and Bash installed:

```bash
bash -n deploy.sh
bash -n deploy/deploy-transaction.sh
python3 -m unittest discover -s deploy/tests -p "test_*.py"
node --test deploy/tests/*.test.mjs
```

Tests use mocks and temporary directories. They do not prove Linux ownership,
systemd sandbox, Docker daemon, Nginx, or production permissions. Those remain
one-time VPS acceptance checks. Successful local tests do not approve a
production deployment.

## Unified coordinator (blocked until installed VPS tools are compared)

`deploy/admin/souqak-deploy` implements exactly `all`, `status`, and `check`.
Unknown arguments are rejected. It is not an installer and never upgrades or
replaces existing administrative helpers. No production rollout is authorized by
this repository change.

`all` holds `/var/lib/souqak-deploy/unified.lock` across preparation and activation.
It resolves GitHub main once to a full SHA, runs the fixed installed preparer as
`souqak`, rechecks helper hashes and main, invokes activation dry-run, then invokes
activation with the same SHA and bundle. A changed main aborts activation rather
than silently switching commits. The activator inherits the terminal and must
retain its full-SHA interactive confirmation and internal rollback. No affirmative
response is generated by the coordinator. It never invokes Docker, migrations,
seeds, checkout cleanup, or production database commands itself. Existing internal
locks remain in use; the reviewed tools must not acquire `unified.lock` themselves.
Direct helper invocation is still serialized by their internal activation lock.

`status` displays only selected fields from the protected activation record; it is
not a live health check and does not infer the deployed backend from checkout HEAD.
`check` verifies installed-file protection, exact reviewed hashes, semantic approval
and statically declared argparse flags. It does not execute helper `--help`, build,
connect to MongoDB, or activate a release. AST flag presence alone does not establish
semantic compatibility: human review of the exact hashed files is mandatory.

### Required installed-tool contract

The coordinator is intentionally incompatible with an unknown preparer. It expects:

- `/usr/local/libexec/souqak/prepare-update.py --release SHA --bundle PATH`, run as
  `souqak`, preparing exactly SHA at `/home/souqak/deploy/prepared/SHA`, failing on
  incomplete tests/builds, with no activation or production secret access.
- `/usr/local/libexec/souqak/activate-release.py --dry-run --release SHA --bundle PATH`
  and the same invocation without `--dry-run` for activation. It must validate the
  bundle as untrusted input, independently verify SHA, build as the separate
  unprivileged builder, confirm SHA interactively, preserve volumes/environment,
  and restore the previous application when activation fails.

The currently supplied VPS information does **not** establish the preparer's
arguments or these semantics. Do not create a compatibility approval merely by
hashing files. Compare complete installed source, imported local helper modules,
paths, privilege handling, locks, bundle format, recovery state, and build inputs
against reviewed source first. If the CLI differs, design and test a fixed adapter
or adjust the coordinator after review; do not rename flags speculatively or replace
VPS tools with repository versions. `check-update.py` is not executed because its
interface remains unknown; the coordinator performs its own fixed Git read.

### Local snapshot pipeline and remaining VPS gate

The repository now exports SEO data in the connected, unprivileged preparation
phase using the reviewed standalone exporter. Preparation stores a bounded
`seo-snapshot.json` in the release bundle and binds its SHA-256, byte count, source
commit and 24-hour lifetime into `manifest.json`. Both preparation and activation
use `SEO_PRERENDER_DATA_SOURCE=local` with an explicit path and maximum age.
No API fallback or synthetic production data is used. The root helper validates
the copied bundle envelope/hash/age before building; full content validation runs
as the isolated builder before npm. The same snapshot is copied to that builder's
workspace and verified again after building. Invalid or stale data aborts activation.

Preparation uses `npm ci --offline` for both components, with the invoking user's
persistent `~/.npm` cache explicitly selected; it never falls back to online npm.
The privileged activator's frontend scopes use `PrivateNetwork=yes` and
`npm ci --offline` with the builder's separate HOME/cache. A missing or incomplete
cache causes failure. Operators must stage verified lockfile dependencies in each
account's cache during a separate authorized connected preparation step; do not
copy secret-bearing npm configuration, disable integrity checks, or assume the two
users share a cache. Dependencies with install scripts needing additional downloads
may require separately staged verified artifacts. This is not proven on VPS yet.

Docker builds now use `--pull=false --network=none`. Cached build layers and local
base images may permit an offline build; cold builds needing npm artifacts fail.
`--network=none` constrains RUN steps, not Docker daemon registry resolution. Base
image availability, approved identity/digest and daemon egress policy must be
verified on VPS; these flags alone do not establish a fully air-gapped build.
There is no dependency-verification bypass or Docker cleanup. A complete cold
Docker offline dependency staging pipeline is not implemented in this change.

The installed VPS scripts still have unknown differences. Keep compatibility
approval false until their CLIs and behavior match this pipeline, including
manifest handling and protected snapshot copying. Install/review the supporting
root-owned `snapshot_contract.py` module alongside any reviewed activation helper;
its hash is also required by the coordinator. Do not replace existing VPS helpers
automatically. Obtain their full source, actual prepare arguments, import dependencies,
cache paths and network sandbox policy before choosing a reviewed update/adapter.

### Safe manual installation after review

1. Leave `/home/souqak/deploy/souqak` unchanged, including its branch, untracked files,
   `.env`, Compose files and prior releases. Establish backend identity independently
   of the frontend `52908a2...` marker and checkout `6ef44ad...`. Verify recoverable
   backups, existing data mounts, protected state and compatibility of rollback.
2. Review this coordinator from a pinned commit. An administrator may copy the
   reviewed file to `/usr/local/libexec/souqak/souqak-deploy-candidate` with root
   ownership and mode 0755; protect all parent directories. Never execute the
   checkout copy as root. No existing helper is overwritten.
3. Only after source comparison and offline-build acceptance, create
   `/var/lib/souqak-deploy/unified-contract.json`, root-owned mode 0600, using
   `deploy/unified-contract.example.json` as the field schema. Record the exact
   installed helper SHA-256 values and approve each reviewed semantic property.
   Protect the state directory as root-owned mode 0700. The example deliberately
   cannot authorize deployment.
4. Run the protected candidate's `check` command. Failure blocks installation.
   After successful verification, install that exact reviewed candidate at
   `/usr/local/sbin/souqak-deploy`, root-owned mode 0755, without replacing an
   existing executable blindly. Run `sudo souqak-deploy check` again.
5. Validate a narrowly scoped sudoers fragment with `visudo -cf` before enabling:

   ```sudoers
   souqak ALL=(root) /usr/local/sbin/souqak-deploy all, /usr/local/sbin/souqak-deploy status, /usr/local/sbin/souqak-deploy check
   ```

   Keep password authentication. Do not grant shell, Python, Docker or wildcard
   argument access. Existing sudo-group membership grants wider rights and needs
   separate review while preserving an independent administrator recovery path.
6. Exercise staging activation, simulated failures, contention, changed main,
   stale snapshot, and explicit existing-helper rollback before the first supervised
   production use. Database rollback is not performed. In-flight requests/jobs may
   be interrupted; retain the previous image/container/frontend and use a maintenance
   window. A process/host crash can require manual recovery through existing state;
   do not remove a lock file or retry blindly to bypass an incomplete activation.

Local isolated checks (temporary fixtures only; no production tools):

```sh
python3 -m unittest discover -s deploy/tests -p 'test_*.py'
node --test deploy/tests/*.test.mjs
```

## VPS discovery update: existing `souqak-update` takes priority

The VPS already has a root-owned `/usr/local/sbin/souqak-update` (reported size
3266 bytes, with three November 10 backups). Do not install a parallel coordinator
or overwrite that command on the basis of this branch. The coordinator here remains
a tested reference implementation pending comparison. The example contract defaults
to `pending-souqak-update-review`, which blocks activation. Review the sanitized source
of the current command and differences from backups before selecting an adapter,
including interpreter, arguments, SHA selection, subprocesses, privilege drops,
confirmation, lock paths, snapshot/cache passing and recovery behavior. A redacted
copy establishes behavior for review; the exact installed file's SHA-256 is needed
for deployment identity. Do not execute an unknown entrypoint to discover its flags.
The reference direct-helper strategy now also pins the existing entrypoint hash and
requires an explicit coexistence/locking review; no existing-entrypoint invocation
is implemented speculatively.

### Connected npm cache preparation

The reported lack of caches means `npm ci --offline` is expected to fail today.
`deploy/warm-npm-cache.py` is an unprivileged, non-production helper: it copies only
package manifests/lockfiles into temporary directories, populates a designated cache
with `npm ci --ignore-scripts`, verifies cache integrity, then performs normal
`npm ci --offline` including lifecycle scripts. Repository files are not modified.
It refuses root execution and does not invoke Docker or any deployment helper.

Example for a future approved connected preparation machine/account:

```sh
python3 deploy/warm-npm-cache.py --repository /path/to/reviewed-checkout --cache /path/to/account-owned/npm-cache
```

Run for each actual target Node/npm version, CPU architecture and libc/platform;
optional native packages differ between Alpine/musl and Debian/glibc. Run the helper
in an appropriately restricted development account, since offline lifecycle scripts
execute dependency code. Transport only the verified artifact cache, not `.npmrc`,
credentials or unrelated HOME files. Then verify it again as the isolated builder
with networking denied. The helper proves npm's offline install behavior, not
OS-enforced isolation of arbitrary lifecycle scripts. The activation systemd scope
continues to provide that isolation.

The existing `node:20-alpine`, `node:22-bookworm-slim`, and backend `52908a2...` images
are useful prerequisites, not proof of a populated npm or Docker build cache.
A backend runtime image does not necessarily contain npm tarballs, build tools,
or reusable layers for the candidate lockfile. Do not extract unknown dependencies
from it or treat it as the candidate image. Cold offline Docker builds still require
an approved matching artifact/cache staging method; keep the compatibility gate
closed until that target-specific test succeeds.

## Confirmed legacy entrypoint defect: undefined PREPARER

The operator reports the installed `souqak-update` is a 108-line Python script
calling `subprocess.run([sys.executable, str(PREPARER)], check=True)` without defining
`PREPARER`. Treat that entrypoint as unfit for production, including automated use.
Its single-bundle search and lack of a visible global lock also do not satisfy the
new coordinator contract. Do not repair it by guessing a PREPARER path or invoking
its dry-run to discover behavior. No installed file was edited by this change.

The reference compatibility check now statically rejects the confirmed undefined
global even if an approval file contains the matching hash. This is a targeted
symbol-table check, not a complete Python linter or proof of runtime correctness.
The regression fixture reproduces the reported control flow; it is not represented
as the actual VPS source. The three reported helper hashes are recorded separately as observed identities;
approval placeholders intentionally remain invalid. The legacy entrypoint hash is
still required.

`all` never scans prepared directories for a convenient bundle. It passes exactly
`prepared/<pinned SHA>` to the preparer, activation preflight and activation, and
rejects a pre-existing bundle at that exact path (including a dangling symlink).
Other old bundles are ignored. To retry a failed preparation with existing output,
review and preserve it through a separate administrator procedure; the command does
not delete it. Changing main or installed-tool hashes before activation aborts.
The terminal remains attached to the reviewed activator for SHA confirmation and
its existing rollback implementation is retained.

### Installation inventory (candidates, not permission to overwrite production)

| Repository artifact | Intended location / action |
| --- | --- |
| `deploy/admin/souqak-deploy` | Stage as root-owned `/usr/local/libexec/souqak/souqak-deploy-candidate`; final `/usr/local/sbin/souqak-deploy` only if the reviewed integration chooses this entrypoint |
| `deploy/admin/snapshot_contract.py` | Root-owned `/usr/local/libexec/souqak/snapshot_contract.py`, after comparison and approval of the consuming helper |
| `deploy/unified-contract.example.json` | Template for root-owned mode-0600 `/var/lib/souqak-deploy/unified-contract.json`; never enable placeholder hashes |
| `deploy/admin/activate-release.py` | Reviewable candidate/diff only; do not copy over the 1504-line installed helper or lose VPS-specific fixes |
| `deploy/prepare-release.py` | Reviewable preparation implementation; **not** a drop-in `prepare-update.py` replacement because its CLI is different |
| `deploy/warm-npm-cache.py` | Unprivileged cache staging tool on a connected preparation host/account; not a privileged production entrypoint |
| Frontend exporter/validator/loader files | Part of the exact reviewed release source; no direct copying into the live served frontend |

Safe subsequent operator procedure:

1. Capture the full sanitized source of current `souqak-update`, `prepare-update.py`,
   `activate-release.py`, their imported local modules, and their exact on-host
   SHA-256 values. Compare the three November 10 backups as evidence, without
   restoring any of them merely because they are older.
2. Before any approved replacement, create a **new** dated root-only backup
   directory under a protected `/var/backups/souqak-tools/`. Copy each affected
   existing administrative tool and applicable sudoers fragment with ownership,
   mode and timestamps preserved. Record SHA-256 for originals and copies and
   verify matching bytes. Preserve previous backup directories. Do not copy or
   display production `.env` as part of this tool backup.
3. Stage approved candidates in a distinct root-owned, non-writable directory,
   not in the souqak-owned checkout. Compare actual prepare arguments, bundle
   schema, snapshot transport, cache users/paths, internal locks and recovery
   records. Decide whether to fix the existing `souqak-update` or use the new
   coordinator. An adapter for the former cannot be approved without its source.
4. Keep `approved=false` until the undefined variable is repaired in a reviewed
   candidate, interfaces match, offline build acceptance passes, and rollback has
   been exercised in staging. Keep the known-broken legacy entrypoint out of
   automated operation. A candidate check that fails is a stop, not a bypass flag.
5. After separate approval, install only the reviewed changed artifacts through
   same-directory temporary files and atomic replacement, preserving root ownership
   and executable modes. Validate sudoers with visudo and retain password-based
   administrative recovery. Do not update helpers from a writable checkout by
   executing repository scripts as root. Do not overwrite the existing entrypoint
   merely to make the compatibility check pass.
6. Recheck final installed hashes and protection, then run only the reviewed
   non-activating checks first. If helper installation fails, restore the verified
   prior tool bytes and permissions; that restoration does not repair the known
   PREPARER bug and does not authorize use of the old updater. Application rollback
   is a separate operation, retaining data and prior application artifacts.

No VPS installation, service operation, database access, deployment, or merge is
performed by these instructions or the isolated tests.

## Observed VPS identities and enforced pre-install gate

`unified-contract.example.json` now records the operator-supplied SHA-256 values of
`prepare-update.py`, `activate-release.py`, and `check-update.py` under
`observed_vps.tool_sha256`, and the reported running backend image tag. These are
inventory evidence only. They are deliberately separate from approved `sha256`
entries; `approved=false`, all semantic reviews false, and the pending repair
strategy remain unchanged. A tag identifies the reported release but is not an
immutable image digest or evidence of database compatibility.

The coordinator also requires a reviewed hash of `check-update.py`, even though it
does not execute that unknown interface. Unknown additional imported helper files
must be inventoried and reviewed before any semantic approval.

### Exact additional VPS material needed

Obtain these through an authorized read-only collection, without executing them:

1. Full sanitized source of `/usr/local/sbin/souqak-update`, plus its actual on-host
   SHA-256 and ownership/mode. The PREPARER defect is confirmed, but the complete
   surrounding flow is not in this repository. Include its three backup sources
   or a full diff against each, and their hashes; do not restore them automatically.
2. Full sanitized source of `/usr/local/libexec/souqak/prepare-update.py`,
   `activate-release.py`, and `check-update.py`. Their supplied hashes are known;
   source, actual prepare arguments and bundle construction/selection remain needed.
3. Every local Python module or sourced shell file imported/invoked by those four
   entrypoints, recursively: source, absolute path, hash, ownership/mode. Derive this
   inventory from their source; exact additional filenames cannot honestly be
   enumerated until it is received. Include any referenced installer/adapter.
4. Applicable sudoers fragments and systemd unit/drop-in definitions used for build
   isolation, with secrets removed; include referenced non-secret build configuration
   and configured paths. Supply variable names/presence only, never `.env` values,
   npm tokens, Docker credentials, private keys or production database data.
5. Sanitized schema/fields of `/var/lib/souqak-deploy/last-activation.json`, and a
   representative existing prepared `manifest.json` and `readiness.txt` (no application
   payload or real SEO snapshot required). Include symlink targets and ownership of
   protected state/releases/build directories, and the internal lock paths.
6. Non-secret Node/npm versions for both accounts, architecture/libc, intended cache
   paths and permissions, and the image IDs/digests for the two local Node images
   and the backend image. These are acceptance evidence, not permission to build.

### Staged installation after compatibility acceptance

`deploy/admin/install-souqak-deploy.py` is an optional installer for the reference
coordinator, **not** an upgrade mechanism for the existing `souqak-update`.
It refuses unknown arguments, requires protected root-owned script/candidate paths,
loads only that protected candidate, and invokes its compatibility gate before any
output file is created. `--check` writes no destination. Final publication is atomic
and exclusive; an existing destination, including a dangling symlink, is refused.
It does not install helpers, create approval, run deployment, or modify sudoers.

After receiving/reviewing the files above and choosing the entrypoint strategy:

1. Preserve verified root-only dated backups of all affected installed scripts and
   sudoers files; record original and backup hashes/modes. Retain older backups.
2. Stage this reviewed installer and coordinator candidate under protected
   `/usr/local/libexec/souqak/`, root-owned; the candidate filename must be
   `souqak-deploy-candidate`. Never run their checkout copies as root.
3. Resolve CLI/snapshot/offline-cache incompatibilities in reviewed staged tools.
   Keep approval false while the legacy undefined PREPARER remains. Only after
   semantic acceptance, record exact approved installed hashes, including required
   helper modules and entrypoint, in the protected mode-0600 contract.
4. From an administrative session run the protected installer's `--check`. If it
   fails, stop. If the reference coordinator is the approved strategy, invoke the
   same protected installer without arguments to install the previously absent
   `/usr/local/sbin/souqak-deploy`. It never replaces `souqak-update` or existing
   activation/preparation helpers. If a repaired existing entrypoint is preferred,
   do not run this installer; its adapter still needs implementation and tests.
5. Recheck installed hashes and run only `souqak-deploy check` and `status` first.
   Review narrow password-based sudoers separately with visudo. Deployment and the
   staging activation/rollback acceptance require a separate authorized operation.

The installation gate is mandatory for this provided installer. Manual root file
copying can bypass software gates; it is not an approved installation procedure.

A standalone candidate for the existing updater, preserving its CLI without
replacing its three helpers, is documented in
[souqak-update-candidate.md](souqak-update-candidate.md). It is separately gated;
this does not approve installation of either coordinator.
