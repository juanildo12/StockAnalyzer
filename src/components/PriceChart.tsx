import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../utils/theme';
import type { HistoricalData } from '../types';

interface PriceChartProps {
  data: HistoricalData[];
}

export const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  const chartData = data.slice(-30).map(d => d.close);
  const labels = data.slice(-30).map((_, i) => {
    if (i % 7 === 0) {
      const date = new Date(data[data.length - 30 + i].date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
    return '';
  });

  if (chartData.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No hay datos históricos disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels,
          datasets: [{ data: chartData }],
        }}
        width={Dimensions.get('window').width - 48}
        height={220}
        chartConfig={{
          backgroundColor: colors.secondary,
          backgroundGradientFrom: colors.secondary,
          backgroundGradientTo: colors.secondary,
          decimalPlaces: 2,
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
          labelColor: () => colors.textSecondary,
          style: { borderRadius: 12 },
          propsForDots: {
            r: '0',
          },
          propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: colors.border,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 16,
  },
  chart: {
    borderRadius: 12,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
