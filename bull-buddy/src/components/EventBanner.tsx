import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import type { GameEvent } from '../data/eventsContent';

interface Props {
  event: GameEvent;
  onPress: () => void;
}

export default function EventBanner({ event, onPress }: Props) {
  const startDate = new Date(event.startsAt);
  const endDate = new Date(event.endsAt);
  const isActive = startDate <= new Date() && endDate >= new Date();

  return (
    <Pressable onPress={onPress} style={[styles.banner, { borderLeftColor: event.bannerColor }]}>
      <View style={styles.bannerContent}>
        <Text style={styles.bannerEmoji}>{event.bannerEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{event.title}</Text>
          <Text style={styles.bannerDesc} numberOfLines={2}>{event.description}</Text>
        </View>
        {isActive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>En vivo</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.countdownRow}>
        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
        <Text style={styles.countdownText}>
          {isActive
            ? `Termina en ${daysUntil(endDate)}`
            : startDate > new Date()
              ? `Empieza en ${daysUntil(startDate)}`
              : 'Finalizado'}
        </Text>
      </View>
    </Pressable>
  );
}

function daysUntil(date: Date): string {
  const days = Math.round((date.getTime() - Date.now()) / 86400000);
  if (days <= 1) return '1 día';
  return `${days} días`;
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 14,
    borderLeftWidth: 5, ...shadows.card,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerEmoji: { fontSize: 32 },
  bannerTitle: { fontSize: fonts.sizes.md, fontWeight: '800', color: colors.text },
  bannerDesc: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  liveBadge: {
    backgroundColor: colors.coralLight, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full,
  },
  liveText: { fontSize: 10, fontWeight: '700', color: colors.coral },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  countdownText: { fontSize: fonts.sizes.xs, color: colors.textMuted },
});
