# PRD — Universal AI Browser Assistant
**Version:** 0.1  
**Status:** Initial Product Definition  
**Product Name:** TBD  
**Platform:** Browser Extension (initially Chrome/Chromium)  
**Product Category:** AI Browser Agent / Accessibility Technology

---

## 1. Product Vision

Build an AI-powered browser agent that makes the internet and software applications easier to use for everyone, particularly people with disabilities.

Users should be able to interact with websites and web applications through natural language, voice, or traditional browser controls. The agent should understand the current interface, explain it, guide users through workflows, and execute tasks on their behalf.

The long-term vision is to reduce the need for people to learn the intricacies of every application they use.

**The user expresses intent. The agent understands the interface and helps accomplish the task.**

The product is not simply an AI chatbot, screen reader, or browser automation tool. It combines interface understanding, accessibility assistance, contextual learning, and autonomous task execution into a universal interaction layer.

---

## 2. Problem Statement

Modern software is designed around the assumption that users can independently understand interfaces, navigate menus, recognize controls, read content, use a mouse and keyboard, and recover from errors.

This creates significant barriers for:

- People with visual impairments.
- People with motor disabilities.
- People with cognitive disabilities or learning difficulties.
- People with limited digital literacy.
- Older adults.
- People unfamiliar with complex software.
- Anyone using unfamiliar, poorly designed or complicated applications.

Existing solutions address portions of the problem:

- Screen readers provide access to interface information but do not generally autonomously complete workflows.
- Accessibility tools improve specific interaction capabilities.
- Tutorials teach users how to perform tasks but are often disconnected from the actual interface.
- AI chatbots explain things but often cannot interact with the current application.
- Browser automation tools execute tasks but are not primarily designed around accessible, understandable, user-controlled interaction.

There is an opportunity to combine these capabilities into a single agent.

---

## 3. Product Objectives

### Primary objectives

1. Enable users to accomplish tasks on websites without needing to understand every interface.
2. Make browser interaction accessible through voice, text and alternative interaction methods.
3. Provide contextual assistance based on the current webpage.
4. Allow the agent to execute multi-step tasks using the browser.
5. Enable users to learn applications through contextual, interactive guidance.
6. Support a broad range of websites without requiring application-specific integrations.
7. Maintain user control, privacy, transparency and safety during execution.

### Secondary objectives

1. Help users become more confident using technology.
2. Reduce time spent learning unfamiliar software.
3. Provide an accessibility layer for websites with poor accessibility.
4. Eventually offer application developers a way to embed or integrate the agent.
5. Support enterprise and institutional deployments.

---

## 4. Product Principles

### 4.1 Universal

The agent should work across websites and web applications without requiring developers to build custom integrations.

### 4.2 Accessibility-first

Accessibility must influence the interface, agent architecture, interaction methods, and execution strategy from the beginning.

### 4.3 User autonomy

The agent assists users without taking away their ability to understand, interrupt, control or override its actions.

### 4.4 Intent-driven interaction

Users communicate what they want to achieve instead of needing to know the sequence of buttons and menus required.

### 4.5 Context-aware

The agent understands the webpage, current task, relevant interface elements and the user's immediate context.

### 4.6 Action-oriented

The agent should be capable of executing tasks, not just producing instructions or answers.

### 4.7 Transparent

Users should understand what the agent is doing, what it has done, and what remains to be completed.

### 4.8 Privacy-conscious

Browsing data is sensitive. The product should minimize collection, processing, retention and transmission of unnecessary information.

---

## 5. Target Users

### 5.1 People with visual impairments

Users who need assistance understanding visual interfaces, locating controls, navigating pages, reading information and completing workflows.

Potential capabilities:

- Describe webpages.
- Read selected or relevant content aloud.
- Identify interface elements.
- Navigate forms.
- Locate buttons, links and menus.
- Execute tasks through voice.
- Explain visual information.
- Work alongside existing screen readers.

### 5.2 People with motor disabilities

Users who may have difficulty using a mouse, keyboard, touchpad or repetitive physical interaction.

Potential capabilities:

- Voice-driven browser control.
- Natural-language commands.
- Reduced interaction requirements.
- Automated multi-step workflows.
- Configurable hands-free interaction.
- Keyboard-based alternatives.

### 5.3 People with cognitive disabilities and learning difficulties

Users who may find complex interfaces, instructions, terminology, navigation or multi-step workflows difficult.

Potential capabilities:

