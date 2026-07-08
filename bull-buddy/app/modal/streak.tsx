import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../../src/constants/theme';
import { useGameStore, useXPProgress } from '../../src/store/gameStore';
import { hapticsSuccess, hapticsLight } from '../../src/utils/haptics';
import { checkAchievements } from '../../src/utils/achievements';
import { useUIStore } from '../../src/store/uiStore';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const REWARDS = [10, 20, 30, 40, 50, 75, 100];

export default function StreakModal() {
  const { streakCount, lastStreakClaimDate, claimStreak } = useGameStore();
  const { level } = useXPProgress();
  const [justClaimed, setJustClaimed] = useState(false);
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);
  const { triggerConfetti, addToast } = useUIStore();

  const today = new Date().toISOString().split('T')[0];
  const alreadyClaimed = lastStreakClaimDate === today;

  const handleClaim = () => {
    if (alreadyClaimed) return;
    hapticsLight();
    const result = claimStreak();
    setJustClaimed(true);
    setReward(result);
    hapticsSuccess();
    triggerConfetti();
    addToast({ type: 'streak', title: `🔥 Racha de ${result.streak} días!`, icon: '🔥', coins: result.coins, xp: result.xp });
    checkAchievements();
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dayName: DAY_NAMES[d.getDay()],
      date: d.getDate(),
      iso: d.toISOString().split('T')[0],
      reward: REWARDS[i],
    };
  });

  let currentDayIndex = -1;
  for (let i = 0; i < weekDays.length; i++) {
    if (weekDays[i].iso === today) {
      currentDayIndex = i;
      break;
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.title}>Racha Diaria</Text>
        <Text style={styles.subtitle}>
          {alreadyClaimed
            ? '¡Ya reclamaste hoy! Vuelve mañana.'
            : '¡Reclama tu recompensa diaria!'}
        </Text>
      </View>

      <View style={styles.calendar}>
        {weekDays.map((day, i) => {
          const isPast = day.iso < today;
          const isToday = day.iso === today;
          const isFuture = day.iso > today;
          const claimed = day.iso <= today && day.iso === lastStreakClaimDate;

          let bgColor = colors.bgCard;
          let borderColor = colors.border;
          let textColor = colors.textMuted;
          let claimedBadge = false;

          if (claimed && isPast) {
            bgColor = colors.greenLight;
            borderColor = colors.green;
            textColor = colors.green;
            claimedBadge = true;
          } else if (isToday && !alreadyClaimed) {
            bgColor = colors.yellowLight;
            borderColor = colors.yellow;
            textColor = colors.yellow;
          } else if (isToday && alreadyClaimed) {
            bgColor = colors.greenLight;
            borderColor = colors.green;
            textColor = colors.green;
            claimedBadge = true;
          } else if (isPast) {
            bgColor = colors.bgTag;
            textColor = colors.textMuted;
          }

          return (
            <View key={i} style={[styles.dayCard, { backgroundColor: bgColor, borderColor }]}>
              <Text style={[styles.dayName, { color: textColor }]}>{day.dayName}</Text>
              <Text style={[styles.dayDate, { color: textColor }]}>{day.date}</Text>
              <Text style={[styles.dayReward, { color: textColor }]}>+{day.reward}🪙</Text>
              {claimedBadge && (
                <View style={styles.claimedIcon}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                </View>
              )}
              {isToday && !alreadyClaimed && (
                <View style={styles.todayDot} />
              )}
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={handleClaim}
        disabled={alreadyClaimed}
        style={[styles.claimBtn, alreadyClaimed && { opacity: 0.5 }]}>
        <Ionicons name="flame" size={24} color={colors.white} />
        <Text style={styles.claimBtnText}>
          {alreadyClaimed ? 'Reclamado hoy ✓' : `¡Reclamar! (día ${streakCount + 1})`}
        </Text>
      </Pressable>

      {justClaimed && reward && (
        <View style={styles.rewardBox}>
          <Text style={styles.rewardTitle}>¡Recompensa!</Text>
          <Text style={styles.rewardText}>+{reward.coins} 🪙  +{reward.xp} XP</Text>
          <Text style={styles.streakText}>Racha: {streakCount} días 🔥</Text>
        </View>
      )}

      {streakCount === 0 && !justClaimed && (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={colors.blue} />
          <Text style={styles.infoText}>Reclama cada 24h para mantener tu racha. Si saltas un día, la racha se reinicia.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, gap: 16 },
  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  emoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fonts.sizes.md, color: colors.textMuted, textAlign: 'center' },
  calendar: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' },
  dayCard: {
    width: 72, alignItems: 'center', paddingVertical: 12, borderRadius: radius.xl,
    borderWidth: 2, gap: 2, position: 'relative',
  },
  dayName: { fontSize: fonts.sizes.xs, fontWeight: '600' },
  dayDate: { fontSize: fonts.sizes.lg, fontWeight: '800' },
  dayReward: { fontSize: fonts.sizes.xs, fontWeight: '600' },
  claimedIcon: { position: 'absolute', top: -6, right: -6 },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.yellow, marginTop: 2 },
  claimBtn: {
    backgroundColor: colors.yellow, paddingVertical: 16, borderRadius: radius.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...shadows.button,
  },
  claimBtnText: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: '800' },
  rewardBox: { backgroundColor: colors.yellowLight, borderRadius: radius.xl, padding: 20, alignItems: 'center', gap: 8, borderWidth: 2, borderColor: colors.yellow },
  rewardTitle: { fontSize: fonts.sizes.lg, fontWeight: '800', color: colors.text },
  rewardText: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  streakText: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.coral },
  infoBox: { flexDirection: 'row', backgroundColor: colors.blueLight, borderRadius: radius.lg, padding: 12, gap: 8, alignItems: 'center' },
  infoText: { flex: 1, fontSize: fonts.sizes.sm, color: colors.text, lineHeight: 18 },
});
