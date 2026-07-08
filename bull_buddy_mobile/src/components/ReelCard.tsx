import { useRef, useState, useCallback } from 'react';
import { View, Text, Dimensions, FlatList, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { theme } from '../constants/theme';
import { hapticsSelection } from '../utils/haptics';
import type { ReelLesson } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 40;

interface Props {
  emoji: string;
  title: string;
  color: string;
  lessons: ReelLesson[];
  onComplete: () => void;
}

export function ReelCard({ emoji, title, color, lessons, onComplete }: Props) {
  const [page, setPage] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
    setPage(idx);
  }, []);

  const isLast = page >= lessons.length - 1;

  return (
    <View
      style={{
        width: CARD_W, borderRadius: 20, overflow: 'hidden',
        backgroundColor: theme.surface,
        borderWidth: 1, borderColor: `${color}40`,
      }}
    >
      <View style={{ backgroundColor: `${color}20`, padding: 20, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 48 }}>{emoji}</Text>
        <Text style={{ color: color, fontSize: 20, fontWeight: '800' }}>{title}</Text>
      </View>

      <FlatList
        ref={flatRef}
        data={lessons}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={{ width: CARD_W, padding: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
              <Text style={{ color: color, fontSize: 17, fontWeight: '700', flex: 1 }}>{item.title}</Text>
              <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: color, fontSize: 11, fontWeight: '600' }}>{page + 1}/{lessons.length}</Text>
              </View>
            </View>
            <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>{item.content}</Text>
            {item.tip && (
              <View style={{ backgroundColor: `${theme.primary}15`, padding: 12, borderRadius: 12 }}>
                <Text style={{ color: theme.primary, fontSize: 13, lineHeight: 18 }}>{item.tip}</Text>
              </View>
            )}
          </View>
        )}
        keyExtractor={(_item, i) => String(i)}
      />

      <View style={{ padding: 16 }}>
        <TouchableOpacity
          onPress={() => {
            hapticsSelection();
            if (!isLast && flatRef.current) {
              flatRef.current.scrollToIndex({ index: page + 1, animated: true });
            } else {
              onComplete();
            }
          }}
          style={{
            backgroundColor: isLast ? theme.gain : color,
            paddingVertical: 14, borderRadius: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {isLast ? '✅ Completar' : 'Siguiente →'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 12 }}>
        {lessons.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === page ? 20 : 8, height: 8, borderRadius: 4,
              backgroundColor: i === page ? color : theme.textSecondary + '40',
            }}
          />
        ))}
      </View>
    </View>
  );
}
