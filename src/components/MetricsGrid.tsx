import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/theme';
import type { StockQuote, StockSummary, AnalystPriceTarget } from '../types';

interface MetricsGridProps {
  quote: StockQuote;
  summary: StockSummary | null;
  priceTarget: AnalystPriceTarget | null;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  quote,
  summary,
  priceTarget,
}) => {
  const formatLargeNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return num.toString();
  };

  const metrics = [
    {
      label: 'Market Cap',
      value: formatLargeNumber(summary?.marketCap || quote.marketCap || 0),
    },
    {
      label: 'P/E Ratio',
      value: (summary?.peRatio || quote.peRatio || 0).toFixed(2),
    },
    { label: 'PEG Ratio', value: (summary?.pegRatio || 0).toFixed(2) },
    {
      label: 'EPS',
      value: `$${(summary?.epsTrailingTwelveMonths || 0).toFixed(2)}`,
    },
    { label: 'Beta', value: (summary?.beta || 0).toFixed(2) },
    {
      label: 'Div Yield',
      value: `${((summary?.dividendYield || 0) * 100).toFixed(2)}%`,
    },
    { label: '52W High', value: `$${quote.fiftyTwoWeekHigh?.toFixed(2) || 0}` },
    { label: '52W Low', value: `$${quote.fiftyTwoWeekLow?.toFixed(2) || 0}` },
    {
      label: 'Target Mean',
      value: priceTarget?.targetMean
        ? `$${priceTarget.targetMean.toFixed(2)}`
        : 'N/A',
    },
    {
      label: 'Target High',
      value: priceTarget?.targetHigh
        ? `$${priceTarget.targetHigh.toFixed(2)}`
        : 'N/A',
    },
    {
      label: 'Target Low',
      value: priceTarget?.targetLow
        ? `$${priceTarget.targetLow.toFixed(2)}`
        : 'N/A',
    },
    {
      label: 'Analysts',
      value:
        priceTarget?.numberOfAnalysts || quote.numberOfAnalystOpinions || 0,
    },
    { label: 'P/B', value: (summary?.priceToBook || 0).toFixed(2) },
    {
      label: 'Volume',
      value: formatLargeNumber(quote.regularMarketVolume || 0),
    },
  ];

  return (
    <View style={styles.grid}>
      {metrics.map((metric, index) => (
        <View key={index} style={styles.item}>
          <Text style={styles.label}>{metric.label}</Text>
          <Text style={styles.value}>{metric.value}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  item: {
    width: '33.33%',
    padding: 8,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
});
