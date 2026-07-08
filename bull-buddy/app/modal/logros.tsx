import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../../src/constants/theme';
import { useGameStore } from '../../src/store/gameStore';
import { ACHIEVEMENTS } from '../../src/data/achievements';

export default function LogrosModal() {
  const { unlockedAchievements } = useGameStore();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🏆</Text>
        <Text style={styles.title}>Logros</Text>
        <Text style={styles.subtitle}>
          {unlockedAchievements.length}/{ACHIEVEMENTS.length} desbloqueados
        </Text>
      </View>

      <View style={styles.grid}>
        {ACHIEVEMENTS.map(ach => {
          const unlocked = unlockedAchievements.includes(ach.id);
          return (
            <View key={ach.id} style={[styles.card, unlocked ? styles.cardUnlocked : styles.cardLocked]}>
              <View style={[styles.iconWrap, unlocked ? { backgroundColor: colors.yellowLight } : { backgroundColor: colors.bgTag }]}>
                <Text style={[styles.achIcon, !unlocked && { opacity: 0.3 }]}>{ach.icon}</Text>
              </View>
              <Text style={[styles.achTitle, { color: unlocked ? colors.text : colors.textMuted }]}>{ach.title}</Text>
              <Text style={styles.achDesc}>{ach.description}</Text>
              {unlocked ? (
                <View style={styles.unlockedRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                  <Text style={styles.unlockedText}>+{ach.coinsReward}🪙 +{ach.xpReward}XP</Text>
                </View>
              ) : (
                <View style={styles.lockedRow}>
                  <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                  <Text style={styles.lockedText}>Bloqueado</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, gap: 16 },
  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  emoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fonts.sizes.md, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  card: {
    width: '47%', borderRadius: radius.xl, padding: 16, gap: 8,
    alignItems: 'center', ...shadows.card,
  },
  cardUnlocked: { backgroundColor: colors.bgCard },
  cardLocked: { backgroundColor: colors.bgTag, opacity: 0.8 },
  iconWrap: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  achIcon: { fontSize: 24 },
  achTitle: { fontSize: fonts.sizes.sm, fontWeight: '700', textAlign: 'center' },
  achDesc: { fontSize: fonts.sizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  unlockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unlockedText: { fontSize: fonts.sizes.xs, color: colors.green, fontWeight: '600' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: { fontSize: fonts.sizes.xs, color: colors.textMuted },
});
