import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, Trade, SkinId, ThemeId, QuizResult, TradeResult, QuizDifficulty } from '../types';
import { SKINS } from '../data/shop';
import { THEMES } from '../data/shop';

interface GameStore extends GameState {
  earnXP: (amount: number) => void;
  earnCoins: (amount: number) => void;
  buyShares: (shares: number, price: number) => boolean;
  sellShares: (shares: number, price: number) => boolean;
  completeQuiz: (id: string) => void;
  completeMission: (id: string) => void;
  setSharePrice: (price: number) => void;
  incrementQuizCombo: () => void;
  resetQuizCombo: () => void;
  claimStreak: () => { streak: number; coins: number; xp: number };
  unlockAchievement: (id: string) => void;
  buySkin: (id: SkinId) => boolean;
  equipSkin: (id: SkinId) => void;
  buyTheme: (id: ThemeId) => boolean;
  equipTheme: (id: ThemeId) => void;
  addQuizResult: (result: { correct: boolean; difficulty: QuizDifficulty }) => void;
  addTradeResult: (result: { profitable: boolean; price: number; shares: number }) => void;
  incrementChatCount: () => void;
  incrementReelsViewed: () => void;
  reset: () => void;
}

const INITIAL_STATE: GameState = {
  coins: 0,
  xp: 0,
  level: 1,
  cash: 1000,
  shares: 0,
  sharePrice: 50,
  trades: [],
  completedQuizIds: [],
  completedMissionIds: [],
  quizCombo: 0,
  maxQuizCombo: 0,
  chatCount: 0,
  reelsViewed: 0,
  streakCount: 0,
  lastStreakClaimDate: null,
  unlockedAchievements: [],
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  ownedThemes: ['default'],
  equippedTheme: 'default',
  totalBuys: 0,
  totalSells: 0,
  lastQuizResults: [],
  lastTradeResults: [],
};

function calcLevel(xp: number): number {
  let level = 1;
  while (xp >= level * 100) {
    xp -= level * 100;
    level++;
  }
  return level;
}

export function xpForNextLevel(level: number): number {
  return level * 100;
}

export function xpProgress(currentXp: number, currentLevel: number): number {
  const needed = currentLevel * 100;
  return Math.min(1, currentXp / needed);
}

