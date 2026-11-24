import React from 'react';
import { InteractionMode } from '../types';
import { BookOpen, Compass, Zap } from 'lucide-react';

interface InteractionModeSelectorProps {
  currentMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
}

export const InteractionModeSelector: React.FC<InteractionModeSelectorProps> = ({
  currentMode,
  onModeChange,
}) => {
  const modes: Array<{
    id: InteractionMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'guide',
      label: 'Guide',
      description: 'Explains & highlights without clicking',
      icon: <BookOpen className="w-3.5 h-3.5" />,
    },
    {
      id: 'assist',
      label: 'Assist',
      description: 'Executes approved actions with you',
      icon: <Compass className="w-3.5 h-3.5" />,
    },
    {
      id: 'autonomous',
      label: 'Auto',
      description: 'Carries out multi-step tasks',
      icon: <Zap className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
      <div
        role="radiogroup"
        aria-label="Agent Interaction Mode"
        className="grid grid-cols-3 gap-1 bg-gray-200 p-1 rounded-lg"
      >
        {modes.map((m) => {
          const isSelected = currentMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onModeChange(m.id)}
              className={`flex items-center justify-center space-x-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title={m.description}
            >
              <span className={isSelected ? 'text-recare-600' : 'text-gray-400'}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
