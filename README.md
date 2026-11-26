# Recare — AI Browser Agent & Accessibility Assistant
*(Built for Google #BuildHybridAI 2026 Hackathon)*

> **Core Principle:** *Software should adapt to people, not require people to adapt to software.*

Recare is an AI browser agent and accessibility assistant designed for Chrome and Chromium-based browsers. It helps users understand webpages, navigate unfamiliar software, and complete multi-step tasks using natural language, voice commands, and controlled browser execution.

Recare is powered by a **Hybrid AI Architecture**: combining on-device **Gemini Nano 4** in Chrome for private, low-latency page understanding and cloud **Gemini** models via **Firebase AI Logic** (`firebase/ai`) and **Firebase App Check** for complex task planning and browser tool execution.

---

## What Recare is About

Recare is an autonomous, multimodal AI browser assistant designed to ensure that **software adapts to people, not the other way around**. Built for Chrome and Chromium-based browsers, Recare acts as a personal digital navigator that understands webpages in real time, translates confusing jargon into plain language, explains complex user interfaces, and autonomously executes multi-step workflows (like filling forms, searching, and navigating menus) with human-in-the-loop safety.

Recare is powered by a **Hybrid AI Architecture**:
* **On-Device (Edge Privacy)**: Leverages **Gemini Nano 4** built into Google Chrome for instant, private page summaries, visual highlighting, and single-turn assistance without transmitting page contents to the cloud.
* **Cloud Reasoning (Firebase AI Logic)**: Employs **Gemini 2.5 / 3.5** models via **Firebase AI Logic** (`@firebase/ai`) and **Render backend** for deep planning, multi-step browser orchestration, and internet research.

---

## Who Recare is For

Recare was built with inclusive design at its foundation:

* **Users with Motor & Mobility Impairments**: Navigate complex websites, click hard-to-reach buttons, and fill tedious forms using simple voice commands, conversational requests, or keyboard shortcuts (`Ctrl+Shift+U`).
* **Visually Impaired & Low-Vision Users**: High-contrast visual element highlights, variable text scaling (Small to XL), smooth voice readouts with adjustable speech rates (0.5x to 2.0x), and screen structure extraction.
* **Cognitive & Neurodivergent Users**: Simplified language mode breaks down convoluted interfaces into plain, calm, step-by-step guidance without digital clutter.
* **Elderly & Casual Web Navigators**: Overcomes confusing modern websites, unexpected popups, and nested menus by letting users simply say what they want to accomplish.
* **Power Users & Researchers**: Hands-free web search, automated research summaries, and seamless form assistance.

---

## How Recare Reads Your Browser Screen

A frequent question is: *Can Recare read my browser screen, and how does it protect my privacy?*

Recare utilizes a hybrid visual and semantic screen-reading architecture:

1. **Semantic DOM Tree Extraction (`DomExtractor`)**:
   - Scans the active page for interactive controls (`button`, `a`, `input`, `select`, `textarea`, `[role="button"]`, `[role="tab"]`, etc.).
   - Computes computed accessible names using ARIA specifications (`aria-label`, `aria-labelledby`, `<label for="...">`, placeholders, and visible text).
   - Extracts page structure and reading hierarchy from headings (`h1` through `h6`).
2. **Privacy-Preserving Data Sanitization**:
   - **Password Fields**: Any input with `type="password"` is strictly sanitized to `[PASSWORD_PROTECTED]`. Passwords and sensitive credentials are never read, stored, or sent over any network.
   - **Form Scrubbing**: Credit card numbers and private inputs are filtered before any LLM inference.
   - **Zero Keystroke Logging**: Recare does not record background keystrokes.
3. **Multimodal Visual Grounding (Vision Screenshots)**:
   - When vision mode is enabled, the extension captures a secure, temporary base64 screenshot of the active viewport via `chrome.tabs.captureVisibleTab`.
   - This visual representation is passed to Gemini's multimodal vision model, allowing Recare to understand layouts, diagrams, charts, and visual icons that lack explicit text labels.
4. **Smart Auto-Dismiss Visual Highlighting (`DomHighlighter`)**:
   - When recommending or interacting with controls, Recare displays a high-visibility green border with an accessible label badge over the element.
   - **Auto-Dismiss Timer**: To prevent screen obstruction, highlights automatically fade out and disappear after **6.5 seconds**, or immediately if you click or type anywhere on the page.

---

## Key Features

- **Hybrid AI Logic (Google #BuildHybridAI)**:
  - **On-Device Inference**: Uses Gemini Nano 4 via `InferenceMode.PREFER_ON_DEVICE` for private, single-turn page explanations, content simplification, and summarization without sending page DOM to the cloud.
  - **Cloud Reasoning & Fallback**: Automatically routes multi-turn chat, complex workflow planning, and browser tool execution to cloud Gemini models.
  - **Firebase App Check**: Secures AI Logic endpoints against unauthorized use.
  - **Live Inference Indicators**: Visually signals whether a response ran `⚡ On-device (Nano 4)` or in the `☁️ Cloud`.
- **Webpage Understanding**: Scans active DOM elements, accessible roles, ARIA names, and page structure while preserving privacy (passwords are automatically sanitized and never collected).
- **Interactive Guidance**: Explains complex interfaces, translates technical terminology into plain language, and visually highlights controls on the page.
- **Controlled Browser Execution**: Performs clicks, form filling, search queries, navigation, and multi-step workflows through a strict, sandboxed execution engine.
- **Safety Policy & Action Approval Gating**: Consequential operations (such as making payments, submitting orders, deleting data, or navigating away) prompt an interactive confirmation modal. Users can toggle **"Require Approval for Actions"** in settings to require approval for all browser actions.
- **Multimodal & Live Audio Inputs**:
  - **Image & File Attachments**: Users can attach images, screenshots, or documents via the `+` button in the composer for multimodal AI analysis.
  - **Live Audio & Voice Recording**: Full push-to-talk voice recording using web `MediaRecorder` with backend audio transcription.
- **Web Search & Online Research**: Autonomous background research using DuckDuckGo and Wikipedia to answer questions about companies, unfamiliar websites, or search topics.
- **Accessibility (WCAG 2.2 AA)**:
  - **Voice Interaction**: Built-in Speech-to-Text and Text-to-Speech support with adjustable voice speed and voice selection.
  - **Keyboard Navigation**: Global shortcut (`Ctrl+Shift+U`) and visible focus indicators throughout the UI.
  - **Customizable Preferences**: Text resizing (Small to Extra Large), speech rate adjustments (0.5x to 2.0x), simplified language, high contrast, reduced motion, and action approval toggles.
- **Interaction Modes**:
  - **Guide**: Explains and highlights without executing actions.
  - **Assist**: Plans and executes approved actions in partnership with the user.
  - **Autonomous**: Completes authorized multi-step tasks while strictly respecting safety gates.

---

## Firebase AI Logic & Hybrid AI Architecture

Recare was architected specifically for Google's **#BuildHybridAI** challenge to bridge on-device privacy with cloud reasoning.

### Where Firebase AI Logic is Implemented:
* **Core Service (`apps/extension/services/firebase-ai/firebaseAiService.ts`)**:
  - Initializes Firebase AI (`getAI`, `GoogleAIBackend`) with Google AI credentials.
  - Configures multi-tier inference modes: `InferenceMode.ONLY_ON_DEVICE`, `InferenceMode.PREFER_ON_DEVICE`, and `InferenceMode.PREFER_IN_CLOUD`.
  - Defines browser agent function-calling schemas (`RECARE_BROWSER_TOOLS` for `inspect_page`, `highlight_element`, `click_element`, `fill_input`, `navigate_page`, `scroll_page`).
* **Prompt API & On-Device Detection (`apps/extension/services/firebase-ai/nanoDetector.ts`)**:
  - Queries Chrome's built-in AI runtime across W3C standard `LanguageModel` and `window.ai.languageModel`.
  - Tracks availability states (`readily`, `downloadable`, `downloading`, `unsupported`).
* **Firebase App Check (`apps/extension/services/firebase-ai/appCheck.ts`)**:
  - Protects AI logic endpoints with App Check token attestation.
* **On-Device Planner (`FirebaseAiService.planLocalAction`)**:
  - Resolves browser-level actions (tabs, history, reload, forms, search) entirely in-browser when running on-device.

### What Happens Based on User Hardware (GPU vs. CPU):

| Hardware Profile | What Chrome Does | How Recare Executes | User Experience |
| :--- | :--- | :--- | :--- |
| **System WITH Dedicated GPU** *(NVIDIA / AMD / Apple Silicon)* | Downloads and loads Gemini Nano model weights into GPU memory via Chrome Prompt API (`#prompt-api-for-gemini-nano`). | Runs directly on-device using local Gemini Nano (`⚡ on_device`). No webpage data or DOM is sent to any server. | Instant, zero-latency inference, 100% offline and private. |
| **System WITHOUT GPU** *(CPU-only Linux / laptops with basic integrated graphics)* | Chrome withholds the on-device execution config to prevent freezing the browser thread (reports missing execution config). | Recare's `NanoDetector` automatically detects the missing GPU runtime and seamlessly routes queries through **Firebase AI Cloud Backend** (Gemini 2.5 on Render). | Fast, full-capability agent execution. Every click, voice response, and form fill works identically with zero crashes or stalls. |

*Users can also toggle **"Only Use Local Model"** in Recare's Accessibility Settings to force strict on-device operation, or leave it unchecked for automatic hybrid switching.*

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
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
