import React from 'react';
import { Eye, Settings, History } from 'lucide-react';
import { CurrentInferencePath } from '../services/firebase-ai/firebaseAiService';

interface HeaderProps {
  currentDomain?: string;
  isBackendConnected?: boolean;
  inferencePath?: CurrentInferencePath;
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHistory,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 sticky top-0 z-20">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_0_0_1px_rgba(16,185,129,0.3)]">
          <Eye className="w-4 h-4 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-semibold text-zinc-950 text-[15px] tracking-tight leading-none">
            Recare
          </h1>
        </div>
      </div>

      {/* Clean Utility Actions */}
      <div className="flex items-center space-x-1">
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
