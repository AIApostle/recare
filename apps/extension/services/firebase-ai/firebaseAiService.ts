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
import { PageContext, BrowserAction, ActionType } from '../../types';
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
   * Hybrid page explanation.
   * Default strategy: Tries Cloud first for rich reasoning; if offline or unavailable,
   * seamlessly falls back to on-device Gemini Nano 4, then to grounded DOM heuristics.
   */
  static async explainPageLocally(
    pageContext: PageContext,
    simplified: boolean = false,
    selectedMode: SelectedInferenceMode = 'PREFER_IN_CLOUD'
  ): Promise<AIExecutionResult> {
    await this.initialize();

    const title = pageContext.title || 'Current Webpage';
    const domain = pageContext.domain || 'Active Site';
    const headings = pageContext.headings.map((h) => h.text).slice(0, 5).join(', ');
    const elements = pageContext.interactive_elements
      .slice(0, 10)
      .map((e) => `[${e.element_id}] <${e.tag}> "${e.accessible_name || e.text || 'unnamed'}"`)
      .join('\n');

    const prompt = simplified
      ? `You are Recare, an accessibility assistant.
Explain this webpage in very simple, calm, plain language without jargon:
Page: ${title} (${domain})
Headings: ${headings}
Controls:
${elements}
Provide a 2-3 sentence overview of what the user can do here.`
      : `You are Recare, an AI browser assistant running with Firebase AI Logic.
Provide an accessible, structured explanation of this page:
Page Title: ${title}
Domain: ${domain}
Key Sections: ${headings}
Interactive Controls:
${elements}
Summarize the page purpose, main interactive controls, and recommended next action for the user.`;

    const nanoStatus = await NanoDetector.checkAvailability();

    // 1. If Gemini Nano is ready on-device, execute directly locally (zero network latency)
    if (nanoStatus.available && nanoStatus.status === 'ready') {
      try {
        const ai = (window as any)?.ai || (globalThis as any)?.ai;
        if (ai?.languageModel?.create) {
          const session = await ai.languageModel.create();
          const localText = await session.prompt(prompt);
          if (typeof session.destroy === 'function') session.destroy();
          if (localText && localText.trim()) {
            this.activeInferencePath = 'on_device';
            return {
              text: localText.trim(),
              inferenceSource: 'on_device',
              modelUsed: 'Gemini Nano 4 (On-Device)',
            };
          }
        }
      } catch (nanoErr: any) {
        console.info('[Recare] On-device Nano execution deferred to cloud pipeline:', nanoErr?.message || nanoErr);
      }
    }

    // 2. Otherwise try Firebase AI or Recare Backend Cloud Agent
    this.activeInferencePath = 'in_cloud';

    try {
      const model = getGenerativeModel(this.ai, {
        mode: InferenceMode.ONLY_IN_CLOUD,
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const source = (result as any).inferenceSource === InferenceSource.ON_DEVICE
        ? 'on_device'
        : 'in_cloud';

      this.activeInferencePath = source;

      return {
        text,
        inferenceSource: source,
        modelUsed: source === 'on_device' ? 'Gemini Nano 4 (On-Device)' : 'Gemini 2.5 Flash Lite (Cloud)',
      };
    } catch (err: any) {
      console.info('[Recare] Direct cloud endpoint unavailable, using Recare Cloud Agent fallback:', err?.message || err);

      // Fallback 1: Query live Recare Backend Agent (cascades Gemini Flash Lite -> 3.5 Flash Lite -> 3.8 Flash)
      try {
        const backendRes = await RecareApiClient.sendChat(
          prompt,
          pageContext,
          'guide',
          simplified
        );
        this.activeInferencePath = 'in_cloud';
        return {
          text: backendRes.reply,
          inferenceSource: 'in_cloud',
          modelUsed: 'Recare Cloud Agent (Gemini Multi-Model Fallback)',
        };
      } catch (backendErr: any) {
        console.info('[Recare] Backend agent fallback note:', backendErr?.message || backendErr);
      }

      // Fallback 2: Direct Chrome Built-in AI (window.ai / Prompt API)
      if (typeof window !== 'undefined' && (window as any).ai?.languageModel) {
        try {
          const ai = (window as any).ai;
          const caps = await ai.languageModel.capabilities?.();
          if (caps?.available === 'readily' || caps?.available === 'available') {
            const session = await ai.languageModel.create();
            const localText = await session.prompt(prompt);
            if (typeof session.destroy === 'function') session.destroy();
            if (localText && localText.trim()) {
              this.activeInferencePath = 'on_device';
              return {
                text: localText.trim(),
                inferenceSource: 'on_device',
                modelUsed: 'Gemini Nano 4 (On-Device)',
              };
            }
          }
        } catch (nanoErr: any) {
          console.info('[Recare] Local Gemini Nano on-device fallback note:', nanoErr?.message || nanoErr);
        }
      }

      // Fallback 3: Grounded contextual summary from live DOM context (never leaves user stranded)
      this.activeInferencePath = 'idle';
      const keyControls = pageContext.interactive_elements
        .slice(0, 4)
        .map((e) => e.accessible_name || e.text || e.tag)
        .filter(Boolean)
        .join(', ');

      return {
        text: `You are on **${pageContext.title || pageContext.domain}**. Key controls available include ${keyControls || 'links and buttons'}. What would you like to accomplish on this page?`,
        inferenceSource: 'on_device',
        modelUsed: 'Recare Assistant (Local Context Analysis)',
      };
    }
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
        mode: InferenceMode.ONLY_IN_CLOUD,
        tools: RECARE_BROWSER_TOOLS as any,
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
        modelUsed: 'Gemini 2.5 Flash Lite (Cloud Function Calling)',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err: any) {
      console.info('[Recare] Direct cloud function-calling unavailable, falling through to Recare task planner:', err?.message || err);
      this.activeInferencePath = 'idle';
      return {
        text: `Processing action for: "${userMessage}".`,
        inferenceSource: 'in_cloud',
        modelUsed: 'Cloud Fallback',
      };
    }
  }

  /** Check live Nano 4 status */
  static async getNanoStatus(): Promise<NanoAvailability> {
    return await NanoDetector.checkAvailability();
  }
}
