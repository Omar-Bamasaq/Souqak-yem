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
