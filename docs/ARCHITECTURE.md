# Recare — Architecture Documentation

## 1. System Overview

Recare is an AI browser agent and accessibility assistant designed to help people understand, navigate, and operate web applications. It bridges natural language intent, accessibility standards (WCAG 2.2 AA), and browser automation through a controlled execution protocol.

```
┌────────────────────────────────────────────────────────┐
│                   Active Browser Tab                   │
│   ┌────────────────────────────────────────────────┐   │
│   │           Target Web Application DOM           │   │
│   └───────────────────────▲────────────────────────┘   │
│                           │ Scans / Operates           │
│   ┌───────────────────────▼────────────────────────┐   │
│   │            Recare Content Script               │   │
│   │  - DomExtractor (accessible names, roles)      │   │
│   │  - DomHighlighter (visual element rings)       │   │
│   │  - DomExecutor (controlled action execution)   │   │
│   └───────────────────────▲────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ Chrome Runtime Messaging
┌───────────────────────────▼────────────────────────────┐
│              Recare Chrome Extension                   │
│   ┌────────────────────────────────────────────────┐   │
│   │           Background Service Worker            │   │
│   │  - Sidepanel lifecycle, tabs, permissions      │   │
│   └───────────────────────▲────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │            React Side Panel UI                 │   │
│   │  - Conversation Area, Composer, Voice Input    │   │
│   │  - Task Controls (Pause, Stop, Takeover)       │   │
│   │  - Approval Confirmation Prompt                │   │
│   │  - Accessibility Preferences                   │   │
│   └───────────────────────▲────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ REST JSON (HTTP / WS ready)
┌───────────────────────────▼────────────────────────────┐
│             Recare FastAPI Backend (Python)            │
│   ┌────────────────────────────────────────────────┐   │
│   │            API Layer (/api/v1)                 │   │
│   │  - /tasks, /chat, /user/preferences, /health   │   │
│   └───────────────────────▲────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │            Safety Policy Engine                │   │
│   │  - Risk Classification (LOW, MEDIUM, HIGH)     │   │
│   │  - Prompt Injection Defense & Sanitization     │   │
│   └───────────────────────▲────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │             Strands Agents SDK                 │   │
│   │  - Agent Orchestration & Task Planning         │   │
│   │  - Tools: inspect_page, find_elements,         │   │
│   │           execute_action, highlight_element    │   │
│   │  - Pluggable Model Provider (Mock / Cloud)     │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

## 2. Core Subsystems

### 2.1 Extension Layer (Manifest V3)
- Built with **WXT** (Vite + React 18 + TypeScript + Tailwind CSS).
- Persistent **Side Panel** (`side_panel.html`) providing the primary user interface.
- Content script isolating DOM inspection, accessible name extraction, and controlled element execution.
- Typed message protocol preventing arbitrary eval or unvalidated scripts.

### 2.2 Backend & Strands Agent Layer
- Python 3.11+ with **FastAPI** and **uv**.
- **Strands Agents SDK**: Orchestrates agent reasoning and tool dispatch.
- **Task State Machine**:
  - `IDLE` -> `UNDERSTANDING` -> `PLANNING` -> `WAITING_FOR_ACTION` -> `EXECUTING` -> `WAITING_FOR_USER_APPROVAL` -> `VERIFYING` -> `COMPLETED`.
- **Policy Engine**: Classifies operations into Low, Medium, and High Risk. Blocks consequential actions until the user clicks or speaks explicit confirmation.
