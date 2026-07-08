import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';
import { AprendeScreen } from '../../src/screens/AprendeScreen';
import { ReelsScreen } from '../../src/screens/ReelsScreen';
import { hapticsSelection } from '../../src/utils/haptics';

type Tab = 'aprender' | 'reels';

export default function AprendeTabScreen() {
  const [tab, setTab] = useState<Tab>('aprender');

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 }}>
        {[
          { key: 'aprender' as Tab, label: '📝 Quiz', icon: '📝' },
          { key: 'reels' as Tab, label: '🎬 Reels', icon: '🎬' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => { setTab(t.key); hapticsSelection(); }}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 12,
              backgroundColor: tab === t.key ? theme.primary : theme.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: tab === t.key ? '#fff' : theme.text, fontWeight: '700', fontSize: 15 }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'aprender' ? <AprendeScreen /> : <ReelsScreen />}
    </View>
  );
}
