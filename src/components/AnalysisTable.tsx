import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/theme';
import type { FundamentalsAnalysis } from '../types';

interface AnalysisTableProps {
  fundamentals: FundamentalsAnalysis;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({ fundamentals }) => {
  const principles = [
    fundamentals.principle1,
    fundamentals.principle2,
    fundamentals.principle3,
    fundamentals.principle4,
    fundamentals.principle5,
    fundamentals.principle6,
    fundamentals.principle7,
    fundamentals.principle8,
    fundamentals.principle9,
    fundamentals.principle10,
  ];

  const formatValue = (value: number, label: string): string => {
    if (label.includes('PE')) {
      return value.toFixed(1);
    }
    if (label.includes('PEG')) {
      return value.toFixed(2);
    }
    if (label.includes('Yield') || label.includes('FCF')) {
      return `${value.toFixed(2)}%`;
    }
    if (label.includes('Book')) {
      return value.toFixed(2);
    }
    if (label.includes('Cash')) {
      return `${value.toFixed(2)}x`;
    }
    if (label.includes('Precio')) {
      return `$${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  };

  const getStatusColor = (isInDiscount: boolean | null) => {
    if (isInDiscount === null) return colors.accentYellow;
    return isInDiscount ? colors.accentGreen : colors.accentRed;
  };

  const getStatusText = (isInDiscount: boolean | null) => {
    if (isInDiscount === null) return 'N/A';
    return isInDiscount ? 'FAVORABLE' : 'DESFAVORABLE';
  };

  const getPEBadgeInfo = (label: string, value: number): { text: string; color: string } | null => {
    if (label.includes('PE Ratio')) {
      if (value < 20) return { text: 'Conservador', color: colors.accentGreen };
      if (value < 40) return { text: 'Crec. Medio', color: colors.accentYellow };
      return { text: 'Alto Crec.', color: colors.accentRed };
    }
    if (label.includes('Cash')) {
      return { text: 'Salud Financiera', color: colors.accentGreen };
    }
    if (label.includes('Crecimiento')) {
      if (value >= 15) return { text: 'Excelente', color: colors.accentGreen };
      if (value >= 5) return { text: 'Adecuado', color: colors.accentYellow };
      if (value > 0) return { text: 'Bajo', color: colors.accentRed };
      return { text: 'Negativo', color: colors.accentRed };
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {principles.map((principle, index) => {
        const badgeInfo = getPEBadgeInfo(principle.name, principle.value);
        
        return (
          <View key={index} style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{principle.name}</Text>
              {badgeInfo && (
                <View style={[styles.peBadge, { backgroundColor: badgeInfo.color + '20' }]}>
                  <Text style={[styles.peBadgeText, { color: badgeInfo.color }]}>{badgeInfo.text}</Text>
                </View>
              )}
              <Text style={styles.description}>{principle.description}</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.value}>{formatValue(principle.value, principle.name)}</Text>
              <View style={[styles.badge, { backgroundColor: getStatusColor(principle.isInDiscount) + '20' }]}>
                <Text style={[styles.badgeText, { color: getStatusColor(principle.isInDiscount) }]}>
                  {getStatusText(principle.isInDiscount)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  nameContainer: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  peBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
    marginBottom: 2,
  },
  peBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  description: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
});
