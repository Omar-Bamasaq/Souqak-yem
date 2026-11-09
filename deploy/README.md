# Souqak release deployment

`deploy.sh` is a host-side release tool. It fetches `main` into a fresh
temporary checkout and never runs `git pull` or `git reset` in
`/home/souqak/deploy/souqak`. It does not use Docker Compose: the checked-in
Compose file describes a different MongoDB version and volume, and must not
manage the production MongoDB 8 replica set.

This tool has not been run on the VPS. Do not treat it as approved for a live
deployment until every one-time check and release compatibility review below
is complete.

## One-time VPS setup

1. Verify the currently running services without changing them:
   - MongoDB is `souqak-mongo-1`, healthy, on `souqak_default`, and mounts
     `souqak_mongo_data` at `/data/db`.
   - The backend is `souqak-backend`, on `souqak_default`, and binds only
     `127.0.0.1:5000`. It mounts `souqak_uploads_data` at `/app/uploads` and
     `souqak_private_uploads_data` at `/app/private_uploads`.
   - MongoDB is a healthy `rs0` replica set. This tool does not inspect or
     modify replica-set configuration.
2. Verify, without printing or copying the URI, that the hostname in the
   private `MONGODB_URI` is a Docker DNS alias for `souqak-mongo-1` and the URI
   selects `replicaSet=rs0`. Set only that hostname in `MONGODB_URI_HOST`.
3. Keep `/home/souqak/deploy/souqak/.env` outside Git. Set owner to `souqak`
   and permissions to `600`. Preserve all current application settings in
   this same file; it must contain exactly one each of `MONGODB_URI`,
   `JWT_SECRET`, and `JWT_REFRESH_SECRET`. The script passes this file to the
   replacement container without printing or sourcing its values. Keep all
   current application keys and values in that file; do not replace it with a
   minimal template. Compare required runtime settings with the existing
   backend before deployment.
4. Create `/home/souqak/deploy/releases` and
   `/home/souqak/deploy/deploy-state`, owned and writable by `souqak`.
   Install `deploy.sh` at `/home/souqak/deploy/deploy.sh`, and install the
   tracked `deploy/` support files beside it at
   `/home/souqak/deploy/deploy/`. Make the shell script executable. Install
   `/etc/souqak/deploy.conf` from `deploy/deploy.conf.example`; keep it
   root-owned and not group/other-writable. The config has paths and public
   URLs only.
5. **Verify the draft indexes independently.** Deployment does not connect to
   MongoDB to inspect or alter indexes. Before deployment, an authorized
   operator must separately verify on the correct database that:
   - the two required unique indexes and their exact specifications match the
     candidate `DraftAction.js` schema;
   - the old unique `(userId, type)` incomplete-draft index is absent;
   - there are no duplicate draft groups or missing/non-ObjectId wallet
     service IDs that would make the required indexes unsafe.

   The existing migration tool's read-only `--dry-run` report can be reviewed
   as evidence; do not use its apply or rollback mode as part of deployment.
   Record the verified facts, including the key patterns and partial filter
   expressions, using `deploy/draft-index-attestation.example`,
   put the candidate schema's SHA-256 in `SCHEMA_SHA256`, and install the
   result at `/etc/souqak/draft-index-attestation`, root-owned and readable by
   `souqak` but not writable by group/other. Do not create the attestation
   from the example alone. It expires after seven days and is bound to the
   exact candidate schema file; a changed schema requires a new independent
   verification. Missing, stale, malformed, or mismatched evidence stops
   deployment before service activation. No index is automatically created,
   dropped, or migrated.
6. **Transition Nginx once without losing the existing frontend.** Verify
   that `/home/souqak/deploy/releases/wallet-drafts-20261108/frontend/dist`
   is the currently served frontend and that it contains the expected
   `index.html`, `sitemap.xml`, and `robots.txt`. If the baseline does not
   exist, copy it without overwriting the original:

   ```sh
   source=/home/souqak/deploy/releases/wallet-drafts-20261108/frontend/dist
   baseline=/home/souqak/deploy/releases/legacy-baseline-20261108/frontend/dist
   test -d "$source" && test ! -e "$baseline"
   install -d "$baseline"
   cp -a "$source/." "$baseline/"
   printf '%s\n' legacy-baseline-20261108 > "$baseline/souqak-release.txt"
   ln -s "$baseline" /home/souqak/deploy/current-frontend
   ```

   If the baseline or link already exists, do not overwrite it; inspect and
   verify it first. Update only the Nginx frontend `root` to
   `/home/souqak/deploy/current-frontend`, preserving API, WebSocket, TLS,
   caching, and security directives. Before reload, run `nginx -t`, verify
   the root and proxy directives, reload Nginx, and check the site. Keep the
   original `wallet-drafts-20261108` directory unchanged; the baseline copy
   is the rollback target for the first release.
