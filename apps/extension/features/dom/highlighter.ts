const HIGHLIGHT_CONTAINER_ID = 'recare-highlight-container';

export class DomHighlighter {
  private static dismissTimeout: any = null;
  private static cleanupListeners: (() => void) | null = null;

  private static getOrCreateContainer(): HTMLElement {
    let container = document.getElementById(HIGHLIGHT_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = HIGHLIGHT_CONTAINER_ID;
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '2147483647'; // Max z-index
      document.body.appendChild(container);
    }
    return container;
  }

  static clearHighlights(): void {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
    const container = document.getElementById(HIGHLIGHT_CONTAINER_ID);
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Smoothly fades out and cleans up all active highlights.
   */
  static fadeAndClear(durationMs: number = 350): void {
    const container = document.getElementById(HIGHLIGHT_CONTAINER_ID);
    if (!container) return;

    const boxes = container.querySelectorAll<HTMLElement>('.recare-highlight-box');
    boxes.forEach((box) => {
      box.style.opacity = '0';
      box.style.transform = 'scale(0.97)';
    });

    setTimeout(() => {
      this.clearHighlights();
    }, durationMs);
  }

  static highlightElement(
    element: HTMLElement,
    label: string = 'Recommended Control',
    autoDismissSeconds: number = 20
  ): void {
    this.clearHighlights();
    const container = this.getOrCreateContainer();

    // Scroll element smoothly into view if out of viewport
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    // Allow scroll to settle before measuring bounds
    setTimeout(() => {
      const rect = element.getBoundingClientRect();
      const highlightBox = document.createElement('div');
      highlightBox.className = 'recare-highlight-box';
      highlightBox.style.position = 'absolute';
      highlightBox.style.top = `${rect.top}px`;
      highlightBox.style.left = `${rect.left}px`;
      highlightBox.style.width = `${rect.width}px`;
      highlightBox.style.height = `${rect.height}px`;
      highlightBox.style.border = '3px solid #16a34a';
      highlightBox.style.borderRadius = '6px';
      highlightBox.style.boxShadow = '0 0 0 4px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)';
      highlightBox.style.pointerEvents = 'none';
      highlightBox.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out, top 0.2s, left 0.2s';
      highlightBox.style.opacity = '1';
      highlightBox.style.transform = 'scale(1)';

      // Badge tag above or below element
      const badge = document.createElement('div');
      badge.textContent = label;
      badge.style.position = 'absolute';
      badge.style.top = rect.top > 32 ? '-28px' : `${rect.height + 6}px`;
      badge.style.left = '0';
      badge.style.backgroundColor = '#15803d';
      badge.style.color = '#ffffff';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = 'bold';
      badge.style.padding = '2px 8px';
      badge.style.borderRadius = '4px';
      badge.style.whiteSpace = 'nowrap';
      badge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

      highlightBox.appendChild(badge);
      container.appendChild(highlightBox);

      // Auto-dismiss timer so highlight does not stay on screen indefinitely
      if (autoDismissSeconds > 0) {
        this.dismissTimeout = setTimeout(() => {
          this.fadeAndClear(350);
        }, autoDismissSeconds * 1000);
      }

      // Auto-dismiss immediately when the user clicks or presses a key anywhere on the page
      const dismissOnInteraction = () => {
        this.fadeAndClear(250);
      };

      window.addEventListener('pointerdown', dismissOnInteraction, { once: true, passive: true });
      window.addEventListener('keydown', dismissOnInteraction, { once: true, passive: true });

      this.cleanupListeners = () => {
        window.removeEventListener('pointerdown', dismissOnInteraction);
        window.removeEventListener('keydown', dismissOnInteraction);
      };
    }, 150);
  }
}