- Simplified explanations.
- One-step-at-a-time guidance.
- Plain-language translation of technical terminology.
- Reminders of the current task.
- Error explanation and recovery.
- Adjustable instruction complexity.

### 5.4 General users

People who:

- Are unfamiliar with a particular application.
- Need help finding features.
- Want to automate repetitive tasks.
- Have difficulty navigating complex forms.
- Want to accomplish something without learning the application's workflow.

### 5.5 Enterprise and institutional users

Organizations that want employees, customers, students or service users to interact more easily with web-based applications.

Potential future deployments include:

- Workplace software assistance.
- Digital banking guidance.
- University portals.
- Government services.
- Healthcare portals.
- Customer service applications.

---

## 6. Core Product Capabilities

The product is organized around three primary capabilities.

### 6.1 Understand

The agent should understand the current webpage and the user's context.

It should be able to:

- Identify the active website and page.
- Understand the visible interface.
- Identify buttons, links, menus, inputs, forms and controls.
- Interpret page structure.
- Understand the current page state.
- Read relevant text.
- Identify available actions.
- Understand error messages.
- Recognize changes in the interface.
- Identify the current step of a workflow.
- Interpret screenshots when DOM-based understanding is insufficient.

### 6.2 Guide

The agent should explain and guide users through applications.

It should be able to:

- Answer questions about the current webpage.
- Explain unfamiliar interface elements.
- Provide step-by-step instructions.
- Highlight controls.
- Explain what a button or option does.
- Simplify complex instructions.
- Explain errors.
- Suggest the next action.
- Guide the user without executing actions.
- Allow users to choose between instructions and execution.

### 6.3 Execute

The agent should interact with the browser and perform tasks.

It should be able to:

- Click controls.
- Navigate pages.
- Type into inputs.
- Fill forms.
- Select options.
- Scroll.
- Open and close menus.
- Search within applications.
- Upload files with authorization.
- Download files.
- Navigate multi-step workflows.
- Recover from certain errors.
- Verify whether actions succeeded.
- Complete workflows across multiple pages.

Execution must be bounded by user authorization and safety policies.

---

## 7. Primary User Experience

### 7.1 Browser Extension

The primary product interface is a browser extension.

The extension should be available regardless of which website the user is visiting.

The extension should provide:

- A persistent AI side panel.
- Text interaction.
- Voice interaction.
- Context-aware assistance.
- Task execution.
- Accessibility controls.
- User preferences.
- Task progress.
- An execution stop control.
- A way to return to normal browser interaction.

### 7.2 Side Panel

The side panel is the primary interface for the agent.

It should contain:

1. Conversation interface.
2. Voice input button.
3. Task input field.
4. Current task indicator.
5. Execution status.
6. Current action description.
7. Confirmation prompts.
8. Task completion summary.
9. Stop/pause controls.
10. Accessibility settings.

The panel should support users who cannot use conventional mouse interaction.

### 7.3 Interaction Modes

Users should be able to select an assistance mode.

**Guide Mode**

The agent explains the process and provides instructions. It does not independently perform actions.

**Assist Mode**

The agent performs actions while communicating what it is doing. Users can intervene at any time.

**Autonomous Mode**

The agent executes an authorized task with minimal interruption, subject to configured safety restrictions and required approvals.

Users should be able to change modes during a task.

---

## 8. Core User Workflows

### Workflow A — Ask about a webpage

1. User opens a webpage.
2. User opens the extension.
3. User asks a question.
4. Extension obtains relevant page context.
5. Agent analyzes the page.
6. Agent provides an answer grounded in the page.
7. Agent can highlight relevant interface elements.

Example:

"What does this page mean?"

### Workflow B — Guided task

1. User opens an application.
2. User asks how to perform a task.
3. Agent understands the current interface.
4. Agent creates a sequence of steps.
5. Agent explains the first step.
6. Agent highlights the relevant control.
7. User performs the action or asks the agent to do it.
8. Agent continues until the task is complete.

Example:

"Teach me how to create an invoice."

### Workflow C — Autonomous task execution

1. User states a desired outcome.
2. Agent analyzes the current page.
3. Agent creates an execution plan.
4. Agent identifies the necessary actions.
5. Agent executes permitted actions.
6. Agent observes changes after each meaningful action.
7. Agent adjusts the plan if the interface changes.
8. Agent requests approval when required.
9. Agent verifies completion.
10. Agent provides a summary.

Example:

"Find my latest electricity bill, download it and save it."

### Workflow D — Voice-first task execution

