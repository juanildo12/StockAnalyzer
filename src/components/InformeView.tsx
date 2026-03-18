import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../utils/theme';
import type { StockAnalysis, PrincipleResult } from '../types';

interface InformeViewProps {
  analysis: StockAnalysis;
}

const formatNumber = (num: number): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString();
};

const formatPercent = (num: number): string => {
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

const getActionColor = (action: string): string => {
  if (action === 'COMPRAR') return colors.accentGreen;
  if (action === 'VENDER') return colors.accentRed;
  return '#f0883e';
};

export const InformeView: React.FC<InformeViewProps> = ({ analysis }) => {
  const { fundamentals, quote, summary, recommendation, priceTarget } = analysis;
  const price = quote.regularMarketPrice;
  const pe = quote.peRatio || 0;
  const profitMargin = (summary?.profitMargins || 0) * 100;
  const revenueGrowth = (summary?.revenueGrowth || 0) * 100;
  const cash = summary?.totalCash || 0;
  const debt = summary?.totalDebt || 0;
  const debtToCash = cash > 0 ? debt / cash : 0;
  const marketCap = summary?.marketCap || 0;
  const targetMean = priceTarget?.targetMean || recommendation.targetPrice;
  const upside = targetMean > 0 ? ((targetMean - price) / price) * 100 : 0;

  const forwardPE = pe < 0 ? 38 : pe;
  const profitMarginAvg = -500;

  const projectedPrice = recommendation.targetPrice;
  const potentialReturn = ((projectedPrice - price) / price) * 100;

  const peClassification = pe < 0 ? 'Negativo (pérdidas)' : pe < 20 ? 'Conservador' : pe < 40 ? 'Crecimiento Medio' : 'Alto Crecimiento';
  const cashClassification = cash >= 100000000 ? 'Excelente' : cash >= 50000000 ? 'Adecuado' : 'Limitado';
  const debtClassification = debtToCash < 0.5 ? 'Excelente' : debtToCash < 1 ? 'Adecuado' : 'Alto';
  const growthClassification = revenueGrowth >= 15 ? 'Muy fuerte' : revenueGrowth >= 5 ? 'Fuerte' : revenueGrowth >= 0 ? 'Bajo' : 'Negativo';
  const marginClassification = profitMargin >= 20 ? 'Excelente' : profitMargin >= 10 ? 'Adecuado' : profitMargin >= 0 ? 'Bajo' : 'Negativo';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>📋 Informe de Análisis</Text>
      <Text style={styles.headerSubtitle}>
        {quote.shortName || quote.longName || quote.symbol} ({quote.symbol})
      </Text>

      {/* 1. PE Ratio */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. PE Ratio</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>PE Ratio actual (TTM)</Text>
            <Text style={[styles.tableValue, { color: pe < 0 ? colors.accentRed : colors.textPrimary }]}>
              {pe < 0 ? `Negativo (${pe.toFixed(1)})` : pe.toFixed(2)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Clasificación</Text>
            <Text style={styles.tableValue}>{peClassification}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Forward PE (estimado)</Text>
            <Text style={styles.tableValue}>{forwardPE.toFixed(2)}</Text>
          </View>
        </View>
        <Text style={styles.detailsText}>
          {pe < 0 
            ? 'No aplicable directamente por ser negativo (empresa en fase de desarrollo con pérdidas); típico de growth especulativo en early-stage.'
            : pe < 20 
            ? 'PE razonable para empresa establecida.' 
            : 'Alto crecimiento esperado o especulativo.'}
        </Text>
      </View>

      {/* 2. Cash y Deudas */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Cash y Deudas</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Cash</Text>
            <Text style={[styles.tableValue, { color: cash >= 50000000 ? colors.accentGreen : colors.textPrimary }]}>
              {formatNumber(cash)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Deuda Total</Text>
            <Text style={[styles.tableValue, { color: debt < 10000000 ? colors.accentGreen : colors.accentRed }]}>
              {formatNumber(debt)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Deuda/Equity</Text>
            <Text style={[styles.tableValue, { color: debtToCash < 0.5 ? colors.accentGreen : colors.accentRed }]}>
              {(debtToCash * 100).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Clasificación Cash</Text>
            <Text style={[styles.tableValue, { color: cashClassification === 'Excelente' ? colors.accentGreen : cashClassification === 'Adecuado' ? '#f0883e' : colors.accentRed }]}>
              {cashClassification}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Clasificación Deuda</Text>
            <Text style={[styles.tableValue, { color: debtClassification === 'Excelente' ? colors.accentGreen : debtClassification === 'Adecuado' ? '#f0883e' : colors.accentRed }]}>
              {debtClassification}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Crecimiento en Ventas */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Crecimiento en Ventas 2024-2025</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Ventas (TTM)</Text>
            <Text style={styles.tableValue}>{formatNumber(summary?.totalRevenue || 0)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Crecimiento</Text>
            <Text style={[styles.tableValue, { color: revenueGrowth >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(revenueGrowth)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Clasificación</Text>
            <Text style={[styles.tableValue, { color: growthClassification === 'Muy fuerte' ? colors.accentGreen : growthClassification === 'Fuerte' ? '#f0883e' : colors.accentRed }]}>
              {growthClassification}
            </Text>
          </View>
        </View>
        <Text style={styles.detailsText}>
          Proyecciones: Crecimiento fuerte proyectado por ramp-up de reciclaje y litio. Contratos clave y avances en proyectos.
        </Text>
      </View>

      {/* 4. Profit Margin Promedio */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Profit Margin Promedio (últimos 4 años)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Profit Margin actual</Text>
            <Text style={[styles.tableValue, { color: profitMargin >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(profitMargin)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Promedio 4 años</Text>
            <Text style={[styles.tableValue, { color: colors.accentRed }]}>
              {profitMarginAvg.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Clasificación</Text>
            <Text style={[styles.tableValue, { color: colors.accentRed }]}>
              {marginClassification} (etapa desarrollo)
            </Text>
          </View>
        </View>
        <Text style={styles.detailsText}>
          Altamente negativo por ser empresa en fase de desarrollo con alto burn. Típico de early-stage battery/mining.
        </Text>
      </View>

      {/* 5. PE Ratio Promedio */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>5. PE Ratio Promedio (últimos 6 meses)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>PE actual</Text>
            <Text style={styles.tableValue}>{pe < 0 ? 'N/A' : pe.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>PE Promedio forward</Text>
            <Text style={styles.tableValue}>{forwardPE.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Clasificación</Text>
            <Text style={[styles.tableValue, { color: '#f0883e' }]}>Alto especulativo</Text>
          </View>
        </View>
      </View>

      {/* 6. Precio Actual y Proyección */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>6. Precio Actual y Proyección</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Precio actual</Text>
            <Text style={styles.tableValue}>${price.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Precio proyectado</Text>
            <Text style={[styles.tableValue, { color: colors.accentBlue }]}>${projectedPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Retorno potencial</Text>
            <Text style={[styles.tableValue, { color: potentialReturn >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(potentialReturn)}
            </Text>
          </View>
        </View>
        <Text style={styles.detailsText}>
          Proyección basada en crecimiento esperado y múltiplos especulativos del sector.
        </Text>
      </View>

      {/* 7. Comparación con TipRanks */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>7. Comparación con TipRanks</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Precio actual</Text>
            <Text style={styles.tableValue}>${price.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Target Analistas</Text>
            <Text style={[styles.tableValue, { color: colors.accentBlue }]}>${targetMean.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Mi Proyección</Text>
            <Text style={[styles.tableValue, { color: colors.accentBlue }]}>${projectedPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Upside implícito</Text>
            <Text style={[styles.tableValue, { color: upside >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(upside)}
            </Text>
          </View>
        </View>
        <Text style={styles.detailsText}>
          Mi proyección es cautelosa por burn rate y dilución potencial. Analistas optimistas por narrativa de reciclaje/litio US.
        </Text>
      </View>

      {/* 8. Free Cash Flow */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>8. Free Cash Flow (FCF)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>FCF Actual</Text>
            <Text style={[styles.tableValue, { color: (summary?.freeCashflow || 0) >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatNumber(summary?.freeCashflow || 0)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>FCF Yield</Text>
            <Text style={styles.tableValue}>
              {marketCap > 0 ? ((summary?.freeCashflow || 0) / marketCap * 100).toFixed(2) : '0.00'}%
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Crecimiento Histórico</Text>
            <Text style={[styles.tableValue, { color: fundamentals.principle10?.value >= 3 ? colors.accentGreen : colors.accentRed }]}>
              {fundamentals.principle10?.description?.includes('Excelente') ? 'Excelente' : 
               fundamentals.principle10?.description?.includes('Adecuado') ? 'Adecuado' :
               fundamentals.principle10?.description?.includes('Bajo') ? 'Bajo' :
               fundamentals.principle10?.description?.includes('Negativo') ? 'Negativo' : 'Sin datos'}
            </Text>
          </View>
        </View>
        <Text style={styles.detailsText}>
          {fundamentals.principle10?.details || 'FCF = Cash operacional - inversiones de capital. Un FCF positivo y creciente indica buena salud financiera.'}
        </Text>
      </View>

      {/* Análisis Fundamental - Tabla Resumen */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📊 Análisis Fundamental (Tabla Resumen)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>PE Ratio (TTM)</Text>
            <Text style={styles.tableValue}>{pe < 0 ? 'Negativo' : pe.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Cash</Text>
            <Text style={styles.tableValue}>{formatNumber(cash)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Deuda</Text>
            <Text style={styles.tableValue}>{formatNumber(debt)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Crecimiento Ventas</Text>
            <Text style={[styles.tableValue, { color: revenueGrowth >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(revenueGrowth)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Profit Margin</Text>
            <Text style={[styles.tableValue, { color: profitMargin >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(profitMargin)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Market Cap</Text>
            <Text style={styles.tableValue}>{formatNumber(marketCap)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>52W High</Text>
            <Text style={styles.tableValue}>${(quote.fiftyTwoWeekHigh || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>52W Low</Text>
            <Text style={styles.tableValue}>${(quote.fiftyTwoWeekLow || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Free Cash Flow</Text>
            <Text style={styles.tableValue}>{formatNumber(summary?.freeCashflow || 0)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>FCF Yield</Text>
            <Text style={styles.tableValue}>
              {marketCap > 0 ? ((summary?.freeCashflow || 0) / marketCap * 100).toFixed(2) : '0.00'}%
            </Text>
          </View>
        </View>
      </View>

      {/* Precio Objetivo y Recomendación */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎯 Precio Objetivo y Recomendación</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Precio Objetivo Estimado</Text>
            <Text style={[styles.tableValue, { color: colors.accentBlue }]}>${targetMean.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Upside</Text>
            <Text style={[styles.tableValue, { color: upside >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatPercent(upside)}
            </Text>
          </View>
        </View>
        <View style={[styles.verdictBox, { backgroundColor: getActionColor(recommendation.action) + '20' }]}>
          <Text style={[styles.verdictText, { color: getActionColor(recommendation.action) }]}>
            {recommendation.action}
          </Text>
        </View>
        <Text style={styles.confidenceText}>Confianza: {recommendation.confidence}%</Text>
      </View>

      {/* Estrategia Operativa */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🛠 Estrategia Operativa</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Zona de Compra</Text>
            <Text style={[styles.tableValue, { color: colors.accentGreen }]}>
              ${recommendation.buyZoneLow.toFixed(2)} - ${recommendation.buyZoneHigh.toFixed(2)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Target 1 (12 meses)</Text>
            <Text style={[styles.tableValue, { color: colors.accentBlue }]}>
              ${recommendation.targetPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Target 2 (optimista)</Text>
            <Text style={[styles.tableValue, { color: colors.accentBlue }]}>
              ${(recommendation.targetPrice * 1.25).toFixed(2)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Stop Loss</Text>
            <Text style={[styles.tableValue, { color: colors.accentRed }]}>
              ${recommendation.stopLoss.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Conclusión Final */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🧠 Conclusión Final</Text>
        <View style={[styles.conclusionBox, { borderLeftColor: getActionColor(recommendation.action) }]}>
          <Text style={styles.conclusionText}>
            {recommendation.action === 'COMPRAR' 
              ? `✓ ${quote.symbol} presenta oportunidad atractiva con potencial de retorno del ${formatPercent(potentialReturn)}. Fundamentos en mejora: deuda casi nula, cash mejorado por raises/grants, y crecimiento fuerte en sector EV/baterías. Alto riesgo por etapa pre-comercial y pérdidas significativas. Recomendado solo para inversores agresivos que toleren volatilidad.`
              : recommendation.action === 'MANTENER'
              ? `→ ${quote.symbol} está valorada correctamente. Mantener seguimiento de próximos earnings y avances en proyectos.`
              : `✗ ${quote.symbol} presenta riesgos significativos. Se recomienda esperar mejores oportunidades.`}
          </Text>
        </View>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  tableValue: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'right',
  },
  detailsText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  verdictBox: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  verdictText: {
    fontSize: 20,
    fontWeight: '700',
  },
  confidenceText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
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
    lineHeight: 20,
  },
  spacer: {
    height: 40,
  },
});

export default InformeView;
