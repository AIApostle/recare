# Recare — AI Browser Agent & Accessibility Assistant

> **Core Principle:** *Software should adapt to people, not require people to adapt to software.*

Recare is an AI browser agent and accessibility assistant designed for Chrome and Chromium-based browsers. It helps users understand webpages, navigate unfamiliar software, and complete multi-step tasks using natural language, voice commands, and controlled browser execution.

---

## Key Features

- **Webpage Understanding**: Scans active DOM elements, accessible roles, ARIA names, and page structure while preserving privacy (passwords are automatically sanitized and never collected).
- **Interactive Guidance**: Explains complex interfaces, translates technical terminology into plain language, and visually highlights controls on the page.
- **Controlled Browser Execution**: Performs clicks, form filling, selections, navigation, and multi-step workflows through a strict, sandboxed execution engine.
- **Safety Policy & Approval System**: Consequential operations (such as making payments, submitting orders, deleting data, or sending communications) require mandatory user approval.
- **Accessibility (WCAG 2.2 AA)**:
  - **Voice Interaction**: Built-in Speech-to-Text and Text-to-Speech support.
  - **Keyboard Navigation**: Global shortcut (`Ctrl+Shift+U`) and visible focus indicators throughout the UI.
  - **Customizable Preferences**: Text resizing (Small to Extra Large), speech rate adjustments (0.5x to 1.75x), simplified language, high contrast, and reduced motion.
- **Interaction Modes**:
  - **Guide**: Explains and highlights without executing actions.
  - **Assist**: Plans and executes approved actions in partnership with the user.
  - **Autonomous**: Completes authorized multi-step tasks while strictly respecting safety gates.

---

## Monorepo Architecture

```text
recare/
├── apps/
│   ├── extension/          # Manifest V3 Chrome Extension (WXT, React 18, Tailwind CSS)
│   │   ├── entrypoints/    # Side Panel, Background Service Worker, Content Script
│   │   ├── components/     # Accessible React UI components (Header, Composer, Approvals)
│   │   ├── features/dom/   # DOM Extractor, Visual Highlighter, Action Executor
│   │   └── services/       # Messaging, Storage, Voice, and API Client
│   │
│   └── web/                # Local test bench demo pages (Forms, Navigation, Workflows)
│
├── backend/                # Python FastAPI Backend
│   ├── app/
│   │   ├── agent/          # Strands Agents SDK orchestration, tools, and planning
│   │   ├── security/       # Policy Engine (Risk classification) & Prompt Injection Defense
│   │   ├── schemas/        # Pydantic v2 schemas for tasks, actions, and safety
│   │   └── api/routes/     # REST endpoints (/tasks, /chat, /preferences, /health)
│   └── tests/              # Pytest test suite for API, policies, and tasks
│
├── docs/                   # Full documentation guides
├── scripts/                # Development, build, and test scripts
└── package.json
```

---

## Quickstart

### 1. Prerequisites
- **Node.js** >= 20 LTS (v22.23.5 recommended)
- **pnpm** >= 12 (`npm install -g pnpm`)
- **Python** >= 3.11 with **uv** (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 2. Install Dependencies
```bash
# Install frontend workspace dependencies
pnpm install

# Setup backend Python environment
cd backend
uv sync
cd ..
```

### 3. Run the Test Suites
```bash
# Run all test suites (Vitest unit tests + Playwright E2E tests + Pytest backend tests)
./scripts/test.sh

# Or run individual suites:
pnpm test:extension   # DOM inspection and action execution unit tests (Vitest)
pnpm test:e2e         # End-to-end browser tests on Chrome (Playwright)
pnpm test:backend     # Backend FastAPI and policy engine tests (Pytest)
```

### 4. Start Development Services

**Terminal 1 — Backend API:**
```bash
pnpm backend:dev
```

**Terminal 2 — Local Test Bench Pages:**
```bash
pnpm demo:serve
```

**Terminal 3 — Chrome Extension Build / Watch:**
```bash
pnpm dev:extension
```

### 5. Load in Chrome
1. In Google Chrome, go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select `apps/extension/.output/chrome-mv3`.
4. Navigate to `http://localhost:3000` to access the Recare Test Bench.
5. Click the Recare toolbar icon or press `Ctrl+Shift+U` to open the Assistant side panel.

---

## Verification & Demonstrations

The included test bench (`apps/web/public/index.html`) demonstrates:
1. **Form Completion** (`form.html`): Form field detection, auto-fill, and submission verification.
2. **Navigation & Highlights** (`navigation.html`): Tabs, menus, and visual control highlighting.
3. **Multi-Step Checkout** (`workflow.html`): Sequential steps pausing for user approval on consequential payment.
4. **Dynamic Application** (`dynamic.html`): React/SPA-style asynchronous DOM updates.
5. **Inaccessible Interface** (`inaccessible.html`): Semantic heuristic extraction on non-standard div controls.
6. **Prompt Injection Defense** (`injection.html`): Adversarial payload filtering verifying that webpage text cannot hijack agent directives.

---

## License
MIT
