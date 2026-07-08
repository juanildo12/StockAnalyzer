import { View, Text, ScrollView } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';

export default function StreakModal() {
  const { currentStreak, bestStreak, lastActiveDate, dailyStreakClaimed } = useGameStore();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toDateString();
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20, gap: 20 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 64 }}>🔥</Text>
        <Text style={{ color: theme.text, fontSize: 36, fontWeight: '800' }}>{currentStreak} días</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>Mejor racha: {bestStreak} días</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {days.map((day, i) => {
          const isToday = i === days.length - 1;
          const isActive = currentStreak >= (7 - i);
          return (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: isActive ? theme.primary : theme.surface,
                  justifyContent: 'center', alignItems: 'center',
                  borderWidth: isToday ? 2 : 0,
                  borderColor: theme.primary,
                }}
              >
                <Text style={{ fontSize: 16 }}>{isActive ? '🔥' : '⚪'}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 9, textAlign: 'center' }}>
                {day.slice(0, 3)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>🎁 Recompensas de racha</Text>
        {[
          { day: 3, reward: '50 🪙 + 100 ⭐' },
          { day: 7, reward: '150 🪙 + 300 ⭐' },
          { day: 14, reward: '300 🪙 + 500 ⭐' },
          { day: 30, reward: '1000 🪙 + 2000 ⭐' },
        ].map(r => (
          <View key={r.day} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: theme.textSecondary }}>{r.day} días</Text>
            <Text style={{ color: theme.primary, fontWeight: '600' }}>{r.reward}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
