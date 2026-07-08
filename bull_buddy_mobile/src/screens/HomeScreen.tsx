import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../store/gameStore';
import { theme, radius, shadows } from '../constants/theme';
import { getProgressToNextLevel } from '../utils/achievements';
import { hapticsLight } from '../utils/haptics';
import { ACHIEVEMENTS } from '../data/achievements';

const QUICK_ACTIONS = [
  { route: '/(tabs)/simulador', icon: '📈', label: 'Simulador', desc: 'Tradea en vivo' },
  { route: '/(tabs)/aprende', icon: '📚', label: 'Aprender', desc: 'Quiz y misiones' },
  { route: '/chat', icon: '💬', label: 'Chat con Toro', desc: 'Consejos y preguntas' },
  { route: '/modal/tienda', icon: '🛒', label: 'Tienda', desc: 'Personaliza tu app' },
];

export default function HomeScreen() {
  const router = useRouter();
  const coins = useGameStore(s => s.coins);
  const xp = useGameStore(s => s.xp);
  const level = useGameStore(s => s.level);
  const cash = useGameStore(s => s.cash);
  const shares = useGameStore(s => s.shares);
  const trades = useGameStore(s => s.trades);
  const currentStreak = useGameStore(s => s.currentStreak);
  const dailyStreakClaimed = useGameStore(s => s.dailyStreakClaimed);
  const claimDailyStreak = useGameStore(s => s.claimDailyStreak);
  const unlockedAchievements = useGameStore(s => s.unlockedAchievements);

  const { current, needed } = getProgressToNextLevel(xp);
  const progressPct = needed > 0 ? current / needed : 0;
  const totalValue = cash + shares.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);

  const handleNav = (route: string) => {
    hapticsLight();
    router.push(route as any);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Header saludo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 36 }}>🐂</Text>
          <View>
            <Text style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
              Trader
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text }}>
              ¡Bienvenido, Toro!
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: theme.surface,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
          onPress={() => handleNav('/modal/ajustes')}
        >
          <Text style={{ fontSize: 14 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Cards de stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: radius.lg, padding: 14,
          borderWidth: 1, borderColor: theme.border, ...shadows.card,
        }}>
          <Text style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>Monedas</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.primary, marginTop: 2 }}>🪙 {coins}</Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: radius.lg, padding: 14,
          borderWidth: 1, borderColor: theme.border, ...shadows.card,
        }}>
          <Text style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>Portafolio</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 2 }}>${totalValue.toFixed(0)}</Text>
        </View>
      </View>

      {/* XP Progress */}
      <View style={{
        backgroundColor: theme.surface, borderRadius: radius.lg, padding: 14,
        borderWidth: 1, borderColor: theme.border, marginBottom: 12, ...shadows.card,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>Nivel {level}</Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>{current}/{needed} XP</Text>
        </View>
        <View style={{ height: 8, backgroundColor: theme.bgAlt, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.min(progressPct * 100, 100)}%`, backgroundColor: theme.primary, borderRadius: 4 }} />
        </View>
      </View>

      {/* Racha diaria */}
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
          borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: theme.border,
          marginBottom: 16, ...shadows.card,
        }}
        onPress={() => handleNav('/modal/streak')}
        activeOpacity={0.7}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${theme.primary}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 20 }}>🔥</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>Racha diaria</Text>
          <Text style={{ fontSize: 12, color: currentStreak > 0 ? theme.primary : theme.textSecondary }}>
            {currentStreak > 0 ? `${currentStreak} días consecutivos` : '¡Reclama tu recompensa hoy!'}
          </Text>
        </View>
        {!dailyStreakClaimed && (
          <View style={{ backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm }}>
            <Text style={{ color: theme.bg, fontSize: 11, fontWeight: '700' }}>RECLAMAR</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Quick Actions */}
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 10 }}>Acciones rápidas</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {QUICK_ACTIONS.map(action => (
          <TouchableOpacity
            key={action.route}
            style={{
              width: '48%', backgroundColor: theme.surface, borderRadius: radius.lg, padding: 14,
              borderWidth: 1, borderColor: theme.border, ...shadows.card,
            } as any}
            onPress={() => handleNav(action.route)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 28, marginBottom: 6 }}>{action.icon}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{action.label}</Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{action.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Portfolio / Stats */}
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 10 }}>Resumen de trading</Text>
      <View style={{
        backgroundColor: theme.surface, borderRadius: radius.lg, padding: 14,
        borderWidth: 1, borderColor: theme.border, marginBottom: 16, ...shadows.card,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Cash disponible</Text>
          <Text style={{ color: theme.gain, fontSize: 14, fontWeight: '700' }}>${cash.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Acciones en cartera</Text>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{shares.reduce((s, h) => s + h.quantity, 0)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Trades realizados</Text>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{trades}</Text>
        </View>
        {trades > 0 && (
          <TouchableOpacity
            style={{ marginTop: 8, backgroundColor: `${theme.primary}20`, borderRadius: radius.sm, padding: 10, alignItems: 'center' }}
            onPress={() => handleNav('/(tabs)/simulador')}
            activeOpacity={0.7}
          >
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>IR AL SIMULADOR →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Últimos logros */}
      {unlockedAchievements.length > 0 && (
        <>
          <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 10 }}>Logros desbloqueados</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {unlockedAchievements.slice(-5).reverse().map(id => {
                const ach = ACHIEVEMENTS.find(a => a.id === id);
                if (!ach) return null;
                return (
                  <View key={id} style={{
                    backgroundColor: theme.surface, borderRadius: radius.md, padding: 12,
                    borderWidth: 1, borderColor: theme.border, alignItems: 'center', minWidth: 80,
                  }}>
                    <Text style={{ fontSize: 28 }}>{ach.icon}</Text>
                    <Text style={{ fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 4 }}>{ach.title}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}
