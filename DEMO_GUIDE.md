# CivicTrack Demo Guide

## Demo Goal

Show the full CivicTrack workflow across:

- Citizen reporting
- Admin triage and assignment
- Field worker completion
- AI-assisted analysis
- Map and analytics views

## Startup Order

### 1. Start MongoDB

Make sure your local MongoDB service is running before anything else.

### 2. Start Backend

```powershell
cd "C:\Users\mithu\OneDrive\Desktop\New folder (2)\backend"
node server.js
```

Expected output:

- `MongoDB connected`
- `Server running on port 5000`

### 3. Start Frontend

```powershell
cd "C:\Users\mithu\OneDrive\Desktop\New folder (2)\frontend"
npm.cmd run dev
```

Open:

- `http://localhost:3000`

### 4. Optional Mobile Demo

```powershell
cd "C:\Users\mithu\OneDrive\Desktop\New folder (2)\mobile"
npm.cmd run start
```

## Required Env Files

### Backend

Use:

- `backend/.env`

Minimum values:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/civictrack
JWT_SECRET=dev-super-secret-key
JWT_REFRESH_SECRET=dev-refresh-secret-key
COOKIE_SECURE=false
AI_PROVIDER=heuristic
```

### Frontend

Use:

- `frontend/.env.local`

Minimum values:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### Mobile

Use:

- `mobile/.env`

For Android emulator:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

For real Android phone:

- replace `10.0.2.2` with your PC's local IP

## Demo Accounts

### Seed Admin And Worker

```powershell
cd "C:\Users\mithu\OneDrive\Desktop\New folder (2)\backend"
npm.cmd run seed:users
```

### Default Accounts

- Admin: `admin@civictrack.local` / `Admin@123`
- Worker: `worker@civictrack.local` / `Worker@123`

Citizen:

- create from `/register`

## Recommended Demo Flow

### 1. Citizen

- Open `/register`
- Create a citizen account
- Go to `/dashboard`
- Show AI Report Writer
- Open `/report`
- Use:
  - Voice To Report
  - Auto Write
  - Smart Preview
  - GPS capture
  - image upload
- Submit the issue

### 2. Admin

- Log in at `/login/admin`
- Open `/admin/dashboard`
- Show:
  - issue analytics
  - predictive hotspot forecast
  - assignment map
  - smart dispatch suggestions
  - AI department and admin summary
- Verify the issue
- Assign a worker

### 3. Worker

- Log in at `/login/worker`
- Open `/worker/tasks`
- Show:
  - route optimization
  - AI task brief
  - priority and department signal
- Upload proof and mark issue resolved

### 4. Citizen Again

- Open issue detail page
- Show resolved status and notifications

## High-Value Pages To Show

- `/`
- `/register`
- `/login/user`
- `/dashboard`
- `/report`
- `/map`
- `/assistant`
- `/admin/dashboard`
- `/worker/tasks`
- `/profile`

## Verified Health Checks

- Backend auth smoke flow passed
- Citizen profile update passed
- Citizen draft composition passed
- Frontend production build passed
- Mobile TypeScript check passed

## Demo Notes

- Frontend production build is working
- Backend core APIs are working
- Mobile Expo setup is present, but Android emulator requires Android Studio and `adb`
- Expo Go version must match the project SDK version if using a physical phone

## Backup Plan

If mobile setup slows you down tomorrow:

- prioritize the web app demo
- keep mobile as an architecture extension and starter implementation
- show the mobile folder structure and Expo setup only if needed
