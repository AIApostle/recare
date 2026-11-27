import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  FunctionCallingMode,
  SchemaType,
  GenerativeModel,
} from 'firebase/ai';
import { getFirebaseConfig } from './firebaseConfig';
import { initAppCheck } from './appCheck';
import { NanoDetector, NanoAvailability } from './nanoDetector';
import { PageContext, BrowserAction, ActionType, GeneratedDocument } from '../../types';
import { RecareApiClient } from '../api';

export type SelectedInferenceMode =
  | 'PREFER_ON_DEVICE'
  | 'ONLY_ON_DEVICE'
  | 'PREFER_IN_CLOUD'
  | 'ONLY_IN_CLOUD';

export type CurrentInferencePath =
  | 'on_device'
  | 'in_cloud'
  | 'downloading_model'
  | 'fallback_to_cloud'
  | 'idle';

export interface AIExecutionResult {
  text: string;
  inferenceSource: 'on_device' | 'in_cloud';
  modelUsed: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  generatedDocument?: GeneratedDocument;
}

// Function Calling Tool Declarations for Firebase AI Cloud Model
export const RECARE_BROWSER_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'inspect_page',
        description: 'Inspect the active webpage structure, headings, and interactive elements',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'highlight_element',
        description: 'Visually highlight an element with an accessible outline and label to guide the user',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            element_id: { type: SchemaType.STRING, description: 'Stable element ID e.g. elem_1' },
            label: { type: SchemaType.STRING, description: 'User-facing label or guide text' },
          },
          required: ['element_id'],
        },
      },
      {
        name: 'click_element',
        description: 'Click a button, tab, link, or interactive control on the active webpage',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            element_id: { type: SchemaType.STRING, description: 'Target element ID' },
            reason: { type: SchemaType.STRING, description: 'Why this element is being clicked' },
          },
          required: ['element_id', 'reason'],
        },
      },
      {
        name: 'fill_input',
        description: 'Fill text into an input field or textarea',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            element_id: { type: SchemaType.STRING, description: 'Target input field ID' },
            value: { type: SchemaType.STRING, description: 'Text value to enter' },
            reason: { type: SchemaType.STRING, description: 'Purpose of data entry' },
          },
          required: ['element_id', 'value'],
        },
      },
      {
        name: 'navigate_page',
        description: 'Navigate to a specific URL within the application',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            url: { type: SchemaType.STRING, description: 'Full URL to navigate to' },
            reason: { type: SchemaType.STRING, description: 'Purpose of navigation' },
          },
          required: ['url'],
        },
      },
      {
        name: 'scroll_page',
        description: 'Scroll the webpage up or down to reveal more content',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            delta_y: { type: SchemaType.NUMBER, description: 'Scroll distance in pixels (+down, -up)' },
          },
        },
      },
    ],
  },
];

export class FirebaseAiService {
  private static app: FirebaseApp | null = null;
  private static ai: any = null;
  private static activeInferencePath: CurrentInferencePath = 'idle';

