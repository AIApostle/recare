# Recare Local Development Guide

## Prerequisites
- **Node.js**: v20+ or v22 LTS (v22.23.5 recommended)
- **pnpm**: v12+ (`npm install -g pnpm`)
- **Python**: 3.11+
- **uv**: Fast Python package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Google Chrome** or Chromium-based browser

## Fast Setup

```bash
# 1. Install frontend monorepo dependencies
pnpm install

# 2. Setup backend virtual environment
cd backend
uv sync
cd ..

# 3. Run all tests
pnpm test
```

## Running the Development Environment

### Terminal 1: Backend
```bash
pnpm backend:dev
# Running on http://127.0.0.1:8000
```

### Terminal 2: Test Bench Webpages
```bash
pnpm demo:serve
# Test bench running on http://localhost:3000
```

### Terminal 3: Chrome Extension (Hot Reload)
```bash
pnpm dev:extension
# Bundles into apps/extension/.output/chrome-mv3
```

## Testing Recare in Chrome
1. Navigate to `chrome://extensions`.
2. Toggle on **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3`.
5. Open `http://localhost:3000` in Chrome.
6. Click the Recare icon or press `Ctrl+Shift+U`.
7. Choose any test scenario (Form, Navigation, Multi-Step Workflow, etc.) and ask Recare to guide or perform the task!
