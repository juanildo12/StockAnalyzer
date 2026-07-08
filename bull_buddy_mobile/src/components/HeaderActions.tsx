import { View, Text, TouchableOpacity } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { theme } from '../constants/theme';

export function HeaderActions() {
  const coins = useGameStore(s => s.coins);
  const xp = useGameStore(s => s.xp);
  const level = useGameStore(s => s.level);

  return (
    <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 16 }}>🪙</Text>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{coins}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 16 }}>⭐</Text>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{xp}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 16 }}>📊</Text>
        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 15 }}>Nv.{level}</Text>
      </View>
    </View>
  );
}
