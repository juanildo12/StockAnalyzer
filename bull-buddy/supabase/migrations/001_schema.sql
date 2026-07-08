-- Bull Buddy Schema
-- Run this in the Supabase SQL Editor to set up the database.

-- Users (synced from app)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Jugador',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  avatar_skin TEXT NOT NULL DEFAULT 'classic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rankings (snapshot, updated periodically or on levelup)
CREATE TABLE IF NOT EXISTS public.rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Challenges between friends
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pnl', 'quiz_score', 'missions')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  creator_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  winner_id UUID REFERENCES public.users(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events (live seasonal events)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  banner_emoji TEXT NOT NULL DEFAULT '🎉',
  banner_color TEXT NOT NULL DEFAULT '#9B5DE5',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_skin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event participation
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rankings_level ON public.rankings(level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(requester_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_challenges_user ON public.challenges(opponent_id) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS idx_events_active ON public.events(starts_at, ends_at);

-- Row Level Security (basic: users can read/write their own data)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Users can read all users (for friend search) but only update themselves
CREATE POLICY "users_read_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_self" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Rankings are public
CREATE POLICY "rankings_read_all" ON public.rankings FOR SELECT USING (true);
CREATE POLICY "rankings_upsert_self" ON public.rankings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rankings_update_self" ON public.rankings FOR UPDATE USING (auth.uid() = user_id);

-- Friendships: involved users can read/write
CREATE POLICY "friendships_read" ON public.friendships FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Challenges: involved users can read/write
CREATE POLICY "challenges_read" ON public.challenges FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = opponent_id);
CREATE POLICY "challenges_insert" ON public.challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "challenges_update" ON public.challenges FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = opponent_id);
