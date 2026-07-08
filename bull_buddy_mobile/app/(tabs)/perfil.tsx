import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';
import { getProgressToNextLevel } from '../../src/utils/achievements';
import { hapticsSelection } from '../../src/utils/haptics';

export default function PerfilScreen() {
  const { coins, xp, level, cash, shares, currentStreak, bestStreak, trades, completedMissions } = useGameStore();
  const progress = getProgressToNextLevel(xp);
  const totalAssets = cash + shares.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);

  const menuItems = [
    { href: '/modal/logros', emoji: '🏆', label: 'Logros' },
    { href: '/modal/tienda', emoji: '🛒', label: 'Tienda' },
    { href: '/modal/ranking', emoji: '🏅', label: 'Ranking' },
    { href: '/modal/streak', emoji: '🔥', label: 'Racha' },
    { href: '/chat', emoji: '🐂', label: 'Chat con Toro' },
    { href: '/modal/ajustes', emoji: '⚙️', label: 'Ajustes' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${theme.primary}20`, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>🐂</Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Nivel {level}</Text>
        <View style={{ width: '100%', height: 8, backgroundColor: theme.bgAlt, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ width: `${(progress.current / progress.needed) * 100}%`, height: 8, backgroundColor: theme.primary, borderRadius: 4 }} />
        </View>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{progress.current} / {progress.needed} XP</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          { emoji: '🪙', label: 'Coins', value: coins },
          { emoji: '💵', label: 'Efectivo', value: `$${cash.toFixed(0)}` },
          { emoji: '💼', label: 'Total', value: `$${totalAssets.toFixed(0)}` },
        ].map(item => (
          <View key={item.label} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{item.value}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          { emoji: '🔥', label: 'Racha', value: `${currentStreak} días` },
          { emoji: '🔄', label: 'Trades', value: trades },
          { emoji: '🎪', label: 'Misiones', value: completedMissions.length },
        ].map(item => (
          <View key={item.label} style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{item.value}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        {menuItems.map(item => (
          <Link key={item.href} href={item.href} asChild>
            <TouchableOpacity
              onPress={() => hapticsSelection()}
              style={{
                backgroundColor: theme.surface, borderRadius: 14, padding: 16,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{item.label}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}
