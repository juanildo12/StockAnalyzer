import { useState, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  emoji?: string;
  text?: string;
  messages?: string[];
  size?: 'small' | 'normal';
}

const DEFAULT_MESSAGES = [
  '¡El mercado está caliente! 🔥',
  'Recuerda: compra barato, vende caro 🐂',
  '¿Sabías que diversificar reduce el riesgo?',
  '¡Buena suerte, trader! 🍀',
  'La paciencia es clave en trading ⏰',
  '¿Listo para hacer trading?',
  'No pongas todos los huevos en la misma canasta 🥚',
];

const COOLDOWN_DAILY = [
  '¡Ya hablamos hoy! Vuelve mañana. 🌙',
  'Las conversaciones tienen límite diario. ¡Mañana más!',
  'Toro necesita descansar. Nos vemos mañana. 😴',
];

export function MascotBubble({ text, messages, size = 'normal' }: Props) {
  const [bounce] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -4, duration: 800, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [bounce]);

  const randomMessage = (messages ?? DEFAULT_MESSAGES)[Math.floor(Math.random() * (messages ?? DEFAULT_MESSAGES).length)];
  const displayText = text ?? randomMessage;
  const isSmall = size === 'small';
  const emojiSize = isSmall ? 32 : 48;
  const bubblePadding = isSmall ? 10 : 16;
  const bubbleMaxW = isSmall ? 220 : 300;
  const fontSize = isSmall ? 13 : 15;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <Animated.View style={{ transform: [{ translateY: bounce }] }}>
        <Text style={{ fontSize: emojiSize }}>🐂</Text>
      </Animated.View>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.surface,
          padding: bubblePadding,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          maxWidth: bubbleMaxW,
          borderWidth: 1,
          borderColor: `${theme.primary}30`,
        }}
      >
        <Text style={{ color: theme.text, fontSize, lineHeight: fontSize * 1.4 }}>{displayText}</Text>
      </View>
    </View>
  );
}
