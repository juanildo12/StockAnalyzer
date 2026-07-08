export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TradeDirection = 'buy' | 'sell';

export interface Trade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  shares: number;
  price: number;
  total: number;
  timestamp: number;
}

export type QuizDifficulty = 'facil' | 'intermedio' | 'avanzado';

export interface QuizQuestion {
  id: string;
  difficulty: QuizDifficulty;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MissionStep {
  id: string;
  narrative: string;
  options: {
    id: string;
    text: string;
    consequence: string;
    nextStepId: string | null;
    isCorrect: boolean;
    coinsReward: number;
    xpReward: number;
  }[];
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  steps: MissionStep[];
  conceptLearned: string;
  order: number;
}

export type MascotMood = 'feliz' | 'triste' | 'emocionado' | 'pensativo' | 'neutral';

export type SkinId = 'classic' | 'vaquero' | 'unicornio' | 'dragon' | 'alien' | 'toroDorado' | 'fantasma';
export type ThemeId = 'default' | 'oceano' | 'noche' | 'bosque' | 'sunset';

export interface Skin {
  id: SkinId;
  name: string;
  emoji: string;
  description: string;
  price: number;
  eventTag?: string;
  colors: {
    bg: string;
    primary: string;
    secondary: string;
  };
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  price: number;
  colors: {
    accent: string;
    accentLight: string;
    accent2: string;
    accent2Light: string;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (state: GameState) => boolean;
  coinsReward: number;
  xpReward: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  level: number;
  coins: number;
  isPlayer?: boolean;
}

export interface QuizResult {
  correct: boolean;
  difficulty: QuizDifficulty;
  timestamp: number;
}

export interface TradeResult {
  profitable: boolean;
  price: number;
  shares: number;
  timestamp: number;
}

export interface GameState {
  coins: number;
  xp: number;
  level: number;
  cash: number;
  shares: number;
  sharePrice: number;
  trades: Trade[];
  completedQuizIds: string[];
  completedMissionIds: string[];
  quizCombo: number;
  maxQuizCombo: number;
  streakCount: number;
  lastStreakClaimDate: string | null;
  unlockedAchievements: string[];
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
  ownedThemes: ThemeId[];
  equippedTheme: ThemeId;
  totalBuys: number;
  totalSells: number;
  chatCount: number;
  reelsViewed: number;
  lastQuizResults: QuizResult[];
  lastTradeResults: TradeResult[];
}
