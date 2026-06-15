# CivicTrack Mentor Report

## 1. Project Overview

**Project Name:** CivicTrack  
**Type:** Full-stack civic issue reporting and resolution platform  
**Goal:** Help citizens report public issues and help admins/workers verify, assign, and resolve them using maps, AI, and real-time updates.

## 2. Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **Auth:** JWT + refresh session flow
- **Realtime:** Socket.io
- **Map:** Leaflet + OpenStreetMap
- **AI Layer:** OpenAI-ready + strong heuristic fallback

## 3. User Roles

### Citizen
- Register and login
- Report civic issues
- Upload image
- Auto-capture GPS
- Track own issues
- Join duplicate nearby issues
- View notifications
- Use AI assistant and AI report writer

### Admin
- Secure admin login
- View full dashboard
- Verify or reject reports
- Assign workers
- Update issue status
- View map/list issue locations
- Export issues to CSV
- Use AI training center
- Delete resolved issues

### Field Worker
- Worker login
- View assigned tasks
- Use route optimization
- Upload proof image
- Add resolution notes
- Mark issue resolved
- Update availability and live location

## 4. Main Features

- Role-based protected routes
- Citizen issue reporting flow
- Admin issue management dashboard
- Worker task completion workflow
- Notifications system
- Realtime updates with sockets
- Duplicate issue detection
- AI smart preview and auto report writer
- Admin analytics and hotspot forecasting
- Proof verification for resolved issues
- CSV export for reporting

## 5. Core APIs

### Authentication APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `POST /api/auth/logout`

### Citizen / Issue APIs
- `GET /api/issues/map`
- `GET /api/issues/nearby`
- `POST /api/issues/compose`
- `POST /api/issues/analyze`
- `POST /api/issues`
- `GET /api/issues/my`
- `GET /api/issues/:id`
- `POST /api/issues/:id/join`
- `POST /api/issues/:id/comments`

### Admin APIs
- `GET /api/admin/dashboard`
- `GET /api/admin/workers`
- `POST /api/admin/workers`
- `GET /api/admin/issues`
- `GET /api/admin/issues/export`
- `PUT /api/admin/assign`
- `PUT /api/admin/status`
- `DELETE /api/admin/issues/:id`
- `GET /api/admin/ai-training`
- `POST /api/admin/ai-training`

### Worker APIs
- `GET /api/worker/tasks`
- `PUT /api/worker/presence`
- `PUT /api/worker/complete`

### Notification & AI Assistant APIs
- `GET /api/notifications`
- `PUT /api/notifications/:id/read`
- `POST /api/chatbot/message`

## 6. Database Models

### User
- name
- email
- password
- role (`user`, `admin`, `worker`)
- profile details
- worker presence details

### Issue
- title
- description
- image
- category
- severity
- location
- address
- status
- reportedBy
- assignedWorker
- AI analysis fields
- proof image
- resolution notes

### Assignment
- issueId
- workerId
- assignedBy
- status

### Comment
- issueId
- userId
- message

### Notification
- userId
- message
- type
- read status

### AITrainingFeedback
- issueId
- predicted category/severity
- corrected category/severity
- notes
- confidence override
- correctedBy

## 7. AI Models / AI Approach Used

This project does **not train a deep custom model from scratch**.  
Instead, it uses a **hybrid AI architecture**:

### A. Common AI Layer
- Shared civic-domain assistant logic
- Role-aware chatbot behavior
- Issue-aware Q&A using live issue context

### B. Heuristic Civic AI Model
- Keyword-based **category classification**
- Rule-based **severity prediction**
- Duplicate detection using **location + similarity**
- Worker brief generation
- Admin summary generation
- Citizen guidance generation

### C. Learning Strategy Used

#### Supervised-style
- Uses labeled category and severity rules
- Example: pothole, garbage, leakage, streetlight, road damage

#### Unsupervised-style
- Finds complaint patterns and hotspot signals
- Detects unusual or repeated civic disruption clusters

#### Semi-supervised-style
- Combines rule confidence + pattern confidence
- Produces safer decision confidence for real workflows

#### Retrieval-augmented learning
- Uses previous issues and approved admin feedback
- Similar historical issues influence current AI reasoning

### D. Optional Foundation Model
- OpenAI can be connected through environment variables
- If OpenAI is unavailable, the app safely falls back to the internal civic heuristic engine

## 8. How AI Is Working In This Application

### Current Working Style

The AI in CivicTrack works in **two layers**:

#### Layer 1: Internal Civic Intelligence
This is the default built-in AI logic inside the backend.

It performs:
- issue category prediction
- severity prediction
- duplicate detection
- worker brief generation
- admin summary generation
- hotspot prediction
- proof verification support

This layer is written in backend services and works even if no external AI API is connected.

#### Layer 2: OpenAI / ChatGPT Integration
If the project owner adds a valid OpenAI API key in environment variables, CivicTrack can call the OpenAI model.

That means:
- the chatbot can use ChatGPT-style responses
- issue drafting can become more natural
- smart preview can become more context-aware
- image/proof reasoning can be improved

### Is It Using ChatGPT?

**Answer:** Yes, it is **OpenAI-ready**, but it depends on configuration.

- If `AI_PROVIDER=openai` and `OPENAI_API_KEY` are set, the application uses **OpenAI models** for advanced responses.
- If not configured, it uses the internal **heuristic civic AI engine**.

So the system is **hybrid**, not fully dependent on ChatGPT.

### Why This Hybrid Method Was Used

- It keeps the app working even without paid API access
- It avoids total AI failure if the external API is unavailable
- It allows demo use without depending fully on the internet
- It gives predictable civic-domain logic for classification and workflow tasks

### Which Part Uses Which AI

#### Uses Internal Heuristic AI
- category detection
- severity detection
- duplicate risk
- hotspot forecasting
- worker instructions
- admin summaries

#### Uses OpenAI When Configured
- chatbot response generation
- advanced issue writing
- richer issue analysis
- stronger proof verification

### AI Training Meaning In This Project

The project includes an **AI Training Center** for admins.

This does **not** retrain the base ChatGPT model directly.

Instead, it improves CivicTrack by:
- storing corrected category/severity feedback
- saving admin-approved training notes
- reusing corrected historical issues in future analysis
- making later predictions more accurate through retrieval and feedback memory

So the “training” here means **application-level learning and decision improvement**, not large-scale neural model training from scratch.

## 9. AI Features Implemented

- Auto issue writing
- Smart issue preview
- Severity prediction
- Category prediction
- Duplicate detection
- Proof verification
- Hotspot forecasting
- Role-based AI assistant
- AI training center for admin corrections

## 10. Quality / Current Status

- Backend tests are passing
- Frontend production build is passing
- Frontend dependency audit is clean
- Role-based access is enforced
- Web map no longer depends on Google Maps API key
- App is ready for demo/presentation use

## 11. Short Conclusion

CivicTrack is a complete smart civic-management platform with:
- citizen reporting,
- admin control,
- worker execution,
- AI-assisted decision support,
- maps,
- realtime notifications,
- and structured issue-resolution tracking.

It demonstrates full-stack development, secure role separation, practical AI integration, and production-style workflow design.
