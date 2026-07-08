export interface CandleData {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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

export interface MissionOption {
  id: string;
  text: string;
  consequence: string;
  nextStepId: string | null;
  isCorrect: boolean;
  coinsReward: number;
  xpReward: number;
}

export interface MissionStep {
  id: string;
  narrative: string;
  options: MissionOption[];
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  conceptLearned: string;
  steps: MissionStep[];
}

export type MascotMood = 'feliz' | 'triste' | 'emocionado' | 'pensativo' | 'neutral';

export interface ReelLesson {
  id: string;
  emoji: string;
  title: string;
  content: string;
  tip: string;
}

export interface ReelQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ReelSeries {
  id: string;
  title: string;
  icon: string;
  color: string;
  lessons: ReelLesson[];
  quiz: ReelQuiz;
}

export interface HeldShare {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'trading' | 'aprender' | 'social';
  requirement: { type: string; target: number };
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

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: 'skin' | 'theme' | 'powerup' | 'trinket';
  price: number;
  icon: string;
  rarity: 'comun' | 'raro' | 'epico' | 'legendario';
}

export interface GameState {
  coins: number;
  xp: number;
  level: number;
  cash: number;
  shares: HeldShare[];
  trades: number;
  currentSymbol: string;
  bestProfit: number;
  worstLoss: number;
  quizAnswered: Record<string, boolean>;
  quizStreak: number;
  completedMissions: string[];
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  dailyStreakClaimed: boolean;
  unlockedAchievements: string[];
  ownedSkins: string[];
  ownedThemes: string[];
  ownedPowerups: string[];
  ownedTrinkets: string[];
  equippedSkin: string;
  equippedTheme: string;
  watchedReels: string[];
  chatCount: number;
}

export interface QuizResult {
  correct: boolean;
  difficulty: QuizDifficulty;
  timestamp: number;
}
