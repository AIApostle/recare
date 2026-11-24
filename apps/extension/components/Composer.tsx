import React, { useState } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';
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
          // Automatically send voice query on completion
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
    <div className="p-3 bg-white border-t border-gray-200">
      {voiceNotice && (
        <div className="mb-2 text-xs py-1 px-2.5 rounded bg-amber-100 text-amber-900 flex items-center justify-between">
          <span>{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-amber-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={toggleVoice}
          className={`p-2 rounded-xl transition-all ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-400'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice input'}
          title={isRecording ? 'Stop listening' : 'Speak to Recare'}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={isRecording ? 'Listening to voice...' : 'Ask Recare or describe a task...'}
            className="w-full py-2 pl-3 pr-9 text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:border-recare-600 transition-colors"
            aria-label="Message Recare assistant"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-recare-600 hover:text-recare-700 disabled:text-gray-300 transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
