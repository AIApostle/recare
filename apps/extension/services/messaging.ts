import { ExtensionMessage, ExtensionResponse, PageContext, BrowserAction, ActionResult } from '../types';

export class MessagingService {
  /** Get active tab ID safely */
  static async getActiveTabId(): Promise<number | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
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

  /** Request structured page context from current webpage */
  static async getPageContext(): Promise<PageContext | null> {
    const response = await this.sendToActiveTab({ type: 'GET_PAGE_CONTEXT' });
    if (response && response.success && 'page_context' in response) {
      return response.page_context;
    }
    return null;
  }

  /** Request execution of a browser action */
  static async executeBrowserAction(action: BrowserAction): Promise<ActionResult> {
    const response = await this.sendToActiveTab({ type: 'EXECUTE_ACTION', action });
    if (response && response.success && 'result' in response) {
      return response.result;
    }
    return {
      action_id: action.action_id,
      success: false,
      error: response && !response.success ? response.error : 'Execution failed',
    };
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
