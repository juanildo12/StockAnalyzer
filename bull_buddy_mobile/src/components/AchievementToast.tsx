import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import type { Achievement } from '../types';

interface Props {
  achievement: Achievement;
  onDone: () => void;
}

export function AchievementToast({ achievement, onDone }: Props) {
  const slide = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, { toValue: 100, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onDone());
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute', bottom: 100, left: 20, right: 20,
        transform: [{ translateY: slide }], opacity,
        backgroundColor: theme.surface,
        borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: `${theme.gain}40`,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}
    >
      <Text style={{ fontSize: 36 }}>{achievement.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.gain, fontSize: 13, fontWeight: '700' }}>🏆 Logro Desbloqueado</Text>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{achievement.title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{achievement.description}</Text>
        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
          +{achievement.coinsReward} 🪙 +{achievement.xpReward} ⭐
        </Text>
      </View>
    </Animated.View>
  );
}
