import React, { useState } from 'react';
import { ArrowUp, Mic, MicOff } from 'lucide-react';
import { VoiceService } from '../services/voice';

interface ComposerProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({ onSendMessage, disabled }) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    onSendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    if (isRecording) {
      VoiceService.stopListening();
      setIsRecording(false);
      setVoiceNotice(null);
      return;
    }

    const started = VoiceService.startListening(
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
          }, 400);
        }
      },
      (error) => {
        setIsRecording(false);
        setVoiceNotice(error);
        setTimeout(() => setVoiceNotice(null), 3500);
      },
      () => {
        setIsRecording(false);
      }
    );

    if (started) {
      setIsRecording(true);
      setVoiceNotice('Listening... Speak your request');
    }
  };

  return (
    <div className="p-3 bg-white border-t border-zinc-100">
      {voiceNotice && (
        <div className="mb-2 text-xs py-1.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between animate-in fade-in">
          <span>{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-amber-700 font-bold ml-2 hover:opacity-75"
          >
            ×
          </button>
        </div>
      )}

      {/* Double-bezel input pill */}
      <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-1.5 flex items-center gap-1.5 focus-within:border-emerald-500/60 focus-within:bg-white focus-within:ring-3 focus-within:ring-emerald-500/10 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
        {/* Voice Trigger */}
        <button
          type="button"
          onClick={toggleVoice}
          className={`p-2 rounded-xl transition-all ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-400'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice input'}
          title={isRecording ? 'Stop listening' : 'Speak to Recare'}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Input Field */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask a question or request an action..."
          className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none px-1"
          aria-label="Message Recare assistant"
        />

        {/* Send Action */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none shadow-xs flex-shrink-0"
          aria-label="Send message"
          title="Send"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