1. User activates voice interaction.
2. User states a task.
3. Agent responds verbally.
4. Agent navigates and executes actions.
5. Agent communicates important progress.
6. Agent asks questions when clarification is required.
7. Agent announces task completion.

The user should be able to complete supported tasks without touching a mouse.

### Workflow E — Recover from an error

1. User encounters an error.
2. User asks the agent for help.
3. Agent reads and interprets the error.
4. Agent explains the likely issue.
5. Agent suggests a resolution.
6. Agent may execute a safe corrective action.
7. Agent verifies whether the problem is resolved.

---

## 9. Functional Requirements

### FR-01: Contextual Page Understanding

The extension must be capable of obtaining relevant context from the active webpage.

Context may include:

- Page title.
- Domain.
- Current URL, subject to privacy settings.
- Visible text.
- DOM structure.
- Accessible names.
- Element roles.
- Form fields.
- Buttons.
- Links.
- Selected content.
- Screenshots.
- Relevant interface state.

The agent must avoid unnecessarily collecting unrelated page content.

### FR-02: Natural-Language Interface

Users must be able to communicate with the agent using ordinary language.

The system must support:

- Questions.
- Instructions.
- Task requests.
- Follow-up instructions.
- Corrections.
- Clarifications.
- Cancellation.

### FR-03: Voice Interaction

The extension should support speech input and spoken output.

Voice features should include:

- Speech-to-text.
- Text-to-speech.
- Spoken responses.
- Hands-free interaction.
- Interrupting the agent.
- Voice-driven navigation.
- Confirmation through voice when appropriate.

Voice interaction should be configurable and should not be mandatory.

### FR-04: Element Identification

The agent must identify relevant webpage elements.

It should use, in order where practical:

- Semantic DOM elements.
- Accessible names and roles.
- ARIA metadata.
- Labels and associated form controls.
- Text and contextual relationships.
- Visual recognition.
- Coordinate-based interaction when necessary.

### FR-05: Element Highlighting

The extension must be able to visually highlight relevant interface elements.

Examples:

- Highlight a button.
- Highlight a form field.
- Highlight a menu.
- Highlight a section.
- Show a numbered sequence of steps.

Highlighting must not obstruct the underlying interface or prevent the user from interacting with it.

### FR-06: Browser Interaction

The agent must be able to perform authorized browser actions, including:

- Clicking.
- Typing.
- Keyboard navigation.
- Scrolling.
- Selecting.
- Opening menus.
- Navigating.
- Filling forms.
- Interacting with supported web elements.

The agent should prefer robust semantic interaction over fragile screen coordinates.

### FR-07: Task Planning

The agent must convert user requests into structured task plans.

Plans should include:

- Goal.
- Steps.
- Relevant page context.
- Expected outcome.
- Required actions.
- Risk classification.
- Approval requirements.

The plan should be updated as the task progresses.

### FR-08: Execution Monitoring

The agent must communicate task progress.

Users should know:

- What the agent is doing.
- What step it is on.
- Whether it is waiting.
- Whether it encountered an error.
- Whether it requires approval.
- Whether the task succeeded.

### FR-09: Verification

The agent must verify the outcome of important actions instead of assuming an action succeeded.

Verification may use:

- DOM changes.
- Confirmation messages.
- Page transitions.
- Updated data.
- Download status.
- Visible indicators.
- Other relevant page evidence.

### FR-10: Error Recovery

The agent should attempt to recover from recoverable failures.

Examples:

- A button is no longer available.
- A page has changed.
- A form validation error occurs.
- A navigation attempt fails.
- A session expires.
- A workflow differs from the expected sequence.

The agent should not continue blindly after an unexpected state.

### FR-11: User Intervention

Users must be able to:

- Stop execution immediately.
- Pause execution.
- Resume execution.
- Change the task.
- Correct the agent.
- Take over manually.
- Revoke permissions.

### FR-12: Application Learning

The agent should help users learn how applications work.

It may:

- Explain workflows.
- Remember user-approved preferences.
- Remember useful instructions for recurring tasks.
- Provide simplified tutorials.
- Offer repeatable task instructions.

Application-specific knowledge should not be assumed to be universally correct or permanently applicable. Interfaces can change, so stored instructions must be revalidated.

### FR-13: Task History

Users may be able to review previous tasks.

History should include:

- User request.
- Task status.
- Actions performed.
- Relevant completion evidence.
- Errors.
- User approvals.
- Time completed.

Users must be able to clear history and configure retention.

