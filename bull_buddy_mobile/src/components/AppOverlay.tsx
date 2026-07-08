import { useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { useUIStore } from '../store/uiStore';
import { theme } from '../constants/theme';

function Toast() {
  const toast = useUIStore(s => s.toast);
  const hideToast = useUIStore(s => s.hideToast);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    if (!toast) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(toast.duration ?? 2000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => hideToast());
  }, [toast]);

  if (!toast) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute', top: 100, left: 20, right: 20,
        alignItems: 'center', opacity,
      }}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: toast.type === 'error' ? theme.loss : toast.type === 'success' ? theme.gain : theme.surface,
          paddingHorizontal: 20, paddingVertical: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: toast.type === 'error' ? theme.loss : toast.type === 'success' ? theme.gain : `${theme.primary}40`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20 }}>
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </Text>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{toast.message}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function Confetti() {
  const confetti = useUIStore(s => s.confetti);
  const hideConfetti = useUIStore(s => s.hideConfetti);
  const confettiOpacity = new Animated.Value(0);

  useEffect(() => {
    if (!confetti) return;
    Animated.sequence([
      Animated.timing(confettiOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(confettiOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => hideConfetti());
  }, [confetti]);

  if (!confetti) return null;

  const emojis = ['🎉', '🌟', '🎊', '⭐', '💫', '✨', '🏆', '🎯'];
  return (
    <Animated.View
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center', opacity: confettiOpacity,
      }}
      pointerEvents="none"
    >
      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {emojis.map((e, i) => (
          <Text key={i} style={{ fontSize: 28 }}>{e}</Text>
        ))}
      </View>
      {confetti.title && (
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 12, textAlign: 'center' }}>
          {confetti.title}
        </Text>
      )}
      {confetti.subtitle && (
        <Text style={{ color: theme.textSecondary, fontSize: 15, marginTop: 4, textAlign: 'center' }}>
          {confetti.subtitle}
        </Text>
      )}
    </Animated.View>
  );
}

export function AppOverlay() {
  return (
    <>
      <Toast />
      <Confetti />
    </>
  );
}
