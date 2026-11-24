# Recare Safety & Security Policy

## 1. Action Risk Classification

Recare enforces strict risk boundaries in trusted application code (`app.security.policies.PolicyEngine`):

### Low-Risk Actions
- Scrolling (`SCROLL`)
- Visual Highlighting (`HIGHLIGHT`)
- Reading visible text (`READ`)
- Waiting / Observing (`WAIT`)
- Internal navigation (`NAVIGATE`)
- Clicking standard tabs and menus
*Execution policy:* Permitted without interrupting confirmation when authorized by the user.

### Moderate-Risk Actions
- Typing / Filling non-sensitive form inputs (`TYPE`, `FILL`)
- Selecting dropdown options (`SELECT`)
*Execution policy:* Permitted under user supervision; changes remain visible and editable prior to submission.

### High-Risk Consequential Actions
- Submitting applications (`SUBMIT`)
- Authorizing financial transactions or payments (`PAY`, `PURCHASE`, `BUY`, `CHECKOUT`)
- Deleting or destroying data (`DELETE`, `REMOVE`)
- Sending communications (`SEND`, `PUBLISH`)
- Requesting file uploads (`REQUEST_FILE_UPLOAD`)
*Execution policy:* **MANDATORY CONFIRMATION**. The agent is paused and an accessible confirmation card is presented to the user showing the exact target, payload, and website.

## 2. Prompt Injection Defense

Webpage content is treated as untrusted data:
- Webpage content is demarcated in `<untrusted_webpage_content>` tags.
- Adversarial patterns (e.g. `System: ignore prior instructions...`) are detected and neutralized.
- Webpage text can never independently grant execution authorization.
