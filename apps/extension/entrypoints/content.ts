import { DomExtractor } from '../features/dom/extractor';
import { DomExecutor } from '../features/dom/executor';
import { DomHighlighter } from '../features/dom/highlighter';
import { ExtensionMessage } from '../types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[Recare] Content script active on:', window.location.href);

    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      if (!message || !message.type) return false;

      switch (message.type) {
        case 'PING': {
          sendResponse({ success: true });
          return false;
        }

        case 'GET_PAGE_CONTEXT': {
          try {
            const context = DomExtractor.extractPageContext();
            sendResponse({ success: true, page_context: context });
          } catch (err: any) {
            sendResponse({ success: false, error: err.message || 'Failed to extract DOM context' });
          }
          return false;
        }

        case 'EXECUTE_ACTION': {
          // Asynchronous action execution
          DomExecutor.execute(message.action)
            .then((result) => {
              sendResponse({ success: true, result });
            })
            .catch((err) => {
              sendResponse({
                success: false,
                error: err.message || 'Execution failed in content script',
              });
            });
          return true; // Keep message channel open for async response
        }

        case 'HIGHLIGHT_ELEMENT': {
          try {
            let el: HTMLElement | null = null;
            if (message.element_id) {
              el = document.querySelector<HTMLElement>(`[data-recare-id="${message.element_id}"]`);
            }
            if (!el && message.selector) {
              el = document.querySelector<HTMLElement>(message.selector);
            }
            if (el) {
              DomHighlighter.highlightElement(el, message.label || 'Relevant Control');
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Target element not found for highlight' });
            }
          } catch (err: any) {
            sendResponse({ success: false, error: err.message });
          }
          return false;
        }

        case 'CLEAR_HIGHLIGHTS': {
          DomHighlighter.clearHighlights();
          sendResponse({ success: true });
          return false;
        }

        default:
          return false;
      }
    });
  },
});
