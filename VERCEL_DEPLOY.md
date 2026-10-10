# Vercel Deploy Checklist (CivicTrack)

## What was verified
- `frontend`: `npm run build` passes (Next 16, Pages Router, 16 static routes).
- `backend`: `npm test` passes (7/7 tests).
- Leaflet map is already SSR-safe (`dynamic(..., { ssr: false })` in `components/MapView.js`).

## What was fixed for Vercel
1. `frontend/vercel.json` — explicit Next.js build/install commands.
2. `frontend/package.json` — added `engines: node >=20 <25` so Vercel uses Node 20+.
3. `frontend/next.config.js` — uses default `.next` output directory (Vercel requires it; custom `distDir` caused "output directory not found").
4. `.vercelignore` (repo root) — excludes backend/mobile/node_modules/caches to keep Vercel uploads fast.

## IMPORTANT: Database is now Supabase Postgres
This project was migrated from MongoDB/Mongoose to **Supabase Postgres**:
- `backend/config/supabase.js` creates the client (`SUPABASE_URL` + service-role key)
- Tables live in `backend/supabase/schema.sql` — run it once in the Supabase SQL Editor
- ObjectIds became UUIDs; every API object carries both `id` and `_id` so the frontend keeps working
- Geo queries use Haversine filtering in JS (no PostGIS required)
- Tests run against an in-memory store, so `npm test` needs no Supabase connection

Your project: `https://fkmocqvsvisrkfgqpcab.supabase.co`
You still need the **service_role key** (Settings -> API) for the backend:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

## How to deploy (correct split)
Vercel can only host the **frontend**. Backend needs a long-running host (Render/Railway) because of Express + Socket.io.

### 1. Backend -> Render (or Railway)
- Root Directory: `backend`
- Build: `npm install`, Start: `npm start`
- Health check: `/api/health`
- Env vars:
  - `NODE_ENV=production`
  - `SUPABASE_URL=https://fkmocqvsvisrkfgqpcab.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY=<service_role key>`
  - `SUPABASE_ANON_KEY=<anon/publishable key>`
  - `CLIENT_URL=https://<your-frontend>.vercel.app`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET` (long random)
  - `ACCESS_TOKEN_EXPIRES_IN=15m`, `REFRESH_TOKEN_EXPIRES_IN=7d`, `COOKIE_SECURE=true`
  - Optional: `AI_PROVIDER`, `OPENAI_API_KEY`, Cloudinary vars

### 2. Frontend -> Vercel
- Import repo, set **Root Directory = `frontend`**
- Framework: Next.js (auto-detected), Build: `npm run build`
- Env vars:
  - `NEXT_PUBLIC_API_URL=https://<your-backend>.onrender.com/api`
  - `NEXT_PUBLIC_SOCKET_URL=https://<your-backend>.onrender.com`
- Deploy. No Google Maps key needed (Leaflet + OSM).

## Common Vercel errors avoided
- `distDir` mismatch: fixed in Dockerfile.
- Leaflet `window is not defined`: already handled via `ssr: false`.
- Node version drift: pinned via `engines`.
- Monorepo uploading backend/mobile: handled via `.vercelignore` + Root Directory setting.
