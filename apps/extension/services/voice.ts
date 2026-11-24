/**
 * Voice interaction service: Speech-to-Text and Text-to-Speech
 * Built for visual, motor, and cognitive accessibility.
 */

export class VoiceService {
  private static recognition: any = null;
  private static isListening = false;

  /** Initialize Speech Recognition with cross-browser support */
  private static getSpeechRecognition() {
    if (typeof window === 'undefined') return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    return new SpeechRecognition();
  }

  /** Request microphone permissions if not yet granted */
  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      }
      return true;
    } catch (err: any) {
      console.warn('[VoiceService] Microphone access error:', err);
      return false;
    }
  }

  /** Start listening for voice commands */
  static startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): boolean {
    if (this.isListening) {
      this.stopListening();
    }

    const rec = this.getSpeechRecognition();
    if (!rec) {
      onError('Speech recognition is not supported in this browser.');
      return false;
    }

    this.recognition = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      this.isListening = true;
    };

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          onTranscript(event.results[i][0].transcript, true);
        } else {
          interim += event.results[i][0].transcript;
          onTranscript(interim, false);
        }
      }
    };

    rec.onerror = (event: any) => {
      this.isListening = false;
      const err = event.error;
      if (err === 'not-allowed') {
        onError('Microphone access blocked. Click the lock/tune icon in the URL bar to allow microphone.');
      } else if (err === 'no-speech') {
        onEnd();
      } else {
        onError(err || 'Speech recognition error');
      }
    };

    rec.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      rec.start();
      return true;
    } catch (e: any) {
      this.isListening = false;
      onError(e.message || 'Could not start microphone');
      return false;
    }
  }

  /** Stop active listening */
  static stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    this.isListening = false;
  }

  /** Text-to-Speech: Spoken agent responses with optional completion callback */
  static speak(text: string, speechRate: number = 1.0, onEnd?: () => void): void {
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
