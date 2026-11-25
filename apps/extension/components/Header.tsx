import React from 'react';
import { Eye, Settings, History, Plus } from 'lucide-react';
import { CurrentInferencePath } from '../services/firebase-ai/firebaseAiService';

interface HeaderProps {
  currentDomain?: string;
  isBackendConnected?: boolean;
  inferencePath?: CurrentInferencePath;
  onNewConversation?: () => void;
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
  onOpenLocalModelSetup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isBackendConnected = true,
  inferencePath = 'idle',
  onNewConversation,
  onOpenSettings,
  onOpenHistory,
  onOpenLocalModelSetup,
}) => {
  const isLocal = inferencePath === 'on_device';
  const statusLabel = isLocal
    ? 'Nano Local'
    : isBackendConnected
    ? 'Render Cloud'
    : 'Local Fallback';

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 sticky top-0 z-20">
      {/* Brand & Logo + Live Connection / Local AI Status */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_0_0_1px_rgba(16,185,129,0.3)] flex-shrink-0">
          <Eye className="w-4 h-4 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-zinc-950 text-[15px] tracking-tight leading-none">
            Recare
          </h1>
          {onOpenLocalModelSetup && (
            <button
              type="button"
              onClick={onOpenLocalModelSetup}
              className="mt-1 inline-flex items-center space-x-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
              title="View Render connection & local Gemini Nano setup"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLocal
                    ? 'bg-emerald-500'
                    : isBackendConnected
                    ? 'bg-sky-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="truncate">{statusLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean Utility Actions */}
      <div className="flex items-center space-x-1">
        {onNewConversation && (
          <button
            type="button"
            onClick={onNewConversation}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95 transition-all"
            aria-label="Start new conversation"
            title="New Conversation"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80 active:scale-95 transition-all"
            aria-label="View task history"
            title="Task History"
          >
            <History className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80 active:scale-95 transition-all"
          aria-label="Open accessibility settings"
          title="Accessibility & Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
