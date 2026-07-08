import { supabase } from './supabase';
import { MOCK_LEADERBOARD } from '../data/leaderboard';
import type { LeaderboardEntry } from '../types';

export interface FriendUser {
  id: string;
  playerCode: string;
  displayName: string;
  level: number;
  coins: number;
  avatarSkin: string;
  isOnline: boolean;
}

export interface Challenge {
  id: string;
  type: 'pnl' | 'quiz_score' | 'missions';
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  opponentName: string;
  creatorScore: number;
  opponentScore: number;
  winnerId: string | null;
  endsAt: string;
}

// ─── Rankings ───

export async function fetchGlobalRanking(): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('user_id, level, coins, xp')
      .order('level', { ascending: false })
      .order('xp', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Empty');

    return data.map((r, i) => ({
      id: r.user_id,
      name: `Jugador ${i + 1}`,
      level: r.level,
      coins: r.coins,
      isPlayer: false,
    }));
  } catch {
    return mockRanking();
  }
}

export async function syncRanking(userId: string, level: number, coins: number, xp: number) {
  try {
    await supabase.from('rankings').upsert(
      { user_id: userId, level, coins, xp, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch {
    // silently fail — ranking works locally
  }
}

function mockRanking(): LeaderboardEntry[] {
  return MOCK_LEADERBOARD.map(e => ({ ...e }));
}

// ─── Friends ───

export async function searchPlayer(code: string): Promise<FriendUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, player_code, display_name, level, coins, avatar_skin, last_seen_at')
      .eq('player_code', code)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      playerCode: data.player_code,
      displayName: data.display_name,
      level: data.level,
      coins: data.coins,
      avatarSkin: data.avatar_skin,
      isOnline: Date.now() - new Date(data.last_seen_at).getTime() < 600000,
    };
  } catch {
    return null;
  }
}

export async function fetchFriends(userId: string): Promise<FriendUser[]> {
  try {
    const { data: sent, error: err1 } = await supabase
      .from('friendships')
      .select('addressee_id')
      .eq('requester_id', userId)
      .eq('status', 'accepted');

    const { data: received, error: err2 } = await supabase
      .from('friendships')
      .select('requester_id')
      .eq('addressee_id', userId)
      .eq('status', 'accepted');

    if (err1 || err2) throw new Error('DB error');

    const friendIds = [
      ...(sent || []).map(f => f.addressee_id),
      ...(received || []).map(f => f.requester_id),
    ];

    if (friendIds.length === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('id, player_code, display_name, level, coins, avatar_skin, last_seen_at')
      .in('id', friendIds);

    return (users || []).map(u => ({
      id: u.id,
      playerCode: u.player_code,
      displayName: u.display_name,
      level: u.level,
      coins: u.coins,
      avatarSkin: u.avatar_skin,
      isOnline: Date.now() - new Date(u.last_seen_at).getTime() < 600000,
    }));
  } catch {
    return mockFriends();
  }
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  try {
    await supabase.from('friendships').insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
    });
    return true;
  } catch {
    return false;
  }
}

function mockFriends(): FriendUser[] {
  return [
    { id: 'mock-1', playerCode: 'AMIGO01', displayName: 'TraderPro', level: 5, coins: 340, avatarSkin: 'vaquero', isOnline: true },
    { id: 'mock-2', playerCode: 'AMIGO02', displayName: 'LunaInversora', level: 3, coins: 210, avatarSkin: 'unicornio', isOnline: false },
    { id: 'mock-3', playerCode: 'AMIGO03', displayName: 'MrMarket', level: 7, coins: 890, avatarSkin: 'dragon', isOnline: true },
  ];
}

// ─── Challenges ───

export async function createChallenge(creatorId: string, opponentId: string, type: Challenge['type']) {
  try {
    await supabase.from('challenges').insert({
      creator_id: creatorId,
      opponent_id: opponentId,
      type,
      status: 'pending',
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchChallenges(userId: string): Promise<Challenge[]> {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Empty');

    return data.map(c => ({
      id: c.id,
      type: c.type as Challenge['type'],
      status: c.status as Challenge['status'],
      opponentName: c.creator_id === userId ? 'Rival' : 'Tú',
      creatorScore: c.creator_score,
      opponentScore: c.opponent_score,
      winnerId: c.winner_id,
      endsAt: c.ends_at,
    }));
  } catch {
    return mockChallenges();
  }
}

function mockChallenges(): Challenge[] {
  return [
    { id: 'chal-1', type: 'pnl', status: 'active', opponentName: 'TraderPro', creatorScore: 15, opponentScore: 12, winnerId: null, endsAt: new Date(Date.now() + 5 * 86400000).toISOString() },
    { id: 'chal-2', type: 'quiz_score', status: 'pending', opponentName: 'LunaInversora', creatorScore: 0, opponentScore: 0, winnerId: null, endsAt: new Date(Date.now() + 7 * 86400000).toISOString() },
  ];
}
