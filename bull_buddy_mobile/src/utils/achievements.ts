import { ACHIEVEMENTS } from '../data/achievements';
import type { GameState } from '../types';

export function checkAchievements(state: GameState, unlocked: Set<string>): string[] {
  const newlyUnlocked: string[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlocked.has(ach.id)) continue;

    let fulfilled = false;
    const req = ach.requirement;

    switch (req.type) {
      case 'trades':
        fulfilled = state.trades >= req.target;
        break;
      case 'profit_single':
        fulfilled = state.bestProfit >= req.target;
        break;
      case 'quiz_answered':
        fulfilled = Object.keys(state.quizAnswered).length >= req.target;
        break;
      case 'quiz_streak':
        fulfilled = state.quizStreak >= req.target;
        break;
      case 'streak':
        fulfilled = state.currentStreak >= req.target;
        break;
      case 'missions_completed':
        fulfilled = state.completedMissions.length >= req.target;
        break;
      case 'level':
        fulfilled = state.level >= req.target;
        break;
      case 'rank':
        fulfilled = false;
        break;
      case 'networth':
        fulfilled = (state.cash + state.shares[0]?.currentPrice * state.shares[0]?.quantity) >= req.target;
        break;
      case 'losses':
        fulfilled = state.worstLoss >= req.target;
        break;
      case 'reels_watched':
        fulfilled = state.watchedReels.length >= req.target;
        break;
    }

    if (fulfilled) {
      newlyUnlocked.push(ach.id);
    }
  }

  return newlyUnlocked;
}

export function getLevelForXP(xp: number): number {
  // Formula: need 100 * level for each level
  let level = 0;
  let xpNeeded = 0;
  while (xp >= xpNeeded) {
    level++;
    xpNeeded = getXPForLevel(level);
  }
  return Math.max(1, level - 1);
}

export function getXPForLevel(level: number): number {
  return 100 * level;
}

export function getProgressToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevelForXP(xp);
  const currentLevelXP = level === 0 ? 0 : getXPForLevel(level - 1);
  const xpInLevel = xp - currentLevelXP;
  const needed = getXPForLevel(level) - currentLevelXP;
  return { current: xpInLevel, needed, level };
}
