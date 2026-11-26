import { DomExtractor } from '../features/dom/extractor';
import { DomExecutor } from '../features/dom/executor';
import { DomHighlighter } from '../features/dom/highlighter';
import { ExtensionMessage } from '../types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[Recare] Content script active on:', window.location.href);

    // Trap webpage window.alert to render non-blocking visual toasts and notify Recare
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          if (window.__recare_alert_hooked) return;
          window.__recare_alert_hooked = true;
          const origAlert = window.alert;
          window.alert = function(msg) {
            const str = String(msg);
            document.documentElement.setAttribute('data-recare-alert', str);
            window.dispatchEvent(new CustomEvent('recare-page-alert', { detail: { message: str } }));
            console.info('[Recare Webpage Alert]:', str);
            try {
              let toast = document.getElementById('recare-alert-toast');
              if (!toast) {
                toast = document.createElement('div');
                toast.id = 'recare-alert-toast';
                toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;background:#18181b;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.3);font-family:system-ui,sans-serif;font-size:13px;font-weight:600;max-width:340px;border-left:4px solid #22c55e;transition:opacity 0.25s;';
                document.body.appendChild(toast);
              }
              toast.textContent = '📢 ' + str;
              toast.style.display = 'block';
              toast.style.opacity = '1';
              setTimeout(() => {
                if (toast) {
                  toast.style.opacity = '0';
                  setTimeout(() => { if (toast) toast.style.display = 'none'; }, 250);
                }
              }, 4500);
            } catch {}
          };
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch {}

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
