import { View, Text, ScrollView } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';
import { ACHIEVEMENTS } from '../../src/data/achievements';

export default function LogrosModal() {
  const unlockedAchievements = useGameStore(s => s.unlockedAchievements);

  const categories = [
    { key: 'trading', label: '📈 Trading' },
    { key: 'aprender', label: '📚 Aprender' },
    { key: 'social', label: '👥 Social' },
  ] as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
        Desbloqueados: {unlockedAchievements.length} / {ACHIEVEMENTS.length}
      </Text>

      {categories.map(cat => {
        const items = ACHIEVEMENTS.filter(a => a.category === cat.key);
        return (
          <View key={cat.key} style={{ gap: 8 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{cat.label}</Text>
            {items.map(ach => {
              const unlocked = unlockedAchievements.includes(ach.id);
              return (
                <View
                  key={ach.id}
                  style={{
                    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
                    flexDirection: 'row', gap: 12, alignItems: 'center',
                    opacity: unlocked ? 1 : 0.4,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{unlocked ? ach.icon : '🔒'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: unlocked ? theme.text : theme.textSecondary, fontSize: 15, fontWeight: '700' }}>
                      {ach.title}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{ach.description}</Text>
                    {unlocked && (
                      <Text style={{ color: theme.primary, fontSize: 11, marginTop: 2 }}>
                        +{ach.coinsReward} 🪙 +{ach.xpReward} ⭐
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}
