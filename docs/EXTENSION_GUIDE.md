# Recare Extension Guide

## Loading the Extension in Google Chrome

1. Build the extension:
   ```bash
   pnpm build
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the upper-right corner.
4. Click **Load unpacked**.
5. Select the build directory:
   ```text
   /path/to/recare/apps/extension/.output/chrome-mv3
   ```
6. The **Recare — AI Browser Agent & Accessibility Assistant** will appear in your extensions list.

## Opening Recare
- **Action Icon**: Click the Recare icon in the Chrome toolbar.
- **Keyboard Shortcut**: Press `Ctrl+Shift+U` (or `Command+Shift+U` on macOS).
- The side panel will slide open on any supported webpage.

## Permissions Explained
- `sidePanel`: Displays the persistent Recare assistant UI alongside the webpage.
- `storage`: Saves local accessibility preferences (text size, speech rate, interaction mode).
- `activeTab`: Grants access to inspect the DOM of the tab the user is actively viewing.
- `scripting`: Allows injecting the content script dynamically on tabs opened before the extension was loaded.
- `tabs`: Enables detecting tab changes and URL navigation.
- `commands`: Supports the `Ctrl+Shift+U` accessibility keyboard shortcut.
