import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../../src/constants/theme';
import { useGameStore } from '../../src/store/gameStore';
import { SKINS, THEMES } from '../../src/data/shop';
import { hapticsSuccess, hapticsError, hapticsLight } from '../../src/utils/haptics';
import { checkAchievements } from '../../src/utils/achievements';
import RewardedAdButton from '../../src/components/RewardedAdButton';
import type { SkinId, ThemeId } from '../../src/types';

type TabType = 'skins' | 'temas';

export default function TiendaModal() {
  const { coins, ownedSkins, equippedSkin, ownedThemes, equippedTheme, buySkin, equipSkin, buyTheme, equipTheme } = useGameStore();
  const [tab, setTab] = useState<TabType>('skins');

  const handleBuySkin = (id: SkinId, price: number) => {
    if (ownedSkins.includes(id)) {
      equipSkin(id);
      hapticsLight();
      return;
    }
    if (coins < price) { hapticsError(); return; }
    const ok = buySkin(id);
    if (ok) {
      equipSkin(id);
      hapticsSuccess();
      checkAchievements();
    }
  };

  const handleBuyTheme = (id: ThemeId, price: number) => {
    if (ownedThemes.includes(id)) {
      equipTheme(id);
      hapticsLight();
      return;
    }
    if (coins < price) { hapticsError(); return; }
    const ok = buyTheme(id);
    if (ok) {
      equipTheme(id);
      hapticsSuccess();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🛒</Text>
        <Text style={styles.title}>Tienda</Text>
        <View style={styles.coinBadge}>
          <Ionicons name="wallet" size={14} color={colors.yellow} />
          <Text style={styles.coinText}>{coins} 🪙</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab('skins')} style={[styles.tab, tab === 'skins' && { backgroundColor: colors.purpleLight, borderColor: colors.purple }]}>
          <Text style={[styles.tabText, tab === 'skins' && { color: colors.purple, fontWeight: '700' }]}>🎭 Skins</Text>
        </Pressable>
        <Pressable onPress={() => setTab('temas')} style={[styles.tab, tab === 'temas' && { backgroundColor: colors.blueLight, borderColor: colors.blue }]}>
          <Text style={[styles.tabText, tab === 'temas' && { color: colors.blue, fontWeight: '700' }]}>🎨 Temas</Text>
        </Pressable>
      </View>

      {tab === 'skins' && (
        <View style={styles.grid}>
          {SKINS.map(skin => {
            const owned = ownedSkins.includes(skin.id);
            const equipped = equippedSkin === skin.id;
            return (
              <Pressable key={skin.id} onPress={() => handleBuySkin(skin.id, skin.price)}
                style={[styles.itemCard, equipped && { borderColor: colors.yellow, borderWidth: 2 }]}>
                {skin.eventTag && (
                  <View style={styles.eventTag}>
                    <Text style={styles.eventTagText}>{skin.eventTag}</Text>
                  </View>
                )}
                <View style={[styles.skinPreview, { backgroundColor: skin.colors.bg + '30' }]}>
                  <Text style={styles.skinEmoji}>{skin.emoji}</Text>
                </View>
                <Text style={styles.itemName}>{skin.name}</Text>
                <Text style={styles.itemDesc}>{skin.description}</Text>
                {equipped ? (
                  <View style={styles.equippedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.yellow} />
                    <Text style={styles.equippedText}>Equipado</Text>
                  </View>
                ) : owned ? (
                  <View style={styles.equipBtn}>
                    <Text style={styles.equipBtnText}>Equipar</Text>
                  </View>
                ) : (
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>{skin.price} 🪙</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {tab === 'temas' && (
        <View style={styles.grid}>
          {THEMES.map(theme => {
            const owned = ownedThemes.includes(theme.id);
            const equipped = equippedTheme === theme.id;
            return (
              <Pressable key={theme.id} onPress={() => handleBuyTheme(theme.id, theme.price)}
                style={[styles.itemCard, equipped && { borderColor: colors.yellow, borderWidth: 2 }]}>
                <View style={styles.themePreview}>
                  <View style={[styles.themeDot, { backgroundColor: theme.colors.accent }]} />
                  <View style={[styles.themeDot, { backgroundColor: theme.colors.accent2 }]} />
                </View>
                <Text style={styles.itemName}>{theme.name}</Text>
                <Text style={styles.itemDesc}>{theme.description}</Text>
                {equipped ? (
                  <View style={styles.equippedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.yellow} />
                    <Text style={styles.equippedText}>Equipado</Text>
                  </View>
                ) : owned ? (
                  <View style={styles.equipBtn}>
                    <Text style={styles.equipBtnText}>Equipar</Text>
                  </View>
                ) : (
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>{theme.price} 🪙</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ paddingTop: 16 }}>
        <RewardedAdButton rewardCoins={50} rewardXp={25} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.bg, gap: 16 },
  header: { alignItems: 'center', gap: 8 },
  emoji: { fontSize: 48 },
  title: { fontSize: fonts.sizes.xxl, fontWeight: '800', color: colors.text },
  coinBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.yellowLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  coinText: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.text },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  tabText: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  itemCard: {
    width: '47%', backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: 16, gap: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight,
    ...shadows.card,
  },
  skinPreview: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  skinEmoji: { fontSize: 32 },
  themePreview: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  themeDot: { width: 24, height: 24, borderRadius: radius.full },
  itemName: { fontSize: fonts.sizes.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
  itemDesc: { fontSize: fonts.sizes.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  equippedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.yellowLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  equippedText: { fontSize: fonts.sizes.xs, color: colors.yellow, fontWeight: '700' },
  equipBtn: { backgroundColor: colors.blueLight, paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full },
  equipBtnText: { fontSize: fonts.sizes.xs, color: colors.blue, fontWeight: '600' },
  priceTag: { backgroundColor: colors.purpleLight, paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full },
  priceText: { fontSize: fonts.sizes.xs, color: colors.purple, fontWeight: '700' },
  eventTag: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: colors.coral, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.sm, zIndex: 1,
  },
  eventTagText: { fontSize: 8, fontWeight: '800', color: colors.white },
});
