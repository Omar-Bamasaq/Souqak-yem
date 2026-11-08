# Yemen Market – Full‑Stack Marketplace

## Overview
- Roles: Admin, Seller, Buyer
- Only approved products are publicly visible
- New products default to Pending
- Admin approves/rejects products

## Tech Stack
- Backend: Node.js, Express, MongoDB, Mongoose, JWT
- Frontend: React + Vite, React Router, Axios

## Project Structure
```
new_project/
  backend/
    src/
      models/
      routes/
      middleware/
      index.js
    package.json
    .env.example
  frontend/
    src/
    package.json
    vite.config.js
    index.html
```

## Setup
1. Prerequisites: Node.js 18+, npm, MongoDB running locally
2. Environment:
   - Copy backend/.env.example to backend/.env
   - Set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, PORT
   - Application startup does not create MongoDB indexes automatically. Review `npm run prelaunch:indexes:plan`; `npm run prelaunch:indexes:apply` is a separate operation for a new empty database. Populated databases require a separately approved migration (see `backend/scripts/MIGRATE_WALLET_SERVICE_DRAFT_INDEXES.md`).
3. Install dependencies:
   - Backend: `cd backend && npm install`
   - Frontend: `cd frontend && npm install`
4. Run:
   - Start API: `npm run dev` in backend (http://localhost:5000)
   - Start web: `npm run dev` in frontend (http://localhost:5173)

## Authentication
- Register as Buyer or Seller
- Login returns JWT and user payload
- Requests with Authorization: Bearer <token>

## API Highlights
- POST /api/auth/register
- POST /api/auth/login
- GET /api/products (approved, supports q/category/location)
- POST /api/products (seller)
- GET /api/products/mine (seller)
- GET /api/products/:id
- GET /api/admin/products (admin)
- PATCH /api/admin/products/:id/status (admin)
- GET /api/admin/users (admin), DELETE /api/admin/users/:id
- GET /api/admin/stats (admin)
- POST /api/messages (buyer)
- GET /api/messages/product/:id (seller)

## Admin User
- For a new prelaunch database, use the explicit `backend` command `npm run prelaunch:admin`.
- Supply `PRELAUNCH_MONGODB_URI`, `PRELAUNCH_DATABASE_NAME`, `PRELAUNCH_ADMIN_NAME`,
  `PRELAUNCH_ADMIN_EMAIL`, and `PRELAUNCH_ADMIN_PASSWORD` through a secure environment
  or secret manager, and set `PRELAUNCH_ADMIN_APPROVED=YES` for this operation; do not
  put credentials in command arguments, project files, or Git. Missing approval is
  rejected before connecting or performing model operations.
- The setup scripts accept only a loopback MongoDB URI with an explicit non-default port
  and a matching database name beginning `souqak_prelaunch_`. Reference-data scripts also
  require `PRELAUNCH_REFERENCE_DATA_APPROVED=YES`.
- The admin command refuses to run if an administrator or matching email already exists;
  it never changes an existing account. The category and location commands only upsert
  their defined records and do not delete unspecified records.
- The admin's `isInitialAdmin` unique partial index prevents concurrent bootstrap runs
  from creating more than one initial administrator without restricting later admins.
- Review the reference content and owner-approved system settings before initialization.
  `prelaunch:settings` requires an approved JSON file outside the repository and an
  explicit `PRELAUNCH_SYSTEM_SETTINGS_APPROVED=YES`; it refuses to modify an existing
  settings document. Commercial settings and exchange rates have no implicit launch
  approval. The owner-approved file must explicitly provide moderation mode/delay and
  keyword policy, identity threshold, every supported exchange rate and buy/sell pair
  plus its update timestamp, welcome-promotion settings, brokerage enablement, and the
  full referral policy. Only singleton identity, counters, empty promotion statistics,
  and the unset updater are initialized technically by the script. `SystemSettings.getSettings()`
  no longer creates undocumented defaults when the collection is empty.
- `prelaunch:indexes:plan` lists indexes for all registered application models without
  connecting to MongoDB. After reviewing the plan and confirming an empty isolated
  prelaunch database, `prelaunch:indexes:apply` requires
  `PRELAUNCH_INDEXES_APPROVED=YES` and refuses to create indexes if any collection has
  documents. It applies the plan's explicit specifications using the MongoDB driver's
  `collection.createIndexes()` API; it never uses `syncIndexes()` or drops indexes.
- After applying indexes, `prelaunch:indexes:verify` compares the planned definitions
  with the target database's `listIndexes()` output. It requires the same explicit
  loopback target variables plus `PRELAUNCH_INDEXES_VERIFY_APPROVED=YES`, performs
  read-only inspection, writes a JSON result to stdout, and exits unsuccessfully if
  collections or indexes are missing, unexpected, or differ. It does not create,
  modify, or delete indexes.
- These are manual bootstrap commands, not part of backend startup. Their execution
  order and database isolation must be reviewed before use.

## Future Extensions
- File upload for images
- Subscriptions, ads, payments, notifications