### FR-14: Accessibility Preferences

Users should be able to configure:

- Speech rate.
- Voice.
- Text size.
- Simplification level.
- Verbosity.
- Interaction mode.
- Voice activation.
- Keyboard shortcuts.
- Visual highlighting.
- Reduced motion.
- Confirmation preferences within allowed safety policies.

---

## 10. Accessibility Requirements

Accessibility is a core product requirement.

### Visual accessibility

- Spoken descriptions of relevant interface content.
- Voice-driven navigation.
- Accessible extension interface.
- Screen-reader compatibility.
- Keyboard support.
- Text descriptions of visual elements.
- Focus management.
- Notifications that do not rely solely on color.
- High-contrast options.
- Adjustable text sizes.

### Motor accessibility

- Voice control.
- Keyboard-only support.
- Minimal repetitive interaction.
- Configurable shortcuts.
- Large, accessible controls.
- Pause and stop functionality.
- No requirement to drag elements.

### Cognitive accessibility

- Plain-language explanations.
- Adjustable complexity.
- Step-by-step guidance.
- Clear task progress.
- Consistent interface.
- Avoidance of unnecessary jargon.
- Ability to repeat instructions.
- Ability to slow down execution and explanations.

### Hearing accessibility

- Text alternatives to spoken output.
- Visible task status.
- Captions or transcripts for voice interactions.
- Visual confirmation of agent responses.

### Accessibility compatibility

The extension must not unnecessarily interfere with existing assistive technologies.

The product should be tested with real users and assistive technologies, including screen readers and keyboard-only workflows.

The product should target WCAG 2.2 AA for its own interface, while acknowledging that it cannot guarantee that every third-party website becomes fully compliant.

---

## 11. Safety and Permissions

Browser autonomy introduces significant risk.

The agent may interact with sensitive accounts, private information, financial services, healthcare systems and communications.

### Action categories

**Category 1 — Low-risk actions**

Examples:

- Navigating pages.
- Reading information.
- Searching.
- Opening menus.
- Scrolling.
- Downloading a user-requested document.

Generally permitted after the user grants the relevant permissions.

**Category 2 — Reversible actions**

Examples:

- Editing drafts.
- Filling forms without submission.
- Changing non-sensitive preferences.
- Creating unsent documents.

May be executed under configured autonomy settings.

**Category 3 — Consequential actions**

Examples:

- Sending emails or messages.
- Publishing content.
- Making purchases.
- Initiating payments.
- Submitting applications.
- Deleting data.
- Changing account security settings.
- Accepting legal agreements.

Require explicit confirmation before final execution.

### Safety controls

- Visible execution indicator.
- Immediate stop control.
- User approval for consequential actions.
- Clear explanation of actions.
- No hidden actions.
- No unauthorized access.
- No bypassing authentication or security controls.
- No bypassing CAPTCHA or anti-bot protections.
- No execution of instructions from webpage content that conflict with user intent or system policies.
- Protection against prompt injection from webpages.
- Sensitive actions must be checked against the original user request.
- Credentials and authentication tokens must not be exposed to the model unnecessarily.

### Prompt injection defense

Webpages are untrusted input.

The agent must distinguish:

- User instructions.
- System instructions.
- Agent policies.
- Webpage content.
- Instructions embedded in documents or websites.

A webpage must not be able to independently authorize the agent to perform actions, change policies, reveal private information, or execute unrelated tasks.

---

## 12. Product Architecture

### 12.1 Browser Extension

The extension is the primary user interface and browser interaction layer.

Responsibilities:

- Side panel.
- Chat interface.
- Voice interface.
- Active webpage context.
- Accessibility features.
- Page element identification.
- Highlighting.
- Browser interaction.
- Task execution interface.
- User intervention controls.
- Local preferences.

Initial platform:

- Chrome.
- Chromium-based browsers.

Future platforms:

- Edge.
- Firefox, subject to compatibility.
- Other supported browsers.

### 12.2 Agent Backend

The backend is responsible for:

- Authentication.
- Agent orchestration.
- Task planning.
- Model access.
- Tool execution orchestration.
- Policy enforcement.
- User preferences.
- Task history.
- Memory.
- Usage management.

The backend should not blindly trust instructions or state supplied by the extension.

### 12.3 Agent Runtime

The agent runtime should support a general-purpose agent with specialized capabilities.

Capabilities may include:

- Page understanding.
- Navigation.
- Search.
- Form completion.
- File handling.
- Accessibility assistance.
- Error recovery.
- Workflow guidance.
- Task planning.
- Task verification.

