import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import EventBanner from '../components/EventBanner';
import { MOCK_EVENTS, type GameEvent } from '../data/eventsContent';
import { hapticsLight } from '../utils/haptics';

export default function EventosScreen() {
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null);
  const state = useGameStore();

  if (selectedEvent) {
    return (
      <SafeAreaView style={styles.container}>
        <FlatList
          contentContainerStyle={styles.list}
          data={selectedEvent.missions}
          keyExtractor={m => m.id}
          ListHeaderComponent={
            <View>
              <Pressable onPress={() => setSelectedEvent(null)} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={colors.textMuted} />
                <Text style={styles.backBtnText}>Volver</Text>
              </Pressable>
              <View style={[styles.eventHeader, { borderLeftColor: selectedEvent.bannerColor }]}>
                <Text style={styles.eventEmoji}>{selectedEvent.bannerEmoji}</Text>
                <Text style={styles.eventTitle}>{selectedEvent.title}</Text>
                <Text style={styles.eventDesc}>{selectedEvent.description}</Text>
                {selectedEvent.rewardSkin && (
                  <View style={styles.skinReward}>
                    <Text style={styles.skinRewardText}>🎁 Skin exclusivo: {selectedEvent.rewardSkin}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sectionTitle}>Misiones del evento</Text>
            </View>
          }
          renderItem={({ item }) => {
            const progress = item.progress(state);
            const done = item.condition(state);
            return (
              <View style={[styles.missionCard, done && styles.missionDone]}>
                <View style={styles.missionInfo}>
                  <Text style={[styles.missionDesc, done && { color: colors.textMuted, textDecorationLine: 'line-through' }]}>
                    {item.description}
                  </Text>
                  <Text style={styles.missionProgress}>{Math.round(progress * item.max)}/{item.max}</Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.bg }]}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: done ? colors.green : colors.purple }]} />
                </View>
                <Text style={styles.missionReward}>+{item.rewardCoins}🪙 +{item.rewardXp}XP</Text>
              </View>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  const activeEvents = MOCK_EVENTS.filter(e => new Date(e.startsAt) <= new Date() && new Date(e.endsAt) >= new Date());
  const upcomingEvents = MOCK_EVENTS.filter(e => new Date(e.startsAt) > new Date());
  const pastEvents = MOCK_EVENTS.filter(e => new Date(e.endsAt) < new Date());

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        contentContainerStyle={styles.list}
        data={[]}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Text style={styles.pageTitle}>🎪 Eventos</Text>

            {activeEvents.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>🔴 Activos ahora</Text>
                {activeEvents.map(e => (
                  <EventBanner key={e.id} event={e} onPress={() => { hapticsLight(); setSelectedEvent(e); }} />
                ))}
              </View>
            )}

            {upcomingEvents.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>📅 Próximos</Text>
                {upcomingEvents.map(e => (
                  <EventBanner key={e.id} event={e} onPress={() => { hapticsLight(); setSelectedEvent(e); }} />
                ))}
              </View>
            )}

            {pastEvents.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>✅ Finalizados</Text>
                {pastEvents.map(e => (
                  <View key={e.id} style={[styles.banner, { opacity: 0.5 }]}>
                    <Text style={styles.bannerEmoji}>{e.bannerEmoji}</Text>
                    <Text style={styles.bannerTitle}>{e.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        }
        renderItem={() => null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 12 },
  pageTitle: { fontSize: fonts.sizes.xl, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sectionTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backBtnText: { fontSize: fonts.sizes.md, color: colors.textMuted, fontWeight: '600' },
  eventHeader: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 20, gap: 10, borderLeftWidth: 5, ...shadows.card },
  eventEmoji: { fontSize: 48 },
  eventTitle: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text },
  eventDesc: { fontSize: fonts.sizes.md, color: colors.textSecondary, lineHeight: 22 },
  skinReward: { backgroundColor: colors.yellowLight, borderRadius: radius.lg, padding: 10 },
  skinRewardText: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.text },
  missionCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 16, gap: 8, ...shadows.card },
  missionDone: { opacity: 0.7 },
  missionInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missionDesc: { flex: 1, fontSize: fonts.sizes.md, fontWeight: '600', color: colors.text },
  missionProgress: { fontSize: fonts.sizes.sm, color: colors.textMuted, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  missionReward: { fontSize: fonts.sizes.xs, color: colors.textMuted },
  banner: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadows.card },
  bannerEmoji: { fontSize: 32 },
  bannerTitle: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
});
