import { BrowserAction, ActionResult } from '../../types';
import { DomHighlighter } from './highlighter';

export class DomExecutor {
  /** Find target element by stable ID, selector, accessible name, or semantic role */
  private static findTargetElement(action: BrowserAction): HTMLElement | null {
    if (action.target?.element_id) {
      const byId = document.querySelector<HTMLElement>(`[data-recare-id="${action.target.element_id}"]`);
      if (byId) return byId;
    }

    if (action.target?.selector) {
      try {
        const bySel = document.querySelector<HTMLElement>(action.target.selector);
        if (bySel) return bySel;
      } catch {}
    }

    // Fallback: match by accessible name or text content across all interactive elements
    if (action.target?.accessible_name) {
      const searchName = action.target.accessible_name.trim().toLowerCase();
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="searchbox"], [tabindex="0"], label'
        )
      );

      // 1. Exact match on accessible name, aria-label, textContent, or placeholder
      for (const el of candidates) {
        const text = (el.textContent || '').trim().toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
        const title = (el.getAttribute('title') || '').trim().toLowerCase();
        if (text === searchName || ariaLabel === searchName || placeholder === searchName || title === searchName) {
          return el;
        }
      }

      // 2. Substring match
      for (const el of candidates) {
        const text = (el.textContent || '').trim().toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
        const title = (el.getAttribute('title') || '').trim().toLowerCase();
        if (
          (text && text.includes(searchName)) ||
          (ariaLabel && ariaLabel.includes(searchName)) ||
          (placeholder && placeholder.includes(searchName)) ||
          (title && title.includes(searchName))
        ) {
          return el;
        }
      }
    }

    // Fallback for search input fields when FILL/TYPE or search action is requested
    if (action.type === 'FILL' || action.type === 'TYPE') {
      const searchInput = document.querySelector<HTMLElement>(
        'input[type="search"], input[name*="search" i], input[placeholder*="search" i], input[aria-label*="search" i], [role="searchbox"], input[type="text"], input:not([type])'
      );
      if (searchInput) return searchInput;
    }

    return null;
  }

  /** Controlled action execution lifecycle */
  static async execute(action: BrowserAction): Promise<ActionResult> {
    const beforeUrl = window.location.href;

    try {
      switch (action.type) {
        case 'HIGHLIGHT': {
          const el = this.findTargetElement(action);
          if (!el) {
            return { action_id: action.action_id, success: false, error: 'Element not found for highlighting' };
          }
          DomHighlighter.highlightElement(el, action.reason || 'Relevant Control');
          return { action_id: action.action_id, success: true, current_url: window.location.href };
        }

        case 'CLICK': {
          const el = this.findTargetElement(action);
          if (!el) {
            return { action_id: action.action_id, success: false, error: 'Target element not found' };
          }
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (typeof el.focus === 'function') {
            el.focus();
          }

          // Dispatch pointer and touch/mouse events for robust screen tapping
          try {
            if (typeof PointerEvent !== 'undefined') {
              el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
            }
          } catch {}
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          try {
            if (typeof PointerEvent !== 'undefined') {
              el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
            }
          } catch {}
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.click();

          // Wait a moment for dynamic page reactions / navigation
          await new Promise((r) => setTimeout(r, 100));
          const alertMsg = document.documentElement.getAttribute('data-recare-alert');
          if (alertMsg) {
            document.documentElement.removeAttribute('data-recare-alert');
          }

          return {
            action_id: action.action_id,
            success: true,
            current_url: window.location.href,
            observed_changes: {
              url_changed: window.location.href !== beforeUrl,
              ...(alertMsg ? { popup_alert: alertMsg } : {}),
            },
          };
        }

        case 'FILL':
        case 'TYPE': {
          const el = this.findTargetElement(action);
          if (!el) {
            return { action_id: action.action_id, success: false, error: 'Target input element not found' };
          }
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (typeof el.focus === 'function') {
            el.focus();
          }

          const val = action.value || '';
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            const proto =
              el instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (nativeSetter) {
              nativeSetter.call(el, val);
            } else {
              el.value = val;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));

            if (action.options?.submit || action.options?.submit_search) {
              const keyInit: KeyboardEventInit = {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              };
              const notPrevented = el.dispatchEvent(new KeyboardEvent('keydown', keyInit));
              el.dispatchEvent(new KeyboardEvent('keypress', keyInit));
              el.dispatchEvent(new KeyboardEvent('keyup', keyInit));

              const form = el.closest('form');
              if (form && notPrevented) {
                const submitBtn = form.querySelector<HTMLElement>(
                  'button[type="submit"], input[type="submit"], button[aria-label*="search" i]'
                );
                if (submitBtn) {
                  submitBtn.click();
                } else if (typeof form.requestSubmit === 'function') {
                  form.requestSubmit();
                } else {
                  form.submit();
                }
              }
              await new Promise((r) => setTimeout(r, 250));
            }
          } else {
            el.textContent = val;
          }

          return {
            action_id: action.action_id,
            success: true,
            current_url: window.location.href,
            observed_changes: { url_changed: window.location.href !== beforeUrl },
          };
        }

        case 'SELECT': {
          const el = this.findTargetElement(action);
          if (el instanceof HTMLSelectElement && action.value) {
            el.value = action.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { action_id: action.action_id, success: true, current_url: window.location.href };
          }
          return { action_id: action.action_id, success: false, error: 'Target is not a select dropdown' };
        }

        case 'SCROLL': {
          const deltaY = action.options?.deltaY ?? action.options?.delta_y ?? 550;
          const deltaX = action.options?.deltaX ?? action.options?.delta_x ?? 0;
          const beforeY = window.scrollY;

          if (deltaY >= 90000) {
            // Scroll to bottom of webpage
            window.scrollTo({ top: Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0), behavior: 'smooth' });
          } else if (deltaY <= -90000) {
            // Scroll to top of webpage
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            window.scrollBy({ top: deltaY, left: deltaX, behavior: 'smooth' });
          }

          // If the page body or window did not move (common in SPA scrollable containers), scroll the inner scrollable container
          setTimeout(() => {
            if (window.scrollY === beforeY) {
              const scrollable = Array.from(document.querySelectorAll<HTMLElement>('*')).find((el) => {
                try {
                  const style = window.getComputedStyle(el);
                  const canScroll = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
                  return canScroll && el.clientHeight > 200;
                } catch {
                  return false;
                }
              });
              if (scrollable) {
                if (deltaY >= 90000) {
                  scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: 'smooth' });
                } else if (deltaY <= -90000) {
                  scrollable.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  scrollable.scrollBy({ top: deltaY, left: deltaX, behavior: 'smooth' });
                }
              }
            }
          }, 60);

          await new Promise((r) => setTimeout(r, 350));
          return { action_id: action.action_id, success: true, current_url: window.location.href };
        }

        case 'NAVIGATE': {
          if (action.value === '__BACK__') {
            window.history.back();
            await new Promise((r) => setTimeout(r, 250));
            return {
              action_id: action.action_id,
              success: true,
              current_url: window.location.href,
              observed_changes: { navigated_back: true },
            };
          }
          if (action.value === '__FORWARD__') {
            window.history.forward();
            await new Promise((r) => setTimeout(r, 250));
            return {
              action_id: action.action_id,
              success: true,
              current_url: window.location.href,
              observed_changes: { navigated_forward: true },
            };
          }
          if (action.value === '__RELOAD__') {
            window.location.reload();
            return { action_id: action.action_id, success: true, current_url: window.location.href };
          }
          if (action.value) {
            window.location.href = action.value;
            return {
              action_id: action.action_id,
              success: true,
              current_url: action.value,
              observed_changes: { url_changed: true },
            };
          }
          return { action_id: action.action_id, success: false, error: 'Navigate URL missing' };
        }

        case 'WAIT': {
          const ms = action.options?.duration_ms ?? 1000;
          await new Promise((r) => setTimeout(r, ms));
          return { action_id: action.action_id, success: true, current_url: window.location.href };
        }

        case 'PRESS_KEY': {
          const key = action.value || 'Enter';
          const el = this.findTargetElement(action) || document.activeElement || document.body;
          el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
          return { action_id: action.action_id, success: true, current_url: window.location.href };
        }

        default:
          return { action_id: action.action_id, success: false, error: `Unsupported action type: ${action.type}` };
      }
    } catch (err: any) {
      return { action_id: action.action_id, success: false, error: err.message || String(err) };
    }
  }
}