The architecture should avoid requiring a separate independent agent for every website.

### 12.4 Browser Interaction Engine

The interaction engine should provide an abstraction over different interaction mechanisms.

Potential execution methods:

- DOM-based actions.
- Accessibility-tree actions.
- Keyboard actions.
- Browser APIs.
- Visual understanding.
- Coordinate-based interaction.
- Supported browser automation mechanisms.

The agent should choose the most reliable available method.

### 12.5 Model Layer

The system should support multiple models and model providers.

Potential capabilities:

- Text reasoning.
- Vision.
- Audio input.
- Audio output.
- Structured output.
- Tool calling.
- Planning.
- Contextual understanding.

Model selection should depend on task complexity, privacy policy, latency, cost and availability.

The architecture should not permanently depend on one model provider.

---

## 13. Data and Privacy Architecture

### 13.1 Data categories

The product may process:

- Account information.
- User preferences.
- Conversation history.
- Task descriptions.
- Browser page context.
- Selected webpage content.
- Screenshots.
- Execution logs.
- Uploaded files.
- Authentication and integration metadata.

### 13.2 Storage strategy

The initial product should use a managed backend.

Potential infrastructure:

- PostgreSQL for user accounts, preferences, tasks and metadata.
- Secure object storage only when file storage is required.
- Encrypted storage for sensitive records.
- Short-lived context processing where persistent storage is unnecessary.

Original browsing content should not be retained by default.

### 13.3 Browser data

The extension should:

- Process only the content necessary for the current task.
- Avoid collecting browsing history unnecessarily.
- Avoid collecting content from unrelated tabs.
- Provide domain and permission controls.
- Allow users to exclude websites.
- Avoid retaining screenshots unless explicitly required.
- Provide clear privacy settings.

### 13.4 Local versus cloud inference

The product should support a hybrid approach.

Local processing may be used for supported operations such as certain page-processing, lightweight reasoning or privacy-sensitive tasks.

Cloud inference may be used for more complex planning, reasoning, vision and execution.

However, local inference does not automatically mean all data is stored locally. If webpage content is sent to a cloud model, that content leaves the device.

The product must clearly communicate this and eventually support enterprise privacy policies and private deployment options.

### 13.5 Data retention

Users should be able to:

- Disable task history.
- Clear conversations.
- Delete stored task records.
- Configure retention.
- Disconnect integrations.
- Revoke permissions.
- Delete their account.

---

## 14. MVP Scope

The MVP should prove that the extension can understand a website and reliably help users complete real tasks.

### Included

1. Chrome extension.
2. Accessible side-panel interface.
3. Text-based interaction.
4. Voice input and output.
5. Active webpage understanding.
6. DOM and accessible-element analysis.
7. Element highlighting.
8. Guided interaction.
9. Task planning.
10. Browser execution.
11. Form filling.
12. Multi-step navigation.
13. Execution status.
14. Pause and stop.
15. User confirmation for consequential actions.
16. Basic error recovery.
17. Completion verification.
18. User preferences.
19. Authentication.
20. Basic task history.
21. Privacy controls.
22. Testing on a range of real websites.

### Excluded from the initial MVP

- Full desktop application control.
- Operating-system-level automation.
- Dedicated native mobile apps.
- Universal integration with every third-party API.
- Enterprise SSO.
- Enterprise administration.
- Private/on-premises deployments.
- A public agent marketplace.
- Advanced shared workflows.
- Unrestricted autonomous financial activity.
- Autonomous operation without user visibility.
- Guaranteed compatibility with every website.
- Dedicated custom integrations for every application.

---

## 15. MVP Demonstration Tasks

The MVP must be demonstrated using realistic tasks across multiple unrelated websites.

Examples:

### Task 1 — Information retrieval

"Find the deadline for this application and tell me what documents I need."

Success:

- Agent identifies relevant information.
- Gives a grounded answer.
- Provides the source context.

### Task 2 — Download

"Find my latest statement and download it."

Success:

- Agent navigates.
- Identifies the correct statement.
- Downloads it.
- Verifies the download.

### Task 3 — Form completion

"Fill in this form using the information I gave you."

Success:

- Correct fields identified.
- Fields populated correctly.
- User can review.
- Form is not submitted without required approval.

### Task 4 — Guided learning

"Teach me how to create a new project in this application."

Success:

- Agent identifies the relevant workflow.
- Provides instructions.
- Highlights relevant controls.
- Can perform steps when asked.

