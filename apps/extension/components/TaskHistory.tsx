import React, { useEffect, useState } from 'react';
import { TaskResponse } from '../types';
import { RecareApiClient } from '../services/api';
import { X, History, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

interface TaskHistoryProps {
  onClose: () => void;
  onSelectTask?: (task: TaskResponse) => void;
}

export const TaskHistory: React.FC<TaskHistoryProps> = ({ onClose, onSelectTask }) => {
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
        return <CheckCircle2 className="w-4 h-4 text-recare-600" />;
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-gray-400" />;
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
      className="fixed inset-0 z-30 bg-black/40 flex flex-col justify-end"
    >
      <div className="bg-white rounded-t-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 text-gray-900">
        <div className="flex items-center justify-between border-b pb-3 border-gray-200">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-recare-600" />
            <h2 id="history-title" className="font-bold text-base text-gray-900">
              Task History & Records
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            aria-label="Close task history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading task records...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">
            No previous tasks recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.task_id}
                className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => onSelectTask?.(t)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(t.state)}
                    <span className="text-xs font-semibold text-gray-800 uppercase tracking-wide">
                      {t.state}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase px-1.5 py-0.5 rounded bg-gray-200 font-medium">
                    {t.mode}
                  </span>
                </div>
                <div className="text-xs font-medium text-gray-900 line-clamp-2">
                  {t.user_request}
                </div>
                {t.completion_summary && (
                  <div className="text-[11px] text-gray-500 italic line-clamp-1">
                    "{t.completion_summary}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow"
        >
          Close
        </button>
      </div>
    </div>
  );
};
