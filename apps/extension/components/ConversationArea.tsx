import React from 'react';
import { ChatMessageItem, GeneratedDocument } from '../types';
import { Bot, Volume2, FileText, Download, Copy, Check } from 'lucide-react';
import { VoiceService } from '../services/voice';

export type { ChatMessageItem };

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
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [copiedDocId, setCopiedDocId] = React.useState<string | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDownloadDoc = (doc: GeneratedDocument) => {
    const blob = new Blob([doc.content], { type: doc.mimeType || 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename || 'research_report.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyDoc = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedDocId(id);
    setTimeout(() => setCopiedDocId(null), 2500);
  };

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation and task history"
      className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-w-0 max-w-full"
    >
      {/* Empty State Onboarding */}
      {messages.length === 0 && (
        <div className="text-center py-10 px-2 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-xs">
            <Bot className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">How can Recare help you?</h2>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
              Ask questions about this page, request interface explanations, or state a task you want accomplished.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap justify-center gap-1.5 max-w-xs mx-auto">
            {['Explain this page', 'Where is the submit button?', 'Help me complete this form'].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSuggestedAction(prompt)}
                className="text-[11px] font-medium px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-xl border border-zinc-200/80 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start space-x-2.5 min-w-0 max-w-full ${
            msg.sender === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {msg.sender === 'assistant' && (
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-100">
              <Bot className="w-4 h-4" />
            </div>
          )}

          <div
            className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed overflow-hidden ${
              msg.sender === 'user'
                ? 'bg-zinc-950 text-white rounded-tr-xs shadow-xs'
                : 'bg-white border border-zinc-200/80 text-zinc-800 rounded-tl-xs shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
            }`}
          >
            {/* Message Header */}
            <div className="flex items-center justify-between space-x-2 mb-1.5">
              <span className="text-[10px] font-semibold opacity-60 uppercase tracking-wider">
                {msg.sender === 'user' ? 'You' : 'Recare'}
              </span>

              {msg.sender === 'assistant' && (
                <button
                  type="button"
                  onClick={() => VoiceService.speak(msg.spokenText || msg.text, speechRate)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  aria-label="Read response aloud"
                  title="Listen aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Optional Attached Image / Document Preview */}
            {msg.attachment && (
              <div className="mb-2 rounded-xl overflow-hidden border border-zinc-200/60 bg-zinc-50/50">
                {msg.attachment.mimeType?.startsWith('image/') || msg.attachment.previewUrl ? (
                  <img
                    src={msg.attachment.previewUrl || `data:${msg.attachment.mimeType || 'image/jpeg'};base64,${msg.attachment.base64}`}
                    alt={msg.attachment.name || 'Attached image'}
                    className="max-h-48 w-auto rounded-lg object-contain"
                  />
                ) : (
                  <div className="p-2 flex items-center space-x-2 text-xs text-zinc-700">
                    <span className="font-semibold text-[11px] truncate">{msg.attachment.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Message Body with Guaranteed Screen Wrapping */}
            <div
              className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] font-normal leading-relaxed ${
                msg.sender === 'user' ? 'text-white' : 'text-zinc-950 font-normal'
              }`}
            >
              {msg.text}
            </div>

            {/* Generated Research Document Card from Assistant */}
            {msg.generatedDocument && (
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/80 border border-emerald-200/90 shadow-xs space-y-2.5 text-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-zinc-950 truncate">
                        {msg.generatedDocument.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">
                        {msg.generatedDocument.filename}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions: Download Document & Copy Text */}
                <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60">
                  <button
                    type="button"
                    onClick={() => handleDownloadDoc(msg.generatedDocument!)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyDoc(msg.id, msg.generatedDocument!.content)}
                    className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    {copiedDocId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Suggested Follow-up Actions */}
            {msg.suggestedActions && msg.suggestedActions.length > 0 && (
              <div className="mt-2.5 pt-2 flex flex-wrap gap-1 border-t border-zinc-100">
                {msg.suggestedActions.map((action, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSuggestedAction(action)}
                    className="text-[11px] font-medium px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Auto-scroll target */}
      <div ref={bottomRef} />
    </div>
  );
};
