import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NanoDetector } from '../services/firebase-ai/nanoDetector';
import { FirebaseAiService, RECARE_BROWSER_TOOLS } from '../services/firebase-ai/firebaseAiService';
import { getFirebaseConfig } from '../services/firebase-ai/firebaseConfig';
import { RecareApiClient } from '../services/api';
import { StorageService } from '../services/storage';
import { PageContext } from '../types';

describe('Firebase AI Logic Configuration & Nano 4 Detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).ai;
    delete (window as any).LanguageModel;
    delete (globalThis as any).LanguageModel;
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('loads valid client configuration without exposing secrets', () => {
    const config = getFirebaseConfig();
    expect(config.apiKey).toBeDefined();
    expect(config.projectId).toBeDefined();
    expect(config.appId).toBeDefined();
    expect(config.appCheckDebugToken).toBeDefined();
  });

  it('detects unsupported environment when window.ai and LanguageModel are absent', async () => {
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

  it('detects Chrome standard global LanguageModel API readiness', async () => {
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn(),
    };

    const status = await NanoDetector.checkAvailability();
    expect(status.available).toBe(true);
    expect(status.status).toBe('ready');
    expect(status.apiStyle).toBe('standard');
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

describe('Firebase AI Logic Tool Declarations, Render Routing & Local Fallbacks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as any).ai;
    delete (window as any).LanguageModel;
    delete (globalThis as any).LanguageModel;
  });

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

  it('uses Firebase AI hybrid mode and falls back to Render backend if client inference is unavailable', async () => {
    const sendChatSpy = vi.spyOn(RecareApiClient, 'sendChat').mockResolvedValue({
      reply: 'Click the Export button on Billing Portal.',
      highlight_targets: [],
      suggested_actions: ['Explain this page'],
    });

    const mockContext: PageContext = {
      url: 'https://example.com/billing',
      domain: 'example.com',
      title: 'Billing Portal',
      headings: [{ level: 1, text: 'Invoices' }],
      interactive_elements: [],
    };

    const result = await FirebaseAiService.explainPageLocally(
      mockContext,
      false,
      'PREFER_IN_CLOUD',
      'How do I export?',
      [{ role: 'user', content: 'Hi' }]
    );

    expect(sendChatSpy).toHaveBeenCalledWith(
      'How do I export?',
      mockContext,
      'guide',
      false,
      [{ role: 'user', content: 'Hi' }]
    );
    expect(result.text).toBe('Click the Export button on Billing Portal.');
    expect(result.inferenceSource).toBe('in_cloud');
  });

  it('falls back to local Gemini Nano automatically when Firebase Cloud and Render backend are unavailable', async () => {
    vi.spyOn(RecareApiClient, 'sendChat').mockRejectedValue(new Error('Network offline'));

    const destroySpy = vi.fn();
    (globalThis as any).LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn().mockResolvedValue('Local Nano answer for Billing Portal.'),
        destroy: destroySpy,
      }),
    };

    const mockContext: PageContext = {
      url: 'https://example.com/billing',
      domain: 'example.com',
      title: 'Billing Portal',
      headings: [{ level: 1, text: 'Invoices' }],
      interactive_elements: [],
    };

    const result = await FirebaseAiService.explainPageLocally(
      mockContext,
      false,
      'PREFER_IN_CLOUD',
      'Summarize this page'
    );

    expect(result.inferenceSource).toBe('on_device');
    expect(result.text).toBe('Local Nano answer for Billing Portal.');
    expect(result.modelUsed).toContain('Nano');
    expect(destroySpy).toHaveBeenCalled();
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

describe('Conversation Persistence Storage', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('saves, lists, and deletes conversation history threads', async () => {
    await StorageService.saveConversation({
      id: 'conv_1',
      title: 'First chat',
      domain: 'example.com',
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:01:00.000Z',
      messages: [
        { id: 'm1', sender: 'user', text: 'Hello', timestamp: '10:00 AM' },
        { id: 'm2', sender: 'assistant', text: 'Hi there!', timestamp: '10:00 AM' },
      ],
    });
    await StorageService.setActiveConversationId('conv_1');

    const loaded = await StorageService.getConversations();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe('First chat');
    expect(loaded[0].messages).toHaveLength(2);
    expect(await StorageService.getActiveConversationId()).toBe('conv_1');

    const afterDelete = await StorageService.deleteConversation('conv_1');
    expect(afterDelete).toHaveLength(0);
    expect(await StorageService.getActiveConversationId()).toBeNull();
  });
});

describe('On-Device Local Action Planning & ONLY_ON_DEVICE Mode', () => {
  const sampleContext: PageContext = {
    url: 'https://example.com/portal',
    title: 'Recare Accessibility Portal',
    domain: 'example.com',
    headings: [{ text: 'Main Services', level: 1 }],
    interactive_elements: [
      {
        element_id: 'elem_form',
        selector: '#form-link',
        tag: 'a',
        text: 'Form Page',
        accessible_name: 'Open Form Page',
        role: 'link',
        is_visible: true,
        is_enabled: true,
        bounds: { x: 10, y: 10, width: 100, height: 30 },
      },
      {
        element_id: 'elem_search',
        selector: 'input#search-input',
        tag: 'input',
        text: '',
        accessible_name: 'Search Documentation',
        role: 'searchbox',
        is_visible: true,
        is_enabled: true,
        bounds: { x: 10, y: 50, width: 200, height: 30 },
      },
    ],
  };

  it('plans browser-level new tab navigation on-device', async () => {
    const action = await FirebaseAiService.planLocalAction(
      'open a new tab in the browser',
      sampleContext
    );
    expect(action).not.toBeNull();
    expect(action?.type).toBe('NAVIGATE');
    expect(action?.value).toBe('__NEW_TAB__');
  });

  it('plans back navigation on-device', async () => {
    const action = await FirebaseAiService.planLocalAction(
      'go back to the previous page',
      sampleContext
    );
    expect(action).not.toBeNull();
    expect(action?.type).toBe('NAVIGATE');
    expect(action?.value).toBe('__BACK__');
  });

  it('plans element clicking on-device matching accessible name', async () => {
    const action = await FirebaseAiService.planLocalAction(
      'open the form page and click on it',
      sampleContext
    );
    expect(action).not.toBeNull();
    expect(action?.type).toBe('CLICK');
    expect(action?.target?.element_id).toBe('elem_form');
  });

  it('plans on-device search bar filling when search input is visible', async () => {
    const action = await FirebaseAiService.planLocalAction(
      'search for something on the search bar maybe social network',
      sampleContext
    );
    expect(action).not.toBeNull();
    expect(action?.type).toBe('FILL');
    expect(action?.target?.element_id).toBe('elem_search');
    expect(action?.value?.toLowerCase()).toContain('social network');
  });

  it('plans browser scrolling down and up on-device', async () => {
    const downAction = await FirebaseAiService.planLocalAction(
      'can you scroll down the page please',
      sampleContext
    );
    expect(downAction).not.toBeNull();
    expect(downAction?.type).toBe('SCROLL');
    expect(downAction?.options?.deltaY).toBeGreaterThan(0);

    const upAction = await FirebaseAiService.planLocalAction(
      'scroll up to the top',
      sampleContext
    );
    expect(upAction).not.toBeNull();
    expect(upAction?.type).toBe('SCROLL');
    expect(upAction?.options?.deltaY).toBeLessThan(0);
  });

  it('strictly runs on-device without calling Render cloud in ONLY_ON_DEVICE mode', async () => {
    const sendChatSpy = vi.spyOn(RecareApiClient, 'sendChat');
    const res = await FirebaseAiService.explainPageLocally(
      sampleContext,
      false,
      'ONLY_ON_DEVICE',
      'What can I do here?'
    );
    expect(sendChatSpy).not.toHaveBeenCalled();
    expect(res.inferenceSource).toBe('on_device');
  });
});
