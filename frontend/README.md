# Frontend Structure

The frontend is built with Next.js, React, and Tailwind CSS.

## Implemented Areas

- `pages/login/[portal].js`: separate citizen, admin, and worker login interfaces
- `pages/dashboard.js`: citizen reporting overview
- `pages/report.js`: civic issue reporting flow with GPS capture and image upload
- `pages/map.js`: Leaflet/OpenStreetMap marker and cluster view
- `pages/admin/dashboard.js`: admin operations dashboard
- `pages/worker/tasks.js`: field worker task completion interface
- `components/ProtectedRoute.js`: role-based route protection
- `utils/AuthContext.js`: client auth state and socket bootstrap
