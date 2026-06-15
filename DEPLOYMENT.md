# Deployment Guide

## Recommended Setup

- Frontend: Vercel
- Backend API: Render
- Database: Render MongoDB or MongoDB Atlas

## Vercel Frontend

1. Import the repository into Vercel.
2. Set the project root directory to `frontend`.
3. Configure environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SOCKET_URL`
4. Deploy.

## Render Backend

1. Import the repository into Render.
2. Use [render.yaml](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\render.yaml) or create a web service manually.
3. Set the root directory to `backend` if you are not using the blueprint.
4. Confirm environment variables:
   - `CLIENT_URL`
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
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

GitHub Actions CI is configured in [.github/workflows/ci.yml](C:\Users\mithu\OneDrive\Desktop\New%20folder%20(2)\.github\workflows\ci.yml).

- Backend job runs the automated Jest test suite.
- Frontend job performs a production build check.
