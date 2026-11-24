import React from 'react';
import { Eye, Settings, History, Wifi, WifiOff, Cpu, Cloud, RefreshCw } from 'lucide-react';
import { CurrentInferencePath } from '../services/firebase-ai/firebaseAiService';

interface HeaderProps {
  currentDomain?: string;
  isBackendConnected: boolean;
  inferencePath?: CurrentInferencePath;
  onOpenSettings: () => void;
  onOpenHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDomain,
  isBackendConnected,
  inferencePath = 'idle',
  onOpenSettings,
  onOpenHistory,
}) => {
  const renderInferenceBadge = () => {
    switch (inferencePath) {
      case 'on_device':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm" title="Processed on-device via Gemini Nano 4">
            <Cpu className="w-3 h-3 text-emerald-600" />
            <span>On-device</span>
          </span>
        );
      case 'in_cloud':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 shadow-sm" title="Processed in-cloud via Firebase AI Logic">
            <Cloud className="w-3 h-3 text-blue-600" />
            <span>Cloud</span>
          </span>
        );
      case 'downloading_model':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            <span>Downloading Nano</span>
          </span>
        );
      case 'fallback_to_cloud':
        return (
          <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
            <RefreshCw className="w-3 h-3 text-purple-600" />
            <span>Cloud Fallback</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200" title="Hybrid inference ready (Firebase AI Logic)">
            <Cpu className="w-3 h-3 text-gray-500" />
            <span>Hybrid AI</span>
          </span>
        );
    }
  };

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
              Hybrid
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate max-w-[140px]" title={currentDomain || 'Ready'}>
            {currentDomain ? `On: ${currentDomain}` : 'Detecting tab...'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {renderInferenceBadge()}

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
          title="Preferences & Hybrid AI"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