  /** Initialize Firebase App, App Check, and Firebase AI Logic */
  static async initialize(): Promise<boolean> {
    try {
      const config = getFirebaseConfig();
      if (!getApps().length) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }

      // Initialize App Check
      initAppCheck(this.app);

      // Initialize Firebase AI Logic service with Google AI backend
      this.ai = getAI(this.app, { backend: new GoogleAIBackend() });
      console.log('[Recare] Firebase AI Logic service initialized.');
      return true;
    } catch (err) {
      console.error('[Recare] Failed to initialize Firebase AI Logic:', err);
      return false;
    }
  }

  static getActiveInferencePath(): CurrentInferencePath {
    return this.activeInferencePath;
  }

  /**
   * Hybrid page & conversational assistant powered by Firebase AI Logic (`firebase/ai`).
   * Uses Firebase AI's native `InferenceMode` (`PREFER_IN_CLOUD` / `PREFER_ON_DEVICE`)
   * so if the cloud model is unavailable, Firebase automatically falls back to Chrome's
   * on-device Gemini Nano model; if both are unavailable, backs up cleanly via Render & DOM heuristics.
   */
  static async explainPageLocally(
    pageContext: PageContext,
    simplified: boolean = false,
    selectedMode: SelectedInferenceMode = 'PREFER_IN_CLOUD',
    userMessage?: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    imageBase64?: string
  ): Promise<AIExecutionResult> {
    await this.initialize();

    const title = pageContext.title || 'Current Webpage';
    const domain = pageContext.domain || 'Active Site';
    const headings = pageContext.headings.map((h) => h.text).slice(0, 5).join(', ');
    const elements = pageContext.interactive_elements
      .slice(0, 12)
      .map((e) => e.accessible_name || e.text || '')
      .filter(Boolean)
      .join(', ');

    const historyBlock = conversationHistory.length > 0
      ? `\nRecent conversation:\n${conversationHistory
          .slice(-6)
          .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
          .join('\n')}\n`
      : '';

    const localSystemPrompt = simplified
      ? `You are Recare, an accessibility browser assistant. Explain in very simple, calm, plain language without jargon. NEVER output technical IDs like [elem_1] or HTML tags.`
      : `You are Recare, an AI accessibility browser assistant. Answer clearly, accurately, and concisely in plain human language grounded in the webpage details. NEVER output technical IDs like [elem_1] or HTML tags.`;

    const promptBody = userMessage?.trim()
      ? `${localSystemPrompt}\n\nWebpage: ${title} (${domain})\nSections: ${headings || 'None'}\nVisible options: ${elements || 'General links'}${historyBlock}\nUser: ${userMessage.trim()}`
      : `${localSystemPrompt}\n\nSummarize "${title}" (${domain}), sections (${headings}), and visible options (${elements}).`;

    const chatMessage = userMessage?.trim() || promptBody;

    const modeMap: Record<SelectedInferenceMode, InferenceMode> = {
      PREFER_IN_CLOUD: InferenceMode.PREFER_IN_CLOUD,
      PREFER_ON_DEVICE: InferenceMode.PREFER_ON_DEVICE,
      ONLY_IN_CLOUD: InferenceMode.ONLY_IN_CLOUD,
      ONLY_ON_DEVICE: InferenceMode.ONLY_ON_DEVICE,
    };
    const modeEnum = modeMap[selectedMode] || InferenceMode.PREFER_IN_CLOUD;
    this.activeInferencePath =
      selectedMode === 'ONLY_ON_DEVICE' || selectedMode === 'PREFER_ON_DEVICE'
        ? 'on_device'
        : 'in_cloud';

    // 1. Primary path: Firebase AI Logic with native hybrid fallback to on-device Gemini Nano
    if (this.ai) {
      try {
        const model = getGenerativeModel(this.ai, {
          mode: modeEnum,
          inCloudParams: { model: 'gemini-3.5-flash-lite' },
          onDeviceParams: {
            createOptions: {
              expectedInputs: [{ type: 'text', languages: ['en'] }],
              expectedOutputs: [{ type: 'text', languages: ['en'] }],
            },
          },
        });

        const contents: any = promptBody;
        const result = await model.generateContent(contents);
        const rawText = result.response.text()?.trim();
        const text = rawText ? rawText.replace(/\[?elem_\d+\]?\s*/gi, '').trim() : '';
        if (text) {
          const source =
            (result as any).inferenceSource === InferenceSource.ON_DEVICE
              ? 'on_device'
              : 'in_cloud';
          this.activeInferencePath = source;
          return {
            text,
            inferenceSource: source,
            modelUsed:
              source === 'on_device'
                ? 'Gemini Nano (Firebase On-Device Fallback)'
                : 'Gemini 3.5 Flash Lite (Firebase AI)',
          };
        }
      } catch (firebaseErr: any) {
        console.info(
          '[Recare] Firebase hybrid inference note (trying Render / local fallback):',
          firebaseErr?.message || firebaseErr
        );
      }
    }

    // 2. Fallback to Render Cloud Agent when Firebase AI client call isn't active/reachable
    if (selectedMode !== 'ONLY_ON_DEVICE') {
      try {
        const backendRes = imageBase64
          ? await RecareApiClient.sendChat(
              chatMessage,
              pageContext,
              'guide',
              simplified,
              conversationHistory,
              undefined,
              imageBase64
            )
          : await RecareApiClient.sendChat(
              chatMessage,
              pageContext,
              'guide',
              simplified,
              conversationHistory
            );
        if (backendRes?.reply && !backendRes.reply.includes('AI model is currently not available')) {
          this.activeInferencePath = 'in_cloud';
          return {
            text: backendRes.reply,
            inferenceSource: 'in_cloud',
            modelUsed: 'Recare Cloud (Render)',
            generatedDocument: backendRes.generated_document,
          };
        }
      } catch (backendErr: any) {
        console.info('[Recare] Render backend fallback note:', backendErr?.message || backendErr);
      }
    }

    // 3. Direct On-Device Nano fallback (supports legacy window.ai as well as LanguageModel)
    if (selectedMode !== 'ONLY_IN_CLOUD') {
      try {
        const nanoStatus = await NanoDetector.checkAvailability();
        if (nanoStatus.available && nanoStatus.status === 'ready') {
          const localText = await NanoDetector.runLocalPrompt(promptBody, localSystemPrompt);
          if (localText) {
            this.activeInferencePath = 'on_device';
            return {
              text: localText,
              inferenceSource: 'on_device',
              modelUsed: 'Gemini Nano (On-Device)',
            };
          }
        }
      } catch (nanoErr: any) {
        console.info('[Recare] Direct on-device Nano fallback note:', nanoErr?.message || nanoErr);
      }
    }

    // 4. Grounded fallback / on-device availability notice
    this.activeInferencePath = 'idle';

    if (selectedMode === 'ONLY_ON_DEVICE') {
      const isGreeting = userMessage
        ?.trim()
        .toLowerCase()
        .match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[!.,\s]*$/i);
      const greetingPrefix = isGreeting ? 'Hello! ' : '';
      return {
        text: `${greetingPrefix}⚠️ **On-device model (Gemini Nano) is currently not active or ready on this system.**\n\nI received your message ("${userMessage?.trim() || 'Help on this page'}"), but **"Only Use Local Model"** is turned on while the local Gemini Nano model is not installed or enabled in Chrome (common on systems without a dedicated GPU).\n\n👉 **To get answers immediately:** Open **Settings** (gear icon) and uncheck **"Only Use Local Model"** to switch to Cloud AI, or click the **"Switch to Cloud AI"** button below.`,
        inferenceSource: 'on_device',
        modelUsed: 'Recare On-Device Notice',
      };
    }

    const isGreeting = userMessage
      ?.trim()
      .toLowerCase()
      .match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)[!.,\s]*$/i);
    if (isGreeting) {
      return {
        text: `Hello! I am Recare, your AI accessibility browser assistant. I am active on **${title}** (${domain}). How can I assist you on this page?`,
        inferenceSource: 'on_device',
        modelUsed: 'Recare Assistant Greeting',
      };
    }

    const keyControls = pageContext.interactive_elements
      .slice(0, 5)
      .map((e) => e.accessible_name || e.text || e.tag)
      .filter(Boolean)
      .join(', ');

    return {
      text: `You are on **${title}** (${domain}). Key controls detected include: ${keyControls || 'links and buttons'}. What would you like help with on this page?`,
      inferenceSource: 'on_device',
      modelUsed: 'Recare Local Context Fallback',
    };
  }

  /**
   * Local on-device planner for browser actions when ONLY_ON_DEVICE is selected.
   * Resolves browser-level actions (tabs, history, reload), element clicking,
   * form filling, and smart search purely on-device without cloud calls.
   */
  static async planLocalAction(
    userRequest: string,
    pageContext: PageContext
  ): Promise<BrowserAction | null> {
    const raw = userRequest.trim();
    const lower = raw.toLowerCase();

    // 1. Browser navigation & tab management
    if (lower.includes('new tab') || lower.includes('open a new tab') || lower.includes('play new tab')) {
      return {
        action_id: crypto.randomUUID(),
        type: 'NAVIGATE',
        value: '__NEW_TAB__',
        risk_level: 'LOW',
        requires_approval: false,
        reason: 'Opening a new tab in your browser',
      };
    }

    if (lower.includes('go back') || lower.includes('previous page') || lower === 'back') {
      return {
        action_id: crypto.randomUUID(),
        type: 'NAVIGATE',
        value: '__BACK__',
        risk_level: 'LOW',
        requires_approval: false,
        reason: 'Navigating back to the previous page',
      };
    }

    if (lower.includes('go forward') || lower === 'forward') {
      return {
        action_id: crypto.randomUUID(),
        type: 'NAVIGATE',
        value: '__FORWARD__',
        risk_level: 'LOW',
        requires_approval: false,
        reason: 'Navigating forward',
      };
    }

    if (lower.includes('reload') || lower.includes('refresh page')) {
      return {
        action_id: crypto.randomUUID(),
        type: 'NAVIGATE',
        value: '__RELOAD__',
        risk_level: 'LOW',
        requires_approval: false,
        reason: 'Reloading the active webpage',
      };
    }

    // 2. Search intent (e.g. "search for X", "search Google for X", "look up X", "find X", "can you search X")
    const isSearchIntent =
      lower.includes('search') ||
      lower.includes('look up') ||
      lower.startsWith('find ') ||
      lower.includes('google for') ||
      lower.includes('search bar');

    if (isSearchIntent) {
      const searchMatch = raw.match(
        /(?:can you\s+|please\s+)?(?:search(?:\s+for|\s+google|\s+the\s+web|\s+online|\s+on\s+google|\s+something\s+on\s+the\s+search\s+bar\s+maybe|\s+on\s+the\s+search\s+bar)?|look\s+up|find(?:\s+me)?|google)\s+(?:maybe\s+)?([^,.]+)/i
      );
      let query = searchMatch
        ? searchMatch[1].replace(/^(?:something\s+on\s+the\s+search\s+bar\s+maybe|maybe)\s+/i, '').trim()
        : '';
      if (!query || query.toLowerCase() === 'something') {
        const cleaned = raw.replace(/(?:can you|please|search for|search on|search bar|search|look up|find|in the|on the)/gi, '').trim();
        if (cleaned) query = cleaned;
      }

      // Find search input on page if available
      const searchInput = pageContext.interactive_elements.find(
        (el) =>
          el.role === 'searchbox' ||
          el.input_type === 'search' ||
          (el.tag === 'input' && (el.accessible_name || el.placeholder || '').toLowerCase().includes('search'))
      );

      if (searchInput && query) {
        return {
          action_id: crypto.randomUUID(),
          type: 'FILL',
          target: {
            element_id: searchInput.element_id,
            selector: searchInput.selector,
            accessible_name: searchInput.accessible_name,
          },
          value: query,
          options: { submit: true, submit_search: true },
          risk_level: 'LOW',
          requires_approval: false,
          reason: `Searching for "${query}" on active page`,
        };
      }

      if (query && query.toLowerCase() !== 'search') {
        return {
          action_id: crypto.randomUUID(),
          type: 'NAVIGATE',
          value: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          options: { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
          risk_level: 'LOW',
          requires_approval: false,
          reason: `Searching for "${query}" on Google`,
        };
      }

      return {
        action_id: crypto.randomUUID(),
        type: 'NAVIGATE',
        value: 'https://www.google.com',
        options: { url: 'https://www.google.com' },
        risk_level: 'LOW',
        requires_approval: false,
        reason: 'Opening Google Search in browser',
      };
    }

    // 3. Form filling on-device
    const fillMatch = raw.match(/(?:fill|type|enter|input)\s+([a-zA-Z0-9_\s]+?)\s+(?:with|as|to|=)\s+([a-zA-Z0-9_@.\s]+)/i);
    if (fillMatch) {
      const targetFieldName = fillMatch[1].trim().toLowerCase();
      const valueToFill = fillMatch[2].trim();

      const inputEl = pageContext.interactive_elements.find((el) => {
        if (el.tag !== 'input' && el.tag !== 'textarea' && el.role !== 'textbox') return false;
        const name = (el.accessible_name || el.text || el.placeholder || '').toLowerCase();
        return name.includes(targetFieldName) || targetFieldName.includes(name);
      });

      if (inputEl) {
        return {
          action_id: crypto.randomUUID(),
          type: 'FILL',
          target: {
            element_id: inputEl.element_id,
            selector: inputEl.selector,
            accessible_name: inputEl.accessible_name,
          },
          value: valueToFill,
          risk_level: 'LOW',
          requires_approval: false,
          reason: `Entered "${valueToFill}" into ${inputEl.accessible_name || targetFieldName}`,
        };
      }
    }

    // 4. Element clicking or navigation matching
    const clickIntent =
      lower.includes('click') ||
      lower.includes('open') ||
      lower.includes('press') ||
      lower.includes('select') ||
      lower.includes('go to');

    if (clickIntent) {
      // Clean request words to identify the intended element
      const cleanReq = lower
        .replace(/^(can you |please |i want to |could you )/i, '')
        .replace(/(click on it and open it|click on it|click|open|press|select|go to|the|page|button|link)/gi, ' ')
        .trim();
      const keywords = cleanReq.split(/\s+/).filter((w) => w.length > 2);

      if (keywords.length > 0) {
        // Find best match in interactive elements
        let bestEl: any = null;
        let bestScore = 0;

        for (const el of pageContext.interactive_elements) {
          const name = (el.accessible_name || el.text || el.current_value || '').toLowerCase();
          const href = (el.href || '').toLowerCase();
          let score = 0;

          for (const kw of keywords) {
            if (name === kw) score += 5;
            else if (name.includes(kw)) score += 3;
            else if (href.includes(kw)) score += 2;
          }

          if (score > bestScore) {
            bestScore = score;
            bestEl = el;
          }
        }

        if (bestEl && bestScore > 0) {
          return {
            action_id: crypto.randomUUID(),
            type: 'CLICK',
            target: {
              element_id: bestEl.element_id,
              selector: bestEl.selector,
              accessible_name: bestEl.accessible_name || bestEl.text,
            },
            risk_level: 'LOW',
            requires_approval: false,
            reason: `Opened ${bestEl.accessible_name || bestEl.text || 'selected control'}`,
          };
        }
      }
    }

    // 5. Try Gemini Nano on-device if available
    try {
      const nanoStatus = await NanoDetector.checkAvailability();
      if (nanoStatus.available && nanoStatus.status === 'ready') {
        const elementsSummary = pageContext.interactive_elements
          .slice(0, 10)
          .map((e) => `[${e.element_id}] ${e.tag} "${e.accessible_name || e.text}"`)
          .join('\n');

        const prompt = `Webpage elements:\n${elementsSummary}\nUser request: "${userRequest}"\nIf an element matches, reply ONLY with the ID e.g. elem_1. Otherwise reply NONE.`;
        const nanoReply = await NanoDetector.runLocalPrompt(prompt);
        const matchId = nanoReply.match(/elem_\d+/i);
        if (matchId) {
          const matchedEl = pageContext.interactive_elements.find((e) => e.element_id.toLowerCase() === matchId[0].toLowerCase());
          if (matchedEl) {
            return {
              action_id: crypto.randomUUID(),
              type: 'CLICK',
              target: {
                element_id: matchedEl.element_id,
                selector: matchedEl.selector,
                accessible_name: matchedEl.accessible_name || matchedEl.text,
              },
              risk_level: 'LOW',
              requires_approval: false,
              reason: `Interacted with ${matchedEl.accessible_name || matchedEl.text || 'page element'}`,
            };
          }
        }
      }
    } catch {}

    return null;
  }

  /**
   * Local fallback for action requests when Render cloud backend is unavailable.
   */
  static async planOrAnswerWithLocalFallback(
    userRequest: string,
    pageContext: PageContext,
    simplified: boolean = false
  ): Promise<AIExecutionResult> {
    return await this.explainPageLocally(pageContext, simplified, 'PREFER_ON_DEVICE', userRequest);
  }

  /**
   * Cloud-powered multi-turn conversation and function calling via Firebase AI Logic.
   */
  static async runCloudAssistantWithTools(
    userMessage: string,
    pageContext: PageContext,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<AIExecutionResult> {
    await this.initialize();
    this.activeInferencePath = 'in_cloud';

    try {
      const model = getGenerativeModel(this.ai, {
        mode: InferenceMode.PREFER_IN_CLOUD,
        inCloudParams: {
          model: 'gemini-3.5-flash-lite',
          tools: RECARE_BROWSER_TOOLS as any,
        },
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          },
        },
      });

      const elementsStr = pageContext.interactive_elements
        .slice(0, 15)
        .map((e) => `[${e.element_id}] ${e.role || e.tag}: "${e.accessible_name || e.text || 'unnamed'}"`)
        .join('\n');

      const systemPrompt = `You are Recare, an AI browser agent.
You understand webpages and execute browser tools to assist users.
Current Page: ${pageContext.title} (${pageContext.domain})
Interactive Elements:
${elementsStr}

When the user asks you to click, navigate, or fill inputs, call the corresponding browser tool.
If asking a question, reply clearly and concisely.`;

      const contents = [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${userMessage}` }] },
      ];

      const result = await model.generateContent({ contents } as any);
      const text = result.response.text() || 'Action proposed by assistant.';

      // Extract tool calls from functionCalls if present
      const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];
      const functionCalls = (result.response as any).functionCalls?.();
      if (functionCalls && Array.isArray(functionCalls)) {
        for (const fc of functionCalls) {
          toolCalls.push({
            name: fc.name,
            args: fc.args || {},
          });
        }
      }

      return {
        text,
        inferenceSource: 'in_cloud',
        modelUsed: 'Gemini 3.5 Flash Lite (Cloud Function Calling)',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err: any) {
      this.activeInferencePath = 'idle';
      return {
        text: `Routing action for: "${userMessage}".`,
        inferenceSource: 'in_cloud',
        modelUsed: 'Recare Cloud Agent',
      };
    }
  }

  /** Check live Nano 4 status */
  static async getNanoStatus(): Promise<NanoAvailability> {
    return await NanoDetector.checkAvailability();
  }
}
