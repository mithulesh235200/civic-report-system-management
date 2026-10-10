# Deployment Guide

## Recommended Setup

- Frontend: Vercel (Root Directory = `frontend`)
- Backend API: Render (Root Directory = `backend`)
- Database: Supabase Postgres (see `backend/supabase/schema.sql`)

## Supabase Setup (do this first)

1. Open https://fkmocqvsvisrkfgqpcab.supabase.co -> SQL Editor.
2. Run the full `backend/supabase/schema.sql` file (creates users, issues,
   issue_supporters, assignments, comments, notifications, ai_training_feedback).
3. Go to Project Settings -> API and copy:
   - `Project URL` -> `SUPABASE_URL`
   - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY` (backend, secret)
   - `anon` / publishable key -> `SUPABASE_ANON_KEY` (fallback only)

## Vercel Frontend

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`.
3. Configure environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SOCKET_URL`
4. Deploy.

## Render Backend

1. Import the repository into Render.
2. Use [render.yaml](render.yaml) or create a web service manually.
3. Set the root directory to `backend` if you are not using the blueprint.
4. Confirm environment variables:
   - `CLIENT_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `ACCESS_TOKEN_EXPIRES_IN`
   - `REFRESH_TOKEN_EXPIRES_IN`
   - `COOKIE_SECURE`
   - `AI_PROVIDER`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
5. Deploy the service and confirm `/api/health` responds with success.

## Production Notes

- Set `CLIENT_URL` on the backend to the deployed frontend URL.
- If you enable OpenAI analysis, set `AI_PROVIDER=openai` and provide `OPENAI_API_KEY`.
- Configure Cloudinary env vars so issue images and proof images are stored as hosted URLs instead of base64 payloads.
- The web map uses Leaflet with OpenStreetMap tiles, so no Google Maps API key is required for the frontend map.

## Continuous Integration

GitHub Actions CI is configured in [.github/workflows/ci.yml](.github/workflows/ci.yml).

- Backend job runs the automated Jest test suite (uses in-memory store, no Supabase needed).
- Frontend job performs a production build check.
