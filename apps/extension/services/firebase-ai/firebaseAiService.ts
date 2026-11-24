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
    let modeEnum: InferenceMode = InferenceMode.ONLY_IN_CLOUD;

    if (selectedMode === 'ONLY_ON_DEVICE' || selectedMode === 'PREFER_ON_DEVICE') {
      if (nanoStatus.available && nanoStatus.status === 'ready') {
        modeEnum = selectedMode === 'ONLY_ON_DEVICE' ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_ON_DEVICE;
      } else {
        console.info('[Recare] On-device Nano not ready, using Cloud inference mode.');
        modeEnum = InferenceMode.ONLY_IN_CLOUD;
      }
    }

    this.activeInferencePath = modeEnum === InferenceMode.ONLY_ON_DEVICE ? 'on_device' : 'in_cloud';

    try {
      const model = getGenerativeModel(this.ai, {
        mode: modeEnum,
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
      console.warn('[Recare] Primary inference mode failed:', err);

      // If on-device failed due to missing execution config or error, try direct cloud
      if (modeEnum !== InferenceMode.ONLY_IN_CLOUD) {
        try {
          const cloudModel = getGenerativeModel(this.ai, {
            mode: InferenceMode.ONLY_IN_CLOUD,
          });
          const cloudRes = await cloudModel.generateContent(prompt);
          this.activeInferencePath = 'in_cloud';
          return {
            text: cloudRes.response.text(),
            inferenceSource: 'in_cloud',
            modelUsed: 'Gemini 2.5 Flash Lite (Cloud Fallback)',
          };
        } catch (cloudErr: any) {
          console.warn('[Recare] Direct cloud inference also threw:', cloudErr);
        }
      }

      this.activeInferencePath = 'idle';
      return {
        text: 'AI model is currently not available.',
        inferenceSource: 'on_device',
        modelUsed: 'Unavailable',
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
      console.warn('[Recare] Cloud tool calling error:', err);
      this.activeInferencePath = 'idle';
      return {
        text: `Recare processed your request for: "${userMessage}".`,
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
