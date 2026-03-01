import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';
import { useStockAnalysis } from '../hooks/useStockAnalysis';
import { usePortfolio } from '../hooks/usePortfolio';
import { StockHeader } from '../components/StockHeader';
import { MetricsGrid } from '../components/MetricsGrid';
import { AnalysisTable } from '../components/AnalysisTable';
import { RecommendationCard } from '../components/RecommendationCard';
import { PriceChart } from '../components/PriceChart';
import { DiscountScore } from '../components/DiscountScore';
import { PortfolioList } from '../components/PortfolioList';

type ViewMode = 'analyzer' | 'portfolio';

export const HomeScreen: React.FC = () => {
  const [view, setView] = useState<ViewMode>('analyzer');
  const [symbol, setSymbol] = useState('');
  const { analysis, loading, error, analyze } = useStockAnalysis();
  const {
    portfolio,
    addToPortfolio,
    removeFromPortfolio,
    isInPortfolio,
    refreshPrices,
    isRefreshing,
  } = usePortfolio();

  const handleSearch = () => {
    if (symbol.trim()) {
      analyze(symbol.trim().toUpperCase());
    }
  };

  const handleSelectFromPortfolio = (sym: string) => {
    const item = portfolio.find(p => p.symbol === sym);
    if (item) {
      analyze(sym);
      setView('analyzer');
    }
  };

  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
    if (newView === 'portfolio' && portfolio.length > 0) {
      refreshPrices();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.logo}>📈 Stock Analyzer</Text>
        <View style={styles.nav}>
          <TouchableOpacity
            style={[styles.navBtn, view === 'analyzer' && styles.navBtnActive]}
            onPress={() => handleViewChange('analyzer')}
          >
            <Text
              style={[
                styles.navText,
                view === 'analyzer' && styles.navTextActive,
              ]}
            >
              Analizador
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, view === 'portfolio' && styles.navBtnActive]}
            onPress={() => handleViewChange('portfolio')}
          >
            <Text
              style={[
                styles.navText,
                view === 'portfolio' && styles.navTextActive,
              ]}
            >
              Portafolio ({portfolio.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'analyzer' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Analiza Acciones de EE.UU.</Text>
          <Text style={styles.subtitle}>
            Ingresa el ticker para obtener un análisis basado en 8 principios
            fundamentales
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Ej: AAPL, MSFT, GOOGL..."
              placeholderTextColor={colors.textSecondary}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                styles.searchBtn,
                loading === 'loading' && styles.searchBtnDisabled,
              ]}
              onPress={handleSearch}
              disabled={loading === 'loading' || !symbol.trim()}
            >
              {loading === 'loading' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.searchBtnText}>Analizar</Text>
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.error}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {analysis && (
            <>
              <View style={styles.card}>
                <StockHeader
                  symbol={analysis.quote.symbol}
                  name={
                    analysis.quote.shortName ||
                    analysis.quote.longName ||
                    analysis.quote.symbol
                  }
                  price={analysis.quote.regularMarketPrice}
                  change={analysis.quote.regularMarketChangePercent}
                />
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    isInPortfolio(analysis.quote.symbol) &&
                      styles.addBtnDisabled,
                  ]}
                  onPress={() => addToPortfolio(analysis)}
                  disabled={isInPortfolio(analysis.quote.symbol)}
                >
                  <Text style={styles.addBtnText}>
                    {isInPortfolio(analysis.quote.symbol)
                      ? '✓ Ya está en el portafolio'
                      : '+ Agregar al portafolio'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Métricas Financieras</Text>
                <MetricsGrid
                  quote={analysis.quote}
                  summary={analysis.summary}
                  priceTarget={analysis.priceTarget}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Análisis de los 8 Principios
                </Text>
                <AnalysisTable fundamentals={analysis.fundamentals} />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Precio Histórico (30 días)</Text>
                <PriceChart data={analysis.historical} />
              </View>

              <View style={styles.scoreSection}>
                <DiscountScore score={analysis.discountScore} />
                <RecommendationCard
                  recommendation={analysis.recommendation}
                  priceTarget={analysis.priceTarget}
                  quote={analysis.quote}
                />
              </View>
            </>
          )}

          {!analysis && loading !== 'loading' && !error && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📈</Text>
              <Text style={styles.emptyText}>
                Ingresa un ticker para analizar
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.portfolioContainer}>
          <Text style={styles.title}>Mi Portafolio</Text>
          <Text style={styles.subtitle}>Acciones analizadas y guardadas</Text>
          <PortfolioList
            items={portfolio}
            onSelect={handleSelectFromPortfolio}
            onRemove={removeFromPortfolio}
            isRefreshing={isRefreshing}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nav: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navBtnActive: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  navText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  navTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchBtn: {
    backgroundColor: colors.accentGreen,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.6,
  },
  searchBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    backgroundColor: colors.accentRed + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: colors.accentRed,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: colors.accentGreen + '20',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnDisabled: {
    backgroundColor: colors.border,
  },
  addBtnText: {
    color: colors.accentGreen,
    fontWeight: '600',
    fontSize: 14,
  },
  scoreSection: {
    marginBottom: 32,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  portfolioContainer: {
    flex: 1,
    padding: 16,
  },
});
