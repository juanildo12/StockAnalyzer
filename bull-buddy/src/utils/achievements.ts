import { ACHIEVEMENTS } from '../data/achievements';
import { useGameStore } from '../store/gameStore';

export interface AchievementUnlock {
  id: string;
  title: string;
  icon: string;
  coinsReward: number;
  xpReward: number;
}

export function checkAchievements(): AchievementUnlock[] {
  const state = useGameStore.getState();
  const unlocked: AchievementUnlock[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.includes(ach.id) && ach.condition(state)) {
      state.unlockAchievement(ach.id);
      state.earnCoins(ach.coinsReward);
      state.earnXP(ach.xpReward);
      unlocked.push({
        id: ach.id,
        title: ach.title,
        icon: ach.icon,
        coinsReward: ach.coinsReward,
        xpReward: ach.xpReward,
      });
    }
  }

  return unlocked;
}
