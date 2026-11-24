# Recare Accessibility Implementation (WCAG 2.2 AA)

Recare is built from the ground up to empower people with disabilities to independently understand and operate modern web applications.

## 1. Visual Accessibility
- **Accessible Names & Roles**: Computes ARIA roles, labels, and associated text.
- **Visual Highlighting**: Places a high-contrast (#16a34a) outline and badge tag over relevant webpage elements.
- **Text-to-Speech (TTS)**: Spoken readout for all assistant replies, interface descriptions, and task progress via the browser SpeechSynthesis API.
- **Adjustable Text Sizes**: Small, Medium, Large, and Extra Large typography options in the side panel.
- **High-Contrast Mode**: Enhanced visual borders and strict color contrast ratios meeting WCAG AAA guidelines.

## 2. Motor Accessibility
- **Voice Control (Speech-to-Text)**: Users can press the microphone button or use voice commands to state requests without repetitive mouse clicking.
- **Keyboard Navigation**:
  - Global extension shortcut `Ctrl+Shift+U` (or `Cmd+Shift+U` on Mac).
  - Explicit visible focus rings (`:focus-visible`) across all interactive buttons, inputs, and toggles.
  - Standard tab-order navigation across all side panel views.
- **Immediate Task Controls**: Accessible Pause, Resume, Stop Immediately, and Manual Takeover buttons.

## 3. Cognitive Accessibility
- **Simplified Language Mode**: Rewrites technical instructions into simple, plain-language explanations.
- **Step-by-Step Task Plans**: Breaks multi-step workflows into numbered, verifiable steps with visible progress indicators.
- **Reduced Motion**: Disables UI animations and transitions when requested by system settings or user preference.
