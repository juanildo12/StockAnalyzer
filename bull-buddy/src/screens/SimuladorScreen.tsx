import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows } from '../constants/theme';
import { useGameStore, usePortfolioValue, useXPProgress } from '../store/gameStore';
import CandlestickChart from '../components/CandlestickChart';
import MascotBubble from '../components/MascotBubble';
import HeaderActions from '../components/HeaderActions';
import { useStockSimulator } from '../components/useStockSimulator';
import { hapticsSuccess, hapticsError, hapticsMedium } from '../utils/haptics';
import { playBuy, playSell, playLevelUp } from '../services/soundManager';
import { checkAchievements } from '../utils/achievements';
import { useUIStore } from '../store/uiStore';
import { getDifficultyProfile } from '../utils/adaptiveDifficulty';
import type { MascotMood } from '../types';

const SHARE_AMOUNTS = [1, 5, 10, 25, 50];

export default function SimuladorScreen() {
  const { lastQuizResults, lastTradeResults, addTradeResult } = useGameStore();
  const diffProfile = getDifficultyProfile(lastQuizResults, lastTradeResults);
  const { candles, currentPrice, trend, trendLabel, changePercent } = useStockSimulator(diffProfile.volatilityMultiplier);
  const { cash, shares, totalValue, pnl } = usePortfolioValue();
  const { level, xp, needed, progress } = useXPProgress();
  const { buyShares, sellShares, earnXP, earnCoins, setSharePrice } = useGameStore();
  const [quantity, setQuantity] = useState(10);
  const [feedback, setFeedback] = useState<{ text: string; mood: MascotMood } | null>(null);
  const prevLevel = useRef(level);
  const { addToast, triggerConfetti } = useUIStore();
  const [showPortfolio, setShowPortfolio] = useState(false);

  useEffect(() => {
    setSharePrice(currentPrice);
  }, [currentPrice, setSharePrice]);

  const celebrateLevelUp = useCallback((newLevel: number) => {
    if (newLevel > prevLevel.current) {
      playLevelUp();
      triggerConfetti();
      addToast({ type: 'levelup', title: `¡Nivel ${newLevel}!`, icon: '⭐', coins: newLevel * 10 });
      prevLevel.current = newLevel;
    }
  }, [triggerConfetti, addToast]);

  const handleBuy = useCallback(() => {
    const ok = buyShares(quantity, currentPrice);
    if (ok) {
      playBuy();
      earnXP(10);
      earnCoins(5);
      celebrateLevelUp(useGameStore.getState().level);
      setFeedback({ text: `¡Compraste ${quantity} acciones a $${currentPrice.toFixed(2)}! +10XP +5🪙`, mood: 'emocionado' });
      hapticsSuccess();
      const newAchs = checkAchievements();
      newAchs.forEach(a => { playLevelUp(); triggerConfetti(); addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward }); });
    } else {
      setFeedback({ text: `No tienes suficiente efectivo. Necesitas $${(quantity * currentPrice).toFixed(2)}`, mood: 'triste' });
      hapticsError();
    }
    setTimeout(() => setFeedback(null), 3000);
  }, [quantity, currentPrice, buyShares, earnXP, earnCoins, celebrateLevelUp, triggerConfetti, addToast]);

  const handleSell = useCallback(() => {
    const ok = sellShares(quantity, currentPrice);
    if (ok) {
      playSell();
      earnXP(10);
      earnCoins(5);
      celebrateLevelUp(useGameStore.getState().level);
      const avgBuy = useGameStore.getState().trades.filter(t => t.direction === 'buy').reduce((s, t) => s + t.price, 0) / Math.max(1, useGameStore.getState().totalBuys);
      addTradeResult({ profitable: currentPrice > avgBuy, price: currentPrice, shares: quantity });
      setFeedback({ text: `¡Vendiste ${quantity} acciones a $${currentPrice.toFixed(2)}! +10XP +5🪙`, mood: 'feliz' });
      hapticsSuccess();
      const newAchs = checkAchievements();
      newAchs.forEach(a => { playLevelUp(); triggerConfetti(); addToast({ type: 'achievement', title: a.title, icon: a.icon, coins: a.coinsReward, xp: a.xpReward }); });
    } else {
      setFeedback({ text: `Solo tienes ${shares} acciones para vender`, mood: 'triste' });
      hapticsError();
    }
    setTimeout(() => setFeedback(null), 3000);
  }, [quantity, currentPrice, sellShares, earnXP, earnCoins, shares, celebrateLevelUp, triggerConfetti, addToast, addTradeResult]);

  const pnlColor = pnl >= 0 ? colors.green : colors.coral;
  const pnlIcon = pnl >= 0 ? 'trending-up' : 'trending-down';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.badge}>
              <Ionicons name="wallet" size={14} color={colors.yellow} />
              <Text style={styles.badgeText}>${cash.toFixed(2)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.purpleLight }]}>
              <Ionicons name="flash" size={14} color={colors.purple} />
              <Text style={[styles.badgeText, { color: colors.purple }]}>Nv.{level}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.symbol}>MOONCO</Text>
          </View>
        </View>

        <View style={styles.xpBar}>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.xpBarText}>{xp}/{needed} XP</Text>
        </View>

        <HeaderActions />

        {feedback && (
          <View style={{ marginBottom: 8 }}>
            <MascotBubble text={feedback.text} mood={feedback.mood} />
          </View>
        )}

        <CandlestickChart data={candles} height={260} />

        <View style={styles.priceRow}>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>Precio</Text>
            <Text style={[styles.priceValue, { color: changePercent >= 0 ? colors.green : colors.coral }]}>
              ${currentPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>Cambio</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={pnlIcon} size={16} color={pnlColor} />
              <Text style={[styles.priceValue, { color: pnlColor }]}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>Mercado</Text>
            <Text style={styles.trendTag}>{trendLabel}</Text>
          </View>
        </View>

        <View style={styles.qtyRow}>
          <Text style={styles.qtyLabel}>Cantidad</Text>
          <View style={styles.qtyChips}>
            {SHARE_AMOUNTS.map(a => (
              <Pressable key={a} onPress={() => setQuantity(a)}
                style={[styles.qtyChip, quantity === a && { backgroundColor: colors.greenLight, borderColor: colors.green }]}>
                <Text style={[styles.qtyChipText, quantity === a && { color: colors.green, fontWeight: '700' }]}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.tradeRow}>
          <Pressable onPress={handleBuy} style={[styles.tradeBtn, { backgroundColor: colors.green }]}>
            <Ionicons name="arrow-up-circle" size={20} color={colors.white} />
            <Text style={styles.tradeBtnText}>Comprar {quantity}</Text>
          </Pressable>
          <Pressable onPress={handleSell} style={[styles.tradeBtn, { backgroundColor: colors.coral }]}>
            <Ionicons name="arrow-down-circle" size={20} color={colors.white} />
            <Text style={styles.tradeBtnText}>Vender {quantity}</Text>
          </Pressable>
        </View>

        <Text style={styles.costDisplay}>
          Costo estimado: <Text style={{ fontWeight: '700', color: colors.text }}>${(quantity * currentPrice).toFixed(2)}</Text>
        </Text>

        <Pressable onPress={() => setShowPortfolio(!showPortfolio)} style={styles.portfolioToggle}>
          <Ionicons name={showPortfolio ? 'eye-off' : 'eye'} size={16} color={colors.textMuted} />
          <Text style={styles.portfolioToggleText}>
            {showPortfolio ? 'Ocultar' : 'Ver'} portafolio
          </Text>
        </Pressable>

        {showPortfolio && (
          <View style={styles.portfolio}>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Efectivo</Text>
              <Text style={styles.portfolioValue}>${cash.toFixed(2)}</Text>
            </View>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Acciones</Text>
              <Text style={styles.portfolioValue}>{shares} MOONCO</Text>
            </View>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Valor acciones</Text>
              <Text style={styles.portfolioValue}>${(shares * currentPrice).toFixed(2)}</Text>
            </View>
            <View style={[styles.portfolioRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
              <Text style={styles.portfolioLabel}>Valor total</Text>
              <Text style={[styles.portfolioValue, { fontWeight: '800' }]}>${totalValue.toFixed(2)}</Text>
            </View>
            <View style={styles.portfolioRow}>
              <Text style={styles.portfolioLabel}>Ganancia/Pérdida</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={pnlIcon} size={16} color={pnlColor} />
                <Text style={[styles.portfolioValue, { color: pnlColor, fontWeight: '700' }]}>
                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 10 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', gap: 8 },
  headerRight: {},
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.yellowLight, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeText: { color: colors.text, fontWeight: '700', fontSize: fonts.sizes.sm },
  symbol: { fontSize: fonts.sizes.lg, fontWeight: '800', color: colors.text },
  xpBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xpBarBg: {
    flex: 1, height: 6, backgroundColor: colors.bgCard, borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: { height: '100%', backgroundColor: colors.purple, borderRadius: 3 },
  xpBarText: { fontSize: fonts.sizes.xs, color: colors.textMuted, fontWeight: '500' },
  priceRow: {
    flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: 14, ...shadows.card, gap: 0,
  },
  priceInfo: { flex: 1, alignItems: 'center' },
  priceLabel: { fontSize: fonts.sizes.xs, color: colors.textMuted, marginBottom: 2 },
  priceValue: { fontSize: fonts.sizes.lg, fontWeight: '700' },
  trendTag: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.text },
  qtyRow: { gap: 8 },
  qtyLabel: { fontSize: fonts.sizes.sm, fontWeight: '600', color: colors.textSecondary },
  qtyChips: { flexDirection: 'row', gap: 8 },
  qtyChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.lg,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  qtyChipText: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.textSecondary },
  tradeRow: { flexDirection: 'row', gap: 12 },
  tradeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16, borderRadius: radius.xl,
    ...shadows.button,
  },
  tradeBtnText: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: '800' },
  costDisplay: { textAlign: 'center', fontSize: fonts.sizes.sm, color: colors.textMuted },
  portfolioToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: colors.bgCard, borderRadius: radius.lg,
  },
  portfolioToggleText: { fontSize: fonts.sizes.sm, color: colors.textMuted, fontWeight: '600' },
  portfolio: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 16, gap: 8,
    ...shadows.card,
  },
  portfolioRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  portfolioLabel: { fontSize: fonts.sizes.sm, color: colors.textMuted },
  portfolioValue: { fontSize: fonts.sizes.md, fontWeight: '600', color: colors.text },
});
