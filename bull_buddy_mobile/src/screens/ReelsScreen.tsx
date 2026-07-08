import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { theme } from '../constants/theme';
import { ReelCard } from '../components/ReelCard';
import { REEL_SERIES } from '../data/reelsContent';

export function ReelsScreen() {
  const [active, setActive] = useState<string | null>(null);
  const watchedReels = useGameStore(s => s.watchedReels);
  const watchReel = useGameStore(s => s.watchReel);

  if (active) {
    const series = REEL_SERIES.find(r => r.id === active);
    if (!series) {
      setActive(null);
      return null;
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ReelCard
          emoji={series.icon}
          title={series.title}
          color={series.color}
          lessons={series.lessons}
          onComplete={() => {
            watchReel(series.id);
            useUIStore.getState().setToast(`✅ Completaste "${series.title}"`, 'success');
            setActive(null);
          }}
        />
        <TouchableOpacity
          onPress={() => setActive(null)}
          style={{ marginTop: 16, padding: 12 }}
        >
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>🎬 Reels Educativos</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: -8 }}>
        Aprende conceptos de trading en cortos interactivos
      </Text>

      {REEL_SERIES.map(series => {
        const completed = watchedReels.includes(series.id);
        return (
          <TouchableOpacity
            key={series.id}
            onPress={() => setActive(series.id)}
            style={{
              backgroundColor: theme.surface, borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: `${series.color}40`,
              flexDirection: 'row', gap: 12, alignItems: 'center',
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${series.color}20`, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>{series.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{series.title}</Text>
                {completed && <Text style={{ fontSize: 14 }}>✅</Text>}
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>{series.lessons.length} lecciones</Text>
            </View>
            <Text style={{ fontSize: 24, color: theme.textSecondary }}>▶️</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
