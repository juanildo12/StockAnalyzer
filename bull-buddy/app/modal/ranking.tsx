import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../../src/constants/theme';
import { useGameStore, useXPProgress } from '../../src/store/gameStore';
import { fetchGlobalRanking } from '../../src/services/socialService';
import type { LeaderboardEntry } from '../../src/types';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function PlayerRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isTop3 = rank <= 2;

  return (
    <View style={[styles.row, entry.isPlayer && styles.playerRow]}>
      <View style={styles.rankCol}>
        {rank < 3 ? (
          <Text style={styles.medal}>{MEDAL_EMOJIS[rank]}</Text>
        ) : (
          <View style={[styles.rankBadge, entry.isPlayer && { backgroundColor: colors.purpleLight }]}>
            <Text style={[styles.rankText, entry.isPlayer && { color: colors.purple }]}>{rank + 1}</Text>
          </View>
        )}
      </View>
      <View style={styles.nameCol}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.name, entry.isPlayer && { color: colors.purple, fontWeight: '800' }]}>{entry.name}</Text>
          {entry.isPlayer && <View style={styles.youBadge}><Text style={styles.youText}>TÚ</Text></View>}
        </View>
        <Text style={styles.levelText}>Nv.{entry.level}</Text>
      </View>
      <Text style={styles.coins}>{entry.coins.toLocaleString()} 🪙</Text>
    </View>
  );
}

export default function RankingModal() {
  const { coins } = useGameStore();
  const { level } = useXPProgress();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const playerEntry: LeaderboardEntry = {
    id: 'player',
    name: 'Tú',
    level,
    coins,
    isPlayer: true,
  };

  useEffect(() => {
    fetchGlobalRanking()
      .then((data) => {
        const merged = [...data, playerEntry]
          .sort((a, b) => b.coins - a.coins)
          .slice(0, 20);
        setEntries(merged);
      })
      .catch(() => {
        const { MOCK_LEADERBOARD } = require('../../src/data/leaderboard');
        const merged = [...MOCK_LEADERBOARD, playerEntry]
          .sort((a, b) => b.coins - a.coins)
          .slice(0, 20);
        setEntries(merged);
      })
      .finally(() => setLoading(false));
  }, [coins, level]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🏅</Text>
        <Text style={styles.title}>Ranking</Text>
        <Text style={styles.subtitle}>Los mejores traders de Bull Buddy</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.purple} style={{ paddingVertical: 40 }} />
      ) : (
        <View>
          <View style={styles.podium}>
            {entries.slice(0, 3).map((entry, i) => (
              <View key={entry.id} style={[styles.podiumItem, i === 0 && styles.podiumFirst]}>
                <Text style={styles.podiumMedal}>{MEDAL_EMOJIS[i]}</Text>
                <View style={[styles.podiumAvatar, { backgroundColor: MEDAL_COLORS[i] + '30' }]}>
                  <Text style={styles.podiumEmoji}>{entry.isPlayer ? '😎' : '🤖'}</Text>
                </View>
                <Text style={styles.podiumName}>{entry.name}</Text>
                <Text style={styles.podiumCoins}>{entry.coins.toLocaleString()} 🪙</Text>
                <Text style={styles.podiumLevel}>Nv.{entry.level}</Text>
              </View>
            ))}
          </View>
          <View style={styles.list}>
            {entries.map((entry, i) => (
              <PlayerRow key={entry.id} entry={entry} rank={i} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, gap: 16 },
  header: { alignItems: 'center', gap: 8 },
  emoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fonts.sizes.sm, color: colors.textMuted },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 12, paddingVertical: 16 },
  podiumItem: { alignItems: 'center', gap: 4, width: 90 },
  podiumFirst: { width: 100 },
  podiumMedal: { fontSize: 28 },
  podiumAvatar: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  podiumEmoji: { fontSize: 22 },
  podiumName: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
  podiumCoins: { fontSize: fonts.sizes.xs, fontWeight: '600', color: colors.yellow },
  podiumLevel: { fontSize: fonts.sizes.xs, color: colors.textMuted },
  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    borderRadius: radius.xl, padding: 12, gap: 12, ...shadows.card,
  },
  playerRow: { backgroundColor: colors.purpleLight, borderWidth: 1, borderColor: colors.purple },
  rankCol: { width: 32, alignItems: 'center' },
  medal: { fontSize: 20 },
  rankBadge: { width: 24, height: 24, borderRadius: radius.full, backgroundColor: colors.bgTag, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: fonts.sizes.xs, fontWeight: '700', color: colors.textMuted },
  nameCol: { flex: 1 },
  name: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.text },
  youBadge: { backgroundColor: colors.purple, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  youText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  levelText: { fontSize: fonts.sizes.xs, color: colors.textMuted, marginTop: 2 },
  coins: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.text },
});
