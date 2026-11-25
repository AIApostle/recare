export interface NanoAvailability {
  available: boolean;
  status: 'ready' | 'downloading' | 'downloadable' | 'unsupported';
  downloadProgress?: number;
  message: string;
  apiStyle?: 'standard' | 'legacy' | 'none';
}

interface DetectedLanguageModelApi {
  style: 'standard' | 'legacy';
  api: any;
}

/**
 * Detects Chrome's Built-in Gemini Nano Prompt API across both:
 * - Standard global `LanguageModel` API (Chrome 138+)
 * - Legacy `window.ai.languageModel` API (Chrome 128-137)
 */
export class NanoDetector {
  private static cachedStatus: NanoAvailability | null = null;

  static getLanguageModelApi(): DetectedLanguageModelApi | null {
    if (typeof window === 'undefined' && typeof globalThis === 'undefined') {
      return null;
    }
    const g: any = typeof globalThis !== 'undefined' ? globalThis : window;
    const w: any = typeof window !== 'undefined' ? window : g;

    const standardApi = w.LanguageModel || g.LanguageModel;
    if (standardApi && (typeof standardApi.availability === 'function' || typeof standardApi.create === 'function')) {
      return { style: 'standard', api: standardApi };
    }

    const ai = w.ai || g.ai;
    if (ai?.languageModel) {
      return { style: 'legacy', api: ai.languageModel };
    }

    return null;
  }

  static async checkAvailability(): Promise<NanoAvailability> {
    if (typeof window === 'undefined') {
      return {
        available: false,
        status: 'unsupported',
        message: 'Non-browser environment detected.',
        apiStyle: 'none',
      };
    }

    const detected = this.getLanguageModelApi();
    if (!detected) {
      return {
        available: false,
        status: 'unsupported',
        message: 'Chrome Built-in AI (LanguageModel / window.ai) is not available in this browser. Cloud fallback will be used.',
        apiStyle: 'none',
      };
    }

    try {
      let avail: string | undefined;

      if (detected.style === 'standard' && typeof detected.api.availability === 'function') {
        avail = await detected.api.availability();
      } else if (typeof detected.api.capabilities === 'function') {
        const capabilities = await detected.api.capabilities();
        avail = capabilities?.available;
      }

      if (!avail) {
        return {
          available: false,
          status: 'unsupported',
          message: 'Unable to query Gemini Nano capabilities.',
          apiStyle: detected.style,
        };
      }

      if (avail === 'readily' || avail === 'available') {
        const result: NanoAvailability = {
          available: true,
          status: 'ready',
          message: 'Gemini Nano 4 is ready on-device for local processing.',
          apiStyle: detected.style,
        };
        this.cachedStatus = result;
        return result;
      }

      if (avail === 'after-download' || avail === 'downloadable') {
        const result: NanoAvailability = {
          available: true,
          status: 'downloadable',
          message: 'Gemini Nano model download is required before first on-device run.',
          apiStyle: detected.style,
        };
        this.cachedStatus = result;
        return result;
      }

      if (avail === 'downloading') {
        const result: NanoAvailability = {
          available: true,
          status: 'downloading',
          message: 'Gemini Nano model weights are currently downloading in Chrome...',
          apiStyle: detected.style,
        };
        this.cachedStatus = result;
        return result;
      }

      return {
        available: false,
        status: 'unsupported',
        message: 'On-device Gemini Nano is not enabled on this device (Hardware/Flags requirement).',
        apiStyle: detected.style,
      };
    } catch (err: any) {
      return {
        available: false,
        status: 'unsupported',
        message: `On-device detection error: ${err?.message || String(err)}`,
        apiStyle: detected.style,
      };
    }
  }

  /**
   * Explicitly triggers model download/initialization from a user gesture (button click)
   * and reports live download progress percentage when Chrome supports monitor events.
   */
  static async downloadAndInitialize(
    onProgress?: (percent: number) => void
  ): Promise<NanoAvailability> {
    const detected = this.getLanguageModelApi();
    if (!detected || typeof detected.api.create !== 'function') {
      return {
        available: false,
        status: 'unsupported',
        message:
          'Chrome Prompt API is not enabled yet. Enable the flags in the guide below, then relaunch Chrome.',
        apiStyle: 'none',
      };
    }

    try {
      const session = await detected.api.create({
        monitor(m: any) {
          if (m && typeof m.addEventListener === 'function') {
            m.addEventListener('downloadprogress', (e: any) => {
              const pct =
                typeof e?.loaded === 'number'
                  ? Math.round((e.loaded <= 1 ? e.loaded * 100 : e.loaded))
                  : 0;
              onProgress?.(Math.min(100, Math.max(0, pct)));
            });
          }
        },
      });
      if (session && typeof session.destroy === 'function') {
        session.destroy();
      }
      onProgress?.(100);
      const ready: NanoAvailability = {
        available: true,
        status: 'ready',
        downloadProgress: 100,
        message: 'Gemini Nano downloaded and verified on-device!',
        apiStyle: detected.style,
      };
      this.cachedStatus = ready;
      return ready;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isMissingExecConfig =
        msg.toLowerCase().includes('execution config') ||
        msg.toLowerCase().includes('not available') ||
        msg.toLowerCase().includes('download');
      const result: NanoAvailability = {
        available: false,
        status: isMissingExecConfig ? 'downloadable' : 'unsupported',
        message: isMissingExecConfig
          ? 'Model weights / execution config are still missing. Follow Steps 1-4 below (set #optimization-guide-on-device-model to Enabled BypassPerfRequirement and check chrome://components).'
          : `Could not initialize local model: ${msg}`,
        apiStyle: detected.style,
      };
      this.cachedStatus = result;
      return result;
    }
  }

  /** Run a prompt directly against Chrome's on-device Gemini Nano session */
  static async runLocalPrompt(prompt: string, systemPrompt?: string): Promise<string> {
    const detected = this.getLanguageModelApi();
    if (!detected || typeof detected.api.create !== 'function') {
      throw new Error('Local Gemini Nano API is not available.');
    }

    const createOpts: Record<string, any> = {};
    if (systemPrompt) {
      if (detected.style === 'standard') {
        createOpts.initialPrompts = [{ role: 'system', content: systemPrompt }];
      } else {
        createOpts.systemPrompt = systemPrompt;
      }
    }

    let session: any;
    try {
      session = await detected.api.create(createOpts);
    } catch {
      // Fallback to zero-arg create if options shape differs across Chrome channels
      session = await detected.api.create();
    }

    try {
      const fullInput = systemPrompt && createOpts.initialPrompts == null && createOpts.systemPrompt == null
        ? `${systemPrompt}\n\n${prompt}`
        : prompt;
      const response = await session.prompt(fullInput);
      return String(response || '').trim();
    } finally {
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy();
        } catch {}
      }
    }
  }

  static getCachedStatus(): NanoAvailability | null {
    return this.cachedStatus;
  }
}
