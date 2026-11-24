const HIGHLIGHT_CONTAINER_ID = 'recare-highlight-container';

export class DomHighlighter {
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
    const container = document.getElementById(HIGHLIGHT_CONTAINER_ID);
    if (container) {
      container.innerHTML = '';
    }
  }

  static highlightElement(element: HTMLElement, label: string = 'Recommended Control'): void {
    this.clearHighlights();
    const container = this.getOrCreateContainer();

    // Scroll element smoothly into view if out of viewport
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

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
      highlightBox.style.transition = 'all 0.2s ease-in-out';

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
    }, 150);
  }
}
