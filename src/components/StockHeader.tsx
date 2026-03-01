import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/theme';

interface StockHeaderProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

export const StockHeader: React.FC<StockHeaderProps> = ({ symbol, name, price, change }) => {
  const isPositive = change > 0;
  const changeColor = isPositive ? colors.accentGreen : colors.accentRed;

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </View>
      <View style={styles.priceContainer}>
        <Text style={styles.price}>${price.toFixed(2)}</Text>
        <Text style={[styles.change, { color: changeColor }]}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  info: {
    flex: 1,
  },
  symbol: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  name: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  change: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
});
