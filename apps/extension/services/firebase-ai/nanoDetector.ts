export interface NanoAvailability {
  available: boolean;
  status: 'ready' | 'downloading' | 'downloadable' | 'unsupported';
  downloadProgress?: number;
  message: string;
}

/**
 * Detects whether Chrome's on-device Gemini Nano 4 model is available in the current browser.
 * Targets Chrome 139+ with Built-in AI / Prompt API.
 */
export class NanoDetector {
  private static cachedStatus: NanoAvailability | null = null;

  static async checkAvailability(): Promise<NanoAvailability> {
    if (typeof window === 'undefined') {
      return {
        available: false,
        status: 'unsupported',
        message: 'Non-browser environment detected.',
      };
    }

    const ai = (window as any).ai || (globalThis as any).ai;
    if (!ai) {
      return {
        available: false,
        status: 'unsupported',
        message: 'Chrome Built-in AI (window.ai) is not available in this browser. Cloud fallback will be used.',
      };
    }

    const languageModel = ai.languageModel;
    if (!languageModel) {
      return {
        available: false,
        status: 'unsupported',
        message: 'Gemini Nano LanguageModel API is not supported in this Chrome version. Cloud fallback will be used.',
      };
    }

    try {
      const capabilities = await languageModel.capabilities?.();
      if (!capabilities) {
        return {
          available: false,
          status: 'unsupported',
          message: 'Unable to query Gemini Nano capabilities.',
        };
      }

      const avail = capabilities.available;
      if (avail === 'readily' || avail === 'available') {
        const result: NanoAvailability = {
          available: true,
          status: 'ready',
          message: 'Gemini Nano 4 is ready on-device for local processing.',
        };
        this.cachedStatus = result;
        return result;
      }

      if (avail === 'after-download' || avail === 'downloadable') {
        const result: NanoAvailability = {
          available: true,
          status: 'downloadable',
          message: 'Gemini Nano model download is required before first on-device run.',
        };
        this.cachedStatus = result;
        return result;
      }

      return {
        available: false,
        status: 'unsupported',
        message: 'On-device Gemini Nano is not enabled on this device (Hardware/Flags requirement).',
      };
    } catch (err: any) {
      return {
        available: false,
        status: 'unsupported',
        message: `On-device detection error: ${err.message}`,
      };
    }
  }

  static getCachedStatus(): NanoAvailability | null {
    return this.cachedStatus;
  }
}
