import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore } from '../store/gameStore';

interface IconBtn {
  route: string;
  icon: any;
  color: string;
  label: string;
  badge?: number | string;
}

export default function HeaderActions() {
  const router = useRouter();
  const streakCount = useGameStore(s => s.streakCount);
  const coins = useGameStore(s => s.coins);

  const buttons: IconBtn[] = [
    { route: '/modal/streak', icon: 'flame', color: colors.coral, label: 'Racha', badge: streakCount },
    { route: '/modal/logros', icon: 'trophy', color: colors.yellow, label: 'Logros' },
    { route: '/modal/tienda', icon: 'cart', color: colors.purple, label: 'Tienda' },
    { route: '/modal/ranking', icon: 'podium', color: colors.blue, label: 'Ranking' },
    { route: '/modal/amigos', icon: 'people', color: colors.purple, label: 'Amigos' },
    { route: '/modal/eventos', icon: 'calendar', color: colors.coral, label: 'Eventos' },
    { route: '/chat', icon: 'chatbubble-ellipses', color: colors.green, label: 'Toro' },
    { route: '/modal/ajustes', icon: 'settings', color: colors.textMuted, label: 'Ajustes' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {buttons.map((btn, i) => (
          <Pressable key={i} onPress={() => router.push(btn.route)} style={styles.btnWrap}>
            <View style={[styles.btn, { backgroundColor: btn.color + '18', borderColor: btn.color + '40' }]}>
              <Ionicons name={btn.icon} size={24} color={btn.color} />
              {btn.badge !== undefined && (typeof btn.badge === 'number' ? btn.badge > 0 : true) && (
                <View style={[styles.badgeDot, { backgroundColor: btn.color }]}>
                  <Text style={styles.badgeText}>{btn.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: btn.color }]}>{btn.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable onPress={() => router.push('/modal/tienda')} style={styles.coinBtn}>
        <Ionicons name="wallet" size={16} color={colors.yellow} />
        <Text style={styles.coinText}>{coins}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    ...shadows.card,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btnWrap: { alignItems: 'center', gap: 4 },
  btn: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeDot: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.white },
  label: { fontSize: 10, fontWeight: '600' },
  coinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.yellowLight,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14,
    marginLeft: 6,
    borderWidth: 1.5, borderColor: colors.yellow + '40',
  },
  coinText: { fontSize: fonts.sizes.md, fontWeight: '800', color: colors.text },
});
