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
   - Set MONGODB_URI, JWT_SECRET, PORT
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
- Create one manually in MongoDB or update an existing user's role to "admin".
  Example update:
  - Find the user document and set `role: "admin"`.

## Future Extensions
- File upload for images
- Subscriptions, ads, payments, notifications
