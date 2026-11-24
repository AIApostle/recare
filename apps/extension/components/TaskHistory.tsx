import React, { useEffect, useState } from 'react';
import { TaskResponse } from '../types';
import { RecareApiClient } from '../services/api';
import { X, History, CheckCircle2, XCircle, Clock, AlertCircle, Plus } from 'lucide-react';

interface TaskHistoryProps {
  onClose: () => void;
  onSelectTask?: (task: TaskResponse) => void;
  onNewConversation?: () => void;
}

export const TaskHistory: React.FC<TaskHistoryProps> = ({ onClose, onSelectTask, onNewConversation }) => {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await RecareApiClient.listTasks(25);
        setTasks(list);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-zinc-400" />;
      case 'FAILED':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
      className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm flex flex-col justify-end"
    >
      <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 text-zinc-900 border-t border-zinc-200">
        <div className="flex items-center justify-between border-b pb-3 border-zinc-100">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-600" />
            <h2 id="history-title" className="font-semibold text-base text-zinc-900 tracking-tight">
              Task History
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
            aria-label="Close task history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Start New Conversation Button */}
        {onNewConversation && (
          <button
            type="button"
            onClick={onNewConversation}
            className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Start New Conversation</span>
          </button>
        )}

        {loading ? (
          <div className="text-center py-8 text-xs text-zinc-400">Loading task records...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            No previous tasks recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.task_id}
                className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-1.5 hover:bg-zinc-100 transition-colors cursor-pointer"
                onClick={() => onSelectTask?.(t)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(t.state)}
                    <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wide">
                      {t.state}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-zinc-200 font-medium">
                    {t.mode}
                  </span>
                </div>
                <div className="text-xs font-medium text-zinc-900 line-clamp-2">
                  {t.user_request}
                </div>
                {t.completion_summary && (
                  <div className="text-[11px] text-zinc-500 italic line-clamp-1">
                    "{t.completion_summary}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
