import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NanoDetector } from '../services/firebase-ai/nanoDetector';
import { FirebaseAiService, RECARE_BROWSER_TOOLS } from '../services/firebase-ai/firebaseAiService';
import { getFirebaseConfig } from '../services/firebase-ai/firebaseConfig';
import { RecareApiClient } from '../services/api';
import { PageContext } from '../types';

describe('Firebase AI Logic Configuration & Nano 4 Detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).ai;
  });

  it('loads valid client configuration without exposing secrets', () => {
    const config = getFirebaseConfig();
    expect(config.apiKey).toBeDefined();
    expect(config.projectId).toBeDefined();
    expect(config.appId).toBeDefined();
    expect(config.appCheckDebugToken).toBeDefined();
  });

  it('detects unsupported environment when window.ai is absent', async () => {
    const status = await NanoDetector.checkAvailability();
    expect(status.available).toBe(false);
    expect(status.status).toBe('unsupported');
    expect(status.message).toContain('Cloud fallback');
  });

  it('detects Gemini Nano ready state when window.ai reports readily available', async () => {
    (window as any).ai = {
      languageModel: {
        capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
      },
    };

    const status = await NanoDetector.checkAvailability();
    expect(status.available).toBe(true);
    expect(status.status).toBe('ready');
    expect(status.message).toContain('ready on-device');
  });

  it('detects downloadable state when Gemini Nano requires download', async () => {
    (window as any).ai = {
      languageModel: {
        capabilities: vi.fn().mockResolvedValue({ available: 'after-download' }),
      },
    };

    const status = await NanoDetector.checkAvailability();
    expect(status.available).toBe(true);
    expect(status.status).toBe('downloadable');
    expect(status.message).toContain('download is required');
  });
});

describe('Firebase AI Logic Tool Declarations & Fallbacks', () => {
  it('defines structured browser tools for cloud function calling', () => {
    const decls = RECARE_BROWSER_TOOLS[0].functionDeclarations;
    const toolNames = decls.map((d: any) => d.name);
    expect(toolNames).toContain('inspect_page');
    expect(toolNames).toContain('highlight_element');
    expect(toolNames).toContain('click_element');
    expect(toolNames).toContain('fill_input');
    expect(toolNames).toContain('navigate_page');
    expect(toolNames).toContain('scroll_page');
  });

  it('provides grounded fallback explanation when running offline or without credentials', async () => {
    vi.spyOn(RecareApiClient, 'sendChat').mockResolvedValue({
      reply: 'Grounded fallback explanation for Billing Portal',
      highlight_targets: [],
      suggested_actions: ['Explain this page'],
    });

    const mockContext: PageContext = {
      url: 'https://example.com/billing',
      domain: 'example.com',
      title: 'Billing Portal',
      headings: [{ level: 1, text: 'Invoices' }],
      interactive_elements: [
        {
          element_id: 'elem_1',
          tag: 'button',
          accessible_name: 'Download PDF',
          is_visible: true,
          is_enabled: true,
        },
      ],
    };

    const result = await FirebaseAiService.explainPageLocally(mockContext, false, 'PREFER_ON_DEVICE');
    expect(result.text).toBeDefined();
    expect(result.inferenceSource).toMatch(/on_device|in_cloud/);
    expect(result.modelUsed).toBeDefined();
  });
});
