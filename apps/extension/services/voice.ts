import { RecareApiClient } from './api';

/**
 * Voice interaction service: Speech-to-Text (with MediaRecorder/Gemini fallback) and Text-to-Speech.
 * Built for visual, motor, and cognitive accessibility inside Chrome Extension Side Panels.
 */
export interface MicPermissionResult {
  granted: boolean;
  needsTabPrompt?: boolean;
  message?: string;
}

export class VoiceService {
  private static recognition: any = null;
  private static mediaRecorder: MediaRecorder | null = null;
  private static mediaStream: MediaStream | null = null;
  private static audioContext: AudioContext | null = null;
  private static vadTimer: ReturnType<typeof setInterval> | null = null;
  private static isListening = false;
  private static activeSessionToken = 0;
  private static cancelledManually = false;
  private static cachedVoices: SpeechSynthesisVoice[] = [];

  /** Initialize Speech Recognition with cross-browser support */
  private static getSpeechRecognition() {
    if (typeof window === 'undefined') return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    return new SpeechRecognition();
  }

  /** Request microphone permissions; signals when Side Panel needs a regular-tab prompt */
  static async requestMicrophonePermission(): Promise<MicPermissionResult> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return {
        granted: false,
        message: 'Microphone API is unavailable in this environment.',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return { granted: true };
    } catch (err: any) {
      const name = err?.name || '';
      const blockedInSidePanel =
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError';
      console.info('[VoiceService] Microphone permission check:', name || err?.message);
      return {
        granted: false,
        needsTabPrompt: blockedInSidePanel,
        message: blockedInSidePanel
          ? 'Please allow microphone access in the permission tab that just opened.'
          : err?.message || 'Microphone access failed.',
      };
    }
  }

  /** Open extension permission page in a regular browser tab where Chrome shows native mic prompts */
  static openMicPermissionTab(): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
        chrome.tabs.create({
          url: chrome.runtime.getURL('mic-permission.html'),
          active: true,
        });
      }
    } catch (e) {
      console.warn('[VoiceService] Could not open mic permission tab:', e);
    }
  }

  /** Start listening for voice commands (SpeechRecognition first, MediaRecorder+Gemini fallback on error/unsupported) */
  static startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onEnd: (reason?: string) => void
  ): boolean {
    this.stopSpeaking();
    this.stopListening();

    this.cancelledManually = false;
    const sessionToken = ++this.activeSessionToken;
    const rec = this.getSpeechRecognition();

    if (!rec) {
      this.startMediaRecorderFallback(sessionToken, onTranscript, onError, onEnd);
      return true;
    }

    let ended = false;
    let receivedFinal = false;
    const finishOnce = (reason?: string) => {
      if (ended || sessionToken !== this.activeSessionToken) return;
      ended = true;
      this.isListening = false;
      onEnd(reason);
    };

    this.recognition = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      if (sessionToken === this.activeSessionToken) {
        this.isListening = true;
      }
    };

    rec.onresult = (event: any) => {
      if (sessionToken !== this.activeSessionToken || this.cancelledManually) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          receivedFinal = true;
          onTranscript(event.results[i][0].transcript, true);
        } else {
          interim += event.results[i][0].transcript;
          onTranscript(interim, false);
        }
      }
    };

    rec.onerror = (event: any) => {
      if (ended || sessionToken !== this.activeSessionToken || this.cancelledManually) return;
      const err = event.error;

      if (err === 'not-allowed' || err === 'permission-denied') {
        ended = true;
        this.isListening = false;
        onError('MIC_PERMISSION_REQUIRED');
      } else if (err === 'no-speech' || err === 'aborted') {
        finishOnce(err);
      } else if (err === 'network' || err === 'service-not-allowed' || err === 'audio-capture') {
        // Fallback to MediaRecorder + backend Whisper/Gemini transcription when Chrome STT service is unavailable
        ended = true;
        this.recognition = null;
        this.isListening = false;
        console.info(`[VoiceService] SpeechRecognition reported '${err}', switching to audio clip fallback.`);
        this.startMediaRecorderFallback(sessionToken, onTranscript, onError, onEnd);
      } else {
        ended = true;
        this.isListening = false;
        onError(err || 'Speech recognition error');
      }
    };

    rec.onend = () => {
      finishOnce(receivedFinal ? 'final' : 'end');
    };

    try {
      rec.start();
      return true;
    } catch (e: any) {
      this.recognition = null;
      this.isListening = false;
      this.startMediaRecorderFallback(sessionToken, onTranscript, onError, onEnd);
      return true;
    }
  }

  /** Capture audio via MediaRecorder with simple silence detection and transcribe on backend */
  private static async startMediaRecorderFallback(
    sessionToken: number,
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onEnd: (reason?: string) => void
  ): Promise<void> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      onError('Voice capture is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sessionToken !== this.activeSessionToken || this.cancelledManually) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.mediaStream = stream;
      this.isListening = true;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        this.cleanupMediaCapture();
        if (this.cancelledManually || sessionToken !== this.activeSessionToken) {
          return;
        }
        if (chunks.length === 0) {
          onEnd('no-speech');
          return;
        }

        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to encode audio clip'));
            reader.readAsDataURL(blob);
          });
          const transcript = await RecareApiClient.transcribeAudio(base64, blob.type || 'audio/webm');
          if (transcript) {
            onTranscript(transcript, true);
            onEnd('final');
          } else {
            onEnd('no-speech');
          }
        } catch (err: any) {
          onError(err?.message || 'Could not transcribe voice audio.');
        }
      };

      recorder.start();

      // Voice Activity Detection: stop cleanly ~1.3s after user stops speaking (or after 10s max)
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx: AudioContext = new AudioCtx();
        this.audioContext = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const buf = new Uint8Array(analyser.fftSize);
        let heardSpeech = false;
        let lastSpeechAt = Date.now();
        const startedAt = Date.now();

        this.vadTimer = setInterval(() => {
          if (sessionToken !== this.activeSessionToken || recorder.state !== 'recording') {
            this.cleanupVadTimer();
            return;
          }
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const centered = (buf[i] - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / buf.length);
          const now = Date.now();

          if (rms > 0.018) {
            heardSpeech = true;
            lastSpeechAt = now;
          }

          const silentTooLong = heardSpeech && now - lastSpeechAt > 1300;
          const noSpeechTimeout = !heardSpeech && now - startedAt > 6500;
          const maxDuration = now - startedAt > 12000;

          if (silentTooLong || noSpeechTimeout || maxDuration) {
            this.cleanupVadTimer();
            try {
              recorder.stop();
            } catch {}
          }
        }, 120);
      } else {
        setTimeout(() => {
          if (recorder.state === 'recording') {
            try {
              recorder.stop();
            } catch {}
          }
        }, 5000);
      }
    } catch (err: any) {
      this.cleanupMediaCapture();
      this.isListening = false;
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onError('MIC_PERMISSION_REQUIRED');
      } else {
        onError(err?.message || 'Could not access microphone.');
      }
    }
  }

  private static cleanupVadTimer(): void {
    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
  }

  private static cleanupMediaCapture(): void {
    this.cleanupVadTimer();
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.isListening = false;
  }

  /** Stop active listening immediately */
  static stopListening(): void {
    this.cancelledManually = true;
    this.activeSessionToken++;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanupMediaCapture();
    this.isListening = false;
  }

  /** Retrieve available system speech synthesis voices */
  static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      this.cachedVoices = voices;
    }
    return voices;
  }

  /** Text-to-Speech: Spoken agent responses with optional completion callback and voice selection */
  static speak(
    text: string,
    speechRate: number = 1.0,
    onEnd?: () => void,
    preferredVoiceName?: string
  ): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return;
    }

    this.stopSpeaking();

    // Clean markdown formatting before speaking
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/[*_#`]/g, '') // bold/italic/headings/code
      .trim();

    if (!cleanText) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = Math.max(0.5, Math.min(2.0, speechRate));
    utterance.lang = 'en-US';

    // Apply voice selection if specified
    const voices = this.getAvailableVoices();
    if (preferredVoiceName && voices.length > 0) {
      const matched = voices.find((v) => v.name === preferredVoiceName || v.voiceURI === preferredVoiceName);
      if (matched) utterance.voice = matched;
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
  }

  /** Stop any currently playing audio */
  static stopSpeaking(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  static isSpeaking(): boolean {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis?.speaking);
  }
}
