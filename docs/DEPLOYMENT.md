# Recare — Production Deployment Guide

This guide walks you through taking Recare from local development to production.

---

## 1. High-Level Architecture: What Goes Where?

Recare consists of three distinct components:

| Component | Target Host | Purpose |
|---|---|---|
| **Python FastAPI Backend** (`backend/`) | **Render** | Agent orchestration (Strands), policy engine, SSE streaming, SQLite/Postgres. |
| **Demo Test Bench / Web App** (`apps/web/`) | **Vercel** | Live hosted web pages where users and judges can test Recare online. |
| **Chrome Extension** (`apps/extension/`) | **Chrome Web Store / Zip** | Bundled client running in user's browser, pointing to the Render API & Firebase. |

---

## 2. Deploying the Backend on Render

### Option A: Using the Render Blueprint (Recommended)
1. Push your repository to GitHub or GitLab.
2. In [Render Dashboard](https://dashboard.render.com/), click **New +** > **Blueprint**.
3. Select your `recare` repository. Render will automatically detect `render.yaml`.
4. Fill in `GEMINI_API_KEY` (or `OPENAI_API_KEY`) when prompted.
5. Click **Apply**. Render will build and deploy the service with a URL like:
   `https://recare-api.onrender.com`

### Option B: Manual Web Service Setup
- **Name**: `recare-api`
- **Root Directory**: `backend`
- **Runtime**: `Python`
- **Build Command**: `pip install uv && uv sync`
- **Start Command**: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`

#### Render Environment Variables
```env
ENVIRONMENT=production
DEBUG=false
PORT=8000
DATABASE_URL=sqlite+aiosqlite:///./recare.db
MODEL_PROVIDER=gemini
MODEL_NAME=gemini-2.5-flash-lite
GEMINI_API_KEY=your_gemini_api_key_here
AUTO_APPROVE_LOW_RISK=true
REQUIRE_APPROVAL_HIGH_RISK=true
CORS_ORIGINS=["chrome-extension://*", "https://*", "http://localhost:3000"]
```

---

## 3. Deploying the Test Bench on Vercel

The test bench provides 6 interactive scenario pages (`form.html`, `navigation.html`, `workflow.html`, etc.) for users and judges to test the extension live.

1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your `recare` repository.
3. Configure the project settings:
   - **Root Directory**: Click edit and select `apps/web` (or leave root and set Output Directory to `apps/web/public`).
   - **Framework Preset**: `Other`.
   - **Build Command**: Leave empty.
   - **Output Directory**: `public`.
4. Click **Deploy**.
5. You will receive a URL like: `https://recare-demo.vercel.app`.

---

## 4. Building the Extension for Production

Once your Render backend and Firebase are set up, build the extension so it points to your live backend:

### Step 1: Create `apps/extension/.env.production`
```env
# Point to your live Render backend
VITE_RECARE_API_URL=https://recare-api.onrender.com

# Firebase Client Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef...
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=your-token
```

### Step 2: Build & Package the Zip
Run in your project root:
```bash
pnpm zip
```
This produces:
`apps/extension/.output/recareextension-0.1.0-chrome.zip`

### Step 3: Distribution
- **For Testers / Judges**: They download the `.zip`, unzip it, and load it via `chrome://extensions` -> **Load unpacked**.
- **For Chrome Web Store**: Upload `recareextension-0.1.0-chrome.zip` directly to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devcenter).
