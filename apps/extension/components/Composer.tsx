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
    <div className="p-4 bg-white border-t border-zinc-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
      {voiceNotice && (
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
        {/* Voice Trigger */}
        <button
          type="button"
          onClick={toggleVoice}
          className={`p-2.5 rounded-xl transition-all ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-400'
              : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95'
          }`}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice input'}
          title={isRecording ? 'Stop listening' : 'Speak to Recare'}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Input Field (Clean, visible, comfortable font and spacing) */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask a question or request an action..."
          className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-sm text-zinc-900 placeholder:text-zinc-400 px-2 py-1 shadow-none"
          style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
          aria-label="Message Recare assistant"
        />

        {/* Send Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm flex-shrink-0"
          aria-label="Send message"
          title="Send"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
