import { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import ConfettiBurst from './ConfettiBurst';
import AchievementToast from './AchievementToast';

export default function AppOverlay() {
  const { toasts, showConfetti, removeToast, clearConfetti } = useUIStore();

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => clearConfetti(), 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti, clearConfetti]);

  return (
    <>
      {showConfetti && <ConfettiBurst />}
      {toasts.map(toast => (
        <AchievementToast
          key={toast.id}
          achievement={{
            id: toast.id!,
            title: toast.title,
            icon: toast.icon,
            coinsReward: toast.coins || 0,
            xpReward: toast.xp || 0,
          }}
          onDone={() => toast.id && removeToast(toast.id)}
        />
      ))}
    </>
  );
}
