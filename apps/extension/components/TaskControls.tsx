import React from 'react';
import { Pause, Play, Square, Hand } from 'lucide-react';
import { TaskState } from '../types';

interface TaskControlsProps {
  state: TaskState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onTakeover: () => void;
}

export const TaskControls: React.FC<TaskControlsProps> = ({
  state,
  onPause,
  onResume,
  onStop,
  onTakeover,
}) => {
  const isExecutingOrWaiting = [
    'UNDERSTANDING',
    'PLANNING',
    'WAITING_FOR_ACTION',
    'EXECUTING',
    'VERIFYING',
  ].includes(state);

  const isPaused = state === 'PAUSED';

  if (!isExecutingOrWaiting && !isPaused) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Active Task Control Bar"
      className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between text-xs"
    >
      <div className="flex items-center space-x-1.5 font-medium text-gray-700">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span>Task in Progress</span>
      </div>

      <div className="flex items-center space-x-1">
        {isPaused ? (
          <button
            type="button"
            onClick={onResume}
            className="flex items-center space-x-1 py-1 px-2.5 bg-recare-600 hover:bg-recare-700 text-white font-medium rounded transition-colors"
            aria-label="Resume active task"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Resume</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="flex items-center space-x-1 py-1 px-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded transition-colors"
            aria-label="Pause active task"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Pause</span>
          </button>
        )}

        <button
          type="button"
          onClick={onStop}
          className="flex items-center space-x-1 py-1 px-2.5 bg-red-100 hover:bg-red-200 text-red-800 font-medium rounded transition-colors"
          aria-label="Stop task immediately"
        >
          <Square className="w-3.5 h-3.5" />
          <span>Stop</span>
        </button>

        <button
          type="button"
          onClick={onTakeover}
          className="flex items-center space-x-1 py-1 px-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded transition-colors"
          title="Manual Takeover"
          aria-label="Take over manually"
        >
          <Hand className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
