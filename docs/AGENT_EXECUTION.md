# Recare Agent Execution Protocol

## Execution Protocol

The Strands Agent operates in the Python backend while the browser execution runs in the Chrome extension. The execution protocol works through an asynchronous state machine:

1. **Context Capture**: The user opens Recare or issues a command. The extension content script extracts the active DOM structure, accessible names, roles, and headings.
2. **Intent Analysis & Planning**: The backend Strands Agent interprets the request against the page context and generates a structured sequence of `PlanStep`s.
3. **Action Proposal & Policy Gate**:
   - The agent proposes a browser action (CLICK, TYPE, FILL, SELECT, SCROLL, NAVIGATE, HIGHLIGHT).
   - The `PolicyEngine` evaluates the action against risk rules.
   - If Low or Moderate risk: The action is sent to the extension for execution.
   - If High risk (Consequential): Execution pauses in `WAITING_FOR_USER_APPROVAL`.
4. **Controlled Execution**:
   - The extension content script locates the element by stable ID, selector, or accessible name.
   - Validates that the element is enabled and interactive.
   - Executes the action and observes DOM mutations / URL changes.
5. **Verification**:
   - The result (`ActionResult`) is submitted back to `/api/v1/tasks/{task_id}/action-result`.
   - The agent verifies whether the intended state transition occurred.
   - The cycle continues until completion or user interruption.
