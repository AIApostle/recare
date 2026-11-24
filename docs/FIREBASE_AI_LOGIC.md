# Firebase AI Logic & Hybrid Inference Guide (#BuildHybridAI)

## 1. Overview & Purpose

Recare integrates the **Firebase AI Logic** JavaScript SDK (`firebase/ai`) to provide a hybrid on-device and cloud AI user experience.

### Why Hybrid AI for an Accessibility Assistant?
- **Privacy & Speed**: Users navigating personal dashboards, bank statements, or healthcare forms benefit from on-device inference using **Gemini Nano 4** in Chrome. Sensitive screen details and personal identifiable information (PII) stay on the user's hardware.
- **Resilience & Capability**: When on-device hardware is unavailable or when tasks require complex multi-step reasoning, Firebase AI Logic seamlessly routes requests to cloud Gemini models.

---

## 2. Architecture & Inference Routing

```
                        User Request / Page Content
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │    Recare Side Panel UI     │
                     └──────────────┬──────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │   FirebaseAiService (SDK)   │
                     │  - initializeApp            │
                     │  - initializeAppCheck       │
                     │  - getAI (GoogleAIBackend)  │
                     │  - getGenerativeModel       │
                     └──────────────┬──────────────┘
                                    │
                  InferenceMode.PREFER_ON_DEVICE
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
         [ Gemini Nano 4 ]                 [ Cloud Gemini ]
         (Desktop Chrome 139+)             (Firebase AI Backend)
         - Local page explanation          - Multi-turn conversation
         - Visual summarization            - Complex task planning
         - Content simplification          - Browser tool calling
```

---

## 3. Supported Inference Modes

Users can configure their preferred strategy in **Settings > Hybrid AI Logic**:

1. **`PREFER_ON_DEVICE` (Default)**: Attempts execution on Chrome's local Gemini Nano 4 model first. If unavailable, unsupported, or offline, safely falls back to cloud Gemini models.
2. **`ONLY_ON_DEVICE`**: Enforces strict on-device execution for privacy-conscious workflows.
3. **`PREFER_IN_CLOUD`**: Prioritizes cloud models while retaining on-device capabilities for offline fallback.
4. **`ONLY_IN_CLOUD`**: Routes all generative tasks directly to the cloud backend.

---

## 4. On-Device vs. Cloud Operation Matrix

| Operation | Model / Tier | Rationale |
| :--- | :--- | :--- |
| **"What am I looking at?"** | On-Device (Gemini Nano 4) | Fast, private, single-turn DOM understanding |
| **"Summarize this page"** | On-Device (Gemini Nano 4) | Local text analysis without uploading page content |
| **"Simplify this language"** | On-Device (Gemini Nano 4) | Cognitive assistance with low latency |
| **Multi-turn Task Assistance** | Cloud (Gemini 2.5 Flash Lite) | Requires multi-turn chat history context |
| **Browser Tool Calling** | Cloud (Gemini 2.5 Flash Lite) | Structured tool execution (`click_element`, `fill_input`) |
| **Consequential Workflows** | Cloud + Strands Backend | Evaluated against trusted safety policies |

---

## 5. Firebase App Check

Firebase App Check protects the AI backend from unauthorized usage:
- In development and extension testing, a custom provider supplies an authorized debug token configured in Firebase Console.
- In production, extension origin attestation is verified before AI Logic API requests proceed.

---

## 6. Model Availability Detection

The `NanoDetector` utility actively queries Chrome's Built-in AI (`window.ai.languageModel`):
- `ready`: Model is present and ready for instantaneous on-device inference.
- `downloadable`: Chrome supports Nano 4 but requires an initial model download.
- `unsupported`: Environment lacks Built-in AI flags or hardware acceleration; cloud inference is engaged automatically.
