# CivicTrack Mobile

This workspace prepares CivicTrack for Android and future iOS support using Expo and React Native.

## Why this structure

- Keeps the existing `backend/` fully shared between web and mobile
- Preserves the current `frontend/` Next.js app for desktop and browser usage
- Adds a dedicated `mobile/` client for Android-friendly capabilities such as camera, GPS, and push-ready architecture

## Mobile Architecture

- `app/`: Expo Router screens for role-based mobile navigation
- `src/context/`: shared auth and session state
- `src/services/`: API, auth, issue, admin, and worker clients
- `src/config/`: runtime environment handling

## Current starter screens

- `/login`
- `/citizen/dashboard`
- `/admin/dashboard`
- `/worker/tasks`

These are production-minded starter shells connected to the existing backend API.

## Run mobile locally

1. Copy `.env.example` to `.env`
2. Install dependencies in `mobile/`
3. Start Expo

```powershell
cd "C:\Users\mithu\OneDrive\Desktop\New folder (2)\mobile"
npm.cmd install
npm.cmd run start
```

## Android API note

Use `10.0.2.2` instead of `localhost` in Android emulator env values:

- `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api`
- `EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000`

## Next recommended mobile build steps

1. Citizen report flow with camera, GPS, and image upload
2. Worker task completion with proof image capture
3. Admin mobile triage with compact assignment map
4. Push notifications for issue updates and assignments
