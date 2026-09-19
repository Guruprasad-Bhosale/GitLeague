import { useState } from 'react';
import {
  X,
  Zap,
  Flame,
  Check,
  RefreshCw,
  Calendar,
  Clock,
  Sparkles,
  GitCommit,
  GitPullRequest,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { IUserQuestsResponse, ISafeUser } from '@gitleague/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

interface QuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ISafeUser | null;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

function formatRelativeTime(dateString?: string | Date | null): string {
  if (!dateString) return 'NEVER SYNCED';
  const date = new Date(dateString);
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSecs < 60) return 'JUST NOW';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}M AGO`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}H AGO`;
  return `${Math.floor(diffSecs / 86400)}D AGO`;
}

function getMetricIcon(metric: string) {
  switch (metric) {
    case 'commits':
      return <GitCommit className="w-4 h-4 text-cyan-400" />;
    case 'pull_requests':
    case 'merged_pull_requests':
      return <GitPullRequest className="w-4 h-4 text-emerald-400" />;
    case 'active_days':
      return <Flame className="w-4 h-4 text-amber-400" />;
    default:
      return <Zap className="w-4 h-4 text-purple-400" />;
  }
}

export function QuestsModal({
  isOpen,
  onClose,
  currentUser,
  onTriggerSync,
  isSyncing = false,
}: QuestsModalProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');

  const { data: questsData, isLoading } = useQuery<IUserQuestsResponse>({
    queryKey: ['my-quests'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/me/quests`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load quests');
      const json = await res.json();
      return json.data;
    },
    enabled: isOpen && Boolean(currentUser),
  });

  if (!isOpen) return null;

  const currentQuests = activeTab === 'daily' ? questsData?.daily || [] : questsData?.weekly || [];
  const completedCount = currentQuests.filter((q) => q.completed).length;
  const totalCount = currentQuests.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm font-mono animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  COMPETITIVE QUESTS
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 uppercase">
                  XP REWARDS
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Earn bonus XP directly from your real GitHub activity.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Honest Synchronization Subheader */}
        <div className="px-5 py-2.5 bg-zinc-900/80 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Progress calculated from your latest GitHub sync • Last synced {formatRelativeTime(questsData?.lastSyncedAt)}</span>
          </span>

          {onTriggerSync && (
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'SYNCING...' : 'SYNC NOW'}</span>
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-white/[0.08] px-6 pt-3 bg-zinc-900/20">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'daily'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>DAILY QUESTS</span>
            {questsData?.daily && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                {questsData.daily.filter((q) => q.completed).length}/{questsData.daily.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'weekly'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>WEEKLY QUESTS</span>
            {questsData?.weekly && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                {questsData.weekly.filter((q) => q.completed).length}/{questsData.weekly.length}
              </span>
            )}
          </button>
        </div>

        {/* Quests Content List */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-3">
          {isLoading ? (
            <div className="flex flex-col gap-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-zinc-900/60 border border-white/[0.06]" />
              ))}
            </div>
          ) : currentQuests.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-zinc-500">
              <AlertCircle className="w-8 h-8 text-zinc-600" />
              <p className="text-xs">No active quests for this rotation period.</p>
            </div>
          ) : (
            currentQuests.map((quest) => {
              const progressPct = Math.min(100, Math.round((quest.progress / quest.target) * 100));

              return (
                <div
                  key={quest.id}
                  className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                    quest.completed
                      ? 'bg-zinc-900/90 border-emerald-500/30'
                      : 'bg-zinc-900/40 border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-white/10 flex items-center justify-center shrink-0">
                        {getMetricIcon(quest.metric)}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-tight">
                            {quest.name}
                          </span>
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.2 rounded">
                            +{quest.rewardXP} XP
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{quest.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {quest.completed ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                          <Check className="w-3 h-3" />
                          <span>COMPLETED</span>
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-zinc-300">
                          {quest.progress} / {quest.target}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex flex-col gap-1">
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          quest.completed
                            ? 'bg-emerald-400'
                            : 'bg-gradient-to-r from-cyan-500 to-cyan-300'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-400">
          <span>
            {activeTab === 'daily' ? 'Daily' : 'Weekly'} Quests Completed:{' '}
            <strong className="text-white">
              {completedCount} / {totalCount}
            </strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-semibold transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