let tradeIdCounter = Date.now();

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      earnXP: (amount: number) => {
        set(state => {
          const newXp = state.xp + amount;
          const newLevel = calcLevel(newXp + state.level * 100);
          return { xp: newXp, level: newLevel };
        });
      },

      earnCoins: (amount: number) => {
        set(state => ({ coins: state.coins + amount }));
      },

      buyShares: (shares: number, price: number): boolean => {
        const state = get();
        const total = shares * price;
        if (total > state.cash || shares <= 0) return false;

        const trade: Trade = {
          id: `trade_${++tradeIdCounter}`,
          symbol: 'MOONCO',
          direction: 'buy',
          shares,
          price,
          total,
          timestamp: Date.now(),
        };

        set(s => ({
          cash: +(s.cash - total).toFixed(2),
          shares: s.shares + shares,
          trades: [trade, ...s.trades].slice(0, 100),
          totalBuys: s.totalBuys + 1,
        }));
        return true;
      },

      sellShares: (shares: number, price: number): boolean => {
        const state = get();
        if (shares > state.shares || shares <= 0) return false;

        const total = +(shares * price).toFixed(2);
        const trade: Trade = {
          id: `trade_${++tradeIdCounter}`,
          symbol: 'MOONCO',
          direction: 'sell',
          shares,
          price,
          total,
          timestamp: Date.now(),
        };

        set(s => ({
          cash: +(s.cash + total).toFixed(2),
          shares: s.shares - shares,
          trades: [trade, ...s.trades].slice(0, 100),
          totalSells: s.totalSells + 1,
        }));
        return true;
      },

      completeQuiz: (id: string) => {
        set(state => ({
          completedQuizIds: state.completedQuizIds.includes(id)
            ? state.completedQuizIds
            : [...state.completedQuizIds, id],
        }));
      },

      completeMission: (id: string) => {
        set(state => ({
          completedMissionIds: state.completedMissionIds.includes(id)
            ? state.completedMissionIds
            : [...state.completedMissionIds, id],
        }));
      },

      setSharePrice: (price: number) => {
        set({ sharePrice: price });
      },

      incrementQuizCombo: () => {
        set(state => {
          const newCombo = state.quizCombo + 1;
          return {
            quizCombo: newCombo,
            maxQuizCombo: Math.max(state.maxQuizCombo, newCombo),
          };
        });
      },

      resetQuizCombo: () => {
        set({ quizCombo: 0 });
      },

      claimStreak: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let newStreak = 1;
        if (state.lastStreakClaimDate === yesterday) {
          newStreak = state.streakCount + 1;
        }

        const coinsReward = Math.min(newStreak * 10, 100);
        const xpReward = Math.min(newStreak * 15, 150);

        set({
          streakCount: newStreak,
          lastStreakClaimDate: today,
          coins: state.coins + coinsReward,
          xp: state.xp + xpReward,
        });

        return { streak: newStreak, coins: coinsReward, xp: xpReward };
      },

      unlockAchievement: (id: string) => {
        set(state => ({
          unlockedAchievements: state.unlockedAchievements.includes(id)
            ? state.unlockedAchievements
            : [...state.unlockedAchievements, id],
        }));
      },

      buySkin: (id: SkinId): boolean => {
        const state = get();
        if (state.ownedSkins.includes(id)) return false;
        const skin = SKINS.find(s => s.id === id);
        if (!skin || state.coins < skin.price) return false;
        set(s => ({
          coins: s.coins - skin.price,
          ownedSkins: [...s.ownedSkins, id],
        }));
        return true;
      },

      equipSkin: (id: SkinId) => {
        const state = get();
        if (state.ownedSkins.includes(id)) {
          set({ equippedSkin: id });
        }
      },

      buyTheme: (id: ThemeId): boolean => {
        const state = get();
        if (state.ownedThemes.includes(id)) return false;
        const theme = THEMES.find(t => t.id === id);
        if (!theme || state.coins < theme.price) return false;
        set(s => ({
          coins: s.coins - theme.price,
          ownedThemes: [...s.ownedThemes, id],
        }));
        return true;
      },

      equipTheme: (id: ThemeId) => {
        const state = get();
        if (state.ownedThemes.includes(id)) {
          set({ equippedTheme: id });
        }
      },

      addQuizResult: (result: { correct: boolean; difficulty: QuizDifficulty }) => {
        set(state => ({
          lastQuizResults: [
            ...state.lastQuizResults,
            { ...result, timestamp: Date.now() },
          ].slice(-20),
        }));
      },

      addTradeResult: (result: { profitable: boolean; price: number; shares: number }) => {
        set(state => ({
          lastTradeResults: [
            ...state.lastTradeResults,
            { ...result, timestamp: Date.now() },
          ].slice(-20),
        }));
      },

      incrementChatCount: () => {
        set(state => ({ chatCount: state.chatCount + 1 }));
      },

      incrementReelsViewed: () => {
        set(state => ({ reelsViewed: state.reelsViewed + 1 }));
      },

      reset: () => {
        set({ ...INITIAL_STATE });
      },
    }),
    {
      name: 'bull-buddy-game',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Convenience hook: portfolio value */
export function usePortfolioValue() {
  const cash = useGameStore(s => s.cash);
  const shares = useGameStore(s => s.shares);
  const price = useGameStore(s => s.sharePrice);
  const trades = useGameStore(s => s.trades);
  const totalValue = cash + shares * price;
  const invested = trades
    .filter(t => t.direction === 'buy')
    .reduce((s, t) => s + t.total, 0);
  const pnl = totalValue - 1000;
  return { cash, shares, sharePrice: price, totalValue, invested, pnl, trades };
}

/** XP progress bar info */
export function useXPProgress() {
  const xp = useGameStore(s => s.xp);
  const level = useGameStore(s => s.level);
  const needed = xpForNextLevel(level);
  const progress = xpProgress(xp, level);
  return { xp, level, needed, progress };
}
