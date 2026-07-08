import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';
import { hapticsSelection } from '../../src/utils/haptics';

export default function AjustesModal() {
  const resetGame = useGameStore(s => s.resetGame);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20, gap: 20 }}>
      <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 20, gap: 16 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Bull Buddy v1.0.0</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20 }}>
          Aprende sobre trading e inversiones de forma divertida. Sin dinero real, solo diversión educativa.
        </Text>
        <TouchableOpacity
          onPress={() => {
            hapticsSelection();
            resetGame();
          }}
          style={{ backgroundColor: theme.loss, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>🗑️ Resetear Progreso</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
