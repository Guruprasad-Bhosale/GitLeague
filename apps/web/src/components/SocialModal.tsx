import { useState } from 'react';
import {
  X,
  GraduationCap,
  UserPlus,
  Users,
  Search,
  Check,
  UserCheck,
  Trash2,
  Swords,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TIER_THRESHOLDS } from '@gitleague/config';
import type {
  ICollegeSummary,
  IFriendRequest,
  IFriendSummary,
  IUserSearchResult,
  ISafeUser,
} from '@gitleague/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export type SocialTab = 'college' | 'requests' | 'search' | 'friends';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SocialTab;
  currentUser: ISafeUser | null;
  onViewProfile: (username: string) => void;
  onCompare: (username: string) => void;
}

export function SocialModal({
  isOpen,
  onClose,
  initialTab = 'college',
  currentUser,
  onViewProfile,
  onCompare,
}: SocialModalProps) {
  const [activeTab, setActiveTab] = useState<SocialTab>(initialTab);
  const [collegeSearch, setCollegeSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const queryClient = useQueryClient();

  // Queries
  const { data: colleges = [], isLoading: collegesLoading } = useQuery<ICollegeSummary[]>({
    queryKey: ['colleges', collegeSearch],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/colleges?search=${encodeURIComponent(collegeSearch)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: isOpen && activeTab === 'college',
  });

  const { data: friendRequests = [], isLoading: requestsLoading } = useQuery<IFriendRequest[]>({
    queryKey: ['friend-requests'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/friends/requests`, {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: isOpen && Boolean(currentUser),
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<IUserSearchResult[]>({
    queryKey: ['user-search', userSearch],
    queryFn: async () => {
      if (!userSearch.trim()) return [];
      const res = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(userSearch)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: isOpen && activeTab === 'search' && userSearch.trim().length > 0,
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery<IFriendSummary[]>({
    queryKey: ['my-friends'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/friends?limit=50`, {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: isOpen && activeTab === 'friends' && Boolean(currentUser),
  });

  // Mutations
  const setCollegeMutation = useMutation({
    mutationFn: async (collegeId: string | null) => {
      const res = await fetch(`${API_BASE_URL}/me/college`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ collegeId }),
      });
      if (!res.ok) throw new Error('Failed to update college');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to accept request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-friends'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`${API_BASE_URL}/friends/requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to reject request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const res = await fetch(`${API_BASE_URL}/friends/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send friend request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
      queryClient.invalidateQueries({ queryKey: ['my-friends'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`${API_BASE_URL}/friends/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove friend');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-friends'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl bg-zinc-950 border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">&gt;_ COMPETITIVE SOCIAL</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.08] px-6 bg-zinc-900/40 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('college')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-bold transition-colors whitespace-nowrap ${
              activeTab === 'college'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>COLLEGE LEAGUE</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-bold transition-colors whitespace-nowrap relative ${
              activeTab === 'requests'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>REQUESTS</span>
            {friendRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-black text-[10px] font-bold">
                {friendRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-bold transition-colors whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>FIND DEVS</span>
          </button>

          <button
            onClick={() => setActiveTab('friends')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-bold transition-colors whitespace-nowrap ${
              activeTab === 'friends'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>MY FRIENDS ({friends.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: COLLEGE */}
          {activeTab === 'college' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-white uppercase">SELECT YOUR COLLEGE</span>
                <p className="text-[11px] text-zinc-400">
                  Join a verified college league to compete against developers on your campus.
                </p>
              </div>

              {currentUser?.collegeId && (
                <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <GraduationCap className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">Current College Affiliation</span>
                      <span className="text-[11px] text-cyan-300">
                        {currentUser.college?.name || 'Selected'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setCollegeMutation.mutate(null)}
                    disabled={setCollegeMutation.isPending}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold"
                  >
                    Leave
                  </button>
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search college directory (e.g. IIT Bombay, BITS, MIT, Stanford)..."
                  value={collegeSearch}
                  onChange={(e) => setCollegeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {collegesLoading ? (
                <div className="py-8 flex justify-center text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : colleges.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No verified colleges matched "{collegeSearch}".
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {colleges.map((col) => {
                    const isSelected = currentUser?.collegeId === col.id;
                    return (
                      <div
                        key={col.id}
                        className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-cyan-950/30 border-cyan-500/40'
                            : 'bg-zinc-900/50 border-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate">{col.name}</span>
                          <span className="text-[11px] text-zinc-400">
                            {col.city}, {col.state} · {col.country}
                          </span>
                        </div>

                        {isSelected ? (
                          <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-bold px-2 py-1 rounded bg-cyan-900/40">
                            <Check className="w-3 h-3" /> JOINED
                          </span>
                        ) : (
                          <button
                            onClick={() => setCollegeMutation.mutate(col.id)}
                            disabled={setCollegeMutation.isPending}
                            className="px-3 py-1 rounded bg-zinc-800 hover:bg-cyan-500 hover:text-black text-xs text-white font-bold transition-colors"
                          >
                            SELECT
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FRIEND REQUESTS */}
          {activeTab === 'requests' && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-white uppercase">PENDING INCOMING REQUESTS</span>

              {requestsLoading ? (
                <div className="py-8 flex justify-center text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : friendRequests.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500 flex flex-col gap-1 items-center">
                  <UserCheck className="w-6 h-6 text-zinc-600 mb-1" />
                  <span>NO PENDING REQUESTS</span>
                  <span className="text-[11px] text-zinc-600">You're all caught up.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {friendRequests.map((req) => {
                    const tierInfo = TIER_THRESHOLDS[req.requesterTier] || { color: '#CD7F32' };

                    return (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={req.requesterAvatarUrl}
                            alt={req.requesterUsername}
                            className="w-10 h-10 rounded-lg border border-white/10 object-cover shrink-0 cursor-pointer"
                            onClick={() => {
                              onViewProfile(req.requesterUsername);
                              onClose();
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              onClick={() => {
                                onViewProfile(req.requesterUsername);
                                onClose();
                              }}
                              className="text-xs font-bold text-white truncate cursor-pointer hover:text-cyan-400"
                            >
                              {req.requesterDisplayName || req.requesterUsername}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                              <span>@{req.requesterUsername}</span>
                              <span>·</span>
                              <span style={{ color: tierInfo.color }} className="font-semibold">
                                Level {req.requesterLevel} · {req.requesterTier}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => acceptRequestMutation.mutate(req.id)}
                            disabled={acceptRequestMutation.isPending}
                            className="px-3 py-1 rounded bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-colors"
                          >
                            ACCEPT
                          </button>
                          <button
                            onClick={() => rejectRequestMutation.mutate(req.id)}
                            disabled={rejectRequestMutation.isPending}
                            className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors"
                          >
                            REJECT
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FIND DEVELOPERS */}
          {activeTab === 'search' && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-white uppercase">SEARCH GITLEAGUE DEVELOPERS</span>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by GitHub username or display name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {searchLoading ? (
                <div className="py-8 flex justify-center text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : userSearch.trim().length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  Type a username above to search GitLeague competitors.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No GitLeague participants found matching "{userSearch}".
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {searchResults.map((user) => {
                    const tierInfo = TIER_THRESHOLDS[user.tier] || { color: '#CD7F32' };

                    return (
                      <div
                        key={user.userId}
                        className="p-3 rounded-lg bg-zinc-900/50 border border-white/[0.06] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={user.avatarUrl}
                            alt={user.username}
                            className="w-9 h-9 rounded-lg border border-white/10 object-cover shrink-0 cursor-pointer"
                            onClick={() => {
                              onViewProfile(user.username);
                              onClose();
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              onClick={() => {
                                onViewProfile(user.username);
                                onClose();
                              }}
                              className="text-xs font-bold text-white truncate cursor-pointer hover:text-cyan-400"
                            >
                              {user.displayName || user.username}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                              <span>@{user.username}</span>
                              <span>·</span>
                              <span style={{ color: tierInfo.color }} className="font-semibold">
                                {user.tier} · {user.xp.toLocaleString()} XP
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {user.friendshipStatus === 'friends' ? (
                            <span className="text-[11px] text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-950/40 border border-emerald-500/30">
                              FRIENDS
                            </span>
                          ) : user.friendshipStatus === 'pending_sent' ? (
                            <span className="text-[11px] text-amber-400 font-semibold px-2 py-1 rounded bg-amber-950/40">
                              REQUEST SENT
                            </span>
                          ) : user.friendshipStatus === 'pending_received' ? (
                            <button
                              onClick={() => user.friendRequestId && acceptRequestMutation.mutate(user.friendRequestId)}
                              className="px-2.5 py-1 rounded bg-cyan-500 text-black text-xs font-bold"
                            >
                              ACCEPT
                            </button>
                          ) : user.friendshipStatus === 'self' ? (
                            <span className="text-[11px] text-zinc-500">YOU</span>
                          ) : (
                            <button
                              onClick={() => sendRequestMutation.mutate(user.userId)}
                              disabled={sendRequestMutation.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-cyan-500 hover:text-black text-xs text-white font-bold transition-colors"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>ADD</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY FRIENDS */}
          {activeTab === 'friends' && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-white uppercase">MY COMPETITIVE CIRCLE</span>

              {friendsLoading ? (
                <div className="py-8 flex justify-center text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500 flex flex-col gap-2 items-center">
                  <Users className="w-6 h-6 text-zinc-600 mb-1" />
                  <span className="text-white font-bold">NO RIVALS YET.</span>
                  <span className="text-[11px] text-zinc-400 max-w-xs">
                    Find developers from search or click on leaderboard profiles to challenge them.
                  </span>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-2 px-3 py-1.5 rounded-md bg-cyan-500 text-black text-xs font-bold"
                  >
                    FIND DEVELOPERS
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
                  {friends.map((friend) => {
                    const tierInfo = TIER_THRESHOLDS[friend.tier] || { color: '#CD7F32' };

                    return (
                      <div
                        key={friend.userId}
                        className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={friend.avatarUrl}
                            alt={friend.username}
                            className="w-10 h-10 rounded-lg border border-white/10 object-cover shrink-0 cursor-pointer"
                            onClick={() => {
                              onViewProfile(friend.username);
                              onClose();
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span
                              onClick={() => {
                                onViewProfile(friend.username);
                                onClose();
                              }}
                              className="text-xs font-bold text-white truncate cursor-pointer hover:text-cyan-400"
                            >
                              {friend.displayName || friend.username}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                              <span>@{friend.username}</span>
                              <span>·</span>
                              <span style={{ color: tierInfo.color }} className="font-semibold">
                                {friend.tier} · {friend.xp.toLocaleString()} XP
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              onCompare(friend.username);
                              onClose();
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-cyan-300 font-bold transition-colors"
                            title="Compare stats"
                          >
                            <Swords className="w-3 h-3" />
                            <span>COMPARE</span>
                          </button>
                          <button
                            onClick={() => removeFriendMutation.mutate(friend.userId)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                            title="Remove friend"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