### Task 5 — Voice interaction

"Open my email and find the latest message from my lecturer."

Success:

- Voice command understood.
- Agent navigates.
- Correct email identified.
- Agent reads or summarizes it appropriately.

### Task 6 — Accessibility

A user with limited vision or motor ability completes a multi-step website task using voice and/or the extension's accessible controls.

Success:

- User does not need conventional mouse interaction for the supported workflow.
- Agent communicates its progress.
- User can stop or intervene.
- Task completes correctly.

---

## 16. Success Metrics

### Task performance

- Task completion rate.
- Successful execution rate.
- Task completion time.
- Number of user interventions.
- Error recovery rate.
- Incorrect-action rate.
- Verification success rate.

### Accessibility

- Percentage of supported tasks completed without mouse use.
- Voice task completion rate.
- Keyboard-only usability.
- Screen-reader compatibility.
- User-reported independence.
- User-reported confidence.
- Accessibility usability testing outcomes.

### User experience

- Time to first successful task.
- Repeat usage.
- Tasks completed per user.
- Task abandonment rate.
- Satisfaction.
- Trust in agent execution.

### Safety

- Unauthorized consequential actions.
- Incorrect submissions.
- Prompt injection success rate.
- Permission violations.
- Unintended data exposure.
- Successful user interruption.

---

## 17. Development Roadmap

### Phase 1 — Browser Understanding

Build the extension foundation.

- Chrome extension.
- Side panel.
- Active-page context.
- DOM extraction.
- Accessibility-tree understanding.
- Text chat.
- Element highlighting.

### Phase 2 — Guided Assistance

- Step-by-step instructions.
- Page-aware question answering.
- Interface explanations.
- Accessibility controls.
- Voice input/output.
- User preferences.

### Phase 3 — Agent Execution

- Task planner.
- Browser interaction engine.
- Clicking and typing.
- Form completion.
- Multi-step navigation.
- Execution status.
- Pause and stop.

### Phase 4 — Reliable Autonomous Workflows

- State verification.
- Error recovery.
- Approval system.
- Risk classification.
- Prompt injection defenses.
- Task history.
- Improved visual interaction.

### Phase 5 — Product Expansion

- Additional browsers.
- Application-specific knowledge.
- Enterprise deployment.
- Private inference.
- Integrations.
- Shared task templates.
- Developer platform.

---

## 18. Risks

### Browser compatibility

Websites differ significantly in structure and behavior. Some use complex JavaScript interfaces, canvas-based controls or poorly labeled elements.

Mitigation: multiple interaction strategies and robust state verification.

### Agent reliability

Models may misunderstand interfaces or perform incorrect actions.

Mitigation: action validation, verification, safe retries, approvals and interruption.

### Accessibility effectiveness

AI-generated descriptions may be inaccurate, and assistance may fail for certain disability-related needs.

Mitigation: established accessibility standards, assistive technology compatibility, user testing and honest capability limitations.

### Privacy

Browser content can contain highly sensitive personal information.

Mitigation: data minimization, consent, domain controls, configurable retention, secure storage and privacy-aware inference.

### Security

Malicious webpages may manipulate the agent through prompt injection.

Mitigation: separation of instructions and webpage content, authorization checks and action policies.

### Website restrictions

Some websites restrict automation or use anti-bot protections.

Mitigation: respect website policies, avoid circumventing security mechanisms and allow manual interaction when automation is unavailable.

---

## 19. Long-Term Vision

The browser extension is the initial distribution channel, not necessarily the final limit of the product.

The long-term vision is an intelligent interaction layer that enables people to use software through intent rather than interface complexity.

Potential future capabilities:

- Browser and desktop interaction.
- Mobile application assistance.
- Personalized digital assistants.
- Enterprise software assistance.
- Application-specific knowledge.
- Accessibility APIs.
- Developer SDK.
- Embedded assistance.
- Personalized workflows.
- Agent memory and preferences.
- Cross-application task execution.
- Integration with existing assistive technologies.

The product should eventually make the distinction between "learning how to use an application" and "using an application" less significant.

---

## 20. Product Definition

**We are building an AI browser agent that helps people understand, navigate and operate websites and web applications. It makes digital experiences more accessible while enabling anyone to accomplish tasks through natural language, voice and autonomous browser interaction.**

The extension is the user's interface to the agent.

The agent understands the browser, guides the user, and executes tasks when authorized.

**Core principle: Software should adapt to people, not require people to adapt to software.**
