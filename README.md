# CivicTrack

CivicTrack is a production-oriented full-stack platform for reporting, managing, and resolving civic issues such as potholes, garbage dumps, water leakage, broken streetlights, and road damage.

## System Architecture

### Clients
- Citizen web app built with Next.js, React, and Tailwind CSS
- Admin dashboard built within the same frontend codebase but isolated behind admin-only routes
- Field worker task interface built within the same frontend codebase but isolated behind worker-only routes
- Android-ready mobile app workspace built with Expo and React Native

### Backend Services
- Express.js REST API for authentication, issue management, assignment workflows, comments, and notifications
- Socket.io server for real-time status updates, assignments, and notifications
- AI service layer for image analysis, smart categorization, duplicate detection, and severity prediction
- File upload pipeline for issue images and proof-of-resolution images

### Data Layer
- Supabase Postgres with tables for users, issues, issue_supporters, assignments, comments, and notifications (`backend/supabase/schema.sql`)
- Longitude/latitude columns with Haversine filtering in JS for nearby issue lookup and duplicate detection

### Security Model
- JWT authentication for all protected APIs
- Role-based access control for `user`, `admin`, and `worker`
- Separate frontend route groups and backend route middleware to ensure users never access admin screens or admin APIs

## Request Flow

1. Citizen registers or logs in.
2. Citizen submits an issue with image, description, category, and GPS coordinates.
3. Backend enriches the issue through AI services and stores it in Supabase Postgres.
4. Admin reviews the report, verifies it, and assigns it to a field worker.
5. Field worker receives the assignment, navigates to the issue, uploads proof, and marks it resolved.
6. Socket.io broadcasts status changes to subscribed clients and creates notifications.

## Folder Structure

```text
CivicTrack/
  backend/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
    utils/
    server.js
    app.js
    package.json
    .env.example
  frontend/
    components/
    pages/
    services/
    utils/
    README.md
  mobile/
    app/
    src/
    package.json
    README.md
```

## Database Design

### Users
- `name`
- `email`
- `password`
- `role` (`user`, `admin`, `worker`)
- `phone`
- `avatar`

### Issues
- `title`
- `description`
- `image`
- `category`
- `severity`
- `location` (GeoJSON Point)
- `address`
- `status`
- `reportedBy`
- `assignedWorker`
- `aiAnalysis`

### Assignments
- `issueId`
- `workerId`
- `assignedBy`
- `notes`
- `status`

### Comments
- `issueId`
- `userId`
- `message`

### Notifications
- `userId`
- `message`
- `status`
- `type`

## Initial API Surface

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### User APIs
- `POST /api/issues`
- `GET /api/issues/my`
- `GET /api/issues/:id`

### Admin APIs
- `GET /api/admin/issues`
- `PUT /api/admin/assign`
- `PUT /api/admin/status`

### Worker APIs
- `GET /api/worker/tasks`
- `PUT /api/worker/complete`

## Next Build Steps

## Implemented Modules

### Backend
- JWT authentication with citizen registration and portal-aware login
- Role-protected APIs for citizen, admin, and worker operations
- Issue reporting, issue tracking, comments, notifications, and public issue map feeds
- Admin dashboard stats, status updates, and worker assignment workflow
- Worker task listing and completion with proof image upload
- Socket.io user-room setup for real-time events
- AI service abstraction with fallback heuristics for category, severity, and duplicate detection

### Frontend
- Next.js app with Tailwind styling and separated role experiences
- Citizen pages for registration, login, dashboard, issue reporting, issue tracking, notifications, profile, and map
- Admin dashboard for issue review, worker assignment, and status management
- Worker task interface with navigation handoff and proof upload
- Shared auth context, protected routes, API clients, and UI components

### Mobile
- Expo Router mobile app starter prepared for Android and future iOS support
- Role-aware mobile entry points for citizen, admin, and worker
- Shared REST API integration pattern aligned with the existing backend
- Async storage based token/session persistence for mobile auth

## Run Locally

### Backend
1. Run `backend/supabase/schema.sql` once in the Supabase SQL Editor
2. Copy `backend/.env.example` to `backend/.env` and set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
3. Install dependencies inside `backend`
4. Run `npm run dev`
5. Optional: seed default admin and worker accounts with `npm run seed:users`
6. Run automated tests with `npm test` (uses in-memory store, no Supabase needed)

### Frontend
1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Install dependencies inside `frontend`
3. Run `npm run dev`
4. Run a production verification build with `npm run build`

### Mobile
1. Copy `mobile/.env.example` to `mobile/.env`
2. Install dependencies inside `mobile`
3. Run `npm run start`
4. Use Android emulator or Expo Go for device testing

## Notes

- Image uploads are currently handled as base64 payloads to keep the initial implementation self-contained. In production, move these to cloud object storage.
- If Cloudinary credentials are configured, uploaded issue and resolution images are automatically persisted as hosted URLs.
- The AI layer supports an `openai` provider through environment variables and safely falls back to deterministic heuristics if credentials are missing or the request fails.
- The web map uses Leaflet with OpenStreetMap tiles, so the frontend issue/admin maps work without a Google Maps API key.
- Docker-based local deployment is available through [docker-compose.yml](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\docker-compose.yml).
- Backend automated tests cover registration, login restrictions, citizen issue creation, admin route protection, and worker account creation.

## Deployment

- Deployment guide: [DEPLOYMENT.md](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\DEPLOYMENT.md)
- Render blueprint: [render.yaml](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\render.yaml)
- Vercel frontend config: [frontend/vercel.json](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\frontend\vercel.json)
- CI pipeline: [.github/workflows/ci.yml](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\.github\workflows\ci.yml)
