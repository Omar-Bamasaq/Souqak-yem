# Wallet-service draft index migration

`src/scripts/migrateWalletServiceDraftIndexes.js` starts in read-only
`--dry-run` mode. It checks the `draftactions` collection's actual indexes,
detects the legacy unique index by its key, uniqueness, and partial filter
(not by an assumed name), compares the two required indexes to the Mongoose
schema, and counts duplicate groups. Comparison preserves compound-key order
and checks all behavior-affecting index options; only server metadata and
MongoDB's deprecated `background` option are ignored. It also reports
incomplete wallet-service drafts whose root `serviceId` is missing or is not
stored as an ObjectId. The report includes index names and specs, not draft
contents or user details.

The migration creates and verifies both new unique indexes before dropping
only the single, exact legacy index it detected. It never writes documents.
If creation or verification fails, the old index is retained. The migration
requires explicit target and operator confirmation; it also requires
`rs0`. The connection URI is read only from
`DRAFT_INDEX_MIGRATION_URI` and is never printed. Use a dedicated read-only
account for dry-run and an approved index-management account for apply or
rollback; the tool never falls back to the application's `MONGODB_URI`.

## Production procedure (do not run without separate approval)

Use the stack's reviewed Compose files and the exact backend image intended
for the rollout. First deliver the script and matching `DraftAction.js` model
to that image. Set `DRAFT_INDEX_MIGRATION_DATABASE=suqaq` in the command
environment and provide `DRAFT_INDEX_MIGRATION_URI` through a protected env
file. For inspection, that URI must use an account with read-only access to
`draftactions` and permission to list indexes and aggregate:

```bash
docker compose run --rm --no-deps --pull never \
  --env-from-file /home/souqak/.config/souqak/draft-index-readonly.env \
  -e DRAFT_INDEX_MIGRATION_DATABASE=suqaq \
  backend node /app/src/scripts/migrateWalletServiceDraftIndexes.js --dry-run
```

Review the report and confirm the legacy candidate's full key, `unique`, and
partial-filter specification from `listIndexes`. Resolve any duplicate groups
or unexpected unique indexes before proceeding.

The backend has a targeted write-pause switch. The deployed backend build must
include `src/services/draftActionWritePause.js` and its guards in the draft,
wallet-service, store, and purchase-request routes. Set
`DRAFT_ACTIONS_WRITES_PAUSED=YES` in the Compose configuration actually passed
to every backend writer, then recreate only the backend service with the
already selected image (no build, pull, or dependency restart):

```bash
docker compose up -d --no-deps --no-build --force-recreate backend
```

Verify the pause flag in each backend container without printing its
environment or other secrets:

```bash
set -eu
containers="$(docker compose ps -q backend)"
test -n "$containers"
for container_id in $containers; do
  docker exec "$container_id" node -e \
    'if (process.env.DRAFT_ACTIONS_WRITES_PAUSED !== "YES") process.exit(1)'
done
```

While paused, draft create/update/delete requests and final catalog-order
submissions linked to drafts return HTTP 503. The store-creation and
purchase-request submission endpoints also return HTTP 503 for all new
submissions during the maintenance window, so they cannot complete a draft
after the pause begins; this briefly pauses those submission flows but not
their reads. Unrelated services continue. Wait for old requests to finish and
ensure no older backend replica, worker, or direct database writer can write
`draftactions`. MongoDB and the `rs0` replica set remain running. Then run the
migration as a one-off backend container with dependencies disabled; do not
start other services:

```bash
docker compose run --rm --no-deps --pull never \
  --env-from-file /home/souqak/.config/souqak/draft-index-admin.env \
  -e DRAFT_INDEX_MIGRATION_DATABASE=suqaq \
  -e DRAFT_INDEX_MIGRATION_APPROVED=YES \
  -e DRAFT_ACTIONS_WRITES_PAUSED=YES \
  backend node /app/src/scripts/migrateWalletServiceDraftIndexes.js \
  --apply --confirm-writes-paused
```

Only after a successful result should the reviewed backend be started again.
If the command fails before dropping the legacy index, keep the pause enabled,
inspect the reported actual indexes, and retry after correcting the cause. A
partially created new index is safe and the command can be rerun. After
verification, remove the pause flag and recreate only the backend service again.

## Rollback

Enable the targeted pause and recreate every backend writer as described
above, then run `--rollback` with the same protected admin env file, explicit
target, approval, and write-pause confirmations. Rollback first checks that
the current incomplete drafts do not violate the old one-per-user-and-type
rule, creates and verifies the legacy unique index, and only then removes the
exact new indexes. It never removes or changes documents.

If multiple incomplete wallet-service drafts for different services now exist
for the same user, the old index cannot be restored without changing product
data. In that case rollback stops and preserves the new indexes; do not delete
or alter drafts to force rollback. Keep the current application and indexes,
or wait until normal completion/expiry reduces the conflicts and reassess.

The commands above are examples only. Verify Compose files, project name,
backend service name, and selected image at execution time. Do not put
credentials in command arguments or print environment values.

Run isolated tests locally with:

```powershell
node --test .\test\migrateWalletServiceDraftIndexes.test.js
```
