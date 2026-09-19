import { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Check,
  Github,
  Trophy,
  Flame,
  AlertCircle,
  MapPin,
  Building,
  Sparkles,
  ShieldCheck,
  Lock,
  GraduationCap,
  Users,
  Swords,
  UserPlus,
  Calendar,
  TrendingUp,
} from 'lucide-react';


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TIER_THRESHOLDS } from '@gitleague/config';
import type { IUserProfile, ISafeUser } from '@gitleague/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

async function fetchUserProfile(username: string): Promise<IUserProfile> {
  const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/profile`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }

  if (!response.ok) {
    throw new Error('Failed to load profile');
  }

  const json = await response.json();
  return json.data;
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

function getRarityBadgeStyle(label?: string): string {
  switch (label) {
    case 'Legendary':
      return 'bg-amber-950/80 text-amber-300 border-amber-600/40';
    case 'Epic':
      return 'bg-purple-950/80 text-purple-300 border-purple-600/40';
    case 'Rare':
      return 'bg-blue-950/80 text-blue-300 border-blue-600/40';
    case 'Uncommon':
      return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40';
    case 'Common':
    default:
      return 'bg-zinc-900 text-zinc-400 border-zinc-700/60';
  }
}

interface DeveloperProfileProps {
  username: string;
  onBack: () => void;
  onCompare: (username: string) => void;
  currentUser?: ISafeUser | null;
}

export function DeveloperProfile({ username, onBack, onCompare, currentUser }: DeveloperProfileProps) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile', username.toLowerCase()],
    queryFn: () => fetchUserProfile(username),
    retry: 1,
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await fetch(`${API_BASE_URL}/friends/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId: targetUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username.toLowerCase()] });
    },
  });

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `${profile?.username || username} — GitLeague`,
      text: `Level ${profile?.level ?? 1} • ${profile?.tier ?? 'BRONZE'} • #${profile?.globalRank ?? '—'} Global on GitLeague`,
      url,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: rankHistoryData } = useQuery({
    queryKey: ['rank-history', username.toLowerCase()],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(username)}/rank-history?scope=global`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(profile),
  });


  if (isLoading) {
    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6 font-mono">
        <div className="w-32 h-8 rounded bg-zinc-800 animate-pulse" />
        <div className="p-6 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex flex-col gap-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-zinc-800" />
            <div className="flex flex-col gap-2">
              <div className="w-40 h-5 rounded bg-zinc-800" />
              <div className="w-24 h-3.5 rounded bg-zinc-800" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-zinc-800/60" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    const isNotFound = (error as Error)?.message === 'NOT_FOUND';

    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-16 flex flex-col items-center justify-center text-center gap-4 font-mono">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isNotFound ? 'DEVELOPER NOT FOUND' : "COULDN'T LOAD PROFILE"}
          </h2>
          <p className="text-xs text-zinc-400 max-w-md">
            {isNotFound
              ? `Developer @${username} has not joined GitLeague or has no synchronized competitive game data yet.`
              : 'A network or server error occurred while retrieving this developer profile.'}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO LEADERBOARD</span>
          </button>
          {!isNotFound && (
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

  const tierInfo = TIER_THRESHOLDS[profile.tier] || { title: profile.tier, color: '#CD7F32' };
  const isOwnProfile = currentUser?.id === profile.userId;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6 font-mono">
      {/* Top Bar: Navigation & Actions */}
      <div className="flex items-center justify-between gap-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>BACK TO LEADERBOARD</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500 uppercase hidden sm:inline">
            UPDATED {formatRelativeTime(profile.lastSyncedAt)}
          </span>

          {currentUser && !isOwnProfile && (
            <button
              onClick={() => onCompare(profile.username)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/30 text-xs text-cyan-300 font-bold transition-all"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>COMPARE</span>
            </button>
          )}

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-200 hover:text-white transition-all"
            title="Copy profile link"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">COPIED!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>SHARE PROFILE</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Developer Identity Card */}
      <div className="p-6 sm:p-8 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-white/10 object-cover shrink-0"
            />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {profile.displayName || profile.username}
                </h1>
                <span className="text-xs text-zinc-400">@{profile.username}</span>
                <a
                  href={profile.githubProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                  title="View on GitHub"
                >
                  <Github className="w-3.5 h-3.5" />
                </a>

                {/* Social Relation Status Button */}
                {currentUser && !isOwnProfile && (
                  <div className="pl-1">
                    {profile.friendshipStatus === 'friends' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
                        FRIENDS ✓
                      </span>
                    ) : profile.friendshipStatus === 'pending_sent' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/30 text-amber-400">
                        REQUEST SENT ⏳
                      </span>
                    ) : profile.friendshipStatus === 'pending_received' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                        PENDING YOUR ACCEPTANCE
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequestMutation.mutate(profile.userId)}
                        disabled={sendFriendRequestMutation.isPending}
                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded bg-cyan-500 text-black hover:bg-cyan-400 transition-colors"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>ADD FRIEND</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {profile.bio && <p className="text-xs text-zinc-400 max-w-xl">{profile.bio}</p>}

              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-1">
                {profile.college && (
                  <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                    <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{profile.college.name}</span>
                  </span>
                )}
                {profile.friendsCount > 0 && (
                  <span className="flex items-center gap-1 text-zinc-300">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{profile.friendsCount} {profile.friendsCount === 1 ? 'Friend' : 'Friends'}</span>
                  </span>
                )}
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{profile.location}</span>
                  </span>
                )}
                {profile.company && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{profile.company}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tier & Rank Summary Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:text-right p-3 sm:p-0 rounded-lg bg-zinc-900/50 sm:bg-transparent border sm:border-0 border-white/[0.06]">
            <div className="flex flex-col items-start sm:items-end">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded tracking-wider uppercase inline-block"
                style={{
                  backgroundColor: `${tierInfo.color}22`,
                  color: tierInfo.color,
                  border: `1px solid ${tierInfo.color}44`,
                }}
              >
                {profile.tier}
              </span>
              <span className="text-[11px] text-zinc-400 pt-1 font-semibold">{profile.tierTitle}</span>
            </div>
            <div className="text-right">
              <div className="text-base sm:text-lg font-bold text-cyan-300">
                {profile.xp.toLocaleString()} <span className="text-xs text-zinc-500">XP</span>
              </div>
              <div className="text-[11px] text-zinc-400">Level {profile.level}</div>
            </div>
          </div>
        </div>

        {/* Competitive Ranks & Progression Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">GLOBAL RANK</span>
              {profile.rankMovement && (
                <span className="text-[11px] font-bold">
                  {profile.rankMovement.direction === 'up' && (
                    <span className="text-emerald-400">↑ {profile.rankMovement.movement}</span>
                  )}
                  {profile.rankMovement.direction === 'down' && (
                    <span className="text-rose-400">↓ {profile.rankMovement.movement}</span>
                  )}
                  {profile.rankMovement.direction === 'same' && (
                    <span className="text-zinc-500">—</span>
                  )}
                  {profile.rankMovement.direction === 'new' && (
                    <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">NEW</span>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white">#{profile.globalRank}</span>
              <span className="text-[11px] text-emerald-400">Top {profile.percentile}%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">COUNTRY RANK</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white">
                {profile.countryRank ? `#${profile.countryRank}` : '—'}
              </span>
              <span className="text-[11px] text-zinc-500">
                {profile.countryRank ? 'India 🇮🇳' : 'Global'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">CURRENT STREAK</span>
            <div className="flex items-center gap-1.5 text-amber-400">
              <Flame className="w-4 h-4" />
              <span className="text-xl font-bold">{profile.currentStreak}</span>
              <span className="text-xs text-zinc-500">DAYS</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">LONGEST STREAK</span>
            <div className="flex items-center gap-1.5 text-zinc-300">
              <Trophy className="w-4 h-4 text-zinc-500" />
              <span className="text-xl font-bold">{profile.longestStreak}</span>
              <span className="text-xs text-zinc-500">DAYS</span>
            </div>
          </div>
        </div>

        {/* Level & Tier Progression Bar */}
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-white/[0.06] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              Level {profile.level} Progression: <strong className="text-white">{profile.levelProgress.xpInCurrentLevel} / {profile.levelProgress.xpRequiredForNextLevel} XP</strong>
            </span>
            <span className="text-cyan-400 font-semibold">{profile.levelProgress.progressPercentage}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-500"
              style={{ width: `${profile.levelProgress.progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recent Progression Timeline */}
      {profile.recentProgression && profile.recentProgression.length > 0 && (
        <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white tracking-tight">RECENT PROGRESSION</h2>
            </div>
            <span className="text-[11px] text-zinc-500">Milestones & Completed Quests</span>
          </div>

          <div className="flex flex-col gap-2">
            {profile.recentProgression.map((event) => (
              <div
                key={event.id || event.eventKey}
                className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded flex items-center justify-center bg-zinc-800 text-sm font-bold shrink-0">
                    {event.type === 'LEVEL_UP'
                      ? '🆙'
                      : event.type === 'TIER_UP'
                      ? '👑'
                      : event.type === 'ACHIEVEMENT_UNLOCKED'
                      ? '🏆'
                      : event.type === 'QUEST_COMPLETED'
                      ? '⚡'
                      : '🎯'}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-zinc-200 font-semibold">
                      {event.type === 'LEVEL_UP'
                        ? `Reached Level ${(event.metadata as { newLevel?: number })?.newLevel || ''}`
                        : event.type === 'TIER_UP'
                        ? `Promoted to ${(event.metadata as { newTier?: string })?.newTier || ''} Tier`
                        : event.type === 'ACHIEVEMENT_UNLOCKED'
                        ? `Unlocked Achievement: ${(event.metadata as { achievementId?: string })?.achievementId || ''}`
                        : event.type === 'QUEST_COMPLETED'
                        ? `Completed Quest: ${(event.metadata as { title?: string })?.title || 'Activity Quest'}`
                        : 'Rank Milestone'}
                    </span>
                    {(event.metadata as { xpGained?: number })?.xpGained ? (
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        +{(event.metadata as { xpGained: number }).xpGained} XP
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0 uppercase">
                  {formatRelativeTime(event.occurredAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season History & Personal Bests */}
      {profile.seasonHistory && profile.seasonHistory.length > 0 && (
        <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h2 className="text-base font-bold text-white tracking-tight">COMPETITIVE SEASON HISTORY</h2>
            </div>
            <span className="text-[11px] text-zinc-500">Immutable Historical Season Results</span>
          </div>

          {/* Personal Bests Highlight Banner */}
          {profile.personalBests && (profile.personalBests.bestRank || profile.personalBests.bestXP) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-purple-950/20 border border-purple-500/20">
              <div className="flex flex-col">
                <span className="text-[10px] text-purple-300/70 uppercase font-semibold">HIGHEST SEASON RANK</span>
                <span className="text-base font-bold text-purple-200">
                  {profile.personalBests.bestRank
                    ? `#${profile.personalBests.bestRank.rank} (${profile.personalBests.bestRank.seasonName})`
                    : '—'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-purple-300/70 uppercase font-semibold">HIGHEST SEASON XP</span>
                <span className="text-base font-bold text-purple-200">
                  {profile.personalBests.bestXP
                    ? `${profile.personalBests.bestXP.xp.toLocaleString()} XP (${profile.personalBests.bestXP.seasonName})`
                    : '—'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-purple-300/70 uppercase font-semibold">SEASONS COMPETED</span>
                <span className="text-base font-bold text-purple-200">
                  {profile.personalBests.seasonsParticipated} Seasons
                </span>
              </div>
            </div>
          )}

          {/* Season Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile.seasonHistory.map((item) => {
              const itemTierConfig = TIER_THRESHOLDS[item.finalTier] || { color: '#CD7F32' };

              return (
                <div
                  key={item.season.id}
                  className="p-4 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-3 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white tracking-wide uppercase">
                      {item.season.name}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                      style={{
                        backgroundColor: `${itemTierConfig.color}22`,
                        color: itemTierConfig.color,
                        border: `1px solid ${itemTierConfig.color}44`,
                      }}
                    >
                      {item.finalTier}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-white">#{item.finalRank}</span>
                      <span className="text-[11px] text-zinc-500">Final Rank</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-cyan-300">
                        {item.finalXP.toLocaleString()} <span className="text-[10px] text-zinc-500">XP</span>
                      </span>
                      <div className="text-[10px] text-zinc-400">Level {item.finalLevel}</div>
                    </div>
                  </div>

                  {item.completedAt && (
                    <div className="text-[9px] text-zinc-500 border-t border-white/[0.04] pt-2">
                      Completed on {new Date(item.completedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Persisted Rank History Sparkline / Timeline */}
      {rankHistoryData?.snapshots && rankHistoryData.snapshots.length > 1 && (
        <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">GLOBAL RANK TRAJECTORY</h2>
            </div>
            <span className="text-[11px] text-zinc-500">Persisted Daily Snapshots</span>
          </div>

          <div className="flex items-end gap-2 h-24 pt-4 px-2 border-b border-white/[0.06]">
            {rankHistoryData.snapshots.map((snap: any, idx: number) => {
              // Lowest rank number = highest bar height
              const ranks = rankHistoryData.snapshots.map((s: any) => s.rank);
              const maxRank = Math.max(...ranks);
              const minRank = Math.min(...ranks);
              const range = maxRank - minRank || 1;
              const heightPct = Math.max(15, Math.min(100, 100 - ((snap.rank - minRank) / range) * 80));

              return (
                <div
                  key={snap.periodKey || idx}
                  className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                >
                  <div
                    className="w-full max-w-[24px] bg-emerald-500/30 group-hover:bg-emerald-400 rounded-t transition-all duration-300"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300 truncate w-full text-center">
                    #{snap.rank}
                  </span>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-zinc-900 border border-zinc-700 px-2 py-1 rounded shadow-lg text-[10px] text-white pointer-events-none z-10 whitespace-nowrap">
                    <span>Rank #{snap.rank}</span>
                    <span className="text-zinc-400">{snap.xp.toLocaleString()} XP</span>
                    <span className="text-zinc-500">{new Date(snap.capturedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RPG Attribute Scores */}
      <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-tight">GITLEAGUE RPG ATTRIBUTES</h2>
          </div>
          <span className="text-[11px] text-zinc-500">
            Deterministic evaluation model (0–100)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Coding */}
          <div className="p-4 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">CODING</span>
              <span className="text-sm font-bold text-cyan-300">{profile.stats.coding} / 100</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${profile.stats.coding}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500">Scored from total commit volume and authored repositories.</span>
          </div>

          {/* Consistency */}
          <div className="p-4 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">CONSISTENCY</span>
              <span className="text-sm font-bold text-amber-400">{profile.stats.consistency} / 100</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${profile.stats.consistency}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500">Scored from active contribution streaks and consecutive days.</span>
          </div>

          {/* Builder */}
          <div className="p-4 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">BUILDER</span>
              <span className="text-sm font-bold text-purple-400">{profile.stats.builder} / 100</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${profile.stats.builder}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500">Scored from repository creation, original projects, and stars earned.</span>
          </div>

          {/* Open Source */}
          <div className="p-4 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">OPEN SOURCE</span>
              <span className="text-sm font-bold text-emerald-400">{profile.stats.openSource} / 100</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${profile.stats.openSource}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500">Scored from pull requests submitted, merged PRs, and public issues.</span>
          </div>
        </div>
      </div>

      {/* GitHub Ingested Activity Metrics */}
      <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
        <h2 className="text-base font-bold text-white tracking-tight">PERSISTED GITHUB ACTIVITY</h2>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">COMMITS</span>
            <span className="text-lg font-bold text-white">{profile.commits.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">PULL REQUESTS</span>
            <span className="text-lg font-bold text-white">{profile.pullRequests.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">MERGED PRS</span>
            <span className="text-lg font-bold text-emerald-400">{profile.mergedPullRequests.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">ISSUES</span>
            <span className="text-lg font-bold text-white">{profile.issues.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">REPOSITORIES</span>
            <span className="text-lg font-bold text-white">{profile.repositories.toLocaleString()}</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">STARS</span>
            <span className="text-lg font-bold text-amber-400">{profile.stars.toLocaleString()}</span>
          </div>
        </div>

        {/* Top Languages */}
        {Object.keys(profile.languages).length > 0 && (
          <div className="pt-2 flex flex-col gap-2">
            <span className="text-[11px] text-zinc-400 uppercase">Primary Languages:</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.languages)
                .slice(0, 8)
                .map(([lang, count]) => (
                  <span
                    key={lang}
                    className="px-2.5 py-1 rounded bg-zinc-900 border border-white/10 text-xs text-zinc-300"
                  >
                    {lang} <span className="text-zinc-500">({count})</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Achievements Showcase */}
      <div className="p-6 rounded-xl bg-zinc-950/80 border border-white/[0.08] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">ACHIEVEMENTS</h2>
          <span className="text-[11px] text-zinc-500">Factual Rarity & Milestones</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profile.achievements.map((ach) => {
            const isUnlocked = Boolean(ach.isUnlocked);
            const progress = ach.progress || 0;

            return (
              <div
                key={ach.id}
                className={`p-4 rounded-lg border flex items-start gap-3 transition-colors ${
                  isUnlocked
                    ? 'bg-zinc-900/90 border-cyan-500/30'
                    : 'bg-zinc-900/30 border-white/[0.06] opacity-75'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                    isUnlocked ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-400' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {ach.icon}
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{ach.title}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${getRarityBadgeStyle(ach.rarityLabel)}`}>
                        {ach.rarityLabel} ({ach.rarityPercent}%)
                      </span>
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold uppercase">
                          <ShieldCheck className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                          <Lock className="w-2.5 h-2.5" /> {progress}/{ach.maxProgress}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-tight">{ach.description}</p>
                  {isUnlocked && ach.unlockedAt && (
                    <span className="text-[9px] text-zinc-500">
                      Unlocked on {new Date(ach.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
