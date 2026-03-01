import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/theme';
import type { Recommendation, AnalystPriceTarget, StockQuote } from '../types';

interface RecommendationCardProps {
  recommendation: Recommendation;
  priceTarget: AnalystPriceTarget | null;
  quote: StockQuote;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  priceTarget,
  quote,
}) => {
  const {
    action,
    confidence,
    reasoning,
    summary,
    buyZoneLow,
    buyZoneHigh,
    targetPrice,
    stopLoss,
  } = recommendation;

  const analystUpside =
    priceTarget && quote.regularMarketPrice > 0
      ? parseFloat(
          (
            ((priceTarget.targetMean - quote.regularMarketPrice) /
              quote.regularMarketPrice) *
            100
          ).toFixed(1),
        )
      : null;

  const actionColors: Record<string, string> = {
    COMPRAR: colors.accentGreen,
    MANTENER: colors.accentYellow,
    VENDER: colors.accentRed,
  };

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: actionColors[action] }]}>
        <Text style={styles.badgeText}>{action}</Text>
      </View>
      <Text style={styles.summary}>{summary}</Text>
      <Text style={styles.confidence}>Confianza: {confidence}%</Text>

      <View style={styles.priceSection}>
        {priceTarget && analystUpside !== null && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>📊 Target Analistas:</Text>
            <Text
              style={[
                styles.priceValue,
                {
                  color:
                    analystUpside > 0 ? colors.accentGreen : colors.accentRed,
                },
              ]}
            >
              ${priceTarget.targetMean.toFixed(2)} (
              {analystUpside > 0 ? '+' : ''}
              {analystUpside}%)
            </Text>
          </View>
        )}
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>💚 Ideal Compra:</Text>
          <Text style={styles.priceValue}>
            ${buyZoneLow.toFixed(2)} - ${buyZoneHigh.toFixed(2)}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>🎯 Objetivo:</Text>
          <Text style={[styles.priceValue, { color: colors.accentGreen }]}>
            ${targetPrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>🛑 Stop Loss:</Text>
          <Text style={[styles.priceValue, { color: colors.accentRed }]}>
            ${stopLoss.toFixed(2)}
          </Text>
        </View>
      </View>

      <Text style={styles.reasoning}>{reasoning}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  summary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  confidence: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  priceSection: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  reasoning: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
