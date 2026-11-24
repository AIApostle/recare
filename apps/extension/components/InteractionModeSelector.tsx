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
    <div className="px-4 py-2 bg-white/60 backdrop-blur-xs border-b border-zinc-100">
      <div
        role="radiogroup"
        aria-label="Agent Interaction Mode"
        className="grid grid-cols-3 gap-1 bg-zinc-100/80 p-1 rounded-2xl border border-zinc-200/40"
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
              className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-xl text-xs transition-all ${
                isSelected
                  ? 'bg-white text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 font-medium'
              }`}
              title={m.description}
            >
              <span className={isSelected ? 'text-emerald-600' : 'text-zinc-400'}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
