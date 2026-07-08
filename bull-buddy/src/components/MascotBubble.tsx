import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, shadows } from '../constants/theme';
import type { MascotMood } from '../types';

interface Props {
  text: string;
  mood?: MascotMood;
}

const MOOD_EMOJI: Record<MascotMood, string> = {
  feliz: '😃',
  triste: '😔',
  emocionado: '🤩',
  pensativo: '🤔',
  neutral: '😐',
};

const EYE_STYLE: Record<MascotMood, string> = {
  feliz: '^‿^',
  triste: ';_;',
  emocionado: '☆▽☆',
  pensativo: '￣～￣',
  neutral: '･_･',
};

const MOOD_COLORS: Record<MascotMood, string> = {
  feliz: colors.yellow,
  triste: colors.blue,
  emocionado: colors.purple,
  pensativo: colors.green,
  neutral: colors.textMuted,
};

export default function MascotBubble({ text, mood = 'feliz' }: Props) {
  const router = useRouter();
  const faceColor = MOOD_COLORS[mood];
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevKey = useRef('');

  useEffect(() => {
    const key = text + mood;
    if (prevKey.current && prevKey.current !== key) {
      fadeAnim.setValue(0.5);
      scaleAnim.setValue(0.95);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    }
    prevKey.current = key;
  }, [text, mood]);

  return (
    <Pressable onPress={() => router.push('/chat')}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{text}</Text>
        </View>
        <View style={styles.arrow} />
        <View style={[styles.face, { backgroundColor: `${faceColor}18` }]}>
          <View style={styles.hornsContainer}>
            <Text style={styles.horn}>🐂</Text>
          </View>
          <Text style={styles.eyes}>{EYE_STYLE[mood]}</Text>
          <Text style={styles.moodEmoji}>{MOOD_EMOJI[mood]}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 8 },
  bubble: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: -4,
    maxWidth: '85%',
    ...shadows.card,
  },
  bubbleText: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  arrow: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: colors.bgCard,
    marginBottom: 4,
  },
  face: {
    width: 72, height: 72, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: `${colors.yellow}60`,
  },
  hornsContainer: { position: 'absolute', top: -8 },
  horn: { fontSize: 18 },
  eyes: { fontSize: 12, fontWeight: '800', color: colors.text, letterSpacing: 2 },
  moodEmoji: { position: 'absolute', bottom: -2, right: -4, fontSize: 16 },
});
