import React from 'react';
import { PlanStep, TaskState } from '../types';
import { Bot, User, CheckCircle2, Clock, Volume2 } from 'lucide-react';
import { VoiceService } from '../services/voice';

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  spokenText?: string;
  timestamp: string;
  plan?: PlanStep[];
  state?: TaskState;
  suggestedActions?: string[];
}

interface ConversationAreaProps {
  messages: ChatMessageItem[];
  onSuggestedAction: (actionText: string) => void;
  speechRate?: number;
}

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  messages,
  onSuggestedAction,
  speechRate = 1.0,
}) => {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation and task history"
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.length === 0 && (
        <div className="text-center py-8 text-gray-500 space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-recare-50 text-recare-600 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-gray-800">How can Recare assist you?</h2>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Ask about this page, have me explain controls, or request multi-step actions using text or voice.
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start space-x-2.5 ${
            msg.sender === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {msg.sender === 'assistant' && (
            <div className="w-7 h-7 rounded-lg bg-recare-100 text-recare-800 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
          )}

          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
              msg.sender === 'user'
                ? 'bg-recare-600 text-white rounded-tr-none'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
            }`}
          >
            <div className="flex items-center justify-between space-x-2 mb-1">
              <span className="text-[10px] font-semibold opacity-75">
                {msg.sender === 'user' ? 'You' : 'Recare'}
              </span>
              {msg.sender === 'assistant' && (
                <button
                  type="button"
                  onClick={() => VoiceService.speak(msg.spokenText || msg.text, speechRate)}
                  className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="Read response aloud"
                  title="Listen"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="whitespace-pre-line">{msg.text}</div>

            {/* Task Structured Plan */}
            {msg.plan && msg.plan.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-1.5">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Task Plan:
                </div>
                {msg.plan.map((step) => (
                  <div
                    key={step.step_number}
                    className="flex items-center space-x-2 text-xs py-1 px-1.5 rounded bg-gray-50"
                  >
                    {step.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-recare-600 flex-shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        step.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-700'
                      }`}
                    >
                      {step.step_number}. {step.description}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested Quick Action Pills */}
            {msg.suggestedActions && msg.suggestedActions.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                {msg.suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSuggestedAction(action)}
                    className="text-[11px] py-1 px-2 bg-gray-100 hover:bg-recare-50 hover:text-recare-800 text-gray-700 rounded-lg transition-colors border border-gray-200"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>

          {msg.sender === 'user' && (
            <div className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
