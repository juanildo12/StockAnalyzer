import { View, Text, ScrollView } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';
import { LEADERBOARD_NAMES, LEADERBOARD_TITLES } from '../../src/data/leaderboard';

export default function RankingModal() {
  const coins = useGameStore(s => s.coins);
  const level = useGameStore(s => s.level);
  const trades = useGameStore(s => s.trades);

  const entries = LEADERBOARD_NAMES.slice(0, 20).map((name, i) => {
    const score = Math.round((20 - i) * 137 + (i % 3) * 50);
    const lvl = Math.max(1, Math.round(20 - i * 0.8));
    return { name, score, level: lvl, title: LEADERBOARD_TITLES[i % LEADERBOARD_TITLES.length] };
  });

  const yourScore = coins * 2 + level * 500 + trades * 100;
  const yourRank = entries.findIndex(e => e.score < yourScore) + 1 || entries.length + 1;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Tu Puesto</Text>
        <Text style={{ color: theme.primary, fontSize: 36, fontWeight: '800' }}>#{yourRank}</Text>
        <Text style={{ color: theme.text, fontSize: 14 }}>Puntaje: {yourScore}</Text>
      </View>

      <View style={{ gap: 6 }}>
        {entries.map((entry, i) => {
          const isYou = false;
          const rank = i + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
          return (
            <View
              key={i}
              style={{
                backgroundColor: isYou ? `${theme.primary}20` : theme.surface,
                borderRadius: 12, padding: 12,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: isYou ? 1 : 0,
                borderColor: theme.primary,
              }}
            >
              <Text style={{ fontSize: 20, width: 36, textAlign: 'center' }}>{medal}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{entry.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{entry.title} · Nv.{entry.level}</Text>
              </View>
              <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '700' }}>{entry.score}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
