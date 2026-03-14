import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../utils/theme';
import type { PortfolioItem } from '../types';

interface PortfolioListProps {
  items: PortfolioItem[];
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  isRefreshing?: boolean;
}

export const PortfolioList: React.FC<PortfolioListProps> = ({
  items,
  onSelect,
  onRemove,
  isRefreshing,
}) => {
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderItem = ({ item }: { item: PortfolioItem }) => {
    const price = item.analysis?.quote?.regularMarketPrice || item.purchasePrice || 0;
    const change = item.analysis?.quote?.regularMarketChangePercent || 0;
    const isPositive = change >= 0;
    
    const invested = (item.purchasePrice || 0) * (item.shares || 1);
    const currentValue = price * (item.shares || 1);
    const profitLoss = currentValue - invested;
    const profitLossPercent = invested > 0 ? (profitLoss / invested) * 100 : 0;

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onSelect(item.symbol)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {item.analysis?.quote?.shortName ||
              item.analysis?.quote?.longName ||
              item.symbol}
          </Text>
          <Text style={styles.date}>
            {item.shares} acciones @ ${item.purchasePrice?.toFixed(2) || '0.00'}
          </Text>
        </View>
        <View style={styles.priceInfo}>
          <Text style={styles.price}>${currentValue.toFixed(2)}</Text>
          <Text
            style={[
              styles.change,
              { color: profitLoss >= 0 ? colors.accentGreen : colors.accentRed },
            ]}
          >
            {profitLoss >= 0 ? '+' : ''}
            {profitLossPercent.toFixed(2)}% (${profitLoss.toFixed(2)})
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(item.symbol)}
        >
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>
          No tienes acciones en tu portafolio
        </Text>
        <Text style={styles.emptyHint}>Analiza una acción y guárdala aquí</Text>
      </View>
    );
  }

  return (
    <View>
      {isRefreshing && (
        <View style={styles.refreshing}>
          <ActivityIndicator size="small" color={colors.accentGreen} />
          <Text style={styles.refreshingText}>Actualizando precios...</Text>
        </View>
      )}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.symbol}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  name: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  date: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  priceInfo: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  change: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentRed + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.accentRed,
    fontSize: 14,
    fontWeight: '600',
  },
  refreshing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.secondary,
    borderRadius: 8,
    marginBottom: 12,
  },
  refreshingText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
