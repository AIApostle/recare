import React, { useEffect, useState } from 'react';
import { TaskResponse, StoredConversation } from '../types';
import { RecareApiClient } from '../services/api';
import { StorageService } from '../services/storage';
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  MessageSquare,
  Trash2,
} from 'lucide-react';

interface TaskHistoryProps {
  activeConversationId?: string | null;
  onClose: () => void;
  onSelectConversation?: (conversation: StoredConversation) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onSelectTask?: (task: TaskResponse) => void;
  onNewConversation?: () => void;
}

export const TaskHistory: React.FC<TaskHistoryProps> = ({
  activeConversationId,
  onClose,
  onSelectConversation,
  onDeleteConversation,
  onSelectTask,
  onNewConversation,
}) => {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [activeTab, setActiveTab] = useState<'conversations' | 'tasks'>('conversations');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [savedConvs, remoteTasks] = await Promise.all([
          StorageService.getConversations(),
          RecareApiClient.listTasks(25),
        ]);
        setConversations(savedConvs);
        setTasks(remoteTasks);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const remaining = await StorageService.deleteConversation(id);
    setConversations(remaining);
    onDeleteConversation?.(id);
  };

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 text-zinc-900 border-t border-zinc-200">
        <div className="flex items-center justify-between border-b pb-3 border-zinc-100">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-600" />
            <h2 id="history-title" className="font-semibold text-base text-zinc-900 tracking-tight">
              Conversation & Task History
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Start New Conversation Button */}
        {onNewConversation && (
          <button
            type="button"
            onClick={onNewConversation}
            className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Start New Conversation</span>
          </button>
        )}

        {/* Section Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
          <button
            type="button"
            onClick={() => setActiveTab('conversations')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'conversations'
                ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Conversations ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Cloud Tasks ({tasks.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-zinc-400">Loading history...</div>
        ) : activeTab === 'conversations' ? (
          conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400">
              No previous conversations saved yet. Start chatting to save your thread automatically.
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-xl border space-y-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-50'
                        : 'bg-zinc-50 border-zinc-200/80 hover:bg-zinc-100'
                    }`}
                    onClick={() => onSelectConversation?.(conv)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-zinc-900 truncate">
                          {conv.title || 'Untitled Conversation'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {isActive && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                            Active
                          </span>
                        )}
                        {conv.domain && (
                          <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-200/80 font-medium max-w-[110px] truncate">
                            {conv.domain}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`Delete conversation ${conv.title}`}
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {lastMsg && (
                      <div className="text-[11px] text-zinc-600 line-clamp-2">
                        {lastMsg.sender === 'user' ? 'You: ' : 'Recare: '}
                        {lastMsg.text}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                      <span>{conv.messages.length} messages</span>
                      <span>{new Date(conv.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            No previous cloud tasks recorded yet.
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
