import { useState, useEffect } from 'react';
import {
  Trophy,
  Zap,
  Flame,
  Github,
  LogOut,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  MapPin,
  AlertCircle,
  Sparkles,
  GitCommit,
  GitPullRequest,
  GraduationCap,
  Users,
  UserCheck,
  UserPlus,
  ChevronDown,
  Lock,
} from 'lucide-react';


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TIER_THRESHOLDS } from '@gitleague/config';
import type {
  IAuthenticatedUser,
  ILeaderboardEntry,
  IPaginatedResponse,
  IPersonalRankResponse,
  ISyncStatusResponse,
  ISeasonSummary,
  IFriendRequest,
  LeagueTier,
  LeaderboardScope,
} from '@gitleague/types';
import { DeveloperProfile } from './components/DeveloperProfile.js';
import { CompareView } from './components/CompareView.js';
import { SocialModal, SocialTab } from './components/SocialModal.js';
import { QuestsModal } from './components/QuestsModal.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// API Fetch Helpers
async function fetchCurrentUser(): Promise<IAuthenticatedUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 401 || !response.ok) return null;
  const json = await response.json();
  return json.data ?? null;
}

async function fetchSyncStatus(): Promise<ISyncStatusResponse | null> {
  const response = await fetch(`${API_BASE_URL}/me/sync`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json.data ?? null;
}

async function fetchSeasons(): Promise<ISeasonSummary[]> {
  const response = await fetch(`${API_BASE_URL}/seasons`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const json = await response.json();
  return json.data ?? [];
}

async function fetchCurrentSeason(): Promise<ISeasonSummary | null> {
  const response = await fetch(`${API_BASE_URL}/seasons/current`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json.data ?? null;
}

async function fetchFriendRequests(): Promise<IFriendRequest[]> {
  const response = await fetch(`${API_BASE_URL}/friends/requests`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const json = await response.json();
  return json.data ?? [];
}

async function triggerUserSync(force = false): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/me/sync`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ force }),
  });
  if (!response.ok) throw new Error('Failed to trigger synchronization');
  return response.json();
}

async function fetchLeaderboard(params: {
  scope: LeaderboardScope;
  country?: string;
  season?: string;
  page: number;
  limit: number;
  tier?: LeagueTier;
  search?: string;
}): Promise<IPaginatedResponse<ILeaderboardEntry>> {
  const query = new URLSearchParams();
  query.set('scope', params.scope);
  if (params.scope === 'country' && params.country) {
    query.set('country', params.country);
  }
  if (params.season && params.season !== 'all') {
    query.set('season', params.season);
  }
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  if (params.tier) query.set('tier', params.tier);
  if (params.search?.trim()) query.set('search', params.search.trim());

  const response = await fetch(`${API_BASE_URL}/leaderboard?${query.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to fetch leaderboard');
  return response.json();
}

async function fetchMyRank(params: {
  scope: LeaderboardScope;
  country?: string;
  season?: string;
}): Promise<IPersonalRankResponse | null> {
  const query = new URLSearchParams();
  query.set('scope', params.scope);
  if (params.scope === 'country' && params.country) {
    query.set('country', params.country);
  }
  if (params.season && params.season !== 'all') {
    query.set('season', params.season);
  }
  const response = await fetch(`${API_BASE_URL}/leaderboard/me?${query.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 401 || !response.ok) return null;
  const json = await response.json();
  return json.data ?? null;
}

async function logoutUser(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
}

function formatRelativeTime(dateString?: string | Date | null): string {
  if (!dateString) return 'NEVER';
  const date = new Date(dateString);
  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSecs < 60) return 'JUST NOW';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}M AGO`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}H AGO`;
  return `${Math.floor(diffSecs / 86400)}D AGO`;
}

export default function App() {
  const queryClient = useQueryClient();

  // Routing State
  const [view, setView] = useState<'leaderboard' | 'profile' | 'compare'>('leaderboard');
  const [targetUsername, setTargetUsername] = useState<string>('');

  // Social & Quests Modal State
  const [isSocialModalOpen, setIsSocialModalOpen] = useState<boolean>(false);
  const [socialModalTab, setSocialModalTab] = useState<SocialTab>('college');
  const [isQuestsModalOpen, setIsQuestsModalOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // Leaderboard Filtering State
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [country] = useState<string>('India');
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [selectedTier, setSelectedTier] = useState<LeagueTier | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Synchronize route from browser pathname
  useEffect(() => {
    const handleLocationChange = () => {
      const pathname = window.location.pathname;
      const compareMatch = pathname.match(/^\/compare\/([^/]+)/);
      const profileMatch = pathname.match(/^\/profile\/([^/]+)/);

      if (compareMatch && compareMatch[1]) {
        setView('compare');
        setTargetUsername(decodeURIComponent(compareMatch[1]));
      } else if (profileMatch && profileMatch[1]) {
        setView('profile');
        setTargetUsername(decodeURIComponent(profileMatch[1]));
      } else {
        setView('leaderboard');
        setTargetUsername('');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Update dynamic document title for public profile / compare / leaderboard
  useEffect(() => {
    if (view === 'profile' && targetUsername) {
      document.title = `@${targetUsername} — GitLeague Developer Profile`;
    } else if (view === 'compare') {
      document.title = `Compare Developers — GitLeague`;
    } else {
      document.title = `GitLeague — The Competitive Developer Platform`;
    }
  }, [view, targetUsername]);

  // Check for OAuth error query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      setOauthError(decodeURIComponent(errorParam));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 1. Current Authenticated User Query
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  // 2. Sync Status Query
  const { data: syncStatus } = useQuery({
    queryKey: ['me', 'sync'],
    queryFn: fetchSyncStatus,
    enabled: Boolean(currentUser),
    refetchInterval: (query) => {
      const status = query.state.data?.syncStatus;
      return status === 'syncing' || status === 'queued' ? 2500 : 30000;
    },
  });

  // 3. Friend Requests Query (for badge count)
  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: fetchFriendRequests,
    enabled: Boolean(currentUser),
    refetchInterval: 30000,
  });

  // 4. Seasons Queries
  const { data: seasonsList = [] } = useQuery({
    queryKey: ['seasons', 'list'],
    queryFn: fetchSeasons,
  });

  const { data: currentSeason } = useQuery({
    queryKey: ['seasons', 'current'],
    queryFn: fetchCurrentSeason,
  });

  const selectedSeasonObj = seasonsList.find((s) => s.slug === selectedSeason);
  const isCompletedSeason = selectedSeason !== 'all' && selectedSeasonObj?.status === 'completed';


  // 5. Leaderboard List Query
  const {
    data: leaderboardData,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    refetch: refetchLeaderboard,
  } = useQuery({
    queryKey: ['leaderboard', scope, country, selectedSeason, page, selectedTier, searchTerm, currentUser?.id],
    queryFn: () =>
      fetchLeaderboard({
        scope,
        country: scope === 'country' ? country : undefined,
        season: selectedSeason,
        page,
        limit: 25,
        tier: selectedTier,
        search: searchTerm,
      }),
    enabled: view === 'leaderboard',
  });

  // 6. Authenticated User Personal Rank Query
  const { data: myRankData } = useQuery({
    queryKey: ['leaderboard', 'me', scope, country, selectedSeason, currentUser?.id],
    queryFn: () =>
      fetchMyRank({
        scope,
        country: scope === 'country' ? country : undefined,
        season: selectedSeason,
      }),
    enabled: Boolean(currentUser) && view === 'leaderboard',
  });

  // Mutations
  const syncMutation = useMutation({
    mutationFn: () => triggerUserSync(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'sync'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.setQueryData(['leaderboard', 'me'], null);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      setIsUserMenuOpen(false);
    },
  });

  const handleGitHubLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  };

  const navigateToProfile = (username: string) => {
    window.history.pushState({}, '', `/profile/${encodeURIComponent(username)}`);
    setTargetUsername(username);
    setView('profile');
    setIsUserMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const navigateToCompare = (username: string) => {
    window.history.pushState({}, '', `/compare/${encodeURIComponent(username)}`);
    setTargetUsername(username);
    setView('compare');
    setIsUserMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const navigateToLeaderboard = () => {
    window.history.pushState({}, '', '/');
    setView('leaderboard');
    setTargetUsername('');
    setIsUserMenuOpen(false);
  };

  const openSocialModal = (tab: SocialTab = 'college') => {
    setSocialModalTab(tab);
    setIsSocialModalOpen(true);
    setIsUserMenuOpen(false);
  };

  const isSyncing =
    syncStatus?.syncStatus === 'syncing' || syncStatus?.syncStatus === 'queued' || syncMutation.isPending;
  const entries = leaderboardData?.data || [];
  const meta = leaderboardData?.meta || {
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* OAuth Error Alert */}
      {oauthError && (
        <div className="bg-rose-950/80 border-b border-rose-500/30 text-rose-200 px-6 py-2.5 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2 max-w-6xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Authentication Failed: {oauthError}</span>
          </div>
          <button onClick={() => setOauthError(null)} className="text-rose-400 hover:text-white font-mono">
            [Dismiss]
          </button>
        </div>
      )}

      {/* Sync Error / Expired Token Notification */}
      {currentUser && syncStatus?.syncStatus === 'failed' && syncStatus?.syncError && (
        <div className="bg-amber-950/80 border-b border-amber-500/30 text-amber-200 px-6 py-2.5 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2 max-w-6xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Synchronization Notice: {syncStatus.syncError}</span>
            {syncStatus.syncError.toLowerCase().includes('reconnect') ||
            syncStatus.syncError.toLowerCase().includes('expired') ||
            syncStatus.syncError.toLowerCase().includes('revoked') ? (
              <button
                onClick={handleGitHubLogin}
                className="ml-2 px-2.5 py-0.5 rounded bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-colors"
              >
                Reconnect GitHub
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070A12]/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo / Brand Mark */}
          <div className="flex items-center gap-3">
            <button onClick={navigateToLeaderboard} className="flex items-center gap-2.5 group text-left">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-cyan-500/40 flex items-center justify-center font-mono text-cyan-400 font-bold text-sm shadow-[0_0_12px_rgba(6,182,212,0.25)] group-hover:border-cyan-400 transition-colors">
                &gt;_
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold tracking-tight text-white text-base leading-none group-hover:text-cyan-300 transition-colors">
                  GITLEAGUE
                </span>
                <span className="text-[10px] font-mono text-zinc-500 leading-tight">
                  {currentSeason ? `${currentSeason.name.toUpperCase()} • ACTIVE` : 'COMPETITIVE LEAGUE'}
                </span>
              </div>
            </button>
          </div>

          {/* User & Action Bar */}
          <div className="flex items-center gap-3 font-mono">
            {currentUser ? (
              <div className="flex items-center gap-2.5 relative">
                {/* Sync Status Button */}
                <button
                  id="btn-sync-now"
                  onClick={() => syncMutation.mutate()}
                  disabled={isSyncing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-all ${
                    isSyncing
                      ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 animate-pulse'
                      : syncStatus?.syncStatus === 'failed'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/40'
                      : 'bg-zinc-900/90 border-white/10 text-zinc-300 hover:border-cyan-500/40 hover:text-white'
                  }`}
                  title="Refresh and recalculate your GitHub stats and XP"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : 'text-zinc-400'}`} />
                  <span className="hidden sm:inline">
                    {isSyncing
                      ? 'Syncing...'
                      : syncStatus?.syncStatus === 'failed'
                      ? 'Sync Failed (Retry)'
                      : `Sync (${formatRelativeTime(syncStatus?.lastSyncedAt)})`}
                  </span>
                </button>

                {/* Quests Trigger */}
                <button
                  onClick={() => setIsQuestsModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900/90 border border-white/10 text-xs text-zinc-300 hover:border-amber-500/40 hover:text-amber-300 transition-colors"
                  title="Daily & Weekly Competitive Quests"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Quests</span>
                </button>

                {/* Social Center Trigger */}
                <button
                  onClick={() => openSocialModal('requests')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900/90 border border-white/10 text-xs text-zinc-300 hover:border-cyan-500/40 hover:text-white transition-colors relative"
                  title="Friend requests and competitive circles"
                >
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden md:inline">Social</span>
                  {friendRequests.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute -top-0.5 -right-0.5" />
                  )}
                </button>

                {/* Profile Identity Dropdown Toggle */}
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/90 border border-white/10 hover:border-cyan-500/40 transition-colors"
                  >
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.username}
                      className="w-5 h-5 rounded-full border border-cyan-400/40 object-cover"
                    />
                    <span className="text-xs font-medium text-zinc-200">
                      @{currentUser.username}
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-xl bg-zinc-950 border border-white/10 shadow-2xl py-2 z-50 flex flex-col text-xs">
                      <button
                        onClick={() => navigateToProfile(currentUser.username)}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 text-left transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>My RPG Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsQuestsModalOpen(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-900 text-zinc-200 hover:text-amber-300 text-left transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Daily & Weekly Quests</span>
                      </button>

                      <button
                        onClick={() => openSocialModal('college')}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 text-left transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>College League</span>
                      </button>

                      <button
                        onClick={() => openSocialModal('requests')}
                        className="flex items-center justify-between px-4 py-2 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Friend Requests</span>
                        </div>
                        {friendRequests.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500 text-black text-[10px] font-bold">
                            {friendRequests.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => openSocialModal('search')}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 text-left transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Find Developers</span>
                      </button>

                      <button
                        onClick={() => openSocialModal('friends')}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-900 text-zinc-200 hover:text-cyan-300 text-left transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span>My Friends</span>
                      </button>

                      <div className="my-1 border-t border-white/[0.06]" />

                      <button
                        onClick={() => logoutMutation.mutate()}
                        disabled={logoutMutation.isPending}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 text-left transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                id="btn-login-github"
                onClick={handleGitHubLogin}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all hover:scale-[1.02]"
              >
                <Github className="w-3.5 h-3.5" />
                <span>SIGN IN WITH GITHUB</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {view === 'profile' ? (
        <DeveloperProfile
          username={targetUsername}
          onBack={navigateToLeaderboard}
          onCompare={navigateToCompare}
          currentUser={currentUser}
        />
      ) : view === 'compare' ? (
        <CompareView
          username={targetUsername}
          onBack={() => navigateToProfile(targetUsername)}
          onViewProfile={navigateToProfile}
        />
      ) : (
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-6 font-mono">
          {/* Core Tagline & Identity */}
          <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/[0.06]">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-[11px] font-semibold uppercase tracking-wider">
                  <Zap className="w-3 h-3" /> Live Competitive League
                </span>
                <span className="text-xs text-zinc-500">•</span>
                <span className="text-xs text-zinc-400">
                  {meta.total} {meta.total === 1 ? 'Competitor' : 'Competitors'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                YOUR CODE. <span className="text-cyan-400">YOUR RANK.</span> YOUR LEAGUE.
              </h1>
            </div>

            {!currentUser ? (
              <button
                onClick={handleGitHubLogin}
                className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>CLAIM YOUR RANK</span>
              </button>
            ) : (
              <button
                onClick={() => openSocialModal('search')}
                className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white text-xs transition-all"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span>FIND COMPETITORS</span>
              </button>
            )}
          </section>

          {/* Scope Navigation & Season Controls */}
          <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Scope Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900/90 border border-white/[0.08] overflow-x-auto text-xs">
              <button
                id="scope-global"
                onClick={() => {
                  setScope('global');
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  scope === 'global'
                    ? 'bg-zinc-800 text-white font-bold border border-white/10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>GLOBAL</span>
              </button>

              <button
                id="scope-country"
                onClick={() => {
                  setScope('country');
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  scope === 'country'
                    ? 'bg-zinc-800 text-white font-bold border border-white/10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>INDIA 🇮🇳</span>
              </button>

              {/* Friends Scope */}
              <button
                id="scope-friends"
                onClick={() => {
                  if (!currentUser) {
                    handleGitHubLogin();
                    return;
                  }
                  setScope('friends');
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  scope === 'friends'
                    ? 'bg-zinc-800 text-white font-bold border border-white/10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>FRIENDS</span>
              </button>

              {/* College Scope */}
              <button
                id="scope-college"
                onClick={() => {
                  if (!currentUser) {
                    handleGitHubLogin();
                    return;
                  }
                  setScope('college');
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  scope === 'college'
                    ? 'bg-zinc-800 text-white font-bold border border-white/10 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                <span>COLLEGE</span>
              </button>
            </div>

            {/* Season Selector, Search & Tier Filter */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Season Selector */}
              {seasonsList.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedSeason}
                    onChange={(e) => {
                      setSelectedSeason(e.target.value);
                      setPage(1);
                    }}
                    className="bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="all">ALL-TIME (LIFETIME)</option>
                    {seasonsList.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name.toUpperCase()} {s.status === 'active' ? '• ACTIVE' : `(${s.status.toUpperCase()})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search developer..."
                  className="w-full bg-zinc-900/90 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <select
                value={selectedTier || ''}
                onChange={(e) => {
                  setSelectedTier(e.target.value ? (e.target.value as LeagueTier) : undefined);
                  setPage(1);
                }}
                className="bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="">ALL TIERS</option>
                {Object.keys(TIER_THRESHOLDS).map((tierKey) => (
                  <option key={tierKey} value={tierKey}>
                    {tierKey}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Authenticated User Rank Highlight Banner */}
          {currentUser && myRankData && (
            <section className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/90 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-cyan-500/40 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] text-zinc-500 uppercase leading-none">RANK</span>
                  <span className="text-base font-bold text-cyan-300 leading-none">#{myRankData.currentRank}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateToProfile(currentUser.username)}
                      className="text-sm font-bold text-white hover:text-cyan-300 transition-colors"
                    >
                      @{currentUser.username}
                    </button>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-semibold"
                      style={{
                        backgroundColor: `${TIER_THRESHOLDS[myRankData.tier]?.color || '#CD7F32'}22`,
                        color: TIER_THRESHOLDS[myRankData.tier]?.color || '#CD7F32',
                      }}
                    >
                      {myRankData.tier}
                    </span>
                    <span className="text-xs text-zinc-400">Lvl {myRankData.level}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 pt-0.5">
                    <span className="text-cyan-400 font-bold">
                      {selectedSeason !== 'all' ? `${myRankData.seasonXP.toLocaleString()} Season XP` : `${myRankData.xp.toLocaleString()} XP`}
                    </span>
                    <span>•</span>
                    <span>
                      {scope === 'friends'
                        ? `#${myRankData.currentRank} / ${myRankData.totalParticipants} Friends`
                        : scope === 'college'
                        ? `#${myRankData.currentRank} in College League`
                        : `Top ${myRankData.percentile}% of ${myRankData.totalParticipants} participants`}
                    </span>
                    {myRankData.rankMovement !== 0 && (
                      <>
                        <span>•</span>
                        <span className={myRankData.rankMovement > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {myRankData.rankMovement > 0 ? `↑ ${myRankData.rankMovement} spots` : `↓ ${Math.abs(myRankData.rankMovement)} spots`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => navigateToProfile(currentUser.username)}
                  className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200 hover:text-white transition-colors"
                >
                  View Profile
                </button>
              </div>
            </section>
          )}

          {/* Completed Season Historical Banner */}
          {isCompletedSeason && (
            <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-purple-300">
                <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-bold uppercase">{selectedSeasonObj?.name} COMPLETED</span>
                <span className="text-zinc-400 hidden sm:inline">• Final competitive rankings are locked &amp; immutable</span>
              </div>
              <span className="text-[11px] text-zinc-500 uppercase">
                {selectedSeasonObj?.endDate ? `Concluded ${new Date(selectedSeasonObj.endDate).toLocaleDateString()}` : 'Archived'}
              </span>
            </div>
          )}

          {/* Leaderboard Table / Empty States */}
          <section className="bg-zinc-950/60 rounded-xl border border-white/[0.08] overflow-hidden flex flex-col">

            {/* Table Header (Desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/[0.08] bg-zinc-900/40 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
              <div className="col-span-1">RANK</div>
              <div className="col-span-5">DEVELOPER</div>
              <div className="col-span-2">LEVEL & TIER</div>
              <div className="col-span-2 text-right">ACTIVITY</div>
              <div className="col-span-2 text-right">
                {selectedSeason !== 'all' ? 'SEASON XP' : 'TOTAL XP'}
              </div>
            </div>

            {/* Loading State */}
            {isLeaderboardLoading && (
              <div className="divide-y divide-white/[0.04] p-4 flex flex-col gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="py-3 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-md bg-zinc-800" />
                      <div className="w-10 h-10 rounded-full bg-zinc-800" />
                      <div className="flex flex-col gap-1.5">
                        <div className="w-28 h-3.5 rounded bg-zinc-800" />
                        <div className="w-20 h-2.5 rounded bg-zinc-900" />
                      </div>
                    </div>
                    <div className="w-24 h-4 rounded bg-zinc-800" />
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {isLeaderboardError && (
              <div className="py-16 px-6 text-center flex flex-col items-center gap-3">
                <AlertCircle className="w-8 h-8 text-rose-400" />
                <h3 className="text-base font-bold text-white">Couldn't load the league.</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  A network or server error occurred while retrieving ranking data.
                </p>
                <button
                  onClick={() => refetchLeaderboard()}
                  className="mt-2 px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Scope Specific Empty States */}
            {!isLeaderboardLoading && !isLeaderboardError && entries.length === 0 && (
              <div className="py-20 px-6 text-center flex flex-col items-center gap-4">
                {scope === 'college' && !currentUser?.collegeId ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-white tracking-tight">JOIN YOUR COLLEGE LEAGUE.</h3>
                      <p className="text-xs text-zinc-400 max-w-md">
                        Choose your verified campus from our directory to enter the collegiate rankings.
                      </p>
                    </div>
                    <button
                      onClick={() => openSocialModal('college')}
                      className="mt-2 px-5 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg transition-all"
                    >
                      SELECT YOUR COLLEGE
                    </button>
                  </>
                ) : scope === 'friends' ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-white tracking-tight">NO RIVALS YET.</h3>
                      <p className="text-xs text-zinc-400 max-w-md">
                        Find developers and add them to create your personal competitive friends leaderboard.
                      </p>
                    </div>
                    <button
                      onClick={() => openSocialModal('search')}
                      className="mt-2 px-5 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all"
                    >
                      FIND DEVELOPERS
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-500">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-white tracking-tight">THE LEAGUE IS EMPTY.</h3>
                      <p className="text-xs text-zinc-400 max-w-md">
                        {searchTerm
                          ? `No developers found matching query "${searchTerm}".`
                          : 'Be the first developer to synchronize your GitHub activity and claim the #1 spot.'}
                      </p>
                    </div>

                    {!currentUser ? (
                      <button
                        onClick={handleGitHubLogin}
                        className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                      >
                        <Github className="w-4 h-4" />
                        <span>CONTINUE WITH GITHUB</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => syncMutation.mutate()}
                        disabled={isSyncing}
                        className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>SYNC YOUR GITHUB METRICS</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Rows List */}
            {!isLeaderboardLoading && !isLeaderboardError && entries.length > 0 && (
              <div className="divide-y divide-white/[0.04]">
                {entries.map((entry) => {
                  const isUserRow = currentUser && currentUser.id === entry.userId;
                  const tierInfo = TIER_THRESHOLDS[entry.tier] || { title: entry.tier, color: '#CD7F32' };
                  const displayXp = selectedSeason !== 'all' ? entry.seasonXP : entry.xp;

                  return (
                    <div
                      key={entry.userId}
                      onClick={() => navigateToProfile(entry.username)}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 sm:px-6 py-3.5 items-center cursor-pointer transition-colors ${
                        isUserRow
                          ? 'bg-cyan-950/20 border-l-2 border-cyan-400 hover:bg-cyan-950/30'
                          : 'hover:bg-white/[0.03]'
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          navigateToProfile(entry.username);
                        }
                      }}
                    >
                      {/* Rank Column */}
                      <div className="flex md:col-span-1 items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded font-bold text-xs flex items-center justify-center ${
                            entry.rank === 1
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                              : entry.rank === 2
                              ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                              : entry.rank === 3
                              ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                              : 'text-zinc-400'
                          }`}
                        >
                          #{entry.rank}
                        </div>

                        {/* Rank Movement */}
                        {isCompletedSeason ? (
                          <span className="text-[10px] text-zinc-600 flex items-center gap-0.5" title="Final locked ranking">
                            <Lock className="w-2.5 h-2.5 text-zinc-600" />
                          </span>
                        ) : entry.rankDirection === 'new' ? (
                          <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/20" title="New Entry">
                            NEW
                          </span>
                        ) : entry.rankMovement > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5" title={`Up ${entry.rankMovement} spots`}>
                            <TrendingUp className="w-3 h-3" />
                            <span>{entry.rankMovement}</span>
                          </span>
                        ) : entry.rankMovement < 0 ? (
                          <span className="text-[10px] font-bold text-rose-400 flex items-center gap-0.5" title={`Down ${Math.abs(entry.rankMovement)} spots`}>
                            <TrendingDown className="w-3 h-3" />
                            <span>{Math.abs(entry.rankMovement)}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600">
                            <Minus className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>


                      {/* Developer Column */}
                      <div className="flex items-center gap-3 md:col-span-5">
                        <img
                          src={entry.avatarUrl}
                          alt={entry.username}
                          className="w-9 h-9 rounded-lg border border-white/10 object-cover shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                              {entry.displayName || entry.username}
                            </span>
                            <span className="text-xs text-zinc-500 truncate">
                              @{entry.username}
                            </span>
                          </div>
                          {isUserRow && (
                            <span className="text-[10px] text-cyan-400 font-medium leading-none">
                              (YOU)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Level & Tier Column */}
                      <div className="flex md:col-span-2 items-center gap-2">
                        <span className="text-xs text-zinc-300 font-medium">
                          Lvl {entry.level}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${tierInfo.color}20`,
                            color: tierInfo.color,
                          }}
                        >
                          {entry.tier}
                        </span>
                      </div>

                      {/* Stats Activity Column */}
                      <div className="flex md:col-span-2 md:justify-end items-center gap-3 text-xs text-zinc-400">
                        {entry.commits > 0 && (
                          <span className="flex items-center gap-1" title={`${entry.commits} commits`}>
                            <GitCommit className="w-3 h-3 text-zinc-500" />
                            <span>{entry.commits}</span>
                          </span>
                        )}
                        {entry.pullRequests > 0 && (
                          <span className="flex items-center gap-1" title={`${entry.pullRequests} pull requests`}>
                            <GitPullRequest className="w-3 h-3 text-zinc-500" />
                            <span>{entry.pullRequests}</span>
                          </span>
                        )}
                        {entry.currentStreak > 0 && (
                          <span className="flex items-center gap-1 text-amber-400" title={`${entry.currentStreak} days active streak`}>
                            <Flame className="w-3 h-3" />
                            <span>{entry.currentStreak}d</span>
                          </span>
                        )}
                      </div>

                      {/* Total XP Column */}
                      <div className="flex md:col-span-2 md:justify-end items-center">
                        <span className="font-bold text-sm text-cyan-300 tracking-tight">
                          {displayXp.toLocaleString()}{' '}
                          <span className="text-[10px] font-normal text-zinc-500">XP</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {!isLeaderboardLoading && entries.length > 0 && (
              <div className="px-6 py-3.5 border-t border-white/[0.08] bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Page {meta.page} of {meta.totalPages} ({meta.total} participants)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!meta.hasPrevPage}
                    className="p-1.5 rounded bg-zinc-900 border border-white/10 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-200 transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-1 bg-zinc-900 rounded border border-white/10 text-white font-bold">
                    {meta.page}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!meta.hasNextPage}
                    className="p-1.5 rounded bg-zinc-900 border border-white/10 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-200 transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* Social Modal */}
      <SocialModal
        isOpen={isSocialModalOpen}
        onClose={() => setIsSocialModalOpen(false)}
        initialTab={socialModalTab}
        currentUser={currentUser ?? null}
        onViewProfile={navigateToProfile}
        onCompare={navigateToCompare}
      />

      {/* Quests Modal */}
      <QuestsModal
        isOpen={isQuestsModalOpen}
        onClose={() => setIsQuestsModalOpen(false)}
        currentUser={currentUser ?? null}
        onTriggerSync={() => syncMutation.mutate()}
        isSyncing={isSyncing}
      />

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 px-6 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GITLEAGUE © 2026 • COMPETITIVE DEVELOPER PLATFORM</span>
          <span className="text-zinc-500">DETERMINISTIC RANKINGS • REAL GITHUB DATA</span>
        </div>
      </footer>
    </div>
  );
}
