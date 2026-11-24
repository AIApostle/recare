import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Mic, MicOff, Radio, Sparkles } from 'lucide-react';
import { VoiceService } from '../services/voice';

interface ComposerProps {
  onSendMessage: (message: string) => void;
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
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const isLiveVoiceRef = useRef(isLiveVoice);
  isLiveVoiceRef.current = isLiveVoice;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content and screen width
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    onSendMessage(text);
    setInput('');
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

  const stopVoice = () => {
    VoiceService.stopListening();
    setIsRecording(false);
    setShowVoiceMenu(false);
    if (onToggleLiveVoice) onToggleLiveVoice(false);
    setVoiceNotice(null);
  };

  const runListeningCycle = (isLive: boolean) => {
    setIsRecording(true);
    setVoiceNotice(isLive ? 'Live Voice Active — Speak naturally...' : 'Listening... Speak your command');

    VoiceService.startListening(
      (transcript, isFinal) => {
        setInput(transcript);
        if (isFinal) {
          setIsRecording(false);
          setVoiceNotice(null);
          setTimeout(() => {
            if (transcript.trim()) {
              onSendMessage(transcript.trim());
              setInput('');
            }
          }, 350);
        }
      },
      (error) => {
        setIsRecording(false);
        setVoiceNotice(error);
        setTimeout(() => setVoiceNotice(null), 4000);
      },
      () => {
        setIsRecording(false);
      }
    );
  };

  const handleMicClick = () => {
    if (isRecording || isLiveVoice) {
      stopVoice();
      return;
    }
    // Toggle upward pop-up menu
    setShowVoiceMenu((prev) => !prev);
  };

  const startSingleRecord = async () => {
    setShowVoiceMenu(false);
    await VoiceService.requestMicrophonePermission();
    if (onToggleLiveVoice) onToggleLiveVoice(false);
    runListeningCycle(false);
  };

  const startLiveChat = async () => {
    setShowVoiceMenu(false);
    await VoiceService.requestMicrophonePermission();
    if (onToggleLiveVoice) onToggleLiveVoice(true);
    runListeningCycle(true);
  };

  // Register re-listen trigger for hands-free live conversation loop
  useEffect(() => {
    if (onRegisterListenTrigger) {
      onRegisterListenTrigger(() => {
        if (isLiveVoiceRef.current && !isRecording) {
          runListeningCycle(true);
        }
      });
    }
  }, [onRegisterListenTrigger, isRecording]);

  return (
    <div className="relative p-4 bg-white border-t border-zinc-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
      {/* Upward Pop-up Voice Selection Menu */}
      {showVoiceMenu && !isRecording && (
        <div className="absolute bottom-full left-4 mb-3 bg-white border border-zinc-200/90 rounded-2xl shadow-xl p-2 w-64 z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
            Choose Voice Interaction
          </div>

          {/* Option 1: Record & Send */}
          <button
            type="button"
            onClick={startSingleRecord}
            className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50/70 hover:text-emerald-950 flex items-start space-x-2.5 transition-colors group cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 group-hover:text-emerald-900">
                Record & Send
              </div>
              <div className="text-[11px] text-zinc-500 leading-normal">
                Speak once, automatically submits command
              </div>
            </div>
          </button>

          {/* Option 2: Live Chat */}
          <button
            type="button"
            onClick={startLiveChat}
            className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50/70 hover:text-rose-950 flex items-start space-x-2.5 transition-colors group mt-1 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 group-hover:text-rose-900 flex items-center gap-1.5">
                <span>Live Voice Chat</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 uppercase">Live</span>
              </div>
              <div className="text-[11px] text-zinc-500 leading-normal">
                Continuous hands-free conversation with agent
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Live Voice Indicator Banner */}
      {isLiveVoice && (
        <div className="mb-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>LIVE CONVERSATION ACTIVE — Speak freely</span>
          </div>
          <button
            type="button"
            onClick={stopVoice}
            className="text-[11px] font-medium bg-black/25 hover:bg-black/35 px-2.5 py-1 rounded-lg transition-colors"
          >
            End Live
          </button>
        </div>
      )}

      {/* Notice Message */}
      {voiceNotice && !isLiveVoice && (
        <div className="mb-2.5 text-xs py-2 px-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between shadow-xs animate-in fade-in">
          <span className="font-medium">{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-amber-700 font-bold ml-2 hover:opacity-75 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Elevated, highly visible input card */}
      <div className="bg-white border-2 border-zinc-300 rounded-2xl p-2 flex items-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] focus-within:border-zinc-800 focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.06)] transition-all duration-200">
        {/* Voice Trigger Button with Pop-up Menu */}
        <button
          type="button"
          onClick={handleMicClick}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            isLiveVoice
              ? 'bg-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-400'
              : isRecording
              ? 'bg-emerald-500 text-white animate-pulse shadow-md ring-2 ring-emerald-400'
              : showVoiceMenu
              ? 'bg-zinc-200 text-zinc-950 ring-2 ring-zinc-400'
              : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95'
          }`}
          aria-label={isRecording || isLiveVoice ? 'Stop voice recording' : 'Choose voice mode'}
          title={isRecording || isLiveVoice ? 'Stop listening' : 'Choose voice mode'}
        >
          {isRecording || isLiveVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Auto-resizing, responsive multi-line Textarea that wraps at screen boundary */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isLiveVoice ? 'Live Voice listening... (or type here)' : 'Ask a question or request an action...'}
          className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-sm text-zinc-950 placeholder:text-zinc-400 px-2 py-1.5 shadow-none font-medium resize-none min-h-[36px] max-h-[120px] leading-relaxed break-words overflow-y-auto"
          style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
          aria-label="Message Recare assistant"
        />

        {/* Send Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm flex-shrink-0 cursor-pointer"
          aria-label="Send message"
          title="Send"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
