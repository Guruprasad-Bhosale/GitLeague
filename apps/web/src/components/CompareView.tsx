import {
  ArrowLeft,
  Swords,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TIER_THRESHOLDS } from '@gitleague/config';
import type { ICompareResponse } from '@gitleague/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

async function fetchComparison(username: string): Promise<ICompareResponse> {
  const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/compare`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }

  if (!response.ok) {
    throw new Error('Failed to load comparison data');
  }

  const json = await response.json();
  return json.data;
}

interface CompareViewProps {
  username: string;
  onBack: () => void;
  onViewProfile: (uname: string) => void;
}

export function CompareView({ username, onBack, onViewProfile }: CompareViewProps) {
  const {
    data: compareData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['compare', username.toLowerCase()],
    queryFn: () => fetchComparison(username),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6 font-mono">
        <div className="w-32 h-8 rounded bg-zinc-800 animate-pulse" />
        <div className="h-96 rounded-xl bg-zinc-900/60 border border-white/[0.08] animate-pulse" />
      </div>
    );
  }

  if (isError || !compareData) {
    const isAuth = (error as Error)?.message === 'UNAUTHORIZED';
    const isNotFound = (error as Error)?.message === 'NOT_FOUND';

    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-16 flex flex-col items-center justify-center text-center gap-4 font-mono">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isAuth
              ? 'AUTHENTICATION REQUIRED'
              : isNotFound
              ? 'DEVELOPER NOT FOUND'
              : 'COULD NOT LOAD COMPARISON'}
          </h2>
          <p className="text-xs text-zinc-400 max-w-md">
            {isAuth
              ? 'Please sign in with GitHub to compare your stats against other developers.'
              : isNotFound
              ? `Developer @${username} has not synchronized game data yet.`
              : 'A network error occurred while retrieving comparison data.'}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK</span>
          </button>
          {!isAuth && !isNotFound && (
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-md bg-cyan-500 text-black text-xs font-bold"
            >
              RETRY
            </button>
          )}
        </div>
      </div>
    );
  }

  const { userA, userB } = compareData;

  const tierA = TIER_THRESHOLDS[userA.tier] || { title: userA.tier, color: '#CD7F32' };
  const tierB = TIER_THRESHOLDS[userB.tier] || { title: userB.tier, color: '#CD7F32' };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6 font-mono">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>BACK TO PROFILE</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-cyan-400 font-bold uppercase tracking-wider">
          <Swords className="w-4 h-4" />
          <span>HEAD-TO-HEAD COMPARISON</span>
        </div>
      </div>

      {/* Main Comparison Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User A (You) */}
        <div className="p-6 rounded-xl bg-zinc-950/80 border border-cyan-500/30 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
              YOU
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded uppercase"
              style={{
                backgroundColor: `${tierA.color}22`,
                color: tierA.color,
                border: `1px solid ${tierA.color}44`,
              }}
            >
              {userA.tier}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <img
              src={userA.avatarUrl}
              alt={userA.username}
              className="w-14 h-14 rounded-xl border border-white/10 object-cover"
            />
            <div className="flex flex-col">
              <span className="text-base font-bold text-white">{userA.displayName || userA.username}</span>
              <span className="text-xs text-zinc-400">@{userA.username}</span>
              {userA.college && (
                <span className="text-[11px] text-zinc-500 flex items-center gap-1 pt-0.5">
                  <GraduationCap className="w-3 h-3 text-zinc-400" />
                  {userA.college.shortName || userA.college.name}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-center">
            <div className="p-2 rounded bg-zinc-900/60">
              <div className="text-[10px] text-zinc-500 uppercase">LEVEL</div>
              <div className="text-sm font-bold text-white">{userA.level}</div>
            </div>
            <div className="p-2 rounded bg-zinc-900/60">
              <div className="text-[10px] text-zinc-500 uppercase">XP</div>
              <div className="text-sm font-bold text-cyan-300">{userA.xp.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded bg-zinc-900/60">
              <div className="text-[10px] text-zinc-500 uppercase">RANK</div>
              <div className="text-sm font-bold text-amber-400">#{userA.globalRank}</div>
            </div>
          </div>
        </div>

        {/* User B (Opponent) */}
        <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-zinc-900 border border-white/10">
              RIVAL DEVELOPER
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded uppercase"
              style={{
                backgroundColor: `${tierB.color}22`,
                color: tierB.color,
                border: `1px solid ${tierB.color}44`,
              }}
            >
              {userB.tier}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <img
              src={userB.avatarUrl}
              alt={userB.username}
              className="w-14 h-14 rounded-xl border border-white/10 object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => onViewProfile(userB.username)}
            />
            <div className="flex flex-col">
              <span
                onClick={() => onViewProfile(userB.username)}
                className="text-base font-bold text-white hover:text-cyan-400 cursor-pointer transition-colors"
              >
                {userB.displayName || userB.username}
              </span>
              <span className="text-xs text-zinc-400">@{userB.username}</span>
              {userB.college && (
                <span className="text-[11px] text-zinc-500 flex items-center gap-1 pt-0.5">
                  <GraduationCap className="w-3 h-3 text-zinc-400" />
                  {userB.college.shortName || userB.college.name}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-center">
            <div className="p-2 rounded bg-zinc-900/60">
              <div className="text-[10px] text-zinc-500 uppercase">LEVEL</div>
              <div className="text-sm font-bold text-white">{userB.level}</div>
            </div>
            <div className="p-2 rounded bg-zinc-900/60">
              <div className="text-[10px] text-zinc-500 uppercase">XP</div>
              <div className="text-sm font-bold text-cyan-300">{userB.xp.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded bg-zinc-900/60">
              <div className="text-[10px] text-zinc-500 uppercase">RANK</div>
              <div className="text-sm font-bold text-amber-400">#{userB.globalRank}</div>
            </div>
          </div>
        </div>
      </div>

      {/* RPG Core Attributes Comparison */}
      <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">RPG ATTRIBUTES</h3>
        </div>

        <div className="flex flex-col gap-4">
          <AttributeRow
            label="CODING"
            valA={userA.stats.coding}
            valB={userB.stats.coding}
            color="bg-cyan-400"
          />
          <AttributeRow
            label="CONSISTENCY"
            valA={userA.stats.consistency}
            valB={userB.stats.consistency}
            color="bg-amber-400"
          />
          <AttributeRow
            label="BUILDER"
            valA={userA.stats.builder}
            valB={userB.stats.builder}
            color="bg-purple-400"
          />
          <AttributeRow
            label="OPEN SOURCE"
            valA={userA.stats.openSource}
            valB={userB.stats.openSource}
            color="bg-emerald-400"
          />
        </div>
      </div>

      {/* Activity & Stats Breakdown Matrix */}
      <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">ACTIVITY COMPARISON</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 uppercase">
                <th className="py-2.5 px-3">METRIC</th>
                <th className="py-2.5 px-3 text-cyan-400">YOU (@{userA.username})</th>
                <th className="py-2.5 px-3 text-zinc-300">RIVAL (@{userB.username})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <StatRow label="Current Streak" valA={`${userA.currentStreak} days`} valB={`${userB.currentStreak} days`} />
              <StatRow label="Longest Streak" valA={`${userA.longestStreak} days`} valB={`${userB.longestStreak} days`} />
              <StatRow label="Total Commits" valA={userA.commits.toLocaleString()} valB={userB.commits.toLocaleString()} />
              <StatRow label="Pull Requests" valA={userA.pullRequests.toLocaleString()} valB={userB.pullRequests.toLocaleString()} />
              <StatRow label="Issues Solved" valA={userA.issues.toLocaleString()} valB={userB.issues.toLocaleString()} />
              <StatRow label="Repositories" valA={userA.repositories.toLocaleString()} valB={userB.repositories.toLocaleString()} />
              <StatRow label="Stars Earned" valA={userA.stars.toLocaleString()} valB={userB.stars.toLocaleString()} />
              <StatRow label="Achievements" valA={userA.achievementsCount} valB={userB.achievementsCount} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AttributeRow({
  label,
  valA,
  valB,
  color,
}: {
  label: string;
  valA: number;
  valB: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-cyan-400">{valA}</span>
        <span className="text-zinc-400 tracking-wider uppercase text-[11px]">{label}</span>
        <span className="text-zinc-300">{valB}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 h-2 rounded bg-zinc-900 overflow-hidden">
        {/* User A bar (aligned right) */}
        <div className="flex justify-end bg-zinc-800">
          <div className={`h-full ${color} rounded-l`} style={{ width: `${Math.min(100, valA)}%` }} />
        </div>
        {/* User B bar (aligned left) */}
        <div className="flex justify-start bg-zinc-800">
          <div className={`h-full ${color} opacity-75 rounded-r`} style={{ width: `${Math.min(100, valB)}%` }} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, valA, valB }: { label: string; valA: string | number; valB: string | number }) {
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className="py-2.5 px-3 text-zinc-400 font-medium">{label}</td>
      <td className="py-2.5 px-3 text-white font-bold">{valA}</td>
      <td className="py-2.5 px-3 text-zinc-300">{valB}</td>
    </tr>
  );
}
