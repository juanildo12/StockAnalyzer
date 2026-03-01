import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/theme';

interface DiscountScoreProps {
  score: number;
}

export const DiscountScore: React.FC<DiscountScoreProps> = ({ score }) => {
  let categoryColor: string;
  let label: string;
  
  if (score >= 5) {
    categoryColor = colors.accentGreen;
    label = 'EN DESCUENTO';
  } else if (score >= 3) {
    categoryColor = colors.accentYellow;
    label = 'NEUTRAL';
  } else {
    categoryColor = colors.accentRed;
    label = 'PREMIUM';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Score de Descuento</Text>
      <Text style={[styles.score, { color: categoryColor }]}>{score}/8</Text>
      <View style={[styles.badge, { backgroundColor: categoryColor + '20' }]}>
        <Text style={[styles.badgeText, { color: categoryColor }]}>{label}</Text>
      </View>
      <Text style={styles.hint}>Basado en 8 principios fundamentales</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  score: {
    fontSize: 48,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
  },
});
