import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Mic, MicOff, Radio, Plus, X, FileText, Image as ImageIcon, Disc } from 'lucide-react';
import { VoiceService } from '../services/voice';
import { RecareApiClient } from '../services/api';

export interface FileAttachment {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl?: string;
}

interface ComposerProps {
  onSendMessage: (message: string, attachment?: FileAttachment) => void;
  disabled?: boolean;
  isLiveVoice?: boolean;
  onToggleLiveVoice?: (enabled: boolean) => void;
  onRegisterListenTrigger?: (trigger: () => void) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  disabled,
  isLiveVoice = false,
  onToggleLiveVoice,
  onRegisterListenTrigger,
}) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isRawRecording, setIsRawRecording] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);

  const isLiveVoiceRef = useRef(isLiveVoice);
  isLiveVoiceRef.current = isLiveVoice;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const sentTurnRef = useRef(false);
  const pendingVoiceModeRef = useRef<'single' | 'live' | 'raw' | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceMenuRef = useRef<HTMLDivElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawRecorderRef = useRef<MediaRecorder | null>(null);
  const rawChunksRef = useRef<BlobPart[]>([]);

  // Listen for microphone grant completion from the permission helper tab
  useEffect(() => {
    const onRuntimeMessage = (msg: any) => {
      if (msg?.type === 'MIC_PERMISSION_GRANTED' && pendingVoiceModeRef.current) {
        const mode = pendingVoiceModeRef.current;
        pendingVoiceModeRef.current = null;
        setVoiceNotice(null);
        if (mode === 'live') {
          onToggleLiveVoice?.(true);
          isLiveVoiceRef.current = true;
          runListeningCycle(true);
        } else if (mode === 'raw') {
          startRawAudioRecording();
        } else {
          onToggleLiveVoice?.(false);
          isLiveVoiceRef.current = false;
          runListeningCycle(false);
        }
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      }
    };
  }, [onToggleLiveVoice]);

  // Close voice popup when clicking anywhere outside or pressing Escape
  useEffect(() => {
    if (!showVoiceMenu) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        voiceMenuRef.current &&
        !voiceMenuRef.current.contains(target) &&
        micButtonRef.current &&
        !micButtonRef.current.contains(target)
      ) {
        setShowVoiceMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowVoiceMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showVoiceMenu]);

  // Auto-resize textarea to fit content and screen width
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if ((!text && !attachment) || disabled) return;
    const finalMsg = text || (attachment ? `Analyze attached ${attachment.name}:` : '');
    onSendMessage(finalMsg, attachment || undefined);
    setInput('');
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setVoiceNotice('File is too large (max 20MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setAttachment({
        base64,
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
        previewUrl: file.type.startsWith('image/') ? result : undefined,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const stopVoice = () => {
    pendingVoiceModeRef.current = null;
    VoiceService.stopListening();
    VoiceService.stopSpeaking();
    setIsRecording(false);
    isRecordingRef.current = false;
    setShowVoiceMenu(false);
    onToggleLiveVoice?.(false);
    isLiveVoiceRef.current = false;
    setVoiceNotice(null);

    if (rawRecorderRef.current && isRawRecording) {
      stopRawAudioRecording();
    }
  };

  const startRawAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      rawRecorderRef.current = recorder;
      rawChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          rawChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRawRecording(false);
        const blob = new Blob(rawChunksRef.current, { type: mimeType });
        setVoiceNotice('Transcribing audio clip via Cloud AI...');

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataUrl = reader.result as string;
            const b64 = dataUrl.split(',')[1] || '';
            const transcript = await RecareApiClient.transcribeAudio(b64, mimeType);
            setVoiceNotice(null);
            if (transcript.trim()) {
              setInput(transcript.trim());
              onSendMessage(transcript.trim());
            } else {
              setVoiceNotice('Could not detect clear speech in audio.');
            }
          } catch (err: any) {
            setVoiceNotice(`Audio transcription notice: ${err.message}`);
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRawRecording(true);
      setVoiceNotice('Recording raw audio clip... Click mic again to send');
    } catch (err: any) {
      setVoiceNotice(`Microphone error: ${err.message}`);
    }
  };

  const stopRawAudioRecording = () => {
    if (rawRecorderRef.current && rawRecorderRef.current.state !== 'inactive') {
      rawRecorderRef.current.stop();
    }
  };

  const runListeningCycle = (isLive: boolean) => {
    sentTurnRef.current = false;
    setIsRecording(true);
    isRecordingRef.current = true;
    setVoiceNotice(isLive ? 'Live Voice Active — Listening...' : 'Listening... Speak your command');

    VoiceService.startListening(
      (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal && !sentTurnRef.current) {
          const clean = transcript.trim();
          if (!clean) return;
          sentTurnRef.current = true;
          VoiceService.stopListening();
          setIsRecording(false);
          isRecordingRef.current = false;
          setVoiceNotice(isLive ? 'Live Voice — Processing...' : null);
          setTimeout(() => {
            onSendMessage(clean);
            setInput('');
          }, 150);
        }
      },
      (error) => {
        setIsRecording(false);
        isRecordingRef.current = false;
        if (error === 'MIC_PERMISSION_REQUIRED') {
          pendingVoiceModeRef.current = isLive ? 'live' : 'single';
          VoiceService.openMicPermissionTab();
          setVoiceNotice('Allow microphone in the new Chrome tab, then Live Voice will resume automatically.');
          return;
        }
        onToggleLiveVoice?.(false);
        isLiveVoiceRef.current = false;
        setVoiceNotice(error);
        setTimeout(() => setVoiceNotice(null), 5000);
      },
      (reason) => {
        setIsRecording(false);
        isRecordingRef.current = false;
        if (
          isLive &&
          isLiveVoiceRef.current &&
          !sentTurnRef.current &&
          (reason === 'no-speech' || reason === 'end') &&
          !VoiceService.isSpeaking()
        ) {
          setTimeout(() => {
            if (isLiveVoiceRef.current && !isRecordingRef.current && !VoiceService.isSpeaking()) {
              runListeningCycle(true);
            }
          }, 250);
        }
      }
    );
  };

  const handleMicClick = () => {
    if (isRawRecording) {
      stopRawAudioRecording();
      return;
    }
    if (isRecording || isLiveVoice) {
      stopVoice();
      return;
    }
    setShowVoiceMenu((prev) => !prev);
  };

  const startVoiceMode = async (mode: 'single' | 'live' | 'raw') => {
    setShowVoiceMenu(false);
    const perm = await VoiceService.requestMicrophonePermission();
    if (!perm.granted) {
      pendingVoiceModeRef.current = mode;
      if (perm.needsTabPrompt) {
        VoiceService.openMicPermissionTab();
      }
      setVoiceNotice(perm.message || 'Microphone access is required.');
      return;
    }

    if (mode === 'raw') {
      startRawAudioRecording();
      return;
    }

    const isLive = mode === 'live';
    onToggleLiveVoice?.(isLive);
    isLiveVoiceRef.current = isLive;
    runListeningCycle(isLive);
  };

  useEffect(() => {
    if (onRegisterListenTrigger) {
      onRegisterListenTrigger(() => {
        if (isLiveVoiceRef.current && !isRecordingRef.current && !VoiceService.isSpeaking()) {
          runListeningCycle(true);
        }
      });
    }
  }, [onRegisterListenTrigger]);

  return (
    <div className="relative p-3 bg-white border-t border-zinc-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
      {/* File & Image Attachment Preview */}
      {attachment && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200/90 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5 min-w-0">
            {attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="w-8 h-8 rounded-lg object-cover border border-zinc-200 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                <FileText className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 truncate">
                {attachment.name}
              </div>
              <div className="text-[10px] text-zinc-500">
                Ready for AI multimodal analysis
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Remove attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Voice Selection Menu */}
      {showVoiceMenu && !isRecording && !isRawRecording && (
        <div
          ref={voiceMenuRef}
          className="absolute bottom-full left-3 mb-2 bg-white border border-zinc-200 rounded-xl shadow-lg p-1.5 w-56 z-30 animate-in fade-in slide-in-from-bottom-1"
        >
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
            Voice Mode
          </div>

          {/* Option 1: Record & Send */}
          <button
            type="button"
            onClick={() => startVoiceMode('single')}
            className="w-full text-left p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-950 flex items-center space-x-2.5 transition-colors group cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Mic className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 group-hover:text-emerald-950 truncate">
                Record & Send
              </div>
              <div className="text-[10px] text-zinc-500 leading-tight truncate">
                Real-time speech recognition
              </div>
            </div>
          </button>

          {/* Option 2: Record Raw Audio Clip */}
          <button
            type="button"
            onClick={() => startVoiceMode('raw')}
            className="w-full text-left p-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-950 flex items-center space-x-2.5 transition-colors group mt-0.5 cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <Disc className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 group-hover:text-indigo-950 truncate">
                Record Raw Audio Clip
              </div>
              <div className="text-[10px] text-zinc-500 leading-tight truncate">
                Direct audio to Gemini Cloud AI
              </div>
            </div>
          </button>

          {/* Option 3: Live Chat */}
          <button
            type="button"
            onClick={() => startVoiceMode('live')}
            className="w-full text-left p-2 rounded-lg hover:bg-rose-50 hover:text-rose-950 flex items-center space-x-2.5 transition-colors group mt-0.5 cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 group-hover:text-rose-950 flex items-center gap-1">
                <span>Live Voice Chat</span>
                <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-rose-100 text-rose-700 uppercase">Live</span>
              </div>
              <div className="text-[10px] text-zinc-500 leading-tight truncate">
                Continuous hands-free loop
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Live Voice Indicator Banner */}
      {isLiveVoice && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs font-semibold min-w-0">
            <span className={`w-2 h-2 rounded-full bg-white flex-shrink-0 ${isRecording ? 'animate-ping' : 'opacity-70'}`} />
            <span className="truncate">
              {isRecording ? 'LIVE VOICE — Listening...' : 'LIVE VOICE — Processing / Speaking...'}
            </span>
          </div>
          <button
            type="button"
            onClick={stopVoice}
            className="text-[10px] font-medium bg-black/25 hover:bg-black/35 px-2 py-0.5 rounded-md transition-colors flex-shrink-0 ml-2 cursor-pointer"
          >
            End Live
          </button>
        </div>
      )}

      {/* Notice Message */}
      {voiceNotice && !isLiveVoice && (
        <div className="mb-2 text-xs py-1.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <span className="font-medium truncate">{voiceNotice}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {voiceNotice.toLowerCase().includes('microphone') && (
              <button
                type="button"
                onClick={() => VoiceService.openMicPermissionTab()}
                className="text-[10px] font-semibold bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded-md cursor-pointer"
              >
                Allow Mic
              </button>
            )}
            <button
              type="button"
              onClick={() => setVoiceNotice(null)}
              className="text-amber-700 font-bold hover:opacity-75 text-sm cursor-pointer"
              aria-label="Dismiss voice notice"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Elevated, responsive input card */}
      <div className="bg-white border-2 border-zinc-300 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] focus-within:border-zinc-800 transition-all duration-200">
        {/* Attachment (+ icon) Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer flex-shrink-0"
          aria-label="Attach image or file"
          title="Upload image or document"
        >
          <Plus className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.json,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Voice Trigger Button with Pop-up Menu */}
        <button
          ref={micButtonRef}
          type="button"
          onClick={handleMicClick}
          className={`p-2 rounded-xl transition-all cursor-pointer flex-shrink-0 ${
            isLiveVoice
              ? 'bg-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-400'
              : isRawRecording
              ? 'bg-indigo-600 text-white animate-pulse shadow-md ring-2 ring-indigo-400'
              : isRecording
              ? 'bg-emerald-500 text-white animate-pulse shadow-md ring-2 ring-emerald-400'
              : showVoiceMenu
              ? 'bg-zinc-200 text-zinc-950 ring-2 ring-zinc-400'
              : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95'
          }`}
          aria-label={isRecording || isLiveVoice || isRawRecording ? 'Stop voice recording' : 'Choose voice mode'}
          title={isRecording || isLiveVoice || isRawRecording ? 'Stop listening' : 'Choose voice mode'}
        >
          {isRecording || isLiveVoice || isRawRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Auto-resizing, responsive multi-line Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            isLiveVoice
              ? 'Live Voice listening... (or type here)'
              : isRawRecording
              ? 'Recording raw audio clip...'
              : attachment
              ? `Ask about ${attachment.name}...`
              : 'Ask a question or request an action...'
          }
          className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-zinc-950 placeholder:text-zinc-400 px-2 py-1 shadow-none font-medium resize-none min-h-[34px] max-h-[120px] leading-relaxed break-words overflow-y-auto"
          style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
          aria-label="Message Recare assistant"
        />

        {/* Send Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={(!input.trim() && !attachment) || disabled}
          className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm flex-shrink-0 cursor-pointer"
          aria-label="Send message"
          title="Send"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
