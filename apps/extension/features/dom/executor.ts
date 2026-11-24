import { BrowserAction, ActionResult } from '../../types';
import { DomHighlighter } from './highlighter';

export class DomExecutor {
  /** Find target element by stable ID, selector, or accessible name */
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

    // Fallback: match by accessible name or text content
    if (action.target?.accessible_name) {
      const searchName = action.target.accessible_name.toLowerCase();
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, input, [role="button"]'));
      for (const el of candidates) {
        const text = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes(searchName)) {
          return el;
        }
      }
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
          // Dispatch standard pointer and click events
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.click();

          // Wait a moment for dynamic page reactions / navigation
          await new Promise((r) => setTimeout(r, 100));
          return {
            action_id: action.action_id,
            success: true,
            current_url: window.location.href,
            observed_changes: { url_changed: window.location.href !== beforeUrl },
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
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = val;
          }

          return { action_id: action.action_id, success: true, current_url: window.location.href };
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
          const deltaY = action.options?.deltaY ?? 400;
          window.scrollBy({ top: deltaY, behavior: 'smooth' });
          await new Promise((r) => setTimeout(r, 300));
          return { action_id: action.action_id, success: true, current_url: window.location.href };
        }

        case 'NAVIGATE': {
          if (action.value) {
            window.location.href = action.value;
            return { action_id: action.action_id, success: true, current_url: action.value };
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