7. Confirm that the deployment user can run Docker and has narrowly scoped,
   non-interactive permission for `nginx -t`, `nginx -T`, and
   `systemctl reload nginx`. The script checks Nginx config and reload
   permission before stopping Backend. Install Git, Bash, Node.js/npm, curl,
   `flock`, and GNU core utilities including `stat`, `realpath`, and
   `mv -T`. Run as `souqak`, never as root.

## Normal update

After review and merge to GitHub `main`, run:

```sh
cd /home/souqak/deploy && ./deploy.sh
```

The script requires the operator to confirm the full commit SHA before
installing dependencies or building. It checks the source-level multiservice
draft fix and tests, then verifies the independent index attestation against
the candidate schema hash. Backend tests run with database and migration
variables unset. Frontend tests run locally. The production frontend build
clears inherited maintenance/prerender-disable flags, runs the normal Vite +
prerender pipeline, and validates all required static routes, every sitemap
target, `robots.txt`, and a generated route manifest before the release can be
activated. That prerender build fetches public data from configured
`VITE_API_URL`; the local deployment tests do not contact that API.

Backend image tags use the full commit SHA. A previously completed release or
image can be reused only when its repository commit, release marker, SEO
outputs, and source-commit image label match. Incomplete or mismatched
leftovers are preserved and cause a fail-closed error; the tool never deletes
an active release, an image that may be in use, or application data to make a
retry pass.

Before activation, the script verifies the current backend health, production
network and named image-upload volumes, Nginx config and permissions, the
managed frontend symlink target, and its release marker. It stops the existing
backend before starting the replacement; **there is an API interruption**.
There is no zero-downtime claim or parallel-backend mode. The old process may
have in-flight HTTP/WebSocket work or scheduled operations when stopped; the
application currently has periodic background jobs and does not provide a
verified graceful-drain protocol. The operator must accept this risk and
choose a maintenance window. The script does not run two backend versions
concurrently against production data.

The new backend uses the existing `.env`, `souqak_default` network, and named
uploads volumes. MongoDB remains a separately running service and its volume
is only inspected, not mounted into, restarted, recreated, or modified by this
script. The new backend is health-checked before the frontend link is changed.
The symlink switch is atomic, then Nginx is tested/reloaded and both services
are checked. These steps are not one atomic transaction.

## Rollback

Run `cd /home/souqak/deploy && ./deploy.sh --rollback` and confirm the recorded
release SHA. The previous backend container is retained stopped and its
frontend target remains in the releases directory. Rollback restores the
previous backend and symlink, reloads Nginx, and checks health. A failed
deployment attempts the same application-only restoration.

Rollback never runs a database down-migration or changes, removes, or recreates
MongoDB or uploads volumes. If Docker, Nginx, or health checks prevent
restoration, the script reports failure and preserves available containers and
release directories for manual recovery; it cannot guarantee service
availability when the host itself refuses recovery operations.

## Schema and data compatibility

The deployment has no seed, migration, import, or export step. Mongoose
automatic index creation is disabled, and the script never invokes Docker
Compose, `mongosh`, or MongoDB migration commands. The attestation is an
external gate, not a migration mechanism. Application code can still write
data after startup; review the release for backward compatibility with the
currently served frontend and retained backend before confirming its SHA.
If compatibility is uncertain, do not deploy.

## Local checks

With Bash and Node.js installed, run:

```sh
bash -n deploy.sh
node --test deploy/tests/*.test.mjs
cd frontend && node --test
```

`--dry-run` loads only the non-secret deploy config and prints the plan. It
does not check the attestation or contact GitHub, Docker, Nginx, MongoDB, or
the API, and it does not create directories or locks. It is not a production
readiness check.
