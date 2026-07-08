import { useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { colors, fonts, radius } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import { playCorrect, playWrong, playLevelUp } from '../services/soundManager';
import ReelCard, { type ReelCardType } from '../components/ReelCard';
import { REEL_SERIES } from '../data/reelsContent';
import { hapticsSuccess, hapticsError } from '../utils/haptics';
import { checkAchievements } from '../utils/achievements';
import { useUIStore } from '../store/uiStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

function flattenSeries(): ReelCardType[] {
  const items: ReelCardType[] = [];
  for (const series of REEL_SERIES) {
    items.push({ kind: 'series-header', title: series.title, icon: series.icon, color: series.color });
    for (const lesson of series.lessons) {
      items.push({ kind: 'lesson', lesson, seriesColor: series.color, seriesTitle: series.title });
    }
    items.push({ kind: 'quiz', quiz: series.quiz, seriesColor: series.color, seriesTitle: series.title, onComplete: () => {} });
  }
  return items;
}

const ALL_CARDS = flattenSeries();

export default function ReelsScreen() {
  const { earnCoins, earnXP, incrementReelsViewed } = useGameStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { addToast, triggerConfetti } = useUIStore();
  const viewedReels = useRef(new Set<number>());
  const prevLevel = useRef(useGameStore.getState().level);
  const completedQuizzes = useRef(new Set<string>());

  const handleQuizComplete = useCallback((seriesId: string, correct: boolean, coins: number, xp: number) => {
    if (completedQuizzes.current.has(seriesId)) return;
    completedQuizzes.current.add(seriesId);

    if (correct) {
      playCorrect();
      hapticsSuccess();
      earnCoins(coins);
      earnXP(xp);
      triggerConfetti();
      addToast({ type: 'combo', title: '🧠 ¡Lección completada!', icon: '📚', coins, xp });

      const newLevel = useGameStore.getState().level;
      if (newLevel > prevLevel.current) {
        playLevelUp();
        triggerConfetti();
        addToast({ type: 'levelup', title: `¡Nivel ${newLevel}!`, icon: '⭐', coins: newLevel * 10 });
        prevLevel.current = newLevel;
      }

      const newAchs = checkAchievements();
      newAchs.forEach(a => { playLevelUp(); triggerConfetti(); addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward }); });
    } else {
      playWrong();
      hapticsError();
      earnCoins(coins);
      earnXP(xp);
      addToast({ type: 'info', title: '¡Sigue practicando!', icon: '💪', coins, xp });
    }
  }, [earnCoins, earnXP, addToast, triggerConfetti]);

  const items = ALL_CARDS.map((card, idx) => {
    if (card.kind === 'quiz') {
      const series = REEL_SERIES.find(s => s.title === card.seriesTitle);
      return { ...card, onComplete: (correct: boolean, coins: number, xp: number) => handleQuizComplete(series?.id || '', correct, coins, xp) };
    }
    return card;
  });

  const progress = REEL_SERIES.length > 0 ? (currentIndex / items.length) : 0;
  const currentSeriesIdx = Math.min(Math.floor(currentIndex / 6), REEL_SERIES.length - 1);
  const currentSeries = REEL_SERIES[currentSeriesIdx];

  return (
    <SafeAreaView style={styles.container}>
      {/* Thin progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Counter badge */}
      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>{currentSeries?.icon} {currentIndex + 1}/{items.length}</Text>
      </View>

      <FlatList
        data={items}
        renderItem={({ item, index }) => {
          if (item.kind === 'quiz') {
            const series = REEL_SERIES.find(s => s.title === item.seriesTitle);
            return (
              <ReelCard
                item={{
                  ...item,
                  onComplete: (correct: boolean, coins: number, xp: number) => handleQuizComplete(series?.id || '', correct, coins, xp),
                }}
                index={index}
              />
            );
          }
          return <ReelCard item={item} index={index} />;
        }}
        keyExtractor={(_, idx) => String(idx)}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
          setCurrentIndex(idx);
          if (!viewedReels.current.has(idx) && idx < ALL_CARDS.length && ALL_CARDS[idx]?.kind === 'lesson') {
            viewedReels.current.add(idx);
            incrementReelsViewed();
            const newAchs = checkAchievements();
            newAchs.forEach(a => { playLevelUp(); triggerConfetti(); addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward }); });
          }
        }}
        getItemLayout={(_, idx) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * idx, index: idx })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  progressContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: colors.border, zIndex: 10,
  },
  progressFill: {
    height: '100%', backgroundColor: colors.purple,
  },
  counterBadge: {
    position: 'absolute', top: 50, right: 16, zIndex: 10,
    backgroundColor: `${colors.text}E6`, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.full,
  },
  counterText: { color: colors.white, fontSize: fonts.sizes.xs, fontWeight: '700' },
});
