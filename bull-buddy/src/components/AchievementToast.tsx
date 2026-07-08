import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { colors, radius, fonts, shadows } from '../constants/theme';
import type { AchievementUnlock } from '../utils/achievements';

interface Props {
  achievement: AchievementUnlock;
  onDone: () => void;
}

export default function AchievementToast({ achievement, onDone }: Props) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <Text style={styles.icon}>{achievement.icon}</Text>
      <Text style={styles.title}>¡Logro desbloqueado!</Text>
      <Text style={styles.name}>{achievement.title}</Text>
      <Text style={styles.reward}>+{achievement.coinsReward}🪙 +{achievement.xpReward}XP</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    zIndex: 9999, ...shadows.card,
  },
  icon: { fontSize: 32 },
  title: { fontSize: fonts.sizes.xs, color: colors.yellow, fontWeight: '700' },
  name: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  reward: { fontSize: fonts.sizes.xs, color: colors.textMuted, fontWeight: '600' },
});
