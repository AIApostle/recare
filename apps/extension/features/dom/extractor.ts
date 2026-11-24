import { PageContext, ElementMetadata, HeadingItem } from '../../types';

export class DomExtractor {
  private static elementCounter = 0;

  /** Check if element is visible and rendered */
  private static isElementVisible(el: HTMLElement): boolean {
    if (!el) return false;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    }
    // In real browser check rects; in jsdom default to true
    if (el.getBoundingClientRect) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && el.offsetParent !== null) {
        return false;
      }
    }
    return true;
  }

  /** Compute accessible name following WAI-ARIA principles */
  private static computeAccessibleName(el: HTMLElement): string {
    // 1. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.trim()) return ariaLabel.trim();

    // 2. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
    }

    // 3. Form input associated label
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }
      const parentLabel = el.closest('label');
      if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();
      if (el.placeholder?.trim()) return el.placeholder.trim();
    }

    // 4. Inner text / button text
    if (el.textContent?.trim()) {
      return el.textContent.trim().slice(0, 100);
    }

    // 5. Title attribute
    if (el.title?.trim()) return el.title.trim();

    return '';
  }

  /** Extract page headings */
  private static extractHeadings(): HeadingItem[] {
    const headings: HeadingItem[] = [];
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    elements.forEach((el) => {
      if (el.textContent?.trim()) {
        const level = parseInt(el.tagName.replace('H', ''), 10) || 1;
        headings.push({ level, text: el.textContent.trim() });
      }
    });
    return headings.slice(0, 15);
  }

  /** Extract interactive elements with stable IDs and sanitization */
  private static extractInteractiveElements(): ElementMetadata[] {
    const selector = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[tabindex="0"]',
    ].join(', ');

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const items: ElementMetadata[] = [];
    this.elementCounter = 0;

    for (const el of nodes) {
      if (!this.isElementVisible(el)) continue;

      this.elementCounter += 1;
      const elementId = `elem_${this.elementCounter}`;
      el.setAttribute('data-recare-id', elementId);

      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const accessibleName = this.computeAccessibleName(el);
      const isInput = el instanceof HTMLInputElement;
      const inputType = isInput ? el.type.toLowerCase() : undefined;

      // Privacy: NEVER capture password values
      let currentValue: string | undefined;
      if (inputType === 'password') {
        currentValue = '[PASSWORD_PROTECTED]';
      } else if (isInput || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        currentValue = (el as HTMLInputElement).value?.slice(0, 200);
      }

      const rect = el.getBoundingClientRect();
      items.push({
        element_id: elementId,
        tag: el.tagName.toLowerCase(),
        role,
        accessible_name: accessibleName,
        text: el.textContent?.trim().slice(0, 80),
        is_visible: true,
        is_enabled: !(el as HTMLButtonElement).disabled,
        input_type: inputType,
        current_value: currentValue,
        placeholder: (el as HTMLInputElement).placeholder,
        href: (el as HTMLAnchorElement).href,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });

      if (items.length >= 75) break; // Keep payload fast and bounded
    }

    return items;
  }

  /** Extract clean page content summary, stripping scripts/styles */
  private static extractMainContentSummary(): string {
    const clone = document.body.cloneNode(true) as HTMLElement;
    // Strip scripts, styles, iframes, and recare overlays
    clone.querySelectorAll('script, style, noscript, iframe, #recare-highlight-container').forEach((s) => s.remove());
    const rawText = clone.innerText || clone.textContent || '';
    // Collapse excess whitespace
    return rawText.replace(/\s+/g, ' ').trim().slice(0, 2500);
  }

  /** Build structured page context */
  static extractPageContext(): PageContext {
    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title || window.location.hostname,
      headings: this.extractHeadings(),
      interactive_elements: this.extractInteractiveElements(),
      main_content_summary: this.extractMainContentSummary(),
      timestamp: new Date().toISOString(),
    };
  }
}
