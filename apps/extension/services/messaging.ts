import { ExtensionMessage, ExtensionResponse, PageContext, BrowserAction, ActionResult } from '../types';

export class MessagingService {
  /** Get active browser webpage tab safely (never returning sidepanel/extension tab) */
  static async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    const current = await chrome.tabs.query({ active: true, currentWindow: true });
    const first = current.find((t) => t.url && !t.url.startsWith('chrome-extension://')) || current[0];
    if (first && first.url && !first.url.startsWith('chrome-extension://')) {
      return first;
    }
    const lastFocused = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const webTab = lastFocused.find((t) => t.url && !t.url.startsWith('chrome-extension://'));
    return webTab || first || null;
  }

  /** Get active tab ID safely */
  static async getActiveTabId(): Promise<number | null> {
    const tab = await this.getActiveTab();
    return tab?.id ?? null;
  }

  /** Return basic tab metadata when content script is unavailable (e.g. chrome:// pages) */
  static async getActiveTabFallbackContext(): Promise<PageContext | null> {
    const tab = await this.getActiveTab();
    if (!tab?.url || tab.url.startsWith('chrome-extension://')) return null;
    let domain = 'browser';
    try {
      domain = new URL(tab.url).hostname || domain;
    } catch {}
    return {
      url: tab.url,
      domain,
      title: tab.title || domain,
      headings: [],
      interactive_elements: [],
      timestamp: new Date().toISOString(),
    };
  }

  /** Send typed message to content script of the active tab */
  static async sendToActiveTab(message: ExtensionMessage): Promise<ExtensionResponse> {
    const tabId = await this.getActiveTabId();
    if (!tabId) {
      return { success: false, error: 'No active browser tab found' };
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (err: any) {
      // Content script may not be injected yet on an existing tab
      try {
        if (chrome.scripting) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/content.js'],
          });
          // Retry message after brief delay
          await new Promise((r) => setTimeout(r, 150));
          const retryRes = await chrome.tabs.sendMessage(tabId, message);
          return retryRes;
        }
      } catch (injectionErr: any) {
        return {
          success: false,
          error: `Cannot communicate with webpage: ${err.message || injectionErr.message}`,
        };
      }
      return { success: false, error: err.message || 'Content script unavailable' };
    }
  }

  /** Wait briefly for active tab navigation / DOM mutations to settle before re-observing */
  static async waitForPageSettle(maxWaitMs: number = 3500): Promise<void> {
    const tabId = await this.getActiveTabId();
    await new Promise((r) => setTimeout(r, 350));
    if (!tabId || typeof chrome === 'undefined' || !chrome.tabs?.get) return;

    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab?.status === 'complete') {
          await new Promise((r) => setTimeout(r, 250));
          return;
        }
      } catch {
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  /** Request structured page context from current webpage */
  static async getPageContext(): Promise<PageContext | null> {
    const response = await this.sendToActiveTab({ type: 'GET_PAGE_CONTEXT' });
    if (response && response.success && 'page_context' in response) {
      return response.page_context;
    }
    return null;
  }

  /** Capture screenshot of visible tab for visual multimodal understanding */
  static async capturePageScreenshot(): Promise<string | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.captureVisibleTab) {
        const screenshot = await chrome.tabs.captureVisibleTab(undefined as any, {
          format: 'jpeg',
          quality: 60,
        });
        return screenshot;
      }
    } catch (err: any) {
      console.info('[Recare] Visual screenshot capture omitted or unavailable:', err?.message || err);
    }
    return null;
  }

  /** Request execution of a browser action */
  static async executeBrowserAction(action: BrowserAction): Promise<ActionResult> {
    // Handle browser-level history/tabs/reload navigation directly via Chrome Tabs API
    if (action.type === 'NAVIGATE' && typeof chrome !== 'undefined' && chrome.tabs) {
      const tabId = await this.getActiveTabId();
      if (action.value === '__NEW_TAB__' || action.value?.startsWith('__NEW_TAB__')) {
        try {
          const newTabUrl = action.options?.url || 'chrome://newtab';
          const newTab = await chrome.tabs.create({ url: newTabUrl });
          return {
            action_id: action.action_id,
            success: true,
            current_url: newTab.url || newTabUrl,
            observed_changes: { new_tab_opened: true, tab_id: newTab.id },
          };
        } catch {
          try {
            const fallbackTab = await chrome.tabs.create({ url: 'https://www.google.com' });
            return {
              action_id: action.action_id,
              success: true,
              current_url: fallbackTab.url || 'https://www.google.com',
              observed_changes: { new_tab_opened: true },
            };
          } catch (err: any) {
            return { action_id: action.action_id, success: false, error: err.message };
          }
        }
      }

      if (tabId) {
        if (action.value === '__BACK__' && typeof chrome.tabs.goBack === 'function') {
          try {
            await chrome.tabs.goBack(tabId);
            await new Promise((r) => setTimeout(r, 350));
            const tab = await chrome.tabs.get(tabId);
            return {
              action_id: action.action_id,
              success: true,
              current_url: tab?.url,
              observed_changes: { url_changed: true, navigated_back: true },
            };
          } catch {}
        }
        if (action.value === '__FORWARD__' && typeof chrome.tabs.goForward === 'function') {
          try {
            await chrome.tabs.goForward(tabId);
            await new Promise((r) => setTimeout(r, 350));
            const tab = await chrome.tabs.get(tabId);
            return {
              action_id: action.action_id,
              success: true,
              current_url: tab?.url,
              observed_changes: { url_changed: true, navigated_forward: true },
            };
          } catch {}
        }
        if (action.value === '__RELOAD__' && typeof chrome.tabs.reload === 'function') {
          try {
            await chrome.tabs.reload(tabId);
            await new Promise((r) => setTimeout(r, 350));
            return { action_id: action.action_id, success: true };
          } catch {}
        }
        if (action.value === '__HOME__') {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab?.url) {
              const origin = new URL(tab.url).origin;
              await chrome.tabs.update(tabId, { url: origin });
              await this.waitForPageSettle();
              return {
                action_id: action.action_id,
                success: true,
                current_url: origin,
                observed_changes: { url_changed: true, navigated: true },
              };
            }
          } catch {}
        }
      }
    }

    try {
      const response = await this.sendToActiveTab({ type: 'EXECUTE_ACTION', action });
      if (response && response.success && 'result' in response) {
        return response.result;
      }

      // Check if error is due to page navigation tearing down the content script
      const errMsg = response && !response.success ? response.error : '';
      if (
        errMsg.includes('message channel closed') ||
        errMsg.includes('Could not establish connection')
      ) {
        // The action triggered a page navigation! Settle and treat as successful navigation
        await this.waitForPageSettle(3000);
        const tab = await this.getActiveTab();
        return {
          action_id: action.action_id,
          success: true,
          current_url: tab?.url,
          observed_changes: { url_changed: true, page_navigated: true },
        };
      }

      return {
        action_id: action.action_id,
        success: false,
        error: errMsg || 'Execution failed',
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (
        msg.includes('message channel closed') ||
        msg.includes('Could not establish connection')
      ) {
        await this.waitForPageSettle(3000);
        const tab = await this.getActiveTab();
        return {
          action_id: action.action_id,
          success: true,
          current_url: tab?.url,
          observed_changes: { url_changed: true, page_navigated: true },
        };
      }
      return { action_id: action.action_id, success: false, error: msg };
    }
  }

  /** Request highlighting of an element */
  static async highlightElement(elementId?: string, selector?: string, label?: string): Promise<boolean> {
    const response = await this.sendToActiveTab({
      type: 'HIGHLIGHT_ELEMENT',
      element_id: elementId,
      selector,
      label,
    });
    return Boolean(response?.success);
  }

  /** Clear all page overlays */
  static async clearHighlights(): Promise<void> {
    await this.sendToActiveTab({ type: 'CLEAR_HIGHLIGHTS' });
  }
}
