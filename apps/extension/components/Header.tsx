import React from 'react';
import { Eye, Settings, History, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  currentDomain?: string;
  isBackendConnected: boolean;
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDomain,
  isBackendConnected,
  onOpenSettings,
  onOpenHistory,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-lg bg-recare-600 flex items-center justify-center text-white font-bold shadow-sm">
          <Eye className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <h1 className="font-bold text-gray-900 text-base tracking-tight">Recare</h1>
            <span className="text-[10px] bg-recare-100 text-recare-800 font-semibold px-1.5 py-0.5 rounded">
              Assistant
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate max-w-[180px]" title={currentDomain || 'Ready'}>
            {currentDomain ? `On: ${currentDomain}` : 'Detecting tab...'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <span
          className="flex items-center text-xs text-gray-500"
          title={isBackendConnected ? 'Backend Connected' : 'Backend Disconnected (localhost:8000)'}
        >
          {isBackendConnected ? (
            <Wifi className="w-4 h-4 text-recare-600" aria-label="Backend Connected" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" aria-label="Backend Disconnected" />
          )}
        </span>

        <button
          type="button"
          onClick={onOpenHistory}
          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="View task history"
          title="Task History"
        >
          <History className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Open accessibility settings"
          title="Preferences"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
