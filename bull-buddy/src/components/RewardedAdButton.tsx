import { useState } from 'react';
import { Pressable, View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore } from '../store/gameStore';
import { hapticsSuccess } from '../utils/haptics';

interface Props {
  rewardCoins?: number;
  rewardXp?: number;
  onReward?: () => void;
}

export default function RewardedAdButton({ rewardCoins = 50, rewardXp = 25, onReward }: Props) {
  const [loading, setLoading] = useState(false);
  const { earnCoins, earnXP } = useGameStore();

  const handleWatch = async () => {
    setLoading(true);

    try {
      // In production: use MobileAds.RewardedAd
      // For now, simulate with a delay + confirmation
      const shouldShowAd = Platform.OS !== 'web' && false; // Placeholder — real ad SDK requires native build

      if (shouldShowAd) {
        // const ad = await RewardedAd.createAd(AD_UNIT_ID);
        // ad.show();
        // ad.onReward(() => { ... });
      } else {
        // Mock: simulate watching an ad
        await new Promise(r => setTimeout(r, 1500));
      }

      earnCoins(rewardCoins);
      earnXP(rewardXp);
      hapticsSuccess();
      onReward?.();
      Alert.alert(
        '¡Recompensa recibida!',
        `+${rewardCoins}🪙 +${rewardXp}XP ¡Gracias por ver el anuncio!`
      );
    } catch {
      Alert.alert('Error', 'No se pudo mostrar el anuncio. Intenta de nuevo.');
    }

    setLoading(false);
  };

  return (
    <Pressable onPress={handleWatch} disabled={loading}
      style={({ pressed }) => [
        styles.button,
        loading && { opacity: 0.6 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}>
      <View style={styles.iconWrap}>
        <Ionicons name="play-circle" size={22} color={colors.yellow} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {loading ? 'Cargando...' : '🎬 Ver anuncio'}
        </Text>
        <Text style={styles.reward}>Gana +{rewardCoins}🪙 +{rewardXp}XP</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: 14, ...shadows.card,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.lg,
    backgroundColor: colors.purpleLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: fonts.sizes.md, fontWeight: '700', color: colors.text },
  reward: { fontSize: fonts.sizes.xs, color: colors.yellow, fontWeight: '600', marginTop: 2 },
});
