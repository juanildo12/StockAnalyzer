import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, CandleData } from '../types';
import { SHOP_ITEMS } from '../data/shop';
import { checkAchievements, getLevelForXP, getXPForLevel } from '../utils/achievements';

interface GameStore extends GameState {
  init: () => void;
  addXP: (amount: number) => void;
  addCoins: (amount: number) => void;
  updatePrice: (price: number) => void;
  addCandle: (candle: CandleData) => void;
  buyShare: (symbol: string, qty: number, price: number, timestamp: string) => void;
  sellShare: (symbol: string, qty: number, price: number, timestamp: string) => void;
  answerQuiz: (id: string, correct: boolean) => void;
  completeMission: (id: string) => void;
  watchReel: (id: string) => void;
  setSymbol: (symbol: string) => void;
  claimDailyStreak: () => { streak: number; coinsReward: number; xpReward: number };
  buyShopItem: (id: string) => boolean;
  equipSkin: (id: string) => void;
  equipTheme: (id: string) => void;
  resetGame: () => void;
}

function calcLevel(xp: number): number {
  let level = 0;
  let needed = 0;
  while (xp >= needed) {
    level++;
    needed = getXPForLevel(level);
  }
  return Math.max(1, level - 1);
}

const INITIAL_STATE: GameState = {
  coins: 150,
  xp: 0,
  level: 1,
  cash: 1000,
  shares: [],
  trades: 0,
  currentSymbol: 'MOONCO',
  bestProfit: 0,
  worstLoss: 0,
  quizAnswered: {},
  quizStreak: 0,
  completedMissions: [],
  currentStreak: 0,
  bestStreak: 0,
  lastActiveDate: null,
  dailyStreakClaimed: false,
  unlockedAchievements: [],
  ownedSkins: ['skin_classic'],
  ownedThemes: ['theme_classic', 'theme_dark'],
  ownedPowerups: [],
  ownedTrinkets: [],
  equippedSkin: 'skin_classic',
  equippedTheme: 'theme_classic',
  watchedReels: [],
  chatCount: 0,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      init: () => {
        const state = get();
        if (state.lastActiveDate) {
          const today = new Date().toDateString();
          const last = new Date(state.lastActiveDate).toDateString();
          if (last !== today) {
            set({ dailyStreakClaimed: false });
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (last !== yesterday) {
              set({ currentStreak: 0 });
            }
          }
        }
      },

      addXP: (amount: number) => {
        set(state => {
          const newXp = state.xp + amount;
          const newLevel = calcLevel(newXp);
          return { xp: newXp, level: newLevel };
        });
      },

      addCoins: (amount: number) => {
        set(state => ({ coins: state.coins + amount }));
      },

      updatePrice: (price: number) => {
        set(state => ({
          shares: state.shares.map(s => ({
            ...s,
            currentPrice: price,
          })),
        }));
      },

      addCandle: (_candle: CandleData) => {},

      buyShare: (symbol: string, qty: number, price: number, _timestamp: string) => {
        set(state => {
          const cost = qty * price;
          if (cost > state.cash) return state;
          const existing = state.shares.find(s => s.symbol === symbol);
          let newShares;
          if (existing) {
            const totalQty = existing.quantity + qty;
            const totalCost = existing.avgPrice * existing.quantity + cost;
            newShares = state.shares.map(s =>
              s.symbol === symbol
                ? { ...s, quantity: totalQty, avgPrice: +(totalCost / totalQty).toFixed(2), currentPrice: price }
                : s
            );
          } else {
            newShares = [...state.shares, { symbol, quantity: qty, avgPrice: price, currentPrice: price }];
          }
          return { cash: +(state.cash - cost).toFixed(2), shares: newShares, trades: state.trades + 1 };
        });
      },

      sellShare: (symbol: string, qty: number, price: number, _timestamp: string) => {
        set(state => {
          const existing = state.shares.find(s => s.symbol === symbol);
          if (!existing || qty > existing.quantity) return state;
          const revenue = qty * price;
          const costBasis = existing.avgPrice * qty;
          const profit = revenue - costBasis;
          let newShares;
          if (qty === existing.quantity) {
            newShares = state.shares.filter(s => s.symbol !== symbol);
          } else {
            newShares = state.shares.map(s =>
              s.symbol === symbol
                ? { ...s, quantity: s.quantity - qty }
                : s
            );
          }
          return {
            cash: +(state.cash + revenue).toFixed(2),
            shares: newShares,
            trades: state.trades + 1,
            bestProfit: profit > state.bestProfit ? profit : state.bestProfit,
            worstLoss: profit < 0 && Math.abs(profit) > state.worstLoss ? Math.abs(profit) : state.worstLoss,
          };
        });
      },

      answerQuiz: (id: string, correct: boolean) => {
        set(state => {
          const newQuizStreak = correct ? state.quizStreak + 1 : 0;
          const xpGain = correct ? 10 : 2;
          const newXp = state.xp + xpGain;
          return {
            quizAnswered: { ...state.quizAnswered, [id]: correct },
            quizStreak: newQuizStreak,
            xp: newXp,
            level: calcLevel(newXp),
          };
        });
      },

      completeMission: (id: string) => {
        set(state => ({
          completedMissions: state.completedMissions.includes(id)
            ? state.completedMissions
            : [...state.completedMissions, id],
          coins: state.coins + 50,
          xp: state.xp + 100,
        }));
      },

      watchReel: (id: string) => {
        set(state => ({
          watchedReels: state.watchedReels.includes(id)
            ? state.watchedReels
            : [...state.watchedReels, id],
          xp: state.xp + 25,
        }));
      },

      setSymbol: (symbol: string) => {
        set({ currentSymbol: symbol });
      },

      claimDailyStreak: () => {
        const state = get();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        let newStreak = 1;
        if (state.lastActiveDate === yesterday) {
          newStreak = state.currentStreak + 1;
        }
        const coinsReward = Math.min(newStreak * 10, 200);
        const xpReward = Math.min(newStreak * 15, 300);
        set({
          currentStreak: newStreak,
          bestStreak: Math.max(state.bestStreak, newStreak),
          lastActiveDate: today,
          dailyStreakClaimed: true,
          coins: state.coins + coinsReward,
          xp: state.xp + xpReward,
        });
        return { streak: newStreak, coinsReward, xpReward };
      },

      buyShopItem: (id: string) => {
        const state = get();
        const item = SHOP_ITEMS.find(i => i.id === id);
        if (!item || state.coins < item.price) return false;
        const owned = {
          skin: state.ownedSkins,
          theme: state.ownedThemes,
          powerup: state.ownedPowerups,
          trinket: state.ownedTrinkets,
        }[item.category];
        if (owned.includes(id)) return false;
        const update: Partial<GameStore> = { coins: state.coins - item.price };
        if (item.category === 'skin') update.ownedSkins = [...state.ownedSkins, id];
        else if (item.category === 'theme') update.ownedThemes = [...state.ownedThemes, id];
        else if (item.category === 'powerup') update.ownedPowerups = [...state.ownedPowerups, id];
        else if (item.category === 'trinket') update.ownedTrinkets = [...state.ownedTrinkets, id];
        set(update as GameState);
        return true;
      },

      equipSkin: (id: string) => {
        const state = get();
        if (state.ownedSkins.includes(id)) set({ equippedSkin: id });
      },

      equipTheme: (id: string) => {
        const state = get();
        if (state.ownedThemes.includes(id)) set({ equippedTheme: id });
      },

      resetGame: () => {
        set({ ...INITIAL_STATE });
      },
    }),
    {
      name: 'bull-buddy-game',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
