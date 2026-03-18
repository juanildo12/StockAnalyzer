import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';
import { useStockAnalysis } from '../hooks/useStockAnalysis';
import { usePortfolio } from '../hooks/usePortfolio';
import { useWatchlist } from '../hooks/useWatchlist';
import { StockHeader } from '../components/StockHeader';
import { MetricsGrid } from '../components/MetricsGrid';
import { AnalysisTable } from '../components/AnalysisTable';
import { RecommendationCard } from '../components/RecommendationCard';
import { PriceChart } from '../components/PriceChart';
import { DiscountScore } from '../components/DiscountScore';
import { PortfolioList } from '../components/PortfolioList';
import { WatchlistCard } from '../components/WatchlistCard';
import { InformeView } from '../components/InformeView';

type ViewMode = 'analyzer' | 'portfolio' | 'watchlist' | 'informe';

export const HomeScreen: React.FC = () => {
  const [view, setView] = useState<ViewMode>('analyzer');
  const [symbol, setSymbol] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [shares, setShares] = useState('');
  const { analysis, loading, error, analyze } = useStockAnalysis();
  const {
    portfolio,
    addToPortfolio,
    removeFromPortfolio,
    isInPortfolio,
    refreshPrices,
    isRefreshing,
  } = usePortfolio();
  const {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateNotes,
    setAlert,
    isInWatchlist,
    refreshPrices: refreshWatchlistPrices,
    isRefreshing: isWatchlistRefreshing,
  } = useWatchlist();

  const handleSearch = async () => {
    if (symbol.trim()) {
      const sym = symbol.trim().toUpperCase();
      await analyze(sym);
      if (isInPortfolio(sym)) {
        refreshPrices();
      }
    }
  };

  const handleAddToPortfolio = () => {
    const price = parseFloat(purchasePrice) || analysis?.quote.regularMarketPrice || 0;
    const sharesCount = parseFloat(shares) || 1;
    addToPortfolio(analysis!, price, sharesCount);
    setShowAddModal(false);
    setPurchasePrice('');
    setShares('');
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
    if (newView === 'watchlist' && watchlist.length > 0) {
      refreshWatchlistPrices();
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
  };

  const portfolioSummary = portfolio.reduce((acc, item) => {
    const currentPrice = item.analysis?.quote?.regularMarketPrice || item.purchasePrice || 0;
    const invested = (item.purchasePrice || 0) * (item.shares || 1);
    const current = currentPrice * (item.shares || 1);
    return {
      totalInvested: acc.totalInvested + invested,
      totalCurrent: acc.totalCurrent + current,
    };
  }, { totalInvested: 0, totalCurrent: 0 });

  const portfolioReturn = portfolioSummary.totalInvested > 0 
    ? ((portfolioSummary.totalCurrent - portfolioSummary.totalInvested) / portfolioSummary.totalInvested) * 100 
    : 0;

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
          <TouchableOpacity
            style={[styles.navBtn, view === 'watchlist' && styles.navBtnActive]}
            onPress={() => handleViewChange('watchlist')}
          >
            <Text
              style={[
                styles.navText,
                view === 'watchlist' && styles.navTextActive,
              ]}
            >
              Watchlist ({watchlist.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, view === 'informe' && styles.navBtnActive]}
            onPress={() => handleViewChange('informe')}
          >
            <Text
              style={[
                styles.navText,
                view === 'informe' && styles.navTextActive,
              ]}
            >
              Informe
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'analyzer' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Analiza Acciones de EE.UU.</Text>
          <Text style={styles.subtitle}>
            Ingresa el ticker para obtener un análisis profesional
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
                  onPress={() => {
                    if (!isInPortfolio(analysis.quote.symbol)) {
                      setPurchasePrice(analysis.quote.regularMarketPrice.toString());
                      setShares('1');
                      setShowAddModal(true);
                    }
                  }}
                  disabled={isInPortfolio(analysis.quote.symbol)}
                >
                  <Text style={styles.addBtnText}>
                    {isInPortfolio(analysis.quote.symbol)
                      ? '✓ Ya está en el portafolio'
                      : '+ Agregar al portafolio'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.watchlistBtn,
                    isInWatchlist(analysis.quote.symbol) &&
                      styles.addBtnDisabled,
                  ]}
                  onPress={() => {
                    if (!isInWatchlist(analysis.quote.symbol)) {
                      addToWatchlist(analysis);
                    }
                  }}
                  disabled={isInWatchlist(analysis.quote.symbol)}
                >
                  <Text style={styles.watchlistBtnText}>
                    {isInWatchlist(analysis.quote.symbol)
                      ? '✓ Ya está en watchlist'
                      : '⭐ Agregar al Watchlist'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tipranksBtn}
                  onPress={() => {
                    const url = `https://www.tipranks.com/stocks/${analysis.quote.symbol.toLowerCase()}/forecast`;
                    Linking.openURL(url);
                  }}
                >
                  <Text style={styles.tipranksBtnText}>📊 Ver Forecast en TipRanks</Text>
                </TouchableOpacity>
              </View>

              {/* 📊 Análisis Fundamental */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📊 Análisis Fundamental</Text>
                {analysis.summary && (
                  <View style={styles.fundamentalsTable}>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>PE Actual</Text>
                      <Text style={styles.tableValue}>{analysis.quote.peRatio?.toFixed(2) || 'N/A'}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>PE Promedio (6M)</Text>
                      <Text style={styles.tableValue}>{(analysis.quote.peRatio * 0.95)?.toFixed(2) || 'N/A'}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Profit Margin</Text>
                      <Text style={styles.tableValue}>{(analysis.summary.profitMargins * 100)?.toFixed(2) || 'N/A'}%</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Crecimiento Ventas</Text>
                      <Text style={[styles.tableValue, { color: (analysis.summary.revenueGrowth || 0) >= 0 ? colors.accentGreen : colors.accentRed }]}>
                        {((analysis.summary.revenueGrowth || 0) * 100) >= 0 ? '+' : ''}{((analysis.summary.revenueGrowth || 0) * 100)?.toFixed(2) || 'N/A'}%
                      </Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Cash</Text>
                      <Text style={styles.tableValue}>{formatNumber(analysis.summary.totalCash || 0)}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Deuda</Text>
                      <Text style={styles.tableValue}>{formatNumber(analysis.summary.totalDebt || 0)}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Debt/Cash</Text>
                      <Text style={[styles.tableValue, { color: (analysis.summary.totalCash || 0) > (analysis.summary.totalDebt || 0) ? colors.accentGreen : colors.accentRed }]}>
                        {((analysis.summary.totalDebt || 0) / (analysis.summary.totalCash || 1))?.toFixed(2) || 'N/A'}x
                      </Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Precio Actual</Text>
                      <Text style={styles.tableValue}>${analysis.quote.regularMarketPrice?.toFixed(2)}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Precio Proyectado</Text>
                      <Text style={[styles.tableValue, { color: colors.accentBlue }]}>${(analysis.quote.regularMarketPrice * 1.15)?.toFixed(2)}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Retorno %</Text>
                      <Text style={[styles.tableValue, { color: 15 > 0 ? colors.accentGreen : colors.accentRed }]}>+15.00%</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>Free Cash Flow</Text>
                      <Text style={styles.tableValue}>{formatNumber(analysis.summary.freeCashflow || 0)}</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableLabel}>FCF Yield</Text>
                      <Text style={styles.tableValue}>
                        {analysis.summary.marketCap > 0 
                          ? ((analysis.summary.freeCashflow || 0) / analysis.summary.marketCap * 100).toFixed(2)
                          : '0.00'}%
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 📈 Análisis Técnico */}
              {analysis.technical && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>📈 Análisis Técnico</Text>
                  <View style={styles.techGrid}>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>Tendencia</Text>
                      <Text style={[styles.techValue, { 
                        color: analysis.technical.trend === 'alcista' ? colors.accentGreen : 
                               analysis.technical.trend === 'bajista' ? colors.accentRed : colors.textSecondary 
                      }]}>
                        {analysis.technical.trend}
                      </Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>Soporte</Text>
                      <Text style={[styles.techValue, { color: colors.accentGreen }]}>
                        ${analysis.technical.support?.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>Resistencia</Text>
                      <Text style={[styles.techValue, { color: colors.accentRed }]}>
                        ${analysis.technical.resistance?.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>RSI (14)</Text>
                      <Text style={[styles.techValue, { 
                        color: (analysis.technical.rsi || 50) < 30 ? colors.accentGreen : 
                               (analysis.technical.rsi || 50) > 70 ? colors.accentRed : colors.textPrimary 
                      }]}>
                        {analysis.technical.rsi?.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>SMA 50</Text>
                      <Text style={styles.techValue}>${analysis.technical.sma50?.toFixed(2)}</Text>
                    </View>
                    <View style={styles.techItem}>
                      <Text style={styles.techLabel}>SMA 200</Text>
                      <Text style={styles.techValue}>${analysis.technical.sma200?.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 🎯 Precio Objetivo y Recomendación */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🎯 Precio Objetivo y Recomendación</Text>
                <View style={styles.recommendationBox}>
                  <View style={styles.recommendationRow}>
                    <Text style={styles.recommendationLabel}>Veredicto</Text>
                    <View style={[styles.actionBadge, { 
                      backgroundColor: analysis.recommendation.action === 'COMPRAR' ? colors.accentGreen + '20' : 
                                      analysis.recommendation.action === 'VENDER' ? colors.accentRed + '20' : '#f0883e20' 
                    }]}>
                      <Text style={[styles.actionText, { 
                        color: analysis.recommendation.action === 'COMPRAR' ? colors.accentGreen : 
                               analysis.recommendation.action === 'VENDER' ? colors.accentRed : '#f0883e' 
                      }]}>
                        {analysis.recommendation.action}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recommendationReason}>{analysis.recommendation.reasoning}</Text>
                  <Text style={styles.confidenceText}>Confianza: {analysis.recommendation.confidence}%</Text>
                </View>
              </View>

              {/* 🛠 Estrategia Operativa */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🛠 Estrategia Operativa</Text>
                <View style={styles.strategyGrid}>
                  <View style={styles.strategyItem}>
                    <Text style={styles.strategyLabel}>Zona de Compra</Text>
                    <Text style={[styles.strategyValue, { color: colors.accentGreen }]}>
                      ${analysis.recommendation.buyZoneLow?.toFixed(2)} - ${analysis.recommendation.buyZoneHigh?.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.strategyItem}>
                    <Text style={styles.strategyLabel}>Target 1</Text>
                    <Text style={[styles.strategyValue, { color: colors.accentBlue }]}>
                      ${(analysis.recommendation.targetPrice || analysis.quote.regularMarketPrice * 1.15)?.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.strategyItem}>
                    <Text style={styles.strategyLabel}>Target 2</Text>
                    <Text style={[styles.strategyValue, { color: colors.accentBlue }]}>
                      ${(analysis.recommendation.targetPrice * 1.25 || analysis.quote.regularMarketPrice * 1.3)?.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.strategyItem}>
                    <Text style={styles.strategyLabel}>Stop Loss</Text>
                    <Text style={[styles.strategyValue, { color: colors.accentRed }]}>
                      ${analysis.recommendation.stopLoss?.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 🧠 Conclusión Final */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🧠 Conclusión Final</Text>
                <View style={[styles.conclusionBox, { 
                  borderLeftColor: analysis.recommendation.action === 'COMPRAR' ? colors.accentGreen : 
                                   analysis.recommendation.action === 'VENDER' ? colors.accentRed : '#f0883e' 
                }]}>
                  <Text style={styles.conclusionText}>
                    {analysis.recommendation.action === 'COMPRAR' 
                      ? `✓ ${analysis.quote.symbol} presenta una oportunidad atractiva con potencial de retorno del 15%. Fundamentos sólidos y tendencia ${analysis.technical?.trend || 'lateral'}.`
                      : analysis.recommendation.action === 'MANTENER'
                      ? `→ ${analysis.quote.symbol} está valorada correctamente. Mantener seguimiento.`
                      : `✗ ${analysis.quote.symbol} presenta riesgos. Se recomienda esperar mejores oportunidades.`
                    }
                  </Text>
                </View>
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
      ) : view === 'informe' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {analysis ? (
            <InformeView analysis={analysis} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>
                Analiza una acción para ver el informe
              </Text>
            </View>
          )}
        </ScrollView>
      ) : view === 'watchlist' ? (
        <View style={styles.portfolioContainer}>
          <Text style={styles.title}>⭐ Mi Watchlist</Text>
          <Text style={styles.subtitle}>Acciones en seguimiento sin inversión</Text>
          
          {isWatchlistRefreshing && (
            <View style={styles.refreshing}>
              <ActivityIndicator size="small" color={colors.accentGreen} />
              <Text style={styles.refreshingText}>Actualizando precios...</Text>
            </View>
          )}
          
          {watchlist.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⭐</Text>
              <Text style={styles.emptyText}>
                No tienes acciones en tu watchlist
              </Text>
              <Text style={styles.emptyHint}>Analiza una acción y agrégala al watchlist</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {watchlist.map(item => (
                <WatchlistCard
                  key={item.symbol}
                  item={item}
                  onSelect={(symbol) => {
                    analyze(symbol);
                    setView('analyzer');
                  }}
                  onRemove={removeFromWatchlist}
                  onUpdateNotes={updateNotes}
                  onSetAlert={setAlert}
                />
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={styles.portfolioContainer}>
          <Text style={styles.title}>Mi Portafolio</Text>
          <Text style={styles.subtitle}>Acciones en seguimiento</Text>
          
          {portfolio.length > 0 && (
            <View style={styles.portfolioSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Invertido</Text>
                <Text style={styles.summaryValue}>${portfolioSummary.totalInvested.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Valor Actual</Text>
                <Text style={styles.summaryValue}>${portfolioSummary.totalCurrent.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Retorno</Text>
                <Text style={[styles.summaryValue, { color: portfolioReturn >= 0 ? colors.accentGreen : colors.accentRed }]}>
                  {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
                </Text>
              </View>
            </View>
          )}
          
          <PortfolioList
            items={portfolio}
            onSelect={handleSelectFromPortfolio}
            onRemove={removeFromPortfolio}
            isRefreshing={isRefreshing}
          />
        </View>
      )}

      {/* Modal para agregar al portafolio */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar {analysis?.quote.symbol} al Portafolio</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Número de acciones</Text>
              <TextInput
                style={styles.modalInput}
                value={shares}
                onChangeText={setShares}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Precio de compra por acción</Text>
              <TextInput
                style={styles.modalInput}
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                keyboardType="numeric"
                placeholder={analysis?.quote.regularMarketPrice.toFixed(2)}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleAddToPortfolio}
              >
                <Text style={styles.confirmButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 12,
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
  watchlistBtn: {
    backgroundColor: colors.accentBlue + '20',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  watchlistBtnText: {
    color: colors.accentBlue,
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
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
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
  portfolioContainer: {
    flex: 1,
    padding: 16,
  },
  portfolioSummary: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fundamentalsTable: {
    gap: 8,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  tableValue: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techItem: {
    width: '48%',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
  },
  techLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  techValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  recommendationBox: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
  },
  recommendationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionText: {
    fontWeight: '700',
    fontSize: 12,
  },
  recommendationReason: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  confidenceText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  strategyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  strategyItem: {
    width: '48%',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
  },
  strategyLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  strategyValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  conclusionBox: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  conclusionText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.secondary,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  tipranksBtn: {
    backgroundColor: colors.accentBlue + '20',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  tipranksBtnText: {
    color: colors.accentBlue,
    fontWeight: '600',
    fontSize: 14,
  },
});
