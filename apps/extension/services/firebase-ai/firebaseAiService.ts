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
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<AIExecutionResult> {
    await this.initialize();

    const title = pageContext.title || 'Current Webpage';
    const domain = pageContext.domain || 'Active Site';
    const headings = pageContext.headings.map((h) => h.text).slice(0, 5).join(', ');
    const elements = pageContext.interactive_elements
      .slice(0, 12)
      .map((e) => `[${e.element_id}] <${e.tag}> "${e.accessible_name || e.text || 'unnamed'}"`)
      .join('\n');

    const historyBlock = conversationHistory.length > 0
      ? `\nRecent conversation:\n${conversationHistory
          .slice(-6)
          .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
          .join('\n')}\n`
      : '';

    const localSystemPrompt = simplified
      ? `You are Recare, an accessibility browser assistant. Explain in very simple, calm, plain language without jargon.`
      : `You are Recare, an AI accessibility browser assistant. Answer clearly, accurately, and concisely grounded in the webpage details.`;

    const promptBody = userMessage?.trim()
      ? `${localSystemPrompt}\n\nWebpage: ${title} (${domain})\nSections: ${headings || 'None'}\nInteractive Controls:\n${elements}${historyBlock}\nUser: ${userMessage.trim()}`
      : `${localSystemPrompt}\n\nSummarize "${title}" (${domain}), sections (${headings}), and main interactive controls:\n${elements}`;

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

        const result = await model.generateContent(promptBody);
        const text = result.response.text()?.trim();
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
        const backendRes = await RecareApiClient.sendChat(
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

    // 4. Final grounded fallback from live DOM context
    this.activeInferencePath = 'idle';
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
