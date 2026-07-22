'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import { 
  savePortfolioToFirestore, 
  getPortfolioFromFirestore, 
  updatePortfolioItem,
  removePortfolioItem,
  PortfolioItem,
  getWatchlistFromFirestore,
  updateWatchlistItem,
  removeWatchlistItem,
  WatchlistItem,
  saveUserEmail
} from '@/src/services/firebase';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
import TradeValidator from '@/components/TradeValidator';
import TradeStationPanel from '@/components/TradeStationPanel';
import Dashboard from '@/components/Dashboard';
import AICoach from '@/components/AICoach';
import BacktestPanel from '@/components/BacktestPanel';
import ScreenerGraham from '@/components/ScreenerGraham';
import ScreenerPage from '@/app/screener/page';
import TradingTrainer from '@/components/TradingTrainer';
import StockDetailPanel from '@/components/StockDetailPanel';
import SmartAlertsPanel from '@/components/SmartAlertsPanel';
import { colors as C, radius as R, font as F, shadow, transition as T } from '@/src/utils/webTheme';


interface StockQuote {
  symbol: string;
  shortName: string;
  longName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  targetMeanPrice: number;
  marketCap: number;
  peRatio: number;
}

const LOCAL_WATCHLIST_KEY = 'local-watchlist';
const LOCAL_PORTFOLIO_KEY = 'local-portfolio';

interface Summary {
  totalCash: number;
  totalDebt: number;
  debtToCash: number;
  profitMargins: number;
  profitMarginsPercent: number;
  avgProfitMargin: number;
  revenueGrowth: number;
  revenueGrowthPercent: number;
  peRatio: number;
  avgPe6Months: number;
  projectedPrice: number;
  potentialReturn: number;
  targetMeanPrice: number;
  targetHighPrice: number;
  targetLowPrice: number;
  buyZoneLow: number;
  buyZoneHigh: number;
  target1: number;
  target2: number;
  stopLoss: number;
  verdict: string;
  cashClassification: string;
  debtClassification: string;
  totalRevenue: number;
  freeCashflow: number;
}

interface Technical {
  rsi: number;
  sma50: number;
  sma200: number;
  trend: string;
  support: number;
  resistance: number;
  signal: string;
}

interface Recommendation {
  action: string;
  confidence: number;
  reasoning: string;
  buyZoneLow: number;
  buyZoneHigh: number;
  targetPrice: number;
  stopLoss: number;
}

interface InformeDetail {
  company: {
    name: string;
    symbol: string;
    description: string;
    sector: string;
    industry: string;
    riskLevel: string;
  };
  dataKey?: {
    price: string;
    marketCap: string;
    sharesOutstanding: string;
    lastUpdated: string;
  };
  peRatio: {
    current: string;
    currentValue: number;
    classification: string;
    classificationDetail: string;
    forward: string;
    forwardValue: number;
  };
  cashDebt: {
    cash: string;
    cashValue: number;
    debt: string;
    debtValue: number;
    debtToEquity: string;
    debtToEquityValue: number;
    cashClassification: string;
    cashClassificationDetail: string;
    debtClassification: string;
    debtClassificationDetail: string;
  };
  growth: {
    current: string;
    currentValue: number;
    projection: string;
    momentum: string;
    classification: string;
    classificationDetail: string;
  };
  profitMargin: {
    current: string;
    currentValue: number;
    average4Years: string;
    average4YearsValue: number;
    forward: string;
    classification: string;
    classificationDetail: string;
  };
  peAverage: {
    historical: string;
    forward: string;
    forwardValue: number;
    classification: string;
  };
  projection: {
    currentPrice: string;
    forwardRevenue: string;
    calculation: string;
    returnRange: string;
    returnMin: number;
    returnMax: number;
    note: string;
  };
  tipRanks: {
    priceTarget: string;
    priceTargetValue: number;
    upside: string;
    upsideValue: number;
    consensus: string;
    analystsCount: number;
    discrepancy: string;
  };
  summaryTable: {
    rows: { metric: string; value: string; classification: string }[];
  };
  priceTargetSection: {
    target: string;
    recommendation: string;
  };
  strategy: {
    verdict: string;
    verdictAction: string;
    buyZone: string;
    buyZoneLow: number;
    buyZoneHigh: number;
    target1: string;
    target1Value: number;
    target2: string;
    target2Value: number;
    stopLoss: string;
    stopLossValue: number;
  };
  conclusion: string;
}

interface ApiResponse {
  quote: StockQuote;
  summary: Summary;
  technical: Technical;
  recommendation: Recommendation;
  informeDetail?: InformeDetail;
  fundamentals?: Record<string, any>;
}

function RenderInforme({ informe, data }: { informe: InformeDetail; data?: any }) {
  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const getActionColor = (action: string) => {
    if (action === 'COMPRAR') return C.positive;
    if (action === 'VENDER') return C.negative;
    return C.warning;
  };
  
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: C.textPrimary, marginBottom: '8px' }}>📋 Análisis Fundamental de {informe.company.name} ({informe.company.symbol})</h2>
        <p style={{ color: C.textMuted, fontSize: F.sizeMd }}>{informe.company.sector} - Riesgo {informe.company.riskLevel}</p>
      </div>

      {/* Datos Clave */}
      {informe.dataKey && (
        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '16px', marginBottom: '16px', borderLeft: `4px solid ${C.accentLight}` }}>
          <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeBase, fontWeight: '600' }}>Datos clave (actualizados a {informe.dataKey.lastUpdated}):</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>Precio actual</p>
              <p style={{ margin: '4px 0 0', fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary }}>{informe.dataKey.price}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>Market Cap</p>
              <p style={{ margin: '4px 0 0', fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary }}>{informe.dataKey.marketCap}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>Acciones</p>
              <p style={{ margin: '4px 0 0', fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary }}>{informe.dataKey.sharesOutstanding}</p>
            </div>
          </div>
        </div>
      )}

      {informe.company.description && (
        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
          <p style={{ color: C.textSecondary, fontSize: F.sizeMd, lineHeight: '1.6', margin: 0 }}>
            {informe.company.description}
          </p>
        </div>
      )}

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>1. PE Ratio</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>PE Ratio actual (TTM)</td>
              <td style={{ padding: '8px 0', color: informe.peRatio.currentValue < 0 ? C.negative : C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.peRatio.current}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.peRatio.classification}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Forward PE</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.peRatio.forward}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: C.textMuted, fontSize: F.sizeSm, marginTop: '8px' }}>{informe.peRatio.classificationDetail}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>2. Cash y Deudas</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Cash</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.cashDebt.cash}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Deuda Total</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.cashDebt.debt}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Deuda/Equity</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.cashDebt.debtToEquity}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>Cash: {informe.cashDebt.cashClassification} | Deuda: {informe.cashDebt.debtClassification}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: C.textMuted, fontSize: F.sizeSm, marginTop: '8px' }}>{informe.cashDebt.cashClassificationDetail}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>3. Crecimiento en Ventas 2024-2025</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Crecimiento actual</td>
              <td style={{ padding: '8px 0', color: informe.growth.currentValue >= 0 ? C.positive : C.negative, textAlign: 'right', fontWeight: '600' }}>{informe.growth.current}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.growth.classification}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Proyección</td>
              <td style={{ padding: '8px 0', color: C.accentLight, textAlign: 'right', fontWeight: '600' }}>{informe.growth.projection}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: C.textMuted, fontSize: F.sizeSm, marginTop: '8px' }}>{informe.growth.momentum}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>4. Profit Margin Promedio (últimos 4 años)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Profit Margin actual</td>
              <td style={{ padding: '8px 0', color: informe.profitMargin.currentValue >= 0 ? C.positive : C.negative, textAlign: 'right', fontWeight: '600' }}>{informe.profitMargin.current}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Promedio 4 años</td>
              <td style={{ padding: '8px 0', color: C.negative, textAlign: 'right', fontWeight: '600' }}>{informe.profitMargin.average4Years}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: C.negative, textAlign: 'right', fontWeight: '600' }}>{informe.profitMargin.classification}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: C.textMuted, fontSize: F.sizeSm, marginTop: '8px' }}>{informe.profitMargin.classificationDetail}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>5. PE Ratio Promedio (últimos 6 meses)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Histórico</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.peAverage.historical}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Forward</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.peAverage.forward}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>6. Precio Actual y Proyección</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Precio actual</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.projection.currentPrice}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Ventas forward</td>
              <td style={{ padding: '8px 0', color: C.accentLight, textAlign: 'right', fontWeight: '600' }}>{informe.projection.forwardRevenue}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Retorno potencial</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.projection.returnRange}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: C.textMuted, fontSize: F.sizeSm, marginTop: '8px' }}>{informe.projection.note}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>7. Comparación con TipRanks</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Price Target</td>
              <td style={{ padding: '8px 0', color: C.accentLight, textAlign: 'right', fontWeight: '600' }}>{informe.tipRanks.priceTarget}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Upside</td>
              <td style={{ padding: '8px 0', color: informe.tipRanks.upsideValue >= 0 ? C.positive : C.negative, textAlign: 'right', fontWeight: '600' }}>{informe.tipRanks.upside}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Consenso</td>
              <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{informe.tipRanks.consensus} ({informe.tipRanks.analystsCount} analistas)</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: C.textMuted, fontSize: F.sizeSm, marginTop: '8px' }}>{informe.tipRanks.discrepancy}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>📊 Análisis Fundamental (Tabla Resumen)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {informe.summaryTable.rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 0', color: C.textMuted }}>{row.metric}</td>
                <td style={{ padding: '8px 0', color: C.textPrimary, textAlign: 'right', fontWeight: '600' }}>{row.value}</td>
              </tr>
            ))}
            {data?.summary?.freeCashflow && (
              <>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 0', color: C.textMuted }}>Free Cash Flow</td>
                  <td style={{ padding: '8px 0', color: C.positive, textAlign: 'right', fontWeight: '600' }}>{formatNumber(data.summary.freeCashflow)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: C.textMuted }}>FCF Yield</td>
                  <td style={{ padding: '8px 0', color: ((data.summary.freeCashflow || 0) / (data.summary.marketCap || 1) * 100) >= 3 ? C.positive : C.negative, textAlign: 'right', fontWeight: '600' }}>
                    {(((data.summary.freeCashflow || 0) / (data.summary.marketCap || 1) * 100)).toFixed(2)}%
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>🎯 Precio Objetivo y Recomendación</h3>
        <div style={{ marginTop: '12px', padding: '14px', borderRadius: R.md, background: getActionColor(informe.strategy.verdictAction) + '20', textAlign: 'center' }}>
          <span style={{ color: getActionColor(informe.strategy.verdictAction), fontWeight: 'bold', fontSize: F.sizeXxl }}>{informe.strategy.verdictAction}</span>
        </div>
        <p style={{ color: C.textSecondary, fontSize: F.sizeMd, marginTop: '12px', textAlign: 'center' }}>{informe.priceTargetSection.recommendation}</p>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>🛠 Estrategia Operativa</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Zona de Compra</td>
              <td style={{ padding: '8px 0', color: C.positive, textAlign: 'right', fontWeight: '600' }}>{informe.strategy.buyZone}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Target 1</td>
              <td style={{ padding: '8px 0', color: C.accentLight, textAlign: 'right', fontWeight: '600' }}>{informe.strategy.target1}</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Target 2</td>
              <td style={{ padding: '8px 0', color: C.accentLight, textAlign: 'right', fontWeight: '600' }}>{informe.strategy.target2}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: C.textMuted }}>Stop Loss</td>
              <td style={{ padding: '8px 0', color: C.negative, textAlign: 'right', fontWeight: '600' }}>{informe.strategy.stopLoss}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: F.sizeLg, fontWeight: '600' }}>🧠 Conclusión Final</h3>
        <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${getActionColor(informe.strategy.verdictAction)}` }}>
          <p style={{ margin: 0, color: C.textSecondary, fontSize: F.sizeBase, lineHeight: '1.6' }}>{informe.conclusion}</p>
        </div>
      </div>
    </>
  );
}

function RenderInformeLegacy({ data, formatNumber, getActionColor }: { 
  data: ApiResponse; 
  formatNumber: (n: number) => string;
  getActionColor: (a: string) => string;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px', color: C.textMuted }}>
      <p>El informe detallado no está disponible para este ticker.</p>
      <p style={{ fontSize: F.sizeSm }}>Intenta analizar otro ticker para ver el nuevo formato.</p>
    </div>
  );
}

export default function Home() {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<{symbol: string; name: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'briefing' | 'analyzer' | 'portfolio' | 'watchlist' | 'informe' | 'risk-report' | 'framework' | 'options' | 'trade-validator' | 'tradestation' | 'screener' | 'dashboard' | 'ai-coach' | 'backtest' | 'inversor-inteligente' | 'trading-trainer' | 'alerts'>('analyzer');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [addForm, setAddForm] = useState({ 
    shares: '', 
    price: '', 
    date: new Date().toISOString().split('T')[0],
    notes: '',
    targetPrice: ''
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const searchParams = useSearchParams();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistPrices, setWatchlistPrices] = useState<{ [key: string]: { price: number; change: number; changePercent: number } }>({});
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [watchlistForm, setWatchlistForm] = useState({
    symbol: '',
    alertPrice: '',
    alertType: 'above' as 'above' | 'below',
    alertEnabled: true,
  });
  const [watchlistError, setWatchlistError] = useState('');
  const [editingAlert, setEditingAlert] = useState<{[key: string]: { alertType: 'above' | 'below'; alertPrice: number; alertEnabled: boolean; alertPriceInput: number }}>({});
  const [savingAlert, setSavingAlert] = useState<string | null>(null);
  const [dailyAnalysisCount, setDailyAnalysisCount] = useState(0);

  const { data: session, status } = useSession();

  useEffect(() => {
    let active = true;
    if (session?.user?.email) {
      saveUserEmail(session.user.email, session.user.email);
    }
    const loadAll = async () => {
      if (session?.user?.email) {
        try {
          const items = await getPortfolioFromFirestore(session.user.email);
          if (active) setPortfolio(items);
        } catch (error) {
          console.error('Error loading portfolio:', error);
        }
        try {
          const items = await getWatchlistFromFirestore(session.user.email);
          if (active) {
            setWatchlist(items);
            setWatchlistError('');
          }
          if (active && items.length > 0) fetchWatchlistPrices(items.map(w => w.symbol));
        } catch (error) {
          console.error('Error loading watchlist:', error);
        }
      } else {
        const pLocal = localStorage.getItem(LOCAL_PORTFOLIO_KEY);
        if (pLocal && active) setPortfolio(JSON.parse(pLocal) as PortfolioItem[]);
        const wLocal = localStorage.getItem(LOCAL_WATCHLIST_KEY);
        if (wLocal && active) {
          const items = JSON.parse(wLocal) as WatchlistItem[];
          setWatchlist(items);
          setWatchlistError('');
          if (items.length > 0) fetchWatchlistPrices(items.map(w => w.symbol));
        }
      }
    };
    loadAll();
    try {
      const raw = localStorage.getItem('prospector_daily_analyses');
      if (raw) {
        const saved = JSON.parse(raw) as { count: number; date: string };
        const today = new Date().toISOString().slice(0, 10);
        if (active && saved.date === today) setDailyAnalysisCount(saved.count);
      }
    } catch {}
    return () => { active = false; };
  }, [session]);

  // Daily refresh of watchlist prices at 8PM Bolivia time (UTC-4)
  useEffect(() => {
    const msTo8PM = (): number => {
      const now = new Date();
      const laPazStr = now.toLocaleString('en-US', { timeZone: 'America/La_Paz' });
      const laPaz = new Date(laPazStr);
      const target = new Date(laPaz);
      target.setHours(20, 0, 0, 0);
      if (target <= laPaz) target.setDate(target.getDate() + 1);
      return target.getTime() - laPaz.getTime();
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(async () => {
        const syms = watchlist.map(w => w.symbol);
        if (syms.length > 0) await fetchWatchlistPrices(syms);
        schedule();
      }, msTo8PM());
    };

    if (watchlist.length > 0) schedule();
    return () => { if (timer) clearTimeout(timer); };
  }, [watchlist.length]);

  const loadPortfolio = async () => {
    if (session?.user?.email) {
      try {
        const items = await getPortfolioFromFirestore(session.user.email);
        setPortfolio(items);
      } catch (error) {
        console.error('Error loading portfolio:', error);
      }
    } else {
      const local = localStorage.getItem(LOCAL_PORTFOLIO_KEY);
      if (local) {
        const items = JSON.parse(local) as PortfolioItem[];
        setPortfolio(items);
      }
    }
  };

  const loadWatchlist = async () => {
    if (session?.user?.email) {
      try {
        const items = await getWatchlistFromFirestore(session.user.email);
        setWatchlist(items);
        setWatchlistError('');
        if (items.length > 0) {
          fetchWatchlistPrices(items.map(w => w.symbol));
        }
      } catch (error) {
        console.error('Error loading watchlist:', error);
      }
    } else {
      const local = localStorage.getItem(LOCAL_WATCHLIST_KEY);
      if (local) {
        const items = JSON.parse(local) as WatchlistItem[];
        setWatchlist(items);
        setWatchlistError('');
        if (items.length > 0) {
          fetchWatchlistPrices(items.map(w => w.symbol));
        }
      }
    }
  };

  const fetchWatchlistPrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    
    try {
      const response = await fetch(`/api/stock?symbols=${symbols.join(',')}`);
      
      if (!response.ok) {
        throw new Error('Error fetching prices');
      }
      
      const result = await response.json();
      
      if (result.quotes && result.quotes.length > 0) {
        const prices: { [key: string]: { price: number; change: number; changePercent: number } } = {};
        result.quotes.forEach((quote: any) => {
          prices[quote.symbol] = {
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent
          };
        });
        setWatchlistPrices(prices);
        setWatchlistError('');
      } else if (result.error) {
        setWatchlistError('Error al cargar precios');
      }
    } catch (error) {
      console.error('Error fetching watchlist prices:', error);
      setWatchlistError('No se pudieron cargar los precios');
    }
  };

  const openWatchlistModal = (symbol: string, currentPrice?: number) => {
    setWatchlistForm({
      symbol: symbol.toUpperCase(),
      alertPrice: currentPrice ? currentPrice.toString() : '',
      alertType: 'above',
      alertEnabled: true,
    });
    setShowWatchlistModal(true);
  };

  const handleAddToWatchlist = async () => {
    if (!watchlistForm.symbol) return;
    
    const newItem: WatchlistItem = {
      symbol: watchlistForm.symbol.toUpperCase(),
      addedAt: new Date().toISOString(),
      alertEnabled: watchlistForm.alertEnabled,
      alertPrice: parseFloat(watchlistForm.alertPrice) || 0,
      alertType: watchlistForm.alertType,
    };

    // Always use localStorage (Firebase has permission issues)
    const local = localStorage.getItem(LOCAL_WATCHLIST_KEY);
    const items = local ? JSON.parse(local) : [];
    if (!items.some((w: WatchlistItem) => w.symbol === newItem.symbol)) {
      items.push(newItem);
      localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(items));
      setWatchlist(items);
      fetchWatchlistPrices(items.map((w: WatchlistItem) => w.symbol));
    }
    setShowWatchlistModal(false);
  };

  const updateWatchlistAlert = async (symbol: string, alertPrice: number, alertEnabled: boolean, alertType: 'above' | 'below') => {
    if (session?.user?.email) {
      try {
        await updateWatchlistItem(session.user.email, symbol, {
          alertPrice,
          alertEnabled,
          alertType
        });
        await loadWatchlist();
      } catch (error) {
        console.error('Error updating watchlist alert:', error);
      }
    } else {
      const local = localStorage.getItem(LOCAL_WATCHLIST_KEY);
      if (local) {
        const items = JSON.parse(local) as WatchlistItem[];
        const index = items.findIndex(w => w.symbol === symbol);
        if (index !== -1) {
          items[index] = { ...items[index], alertPrice, alertEnabled, alertType };
          localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(items));
          setWatchlist(items);
        }
      }
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    if (session?.user?.email) {
      try {
        await removeWatchlistItem(session.user.email, symbol);
        await loadWatchlist();
      } catch (error) {
        console.error('Error removing from watchlist:', error);
      }
    } else {
      const local = localStorage.getItem(LOCAL_WATCHLIST_KEY);
      if (local) {
        const items = JSON.parse(local) as WatchlistItem[];
        const filtered = items.filter(w => w.symbol !== symbol);
        localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(filtered));
        setWatchlist(filtered);
        const prices = { ...watchlistPrices };
        delete prices[symbol];
        setWatchlistPrices(prices);
      }
    }
  };

  const isInWatchlist = (symbol: string) => {
    return watchlist.some(w => w.symbol === symbol.toUpperCase());
  };

  const savePortfolio = async (items: PortfolioItem[]) => {
    if (!session?.user?.email) return;
    setPortfolio(items);
    try {
      await savePortfolioToFirestore(session.user.email, items);
    } catch (error) {
      console.error('Error saving portfolio:', error);
    }
  };

  const fetchSuggestions = async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${query}`);
      const json = await res.json();
      setSuggestions(json.results || []);
    } catch (e) {
      setSuggestions([]);
    }
  };

  const searchStock = async (symToSearch?: string) => {
    const sym = (symToSearch || symbol).trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`/api/stock?symbol=${sym}`);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error fetching data');
      }

      const json = await res.json();

      if (!json.quote) {
        throw new Error('Symbol not found');
      }

      setData({
        quote: json.quote,
        summary: json.summary,
        technical: json.technical,
        recommendation: json.recommendation,
        informeDetail: json.informeDetail,
        fundamentals: json.fundamentals,
      });
      const today = new Date().toISOString().slice(0, 10);
      try {
        const raw = localStorage.getItem('prospector_daily_analyses');
        const saved = raw ? JSON.parse(raw) as { count: number; date: string } : { count: 0, date: '' };
        const newCount = saved.date === today ? saved.count + 1 : 1;
        localStorage.setItem('prospector_daily_analyses', JSON.stringify({ count: newCount, date: today }));
        setDailyAnalysisCount(newCount);
      } catch {}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const urlSymbol = searchParams?.get('symbol');
    if (urlSymbol && view === 'analyzer') {
      const upperSymbol = urlSymbol.toUpperCase();
      if (upperSymbol !== symbol) {
        setSymbol(upperSymbol);
      }
      if (!data || data?.quote?.symbol !== upperSymbol) {
        (async () => {
          setLoading(true);
          setError('');
          try {
            const res = await fetch(`/api/stock?symbol=${encodeURIComponent(upperSymbol)}`);
            const json = await res.json();
            if (cancelled) return;
            if (!json.quote) throw new Error('Symbol not found');
            setData({
              quote: json.quote, summary: json.summary,
              technical: json.technical, recommendation: json.recommendation,
              informeDetail: json.informeDetail, fundamentals: json.fundamentals,
            });
          } catch (e: any) {
            if (!cancelled) setError(e.message);
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();
      }
    }
    return () => { cancelled = true; };
  }, [searchParams, view]);

  const addToPortfolio = async () => {
    if (!data || !addForm.shares) return;
    
    const price = addForm.price ? parseFloat(addForm.price) : data.quote.regularMarketPrice;
    
    const newItem: PortfolioItem = {
      symbol: data.quote.symbol,
      purchasePrice: price,
      shares: parseFloat(addForm.shares),
      purchaseDate: addForm.date || new Date().toISOString().split('T')[0],
      currentPrice: data.quote.regularMarketPrice,
      notes: addForm.notes || undefined,
      targetPrice: addForm.targetPrice ? parseFloat(addForm.targetPrice) : undefined,
    };

    try {
      // Always use localStorage for now (Firebase has permission issues)
      const localData = localStorage.getItem(LOCAL_PORTFOLIO_KEY);
      const items: PortfolioItem[] = localData ? JSON.parse(localData) : [];
      items.push(newItem);
      localStorage.setItem(LOCAL_PORTFOLIO_KEY, JSON.stringify(items));
      setPortfolio(items);
      setShowAddModal(false);
      setAddForm({ shares: '', price: '', date: new Date().toISOString().split('T')[0], notes: '', targetPrice: '' });
    } catch (error) {
      console.error('Error adding to portfolio:', error);
    }
  };

  const removeFromPortfolio = async (sym: string) => {
    try {
      if (session?.user?.email) {
        const updatedPortfolio = await removePortfolioItem(session.user.email, sym);
        setPortfolio(updatedPortfolio);
      } else {
        const local = localStorage.getItem(LOCAL_PORTFOLIO_KEY);
        if (local) {
          const items: PortfolioItem[] = JSON.parse(local);
          const filtered = items.filter(item => item.symbol !== sym);
          localStorage.setItem(LOCAL_PORTFOLIO_KEY, JSON.stringify(filtered));
          setPortfolio(filtered);
        }
      }
    } catch (error) {
      console.error('Error removing from portfolio:', error);
    }
  };

  const openEditModal = (item: PortfolioItem) => {
    setEditingItem(item);
    setAddForm({
      shares: item.shares.toString(),
      price: item.purchasePrice.toString(),
      date: item.purchaseDate,
      notes: item.notes || '',
      targetPrice: item.targetPrice?.toString() || ''
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingItem || !addForm.shares || !session?.user?.email) return;
    
    const updates: Partial<PortfolioItem> = {
      shares: parseFloat(addForm.shares),
      purchasePrice: parseFloat(addForm.price),
      purchaseDate: addForm.date,
      notes: addForm.notes || undefined,
      targetPrice: addForm.targetPrice ? parseFloat(addForm.targetPrice) : undefined
    };

    try {
      const updatedPortfolio = await updatePortfolioItem(session.user.email, editingItem.symbol, updates);
      setPortfolio(updatedPortfolio);
      setShowEditModal(false);
      setEditingItem(null);
      setAddForm({ shares: '', price: '', date: new Date().toISOString().split('T')[0], notes: '', targetPrice: '' });
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
  };

  const getActionColor = (action: string) => {
    if (action === 'COMPRAR') return C.positive;
    if (action === 'VENDER') return C.negative;
    return C.warning;
  };

  const portfolioSummary = portfolio.reduce((acc, item) => {
    const invested = item.purchasePrice * item.shares;
    const current = (item.currentPrice || item.purchasePrice) * item.shares;
    return {
      totalInvested: acc.totalInvested + invested,
      totalCurrent: acc.totalCurrent + current,
      profitLoss: 0,
    };
  }, { totalInvested: 0, totalCurrent: 0, profitLoss: 0 });
  portfolioSummary.profitLoss = portfolioSummary.totalCurrent - portfolioSummary.totalInvested;

  const portfolioReturn = portfolioSummary.totalInvested > 0 
    ? (portfolioSummary.profitLoss / portfolioSummary.totalInvested) * 100 
    : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', maxWidth: '100%', background: C.bg, color: C.textSecondary, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {!isMobile && <Sidebar view={view} onViewChange={setView} userPlan={(session?.user as any)?.plan || 'free'} userName={session?.user?.name || session?.user?.email?.split('@')[0] || 'User'} />}
      <div style={{ flex: 1, minWidth: 0, width: '100%', maxWidth: '100%', marginLeft: isMobile ? 0 : 220, display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${C.border}`, background: C.bg, position: isMobile ? 'sticky' : undefined, top: 0, zIndex: isMobile ? 100 : undefined }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen}
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: F.sizeXxl }}>
              {menuOpen ? '✕' : '☰'}
            </button>
            <div style={{ width: '32px', height: '32px', borderRadius: R.lg, background: `linear-gradient(135deg, ${C.accent} 0%, #6366F1 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: F.sizeLg, fontWeight: '700', color: C.textPrimary }}>P</div>
            <h1 style={{ margin: 0, fontSize: F.sizeXl, fontWeight: '700', color: C.textPrimary, letterSpacing: '-0.3px' }}>Prospector</h1>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {status === 'loading' ? (
            <span style={{ color: C.textMuted, fontSize: F.sizeBase }}>Cargando...</span>
          ) : session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {session.user?.image && (
                <img src={session.user.image} alt={session.user.name || 'User'} style={{ width: '32px', height: '32px', borderRadius: R.full }} />
              )}
              <span style={{ color: C.textSecondary, fontSize: F.sizeBase }}>{session.user?.name}</span>
              <button onClick={() => signOut()} aria-label="Cerrar sesión" style={{ padding: '6px 12px', borderRadius: R.sm, border: `1px solid ${C.negative}`, background: 'transparent', color: C.negative, cursor: 'pointer', fontSize: F.sizeSm }}>Salir</button>
            </div>
          ) : (
            <button onClick={() => signIn('google')} aria-label="Iniciar sesión con Google" style={{ padding: '8px 16px', borderRadius: R.md, border: 'none', background: C.accent, color: C.textPrimary, cursor: 'pointer', fontWeight: '600', fontSize: F.sizeBase }}>Iniciar sesión</button>
          )}
        </div>
      </header>


        {isMobile && menuOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: `C.bgb3`, zIndex: 10000 }} onClick={() => setMenuOpen(false)} />
        )}
        {isMobile && menuOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '280px', height: '100dvh', background: C.bgCard, borderRight: `1px solid ${C.border}`, zIndex: 10001, overflowY: 'auto', padding: '20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: R.lg, background: `linear-gradient(135deg, ${C.accent} 0%, #6366F1 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: F.sizeXl, fontWeight: '700', color: C.textPrimary }}>P</div>
                <span style={{ fontSize: F.sizeXl, fontWeight: '700', color: C.textPrimary }}>Prospector</span>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: F.sizeHero }}>✕</button>
            </div>
            {(() => {
              const mobileUserPlan = (session?.user as any)?.plan || 'free';
              const planLevel: Record<string, number> = { free: 0, pro: 1, elite: 2, enterprise: 3 };
              const userLevel = planLevel[mobileUserPlan] ?? 0;
              const mobileItems = [
                { id: 'analyzer', icon: '🏠', label: 'Inicio', minPlan: 0 },
                { id: 'briefing', icon: '📰', label: 'Briefing', minPlan: 0 },
                { id: 'dashboard', icon: '📈', label: 'Dashboard', minPlan: 0 },
                { id: 'screener', icon: '🔎', label: 'Screener', minPlan: 0 },
                { id: 'alerts', icon: '🔔', label: 'Smart Alerts', minPlan: 1 },
                { id: 'options', icon: '🎯', label: 'Opciones', minPlan: 2 },
                { id: 'watchlist', icon: '👁️', label: 'Watchlist', minPlan: 0 },
                { id: 'backtest', icon: '🧪', label: 'Backtest', minPlan: 1 },
                { id: 'framework', icon: '🧠', label: 'Framework', minPlan: 0 },
                { id: 'ai-coach', icon: '🤖', label: 'AI Coach', minPlan: 1 },
                { id: 'inversor-inteligente', icon: '💰', label: 'Value Investing', minPlan: 2 },
                { id: 'trading-trainer', icon: '🎮', label: 'Trainer', minPlan: 0 },
                { id: 'portfolio', icon: '📁', label: 'Portafolio', minPlan: 0 },
              ];
              return mobileItems.map(({ id, icon, label, minPlan }) => {
                const locked = userLevel < minPlan;
                return (
                  <button key={id} onClick={() => { if (locked) { window.location.href = '/settings/billing'; } else { setView(id); } setMenuOpen(false); }}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: R.md, border: `1px solid ${C.border}`, background: view === id ? C.accent : 'transparent', color: C.textSecondary, cursor: 'pointer', fontWeight: '500', textAlign: 'left', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', opacity: locked ? 0.6 : 1 }}>
                    <span>{icon}</span><span>{label} {id === 'portfolio' ? `(${portfolio.length})` : ''}</span>
                    {locked && <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.textMuted }}>PRO</span>}
                  </button>
                );
              });
            })()}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '16px', marginTop: '16px' }}>
              {status === 'loading' ? (
                <span style={{ color: C.textMuted, fontSize: F.sizeBase }}>Cargando...</span>
              ) : session ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {session.user?.image && <img src={session.user.image} alt={session.user.name || 'User'} style={{ width: '32px', height: '32px', borderRadius: R.full }} />}
                  <span style={{ color: C.textSecondary, fontSize: F.sizeBase, flex: 1 }}>{session.user?.name}</span>
                  <button onClick={() => { signOut(); setMenuOpen(false); }} aria-label="Cerrar sesión" style={{ padding: '8px 12px', borderRadius: R.sm, border: `1px solid ${C.negative}`, background: 'transparent', color: C.negative, cursor: 'pointer', fontSize: F.sizeSm }}>Salir</button>
                </div>
              ) : (
                <button onClick={() => { signIn('google'); setMenuOpen(false); }} aria-label="Iniciar sesión con Google" style={{ width: '100%', padding: '12px 16px', borderRadius: R.md, border: 'none', background: C.accent, color: C.textPrimary, cursor: 'pointer', fontWeight: '600', fontSize: F.sizeBase }}>Iniciar sesión</button>
              )}
            </div>
          </div>
        )}

      <div key={view} style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '12px' : '20px', animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        {view === 'analyzer' ? (
          <>
            {/* ═══ LANDING HERO (when no stock selected) ═══ */}
            {!data && !loading && !error && (
              <div style={{
                position: 'relative', overflow: 'hidden',
                borderRadius: R.xl, marginBottom: '32px',
                background: `linear-gradient(135deg, ${C.bgCard} 0%, ${C.bgElevated} 100%)`,
                border: `1px solid ${C.border}`,
                boxShadow: shadow.lg,
                animation: `fadeInScale 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
              }}>
                {/* Glow effects */}
                <div style={{
                  position: 'absolute', top: -100, right: -100,
                  width: 300, height: 300, borderRadius: '50%',
                  background: `${C.accent10}`, filter: 'blur(80px)',
                  animation: 'pulseGlow 4s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', bottom: -60, left: -60,
                  width: 200, height: 200, borderRadius: '50%',
                  background: `${C.positive08}`, filter: 'blur(60px)',
                }} />

                <div style={{ position: 'relative', padding: '56px 48px 48px', textAlign: 'center' }}>
                  {/* Badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '6px 16px', borderRadius: R.full,
                    background: `${C.accent12}`, border: `1px solid ${C.accent25}`,
                    marginBottom: '24px',
                    animation: 'fadeInUp 0.3s ease 0.05s both',
                  }}>
                    <span style={{ fontSize: F.sizeXs, color: C.accentLight, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      AI-Powered Analysis
                    </span>
                  </div>

                  {/* Headline */}
                  <h1 style={{
                    fontSize: F.sizeDisplay, fontWeight: 800, color: C.textPrimary,
                    lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 16px',
                    fontFamily: F.family,
                    animation: 'fadeInUp 0.3s ease 0.1s both',
                  }}>
                    Analiza cualquier acción<br />
                    <span style={{
                      background: `${C.gradientPrimary}`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>como un profesional</span>
                  </h1>

                  <p style={{
                    fontSize: F.sizeLg, color: C.textSecondary,
                    margin: '0 auto 36px', maxWidth: 540,
                    lineHeight: 1.7, letterSpacing: '-0.01em',
                    animation: 'fadeInUp 0.3s ease 0.15s both',
                  }}>
                    Graham Principles, AI briefing, trade setups y levels automáticos en segundos.
                  </p>

                  {/* Search bar */}
                  <div style={{
                    display: 'flex', gap: '12px', maxWidth: 640, margin: '0 auto',
                    position: 'relative',
                    animation: 'fadeInUp 0.3s ease 0.2s both',
                  }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 18, color: C.textMuted, pointerEvents: 'none',
                      }}>&#128269;</span>
                      <input
                        type="text"
                        value={symbol}
                        placeholder="AAPL, MSFT, GOOGL, NVDA..."
                        aria-label="Buscar acción por ticker"
                        onKeyDown={e => { if (e.key === 'Enter') searchStock(); }}
                        onChange={e => {
                          setSymbol(e.target.value);
                          setShowSuggestions(true);
                          fetchSuggestions(e.target.value);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        style={{
                          width: '100%', padding: '18px 18px 18px 48px',
                          borderRadius: R.xl,
                          border: `1px solid ${C.borderHover}`,
                          background: C.bgInput,
                          color: C.textPrimary,
                          fontSize: F.sizeLg,
                          outline: 'none',
                          fontFamily: F.family,
                          transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                          boxShadow: shadow.sm,
                        }}
                        onFocusCapture={e => {
                          e.currentTarget.style.borderColor = C.accent;
                          e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent15}, 0 4px 16px ${C.accent10}`;
                        }}
                        onBlurCapture={e => {
                          e.currentTarget.style.borderColor = C.borderHover;
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: C.bgCard, border: `1px solid ${C.border}`,
                          borderRadius: R.xl, marginTop: '8px', zIndex: 100,
                          maxHeight: 260, overflow: 'auto', boxShadow: shadow.xl,
                          animation: 'slideDown 0.2s ease forwards',
                        }}>
                          {suggestions.map(s => (
                            <div key={s.symbol} onClick={() => { setSymbol(s.symbol); setShowSuggestions(false); searchStock(); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}
                              onMouseOver={e => (e.currentTarget.style.background = C.bgCardHover)}
                              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                              <span style={{ color: C.accentLight, fontWeight: 700, fontSize: F.sizeBase, fontFamily: F.mono }}>{s.symbol}</span>
                              <span style={{ color: C.textMuted, fontSize: F.sizeSm }}>{s.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => searchStock()}
                      disabled={loading || (!(session?.user as any)?.plan || (session?.user as any)?.plan === 'free') && dailyAnalysisCount >= 5}
                      aria-label="Analizar acción"
                      style={{
                        padding: '18px 36px', borderRadius: R.xl,
                        border: 'none',
                        background: `${C.gradientPrimary}`,
                        color: '#fff',
                        fontSize: F.sizeLg,
                        fontWeight: 700,
                        cursor: (loading || ((!(session?.user as any)?.plan || (session?.user as any)?.plan === 'free') && dailyAnalysisCount >= 5)) ? 'not-allowed' : 'pointer',
                        opacity: (loading || ((!(session?.user as any)?.plan || (session?.user as any)?.plan === 'free') && dailyAnalysisCount >= 5)) ? 0.6 : 1,
                        fontFamily: F.family,
                        transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        whiteSpace: 'nowrap',
                        boxShadow: `0 4px 14px rgba(124, 58, 237, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)`,
                        letterSpacing: '-0.01em',
                      }}
                      onMouseOver={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                      onMouseOut={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(124, 58, 237, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      {loading ? 'Analizando...' : ((!(session?.user as any)?.plan || (session?.user as any)?.plan === 'free') && dailyAnalysisCount >= 5) ? 'Límite diario alcanzado — Actualiza a Pro' : 'Analizar'}
                    </button>
                  </div>

                  {(!(session?.user as any)?.plan || (session?.user as any)?.plan === 'free') && (
                    <p style={{
                      fontSize: F.sizeXs, color: dailyAnalysisCount >= 5 ? '#ef4444' : C.textMuted,
                      marginTop: '8px', textAlign: 'center',
                      animation: 'fadeInUp 0.3s ease 0.25s both',
                    }}>
                      {dailyAnalysisCount} de 5 análisis gratuitos hoy
                    </p>
                  )}

                  {/* Quick tickers */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '10px', marginTop: '24px', flexWrap: 'wrap',
                    animation: 'fadeInUp 0.3s ease 0.3s both',
                  }}>
                    <span style={{ fontSize: F.sizeSm, color: C.textMuted, fontWeight: 500 }}>Popular:</span>
                    {['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA'].map((t, i) => (
                      <button key={t} onClick={() => { setSymbol(t); searchStock(); }}
                        style={{
                          padding: '6px 14px', borderRadius: R.full,
                          border: `1px solid ${C.border}`, background: 'transparent',
                          color: C.textSecondary, fontSize: F.sizeSm, fontWeight: 600,
                          cursor: 'pointer', fontFamily: F.mono,
                          transition: 'all 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)',
                          animation: `fadeInUp 0.2s ease ${0.35 + i * 0.04}s both`,
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accentLight; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 2px 8px ${C.accent15}`; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Feature pills */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', marginTop: '24px', flexWrap: 'wrap',
                    animation: 'fadeInUp 0.3s ease 0.4s both',
                  }}>
                    {[
                      { icon: '🧠', label: 'AI Briefing' },
                      { icon: '📋', label: 'Graham Principles' },
                      { icon: '🎯', label: 'Trade Setup' },
                      { icon: '📊', label: 'Technical Matrix' },
                    ].map((f, i) => (
                      <div key={f.label} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: R.full,
                        background: `${C.bgElevated80}`, border: `1px solid ${C.border}`,
                        fontSize: F.sizeSm, color: C.textSecondary, fontWeight: 500,
                        transition: 'all 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        animation: `fadeInUp 0.2s ease ${0.45 + i * 0.05}s both`,
                        cursor: 'default',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = C.accentBorder;
                        e.currentTarget.style.background = C.accentGlow;
                        e.currentTarget.style.color = C.accentLight;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = C.border;
                        e.currentTarget.style.background = `${C.bgElevated80}`;
                        e.currentTarget.style.color = C.textSecondary;
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      >
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ LOADING STATE ═══ */}
            {loading && (
              <div style={{ animation: 'fadeIn 0.3s ease forwards' }}>
                {/* Compact search */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', maxWidth: '500px' }}>
                  <div style={{ flex: 1, padding: '14px 18px', borderRadius: R.lg, background: C.bgCard, border: `1px solid ${C.border}` }} />
                  <div style={{ padding: '14px 28px', borderRadius: R.lg, background: C.accent, opacity: 0.5 }} />
                </div>
                {/* Skeleton cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{
                      padding: '24px', borderRadius: R.xl,
                      background: C.bgCard, border: `1px solid ${C.border}`,
                      animation: `fadeIn 0.3s ease ${i * 0.1}s both`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: R.lg, background: C.bgElevated, animation: 'pulseSoft 1.5s ease-in-out infinite' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: '16px', width: '80px', borderRadius: R.sm, background: C.bgElevated, marginBottom: '6px', animation: 'pulseSoft 1.5s ease-in-out infinite 0.1s' }} />
                          <div style={{ height: '12px', width: '120px', borderRadius: R.sm, background: C.bgElevated, animation: 'pulseSoft 1.5s ease-in-out infinite 0.2s' }} />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ height: '20px', width: '60px', borderRadius: R.sm, background: C.bgElevated, marginBottom: '4px', animation: 'pulseSoft 1.5s ease-in-out infinite 0.15s' }} />
                          <div style={{ height: '12px', width: '40px', borderRadius: R.sm, background: C.bgElevated, animation: 'pulseSoft 1.5s ease-in-out infinite 0.25s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {[1, 2, 3].map(j => (
                          <div key={j} style={{ height: '48px', borderRadius: R.md, background: C.bgElevated, animation: `pulseSoft 1.5s ease-in-out infinite ${0.1 * j}s` }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{
                  color: C.textMuted, fontSize: F.sizeSm,
                  textAlign: 'center', marginTop: '20px',
                  fontFamily: F.mono, letterSpacing: '0.02em',
                  animation: 'pulseSoft 1.5s ease-in-out infinite',
                }}>Analizando {symbol.toUpperCase()}...</p>
              </div>
            )}

            {/* ═══ ERROR STATE ═══ */}
            {error && (
              <div style={{
                padding: '16px 20px', borderRadius: R.lg,
                background: C.negativeBg, border: `1px solid ${C.negativeBorder}`,
                color: C.negative, textAlign: 'center', marginBottom: '16px',
                fontSize: F.sizeBase, boxShadow: `0 4px 12px rgba(239, 68, 68, 0.1)`,
              }}>
                {error}
              </div>
            )}

            {/* ═══ SEARCH BAR (compact, shown when loading or after search) ═══ */}
            {(data || loading || error) && (
              <div style={{
                display: 'flex', gap: '10px', marginBottom: '24px', maxWidth: '480px',
                position: 'relative',
              }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={symbol}
                    placeholder="Otro ticker..."
                    onKeyDown={e => { if (e.key === 'Enter') searchStock(); }}
                    onChange={e => {
                      setSymbol(e.target.value);
                      setShowSuggestions(true);
                      fetchSuggestions(e.target.value);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: R.lg,
                      border: `1px solid ${C.border}`, background: C.bgCard,
                      color: C.textPrimary, fontSize: F.sizeBase, outline: 'none',
                      fontFamily: F.family,
                      transition: 'border-color 0.2s ease',
                    }}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      background: C.bgCard, border: `1px solid ${C.border}`,
                      borderRadius: R.lg, marginTop: '4px', zIndex: 100,
                      maxHeight: 220, overflow: 'auto', boxShadow: shadow.xl,
                    }}>
                      {suggestions.map(s => (
                        <div key={s.symbol} onClick={() => { setSymbol(s.symbol); setShowSuggestions(false); searchStock(); }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}
                          onMouseOver={e => (e.currentTarget.style.background = C.bgCardHover)}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ color: C.accentLight, fontWeight: 700, fontSize: F.sizeBase, fontFamily: F.mono }}>{s.symbol}</span>
                          <span style={{ color: C.textMuted, fontSize: F.sizeSm }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => searchStock()} disabled={loading}
                  style={{
                    padding: '10px 20px', borderRadius: R.md, border: 'none',
                    background: C.positive, color: '#fff', fontSize: F.sizeBase,
                    fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1, fontFamily: F.family,
                  }}>
                  {loading ? '...' : 'Buscar'}
                </button>
              </div>
            )}

            {/* ═══ STOCK RESULT ═══ */}
            {data && (
              <StockDetailPanel
                symbol={data.quote.symbol}
                name={data.quote.shortName || data.quote.longName}
                price={data.quote.regularMarketPrice}
                change={data.quote.regularMarketChange}
                changePercent={data.quote.regularMarketChangePercent}
                sector={data.informeDetail?.company?.sector}
                marketCap={data.quote.marketCap}
                peRatio={data.quote.peRatio}
                technical={data.technical ? {
                  rsi: data.technical.rsi,
                  sma50: data.technical.sma50,
                  sma200: data.technical.sma200,
                  trend: data.technical.trend,
                  support: data.technical.support,
                  resistance: data.technical.resistance,
                  signal: data.technical.signal,
                } : undefined}
                summary={{
                  buyZoneLow: data.summary.buyZoneLow,
                  buyZoneHigh: data.summary.buyZoneHigh,
                  target1: data.summary.target1,
                  target2: data.summary.target2,
                  stopLoss: data.summary.stopLoss,
                  projectedPrice: data.summary.projectedPrice,
                  potentialReturn: data.summary.potentialReturn,
                  freeCashflow: data.summary.freeCashflow,
                  revenueGrowth: data.summary.revenueGrowth,
                  profitMargins: data.summary.profitMargins,
                }}
                recommendation={{
                  action: data.recommendation.action,
                  confidence: data.recommendation.confidence,
                  reasoning: data.recommendation.reasoning,
                }}
                fundamentals={data.fundamentals}
                userPlan={(session?.user as any)?.plan || 'free'}
                onAddPortfolio={() => {
                  setAddForm({
                    shares: '',
                    price: data.quote.regularMarketPrice.toString(),
                    date: new Date().toISOString().split('T')[0],
                    notes: '',
                    targetPrice: ''
                  });
                  setShowAddModal(true);
                }}
                onAddWatchlist={() => openWatchlistModal(data.quote.symbol, data.quote.regularMarketPrice)}
                inWatchlist={isInWatchlist(data.quote.symbol)}
              />
            )}
          </>
        ) : view === 'portfolio' ? (
          <>
            {!session ? (
              <div style={{ textAlign: 'center', padding: '80px 24px', background: C.bgCard, borderRadius: R.xl, border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
                <div style={{ width: '72px', height: '72px', borderRadius: R.xl, background: `${C.accent12}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', border: `1px solid ${C.accent25}` }}>🔐</div>
                <h3 style={{ color: C.textPrimary, fontSize: F.sizeXl, marginBottom: '8px', fontWeight: 600 }}>Inicia sesión para ver tu portafolio</h3>
                <p style={{ color: C.textMuted, fontSize: F.sizeBase, marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px', lineHeight: 1.6 }}>Tu portafolio se guardará en la nube y estará disponible en cualquier dispositivo</p>
                <button
                  onClick={() => signIn('google')}
                  style={{
                    marginTop: '20px',
                    padding: '12px 24px',
                    borderRadius: R.md,
                    border: 'none',
                    background: C.accentLight,
                    color: C.textPrimary,
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: F.sizeLg,
                  }}
                >
                  Iniciar sesión con Google
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <h2 style={{ color: C.textPrimary, marginBottom: '8px' }}>Mi Portafolio</h2>
                  <p style={{ color: C.textMuted }}>Acciones en seguimiento</p>
                </div>

                {portfolio.length > 0 && (
                  <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '24px', marginBottom: '20px', border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center' }}>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted, fontWeight: 500, letterSpacing: '0.02em' }}>Total Invertido</p>
                        <p style={{ margin: 0, fontSize: F.sizeXxl, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.02em' }}>${portfolioSummary.totalInvested.toFixed(2)}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted, fontWeight: 500, letterSpacing: '0.02em' }}>Valor Actual</p>
                        <p style={{ margin: 0, fontSize: F.sizeXxl, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.02em' }}>${portfolioSummary.totalCurrent.toFixed(2)}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted, fontWeight: 500, letterSpacing: '0.02em' }}>Retorno</p>
                        <p style={{ margin: 0, fontSize: F.sizeXxl, fontWeight: 700, color: portfolioReturn >= 0 ? C.positive : C.negative, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                          {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: '12px' }}>
                  {portfolio.map((item) => {
                    const currentValue = (item.currentPrice || item.purchasePrice) * item.shares;
                    const invested = item.purchasePrice * item.shares;
                    const profitLoss = currentValue - invested;
                    const profitLossPercent = (profitLoss / invested) * 100;
                    const portfolioPercent = portfolioSummary.totalCurrent > 0 ? (currentValue / portfolioSummary.totalCurrent) * 100 : 0;

                    return (
                      <div key={item.symbol} style={{ background: C.bgCard, borderRadius: R.xl, padding: '20px', border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: '600', color: C.textPrimary }}>{item.symbol}</p>
                            <p style={{ margin: '4px 0 0', fontSize: F.sizeSm, color: C.textMuted }}>
                              {item.shares} acciones @ ${item.purchasePrice.toFixed(2)} | {item.purchaseDate}
                            </p>
                            {item.targetPrice && (
                              <p style={{ margin: '4px 0 0', fontSize: F.sizeXs, color: C.accentLight }}>
                                Objetivo: ${item.targetPrice.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => openEditModal(item)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: R.sm,
                                border: `1px solid ${C.border}`,
                                background: 'transparent',
                                color: C.textMuted,
                                cursor: 'pointer',
                                fontSize: F.sizeSm,
                              }}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => removeFromPortfolio(item.symbol)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: R.sm,
                                border: 'none',
                                background: C.negativeBg,
                                color: C.negative,
                                cursor: 'pointer',
                              }}
                              title="Eliminar"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>
                            Invertido: ${invested.toFixed(2)} | Cartera: {portfolioPercent.toFixed(1)}%
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: F.sizeLg, fontWeight: '600', color: C.textPrimary }}>${currentValue.toFixed(2)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: F.sizeSm, color: profitLoss >= 0 ? C.positive : C.negative }}>
                              {profitLoss >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}% (${profitLoss.toFixed(2)})
                            </p>
                          </div>
                        </div>
                        
                        {item.notes && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${C.border}`, fontSize: F.sizeXs, color: C.textMuted, fontStyle: 'italic' }}>
                            📝 {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {portfolio.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '64px 24px', background: C.bgCard, borderRadius: R.xl, border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
                      <div style={{ width: '72px', height: '72px', borderRadius: R.xl, background: C.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', border: `1px solid ${C.border}` }}>📊</div>
                      <h3 style={{ color: C.textPrimary, fontSize: F.sizeXl, marginBottom: '8px', fontWeight: 600 }}>Sin acciones en tu portafolio</h3>
                      <p style={{ color: C.textMuted, fontSize: F.sizeBase, marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px', lineHeight: 1.6 }}>Analiza una acción y agrégala aquí para hacer seguimiento de tus inversiones</p>
                      <button
                        onClick={() => setView('analyzer')}
                        style={{
                          padding: '12px 24px',
                          borderRadius: R.md,
                          border: 'none',
                          background: C.positive,
                          color: C.textPrimary,
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: F.sizeBase,
                        }}
                      >
                        Analizar una acción
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : view === 'watchlist' ? (
          <>
            {!session && watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 24px' }}>
                <div style={{ width: '88px', height: '88px', borderRadius: R.xl, background: `linear-gradient(135deg, ${C.accent15}, ${C.info15})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', fontSize: '40px', border: `1px solid ${C.accent25}` }}>📊</div>
                <h2 style={{ color: C.textPrimary, fontSize: F.sizeHero, marginBottom: '12px', fontWeight: 700, letterSpacing: '-0.02em' }}>Tu Watchlist Personal</h2>
                <p style={{ color: C.textSecondary, fontSize: F.sizeBase, maxWidth: '420px', margin: '0 auto 32px', lineHeight: 1.6 }}>Recibe alertas personalizadas cuando las acciones alcancen el precio que tú decides</p>
                <button
                  onClick={() => signIn('google')}
                  style={{
                    padding: '14px 32px',
                    borderRadius: R.full,
                    border: 'none',
                    background: `${C.gradientPrimary}`,
                    color: C.textPrimary,
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: F.sizeBase,
                    boxShadow: `0 4px 14px ${C.accent30}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  Iniciar con Google
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h2 style={{ color: C.textPrimary, fontSize: F.sizeHero, fontWeight: '600', margin: 0 }}>Mi Watchlist</h2>
                    <button
                      onClick={() => setView('analyzer')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: `1px solid ${C.border}`,
                        background: 'transparent',
                        color: C.accentLight,
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: F.sizeMd,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: F.sizeLg }}>+</span> Agregar
                    </button>
                  </div>
                  <p style={{ color: C.textMuted, fontSize: F.sizeMd, margin: 0 }}>{watchlist.length} {watchlist.length === 1 ? 'acción' : 'acciones'} en seguimiento</p>
                </div>

                {watchlist.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '64px 24px', background: C.bgCard, borderRadius: R.xl, border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: R.xl, background: C.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', border: `1px solid ${C.border}` }}>📋</div>
                    <h3 style={{ color: C.textPrimary, fontSize: F.sizeXl, marginBottom: '8px', fontWeight: 600 }}>Sin acciones vigiladas</h3>
                    <p style={{ color: C.textMuted, fontSize: F.sizeBase, marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px', lineHeight: 1.6 }}>Agrega acciones desde el analizador para recibir alertas de precio</p>
                    <button
                      onClick={() => setView('analyzer')}
                      style={{
                        padding: '12px 24px',
                        borderRadius: R.md,
                        border: 'none',
                        background: C.positive,
                        color: C.textPrimary,
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: F.sizeBase,
                      }}
                    >
                      Buscar acciones
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {watchlist.map((item) => {
                      const priceData = watchlistPrices[item.symbol];
                      const currentPrice = priceData?.price || 0;
                      const priceChange = priceData?.change || 0;
                      const priceChangePercent = priceData?.changePercent || 0;
                      const alertEnabled = item.alertEnabled ?? false;
                      const alertPrice = item.alertPrice ?? 0;
                      const alertType = item.alertType ?? 'above';
                      const isAlertTriggered = alertEnabled && alertPrice > 0 && (
                        (alertType === 'above' && currentPrice >= alertPrice) ||
                        (alertType === 'below' && currentPrice <= alertPrice)
                      );

                      return (
                        <div key={item.symbol} style={{ 
                          background: C.bgCard, 
                          borderRadius: R.xl, 
                          padding: '20px',
                          border: isAlertTriggered ? `1px solid ${C.positive}` : `1px solid ${C.border}`,
                          boxShadow: shadow.card,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            {/* Left side - Symbol and Price */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ 
                                  width: '44px', 
                                  height: '44px', 
                                  borderRadius: R.lg, 
                                  background: `linear-gradient(135deg, #667eea22 0%, #764ba222 100%)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: C.accentLight,
                                  fontSize: F.sizeXl,
                                  fontWeight: '700'
                                }}>
                                  {item.symbol.charAt(0)}
                                </div>
                                <div>
                                  <h3 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeXl, fontWeight: '600' }}>{item.symbol}</h3>
                                  {priceData && (
                                    <p style={{ margin: 0, color: C.textMuted, fontSize: F.sizeSm }}>Mercado NYSE</p>
                                  )}
                                </div>
                              </div>
                              
                              {priceData ? (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                                  <span style={{ color: C.textPrimary, fontSize: '28px', fontWeight: '700' }}>${currentPrice.toFixed(2)}</span>
                                  <span style={{ 
                                    color: priceChange >= 0 ? C.positive : C.negative, 
                                    fontSize: F.sizeBase, 
                                    fontWeight: '500',
                                    padding: '4px 8px',
                                    borderRadius: R.sm,
                                    background: priceChange >= 0 ? `${C.positive15}` : `${C.negative15}`
                                  }}>
                                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChangePercent).toFixed(2)}%
                                  </span>
                                </div>
                              ) : watchlistError ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: C.negative, fontSize: F.sizeMd }}>{watchlistError}</span>
                                  <button
                                    onClick={() => fetchWatchlistPrices([item.symbol])}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: `1px solid ${C.border}`,
                                      background: 'transparent',
                                      color: C.accentLight,
                                      cursor: 'pointer',
                                      fontSize: F.sizeXs,
                                    }}
                                  >
                                    Reintentar
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '16px', height: '16px', borderRadius: R.full, border: `2px solid ${C.border}`, borderTopColor: C.accentLight, animation: 'spin 1s linear infinite' }}></div>
                                  <span style={{ color: C.textMuted, fontSize: F.sizeBase }}>Cargando...</span>
                                </div>
                              )}
                            </div>

                            {/* Right side - Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                onClick={() => removeFromWatchlist(item.symbol)}
                                style={{ 
                                  padding: '10px', 
                                  borderRadius: R.lg, 
                                  border: 'none', 
                                  background: C.bgElevated, 
                                  color: C.textMuted, 
                                  cursor: 'pointer',
                                  fontSize: F.sizeLg,
                                  transition: 'all 0.2s'
                                }}
                                title="Eliminar"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Alert Section */}
                          <div style={{ 
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: `1px solid ${C.border}`
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: F.sizeXl }}>{alertEnabled ? '🔔' : '🔕'}</span>
                                <span style={{ color: C.textSecondary, fontSize: F.sizeBase, fontWeight: '500' }}>
                                  {alertEnabled ? 'Alerta activa' : 'Alerta inactiva'}
                                </span>
                              </div>
                              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '28px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={alertEnabled}
                                  onChange={(e) => setEditingAlert(prev => ({ ...prev, [item.symbol]: { alertType, alertPrice, alertEnabled: e.target.checked, alertPriceInput: prev[item.symbol]?.alertPriceInput ?? alertPrice } }))}
                                  style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: alertEnabled ? C.positive : C.border,
                                  borderRadius: '28px',
                                  transition: 'all 0.2s',
                                  cursor: 'pointer'
                                }}>
                                  <span style={{
                                    position: 'absolute',
                                    height: '22px',
                                    width: '22px',
                                    left: alertEnabled ? '23px' : '3px',
                                    bottom: '3px',
                                    background: C.textPrimary,
                                    borderRadius: R.full,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }} />
                                </span>
                              </label>
                            </div>

                            {alertEnabled && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <select
                                    value={alertType}
                                    onChange={(e) => setEditingAlert(prev => ({ ...prev, [item.symbol]: { alertType: e.target.value as 'above' | 'below', alertPrice, alertEnabled, alertPriceInput: prev[item.symbol]?.alertPriceInput ?? alertPrice } }))}
                                    style={{ 
                                      flex: 1,
                                      padding: '12px 16px', 
                                      borderRadius: R.lg, 
                                      border: `1px solid ${C.border}`, 
                                      background: C.bg, 
                                      color: C.textSecondary, 
                                      fontSize: F.sizeBase,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <option value="above">📈Alertar cuando suba a</option>
                                    <option value="below">📉Alertar cuando baje a</option>
                                  </select>
                                  <div style={{ position: 'relative', flex: '0 0 120px' }}>
                                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: F.sizeBase }}>$</span>
                                    <input
                                      type="number"
                                      placeholder="0.00"
                                      value={editingAlert[item.symbol]?.alertPriceInput ?? (alertPrice || '')}
                                      onChange={(e) => setEditingAlert(prev => ({ ...prev, [item.symbol]: { alertType, alertPrice, alertEnabled, alertPriceInput: parseFloat(e.target.value) || 0 } }))}
                                      style={{ 
                                        width: '100%', 
                                        padding: '12px 12px 12px 28px', 
                                        borderRadius: R.lg, 
                                        border: `1px solid ${C.border}`, 
                                        background: C.bg, 
                                        color: C.textSecondary, 
                                        fontSize: F.sizeBase,
                                        textAlign: 'right',
                                      }}
                                    />
                                  </div>
                                </div>
                                
                                {editingAlert[item.symbol] && (
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => {
                                        setEditingAlert(prev => {
                                          const next = { ...prev };
                                          delete next[item.symbol];
                                          return next;
                                        });
                                      }}
                                      style={{ 
                                        padding: '8px 16px',
                                        borderRadius: R.md, 
                                        border: `1px solid ${C.border}`, 
                                        background: C.bgElevated, 
                                        color: C.textSecondary, 
                                        fontSize: F.sizeBase,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const edit = editingAlert[item.symbol];
                                        if (edit) {
                                          setSavingAlert(item.symbol);
                                          await updateWatchlistAlert(item.symbol, edit.alertPriceInput ?? alertPrice, edit.alertEnabled, edit.alertType);
                                          setEditingAlert(prev => {
                                            const next = { ...prev };
                                            delete next[item.symbol];
                                            return next;
                                          });
                                          setSavingAlert(null);
                                        }
                                      }}
                                      disabled={savingAlert === item.symbol}
                                      style={{ 
                                        padding: '8px 20px',
                                        borderRadius: R.md, 
                                        border: 'none', 
                                        background: savingAlert === item.symbol ? C.border : C.positive, 
                                        color: C.textPrimary, 
                                        fontSize: F.sizeBase,
                                        fontWeight: '600',
                                        cursor: savingAlert === item.symbol ? 'wait' : 'pointer',
                                      }}
                                    >
                                      {savingAlert === item.symbol ? 'Guardando...' : 'Guardar'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {isAlertTriggered && (
                              <div style={{ 
                                marginTop: '12px', 
                                padding: '14px 16px',
                                background: `linear-gradient(135deg, ${C.positive30} 0%, ${C.positive15} 100%)`,
                                borderRadius: R.lg, 
                                border: `1px solid ${C.positive}`,
                                color: `${C.positive}`, 
                                fontSize: F.sizeBase, 
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span style={{ fontSize: F.sizeXl }}>🎉</span>
                                ¡Alerta! {item.symbol} ha alcanzado tu objetivo de ${alertPrice.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
      </div>
      {/* Vista de Informe - Nuevo Formato Detallado */}
      {view === 'informe' && (
      <div key={view} style={{ width: '100%', maxWidth: isMobile ? '100%' : '1200px', margin: '0 auto', padding: isMobile ? '12px' : '20px', boxSizing: 'border-box', animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          {data?.informeDetail ? (
            <RenderInforme informe={data.informeDetail} data={data} />
          ) : data ? (
            <RenderInformeLegacy data={data} formatNumber={formatNumber} getActionColor={getActionColor} />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📋</p>
              <p style={{ color: C.textPrimary, fontSize: F.sizeXl, marginBottom: '8px' }}>Sin informe disponible</p>
              <p style={{ marginBottom: '20px' }}>Analiza una acción para ver el informe detallado</p>
              <button
                onClick={() => setView('analyzer')}
                style={{
                  padding: '12px 24px', borderRadius: R.md, border: 'none',
                  background: C.positive, color: C.textPrimary, cursor: 'pointer',
                  fontWeight: '600', fontSize: F.sizeBase,
                }}
              >
                Buscar acción
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vista de Risk Report */}
      {view === 'risk-report' && (
        data ? <RiskReport data={data} symbol={symbol} /> : (
          <div key={view} style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', textAlign: 'center', animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div style={{ background: C.bgCard, borderRadius: '16px', padding: '80px 32px', border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📊</p>
              <p style={{ color: C.textPrimary, fontSize: F.sizeXl, marginBottom: '8px' }}>Sin Risk Report</p>
              <p style={{ color: C.textMuted, fontSize: F.sizeMd, marginBottom: '20px' }}>Analiza una acción primero para ver su análisis de riesgo</p>
              <button
                onClick={() => setView('analyzer')}
                style={{
                  padding: '12px 24px', borderRadius: R.md, border: 'none',
                  background: C.positive, color: C.textPrimary, cursor: 'pointer',
                  fontWeight: '600', fontSize: F.sizeBase,
                }}
              >
                Buscar acción
              </button>
            </div>
          </div>
        )
      )}

      {/* Vista de Framework PRO */}
      {view === 'framework' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          {data ? (
            <FrameworkView data={data} />
          ) : (
            <div style={{ textAlign: 'center', padding: isMobile ? '40px 20px' : '80px 40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</div>
              <h2 style={{ color: C.textPrimary, fontSize: F.sizeXl, marginBottom: '12px' }}>Framework Pro</h2>
              <p style={{ color: C.textSecondary, fontSize: F.sizeBase, marginBottom: '8px', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
                Analiza una acción para ver su score, escenarios y veredicto con el Framework de Inversión.
              </p>
              <div style={{ display: 'flex', gap: '12px', maxWidth: 500, margin: '0 auto' }}>
                <input
                  type="text"
                  value={symbol}
                  placeholder="Ej: AAPL"
                  aria-label="Ticker para Framework"
                  onKeyDown={e => { if (e.key === 'Enter') { setView('analyzer'); searchStock(); } }}
                  onChange={e => { setSymbol(e.target.value); fetchSuggestions(e.target.value); }}
                  style={{ flex: 1, padding: '14px 18px', borderRadius: R.lg, border: `1px solid ${C.borderHover}`, background: C.bgInput, color: C.textPrimary, fontSize: F.sizeBase, outline: 'none' }}
                />
                <button
                  onClick={() => { setView('analyzer'); searchStock(); }}
                  disabled={!symbol.trim()}
                  style={{ padding: '14px 28px', borderRadius: R.lg, border: 'none', background: C.gradientPrimary, color: '#fff', fontSize: F.sizeBase, fontWeight: 700, cursor: symbol.trim() ? 'pointer' : 'not-allowed', opacity: symbol.trim() ? 1 : 0.5 }}
                >
                  Analizar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista de Opciones */}
      {view === 'options' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <OptionsView 
            initialSymbol={symbol} 
            currentSymbol={symbol} 
            onSymbolChange={(sym) => setSymbol(sym)} 
            onAnalyzeInMain={(sym) => {
              setSymbol(sym);
              searchStock(sym);
            }} 
          />
        </div>
      )}

      {/* Vista de Screener */}
      {view === 'screener' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <ScreenerPage />
        </div>
      )}

      {/* Vista de Trade Validator */}
      {view === 'trade-validator' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <TradeValidator initialSymbol={symbol} onSymbolChange={(sym) => setSymbol(sym)} />
        </div>
      )}

      {/* Vista de TradeStation */}
      {view === 'tradestation' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <TradeStationPanel />
        </div>
      )}

      {/* Vista de Briefing — always mounted, hidden when inactive to preserve state */}
      <div style={{ display: view === 'briefing' ? 'block' : 'none' }}>
        <div style={{ animation: view === 'briefing' ? 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none' }}>
          <Dashboard onNavigateToAICoach={() => setView('ai-coach')} initialSection="briefing" />
        </div>
      </div>

      {/* Vista de Dashboard */}
      {view === 'dashboard' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <Dashboard onNavigateToAICoach={() => setView('ai-coach')} />
        </div>
      )}

      {/* Vista de AI Coach */}
      {view === 'ai-coach' && (
        (['pro', 'elite', 'enterprise'].includes((session?.user as any)?.plan || 'free')) ? (
          <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <AICoach symbol={symbol} onAnalyzeSymbol={(sym) => setSymbol(sym)} />
          </div>
        ) : (
          <div key={view} style={{ padding: '60px 20px', textAlign: 'center', animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: R.full, background: `linear-gradient(135deg, #ff00ff15, #00d4ff15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>🤖</div>
            <h2 style={{ color: C.textPrimary, fontSize: F.sizeHero, marginBottom: '8px' }}>AI Coach</h2>
            <p style={{ color: C.textSecondary, fontSize: F.sizeLg, marginBottom: '8px' }}>Tu asistente personal de trading con AI</p>
            <p style={{ color: C.textMuted, marginBottom: '24px', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Recibe análisis en tiempo real, responde preguntas sobre acciones y mejora tus decisiones de inversión.
            </p>
            <button onClick={() => window.location.href = '/settings/billing'} style={{ padding: '12px 32px', borderRadius: '50px', border: 'none', background: `linear-gradient(135deg, #ff00ff, #00d4ff)`, color: C.textPrimary, fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
              Desbloquear con Pro — $49/mes
            </button>
          </div>
        )
      )}

      {/* Vista de Backtest */}
      {view === 'backtest' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <BacktestPanel />
        </div>
      )}

      {/* Vista de Inversor Inteligente */}
      {view === 'inversor-inteligente' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <ScreenerGraham onSelect={(sym) => { setSymbol(sym); setView('analyzer'); }} />
        </div>
      )}

      {/* Vista de Trading Trainer */}
      {view === 'trading-trainer' && (
        <div key={view} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <TradingTrainer />
        </div>
      )}

      {/* Vista de Smart Alerts */}
      {view === 'alerts' && (
        <div key={view} style={{ padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%', animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
          <SmartAlertsPanel />
        </div>
      )}

      {/* Modal para agregar a Watchlist */}
      {showWatchlistModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: C.textPrimary }}>Agregar {watchlistForm.symbol} a Watchlist</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>🔔 Configurar alerta de precio</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: C.bg, borderRadius: R.md }}>
                <span style={{ color: C.textSecondary, fontSize: F.sizeBase }}>Activar alerta</span>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    checked={watchlistForm.alertEnabled}
                    onChange={(e) => setWatchlistForm({ ...watchlistForm, alertEnabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: watchlistForm.alertEnabled ? C.positive : C.border,
                    borderRadius: '24px',
                    transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      height: '18px',
                      width: '18px',
                      left: watchlistForm.alertEnabled ? '23px' : '3px',
                      bottom: '3px',
                      background: C.textPrimary,
                      borderRadius: R.full,
                      transition: '0.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {watchlistForm.alertEnabled && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Tipo de alerta</label>
                  <select
                    value={watchlistForm.alertType}
                    onChange={(e) => setWatchlistForm({ ...watchlistForm, alertType: e.target.value as 'above' | 'below' })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: R.md,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.textSecondary,
                      fontSize: F.sizeLg,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="above">📈 Alerta cuando suba a...</option>
                    <option value="below">📉 Alerta cuando baje a...</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Precio objetivo</label>
                  <input
                    type="number"
                    value={watchlistForm.alertPrice}
                    onChange={(e) => setWatchlistForm({ ...watchlistForm, alertPrice: e.target.value })}
                    placeholder="Ej: 150.00"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: R.md,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.textSecondary,
                      fontSize: F.sizeLg,
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: F.sizeSm, color: C.accentLight }}>
                    Recibirás un correo cuando {watchlistForm.symbol} {watchlistForm.alertType === 'above' ? 'suba' : 'baje'} a este precio
                  </p>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowWatchlistModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.textSecondary,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddToWatchlist}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: R.md,
                  border: 'none',
                  background: C.positive,
                  color: C.textPrimary,
                  fontSize: F.sizeLg,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar al portafolio */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: C.textPrimary }}>Agregar al Portafolio</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Símbolo</label>
              <input
                type="text"
                value={data?.quote?.symbol || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  opacity: 0.7,
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Número de acciones *</label>
              <input
                type="number"
                value={addForm.shares}
                onChange={e => setAddForm({ ...addForm, shares: e.target.value })}
                placeholder="Ej: 100"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Precio de compra por acción</label>
              <input
                type="number"
                value={addForm.price}
                onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                placeholder="Precio actual"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Fecha de compra</label>
              <input
                type="date"
                value={addForm.date}
                onChange={e => setAddForm({ ...addForm, date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Precio objetivo (opcional)</label>
              <input
                type="number"
                value={addForm.targetPrice}
                onChange={e => setAddForm({ ...addForm, targetPrice: e.target.value })}
                placeholder="Precio objetivo"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Notas (opcional)</label>
              <textarea
                value={addForm.notes}
                onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                placeholder="Notas sobre esta posición..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => addToPortfolio()}
                disabled={!addForm.shares}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: R.md,
                  border: 'none',
                  background: C.positive,
                  color: C.textPrimary,
                  fontSize: F.sizeLg,
                  fontWeight: 'bold',
                  cursor: !addForm.shares ? 'not-allowed' : 'pointer',
                  opacity: !addForm.shares ? 0.5 : 1,
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar posición del portafolio */}
      {showEditModal && editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: C.textPrimary }}>Editar {editingItem.symbol}</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Número de acciones *</label>
              <input
                type="number"
                value={addForm.shares}
                onChange={e => setAddForm({ ...addForm, shares: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Precio de compra por acción *</label>
              <input
                type="number"
                value={addForm.price}
                onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Fecha de compra</label>
              <input
                type="date"
                value={addForm.date}
                onChange={e => setAddForm({ ...addForm, date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Precio objetivo</label>
              <input
                type="number"
                value={addForm.targetPrice}
                onChange={e => setAddForm({ ...addForm, targetPrice: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeLg,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: F.sizeBase }}>Notas</label>
              <textarea
                value={addForm.notes}
                onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.textSecondary,
                  fontSize: F.sizeBase,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                  setAddForm({ shares: '', price: '', date: new Date().toISOString().split('T')[0], notes: '', targetPrice: '' });
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: R.md,
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.textSecondary,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: R.md,
                  border: 'none',
                  background: C.accent,
                  color: C.textPrimary,
                  fontSize: F.sizeLg,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

type CheckStatus = 'pass' | 'fail';

function OptionsView({ initialSymbol, onSymbolChange, currentSymbol, onAnalyzeInMain }: { initialSymbol?: string; onSymbolChange?: (symbol: string) => void; currentSymbol?: string; onAnalyzeInMain?: (symbol: string) => void }) {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [screenerData, setScreenerData] = useState<any>(null);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyze' | 'screener'>('analyze');
  const [selectedSymbolFromScreener, setSelectedSymbolFromScreener] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('suitabilityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [symbolChanges, setSymbolChanges] = useState<{ added: string[]; removed: string[] }>({ added: [], removed: [] });
  const [showChanges, setShowChanges] = useState(false);
  const [newSymbols, setNewSymbols] = useState<Set<string>>(new Set());
  const [screenerFilter, setScreenerFilter] = useState('');
  const [timeValidation, setTimeValidation] = useState<{
    estimatedDays: number;
    expirationDays: number;
    expectedMove: number;
    score: number;
    setupType: string;
    distance: number;
    expectedDays: number;
    message: string;
    label: string;
    labelColor: string;
  } | null>(null);
  
  const [preTradeChecklist, setPreTradeChecklist] = useState<Record<string, CheckStatus>>({
    marketAligned: 'fail',
    priceAligned: 'fail',
    breakout: 'fail',
    aboveResistance: 'fail',
    volumeUp: 'fail',
    aboveEMAs: 'fail',
    notExtended: 'fail',
    hasSpace: 'fail',
    goodRiskReward: 'fail',
    riskAcceptable: 'fail',
    goodTiming: 'fail',
    ivFavorable: 'fail',
    noEvents: 'fail',
  });
  const [showChecklist, setShowChecklist] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (currentSymbol && currentSymbol !== initialSymbol) {
      setScreenerFilter(currentSymbol.toUpperCase());
    }
  }, [currentSymbol]);

  const getStatusIcon = (status: CheckStatus) => {
    if (status === 'pass') return { icon: '✅', color: C.positive };
    return { icon: '❌', color: C.negative };
  };

  const getStatusTextColor = (status: CheckStatus) => {
    if (status === 'pass') return C.positive;
    return C.negative;
  };

  const calculateTimeValidation = (data: any) => {
    const currentPrice = data.optionsAnalysis?.keyLevels?.currentPrice || data.quote?.price || 100;
    const targetPrice = data.optionsAnalysis?.keyLevels?.resistance || data.optionsAnalysis?.keyLevels?.pivot || currentPrice * 1.05;
    const adr = data.technical?.adr || currentPrice * 0.02;
    const iv = data.optionsAnalysis?.impliedVolatility || 0.3;
    const expirationDays = data.optionsAnalysis?.nextExpirations?.[0]?.daysToExpiration || 30;
    const trend = data.technical?.trend || 'lateral';
    
    const setupType = trend === 'alcista' ? 'breakout' : trend === 'bajista' ? 'swing' : 'income';
    
    const distance = Math.abs(targetPrice - currentPrice);
    const estimatedDays = adr > 0 ? distance / adr : 30;
    
    let expectedDays = 20;
    if (setupType === 'breakout') expectedDays = 10;
    else if (setupType === 'swing') expectedDays = 20;
    else expectedDays = 30;
    
    const expectedMove = currentPrice * iv * Math.sqrt(expirationDays / 365);
    
    let score = 0;
    let message = '';
    
    if (estimatedDays <= expirationDays) {
      score += 1;
      message = 'El movimiento esperado cabe dentro del tiempo';
    } else {
      message = 'El vencimiento es demasiado corto para este setup';
    }
    
    if (expectedMove >= distance) {
      score += 1;
      message += '. Expected move cubre la distancia';
    } else {
      message += '. Expected move menor que distancia';
    }
    
    if (expirationDays >= expectedDays) {
      score += 1;
      message += '. Expiración adecuada para el setup';
    } else {
      message += '. Considera usar una expiración más larga';
    }
    
    let label = 'Mal estructurado';
    let labelColor = C.negative;
    if (score === 3) {
      label = 'Óptimo';
      labelColor = C.positive;
    } else if (score === 2) {
      label = 'Válido';
      labelColor = C.accentLight;
    }
    
    setTimeValidation({
      estimatedDays: Math.round(estimatedDays),
      expirationDays,
      expectedMove,
      score,
      setupType,
      distance,
      expectedDays,
      message,
      label,
      labelColor,
    });
    
    return score >= 2;
  };

  useEffect(() => {
    if (data) {
      const earningsDays = data.optionsAnalysis?.earningsDaysUntil || 999;
      const noEvents = !data.optionsAnalysis?.earningsDate || earningsDays > 14;
      const score = data.stockEvaluation?.suitabilityScore || 0;
      
      const goodTiming = calculateTimeValidation(data);
      
      setPreTradeChecklist({
        marketAligned: data.technical?.trend === 'alcista' || data.technical?.trend === 'bajista' ? 'pass' : 'fail',
        priceAligned: 'pass',
        breakout: score >= 70 ? 'pass' : 'fail',
        aboveResistance: data.optionsAnalysis?.keyLevels?.currentPrice > data.optionsAnalysis?.keyLevels?.pivot ? 'pass' : 'fail',
        volumeUp: 'pass',
        aboveEMAs: 'pass',
        notExtended: 'pass',
        hasSpace: 'pass',
        goodRiskReward: data.optionsAnalysis?.recommendedStrategies?.length > 0 ? 'pass' : 'fail',
        riskAcceptable: 'pass',
        goodTiming: goodTiming ? 'pass' : 'fail',
        ivFavorable: data.optionsAnalysis?.ivRank < 50 ? 'pass' : 'fail',
        noEvents: noEvents ? 'pass' : 'fail',
      });
    }
  }, [data]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getSortedStocks = () => {
    if (!screenerData?.all) return [];
    let stocks = [...screenerData.all];
    
    if (screenerFilter) {
      const filter = screenerFilter.toUpperCase();
      stocks = stocks.filter((s: any) => s.symbol.includes(filter));
    }
    
    return stocks.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const analyzeOptions = async (sym?: string) => {
    const targetSymbol = (sym && typeof sym === 'string') ? sym : symbol;
    if (!targetSymbol || !targetSymbol.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    setScreenerFilter(targetSymbol.toUpperCase());

    try {
      const res = await fetch(`/api/options?symbol=${targetSymbol.toUpperCase()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error fetching data');
      }
      const json = await res.json();
      setData(json);
      if (onSymbolChange) onSymbolChange(targetSymbol.toUpperCase());
      if (onAnalyzeInMain) onAnalyzeInMain(targetSymbol.toUpperCase());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const urlSymbol = searchParams.get('symbol');
    const urlTab = searchParams.get('tab');
    if (urlTab === 'options') {
      setActiveTab('analyze');
    }
    if (urlSymbol && typeof urlSymbol === 'string') {
      setSymbol(urlSymbol);
      analyzeOptions(urlSymbol);
    } else if (initialSymbol && initialSymbol !== symbol) {
      setSymbol(initialSymbol);
      analyzeOptions(initialSymbol);
    } else if (initialSymbol && !symbol) {
      setSymbol(initialSymbol);
      analyzeOptions(initialSymbol);
    }
    return () => { cancelled = true; };
  }, [searchParams, initialSymbol]);

  useEffect(() => {
    let cancelled = false;
    if (selectedSymbolFromScreener) {
      setSymbol(selectedSymbolFromScreener);
      setActiveTab('analyze');
      analyzeOptions(selectedSymbolFromScreener);
      if (onSymbolChange) onSymbolChange(selectedSymbolFromScreener);
      setSelectedSymbolFromScreener(null);
    }
    return () => { cancelled = true; };
  }, [selectedSymbolFromScreener]);

  const loadScreener = async () => {
    setScreenerLoading(true);
    try {
      const res = await fetch('/api/options?screen=screener');
      const json = await res.json();
      
      const currentSymbols = new Set(json.all?.map((s: any) => s.symbol) || []);
      const savedSymbols = typeof window !== 'undefined' 
        ? new Set(JSON.parse(localStorage.getItem('optionsScreenerSymbols') || '[]'))
        : new Set();
      
      const added: string[] = [];
      const removed: string[] = [];
      
      currentSymbols.forEach((sym: string) => {
        if (!savedSymbols.has(sym)) {
          added.push(sym);
        }
      });
      
      savedSymbols.forEach((sym: string) => {
        if (!currentSymbols.has(sym)) {
          removed.push(sym);
        }
      });
      
      setSymbolChanges({ added, removed });
      setNewSymbols(new Set(added));
      
      if (added.length > 0 || removed.length > 0) {
        setShowChanges(true);
      }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('optionsScreenerSymbols', JSON.stringify([...currentSymbols]));
      }
      setScreenerData(json);
    } catch (e) {
      console.error('Screener error:', e);
    } finally {
      setScreenerLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (activeTab === 'screener' && !screenerData) {
      loadScreener();
    }
    return () => { cancelled = true; };
  }, [activeTab]);

  const getRecommendationColor = (rec: string) => {
    if (rec === 'excelente') return C.positive;
    if (rec === 'buena') return C.accentLight;
    if (rec === 'regular') return C.warning;
    return C.negative;
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'bajo') return C.positive;
    if (risk === 'medio') return C.warning;
    return C.negative;
  };

  const formatIV = (iv: number) => (iv * 100).toFixed(1) + '%';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: C.textPrimary, marginBottom: '8px' }}>🎯 Estrategias de Opciones</h2>
        <p style={{ color: C.textMuted, margin: 0, fontSize: F.sizeBase }}>Analiza estrategias de opciones y encuentra acciones ideales para operar</p>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px', minHeight: '24px' }}>
        {data && activeTab === 'analyze' && (
          <button
            onClick={() => setShowChecklist(true)}
            style={{
              padding: '12px 20px',
              borderRadius: R.md,
              border: `2px solid ${C.warning}`,
              background: `linear-gradient(135deg, ${C.warning20} 0%, ${C.warning10} 100%)`,
              color: C.warning,
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: F.sizeBase,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            📋 ¿Buen momento?
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        <button
          onClick={() => setActiveTab('analyze')}
          style={{
            padding: '12px 24px',
            borderRadius: R.md,
            border: 'none',
            background: activeTab === 'analyze' ? C.positive : C.bgCard,
            color: C.textPrimary,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: F.sizeBase,
          }}
        >
          Analizar Ticker
        </button>
        <button
          onClick={() => setActiveTab('screener')}
          style={{
            padding: '12px 24px',
            borderRadius: R.md,
            border: 'none',
            background: activeTab === 'screener' ? C.positive : C.bgCard,
            color: C.textPrimary,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: F.sizeBase,
          }}
        >
          Screener de Acciones
        </button>
      </div>

      {(activeTab === 'analyze' || selectedSymbolFromScreener) ? (
        <>
          {/* Search */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px' }}>
            <input
              type="text"
              value={symbol}
              placeholder="Ej: AAPL, MSFT, TSLA..."
              onKeyDown={e => { if (e.key === 'Enter') analyzeOptions(); }}
              onChange={e => setSymbol(e.target.value)}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: R.md,
                border: `1px solid ${C.border}`,
                background: C.bgCard,
                color: C.textSecondary,
                fontSize: F.sizeLg,
                outline: 'none',
              }}
            />
            <button
              onClick={analyzeOptions}
              disabled={loading}
              style={{
                padding: '14px 24px',
                borderRadius: R.md,
                border: 'none',
                background: C.positive,
                color: C.textPrimary,
                fontSize: F.sizeLg,
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '...' : 'Analizar'}
            </button>
          </div>

          {error && (
            <div style={{ padding: '16px', borderRadius: R.md, background: C.negativeBg, color: C.negative, textAlign: 'center', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {data && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Header */}
              <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '28px' }}>{data.quote?.symbol}</h2>
                    <p style={{ margin: '4px 0 0', color: C.textMuted }}>{data.quote?.shortName}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: C.textPrimary }}>${data.quote?.price?.toFixed(2)}</p>
                    <p style={{ margin: '4px 0 0', color: data.quote?.change >= 0 ? C.positive : C.negative, fontSize: F.sizeLg }}>
                      {data.quote?.change >= 0 ? '+' : ''}{data.quote?.changePercent?.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock Evaluation */}
              <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>📊 Evaluación para Opciones</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>Score de Suitabilidad</p>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: getRecommendationColor(data.stockEvaluation?.recommendation) }}>
                      {data.stockEvaluation?.suitabilityScore || 0}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: F.sizeSm, color: getRecommendationColor(data.stockEvaluation?.recommendation), textTransform: 'uppercase', fontWeight: '600' }}>
                      {data.stockEvaluation?.recommendation?.replace('_', ' ')}
                    </p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md }}>
                    <p style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>Mejor Estrategia</p>
                    <p style={{ margin: 0, fontSize: F.sizeLg, fontWeight: '600', color: C.accentLight }}>{data.stockEvaluation?.topStrategy}</p>
                    <div style={{ marginTop: '12px' }}>
                      {data.stockEvaluation?.reasons?.slice(0, 2).map((r: string, i: number) => (
                        <p key={i} style={{ margin: '4px 0 0', fontSize: F.sizeSm, color: C.textMuted }}>• {r}</p>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md }}>
                    <p style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>Tendencia</p>
                    <p style={{ margin: 0, fontSize: F.sizeLg, fontWeight: '600', color: data.technical?.trend === 'alcista' ? C.positive : data.technical?.trend === 'bajista' ? C.negative : C.warning, textTransform: 'capitalize' }}>
                      {data.technical?.trend || 'lateral'}
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: F.sizeSm, color: C.textMuted }}>RSI: {data.technical?.rsi?.toFixed(1)}</p>
                  </div>
                </div>
              </div>

              {/* IV Analysis */}
              {data.optionsAnalysis && (
                <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>📈 Volatilidad Implícita (IV)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>IV Actual</p>
                      <p style={{ margin: 0, fontSize: F.sizeHero, fontWeight: 'bold', color: C.accentLight }}>{formatIV(data.optionsAnalysis.impliedVolatility)}</p>
                    </div>
                    <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>IV Rank</p>
                      <p style={{ margin: 0, fontSize: F.sizeHero, fontWeight: 'bold', color: data.optionsAnalysis.ivRank > 50 ? C.warning : C.positive }}>{data.optionsAnalysis.ivRank?.toFixed(0)}%</p>
                    </div>
                    <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>IV Percentile</p>
                      <p style={{ margin: 0, fontSize: F.sizeHero, fontWeight: 'bold', color: C.textPrimary }}>{data.optionsAnalysis.ivPercentile?.toFixed(0)}%</p>
                    </div>
                    <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>Comparación Histórica</p>
                      <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: C.accentLight }}>{data.optionsAnalysis.ivComparison?.interpretation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Levels */}
              {data.optionsAnalysis && (
                <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>🎯 Niveles Clave</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                    <div style={{ background: C.bg, padding: '12px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>Soporte</p>
                      <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: 'bold', color: C.positive }}>${data.optionsAnalysis.keyLevels?.support?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: C.bg, padding: '12px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>Pivote</p>
                      <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: 'bold', color: C.textPrimary }}>${data.optionsAnalysis.keyLevels?.pivot?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: C.bg, padding: '12px', borderRadius: R.md, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>Resistencia</p>
                      <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: 'bold', color: C.negative }}>${data.optionsAnalysis.keyLevels?.resistance?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Strategies */}
              {data.optionsAnalysis?.recommendedStrategies?.length > 0 && (
                <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>🏆 Estrategias Recomendadas</h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {data.optionsAnalysis.recommendedStrategies.map((rec: any, idx: number) => (
                      <div key={idx} style={{ background: C.bg, padding: '20px', borderRadius: R.lg, borderLeft: `4px solid ${getRiskColor(rec.strategy.riskLevel)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <h4 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeLg }}>{idx + 1}. {rec.strategy.name}</h4>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: F.sizeXs, fontWeight: '600', background: getRiskColor(rec.strategy.riskLevel) + '30', color: getRiskColor(rec.strategy.riskLevel) }}>
                              Riesgo {rec.strategy.riskLevel.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>Score</p>
                            <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: 'bold', color: C.accentLight }}>{rec.suitabilityScore?.toFixed(0)}%</p>
                          </div>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: F.sizeBase, color: C.textSecondary }}>{rec.strategy.description}</p>
                        
                        {/* Ejemplo Práctico */}
                        {rec.strategy.example && rec.strategy.example.totalCost > 0 && (
                          <div style={{ background: C.bgElevated, padding: '16px', borderRadius: R.md, marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: F.sizeMd, color: C.accentLight, fontWeight: '600' }}>📋 PLAN DE ACCIÓN</p>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ padding: '4px 10px', background: C.bg, borderRadius: '4px', fontSize: F.sizeSm, color: C.textMuted }}>
                                  📅 {rec.strategy.example.expiration}
                                </span>
                                <span style={{ padding: '4px 10px', background: C.bg, borderRadius: '4px', fontSize: F.sizeSm, color: C.textMuted }}>
                                  ⏱ {rec.strategy.example.daysToExpiration} días
                                </span>
                              </div>
                            </div>

                            {/* Instrucciones de Compra/Venta */}
                            {rec.strategy.name === 'Bull Call Spread' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 CALL ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: C.negative, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 VENDE</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 CALL ${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.deltaUpper?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.positive, fontWeight: '600' }}>Costo neto:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.accentLight, fontWeight: '600' }}>Ganancia máx:</span> ${((rec.strategy.example.strikeUpper! - rec.strategy.example.strike) * 100 - rec.strategy.example.totalCost)?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Bull Put Spread' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: C.negative, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 VENDE</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 PUT ${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.deltaUpper?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.positive, fontWeight: '600' }}>Crédito neto:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.accentLight, fontWeight: '600' }}>Ganancia máx:</span> ${rec.strategy.example.totalCost?.toFixed(2)} (crédito recibido)
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Covered Call' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '16px', background: C.negative, borderRadius: R.md, textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 8px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 VENDE (si tienes 100 acciones de {data.quote?.symbol})</p>
                                  <p style={{ margin: '0 0 4px', fontSize: F.sizeXxl, fontWeight: 'bold', color: C.textPrimary }}>1 CALL ${rec.strategy.example.strike?.toFixed(2)}</p>
                                  <p style={{ margin: 0, fontSize: F.sizeBase, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm, marginTop: '8px' }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.positive, fontWeight: '600' }}>Prima Recibida:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.warning, fontWeight: '600' }}>Renuncias a ganancias sobre:</span> ${rec.strategy.example.strike?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Cash-Secured Put' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '16px', background: C.negative, borderRadius: R.md, textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 8px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 VENDE</p>
                                  <p style={{ margin: '0 0 4px', fontSize: F.sizeXxl, fontWeight: 'bold', color: C.textPrimary }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                  <p style={{ margin: 0, fontSize: F.sizeBase, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm, marginTop: '8px' }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.positive, fontWeight: '600' }}>Prima Recibida:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.warning, fontWeight: '600' }}>Margen requerido:</span> $${(rec.strategy.example.strike * 100)?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Protective Put' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '16px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 8px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA (para proteger 100 acciones)</p>
                                  <p style={{ margin: '0 0 4px', fontSize: F.sizeXxl, fontWeight: 'bold', color: C.textPrimary }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                  <p style={{ margin: 0, fontSize: F.sizeBase, color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm, marginTop: '8px' }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.warning, fontWeight: '600' }}>Costo:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.accentLight, fontWeight: '600' }}>Protección hasta:</span> $${rec.strategy.example.strike?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Long Straddle' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 CALL ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ ~0.50</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ ~-0.50</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.warning, fontWeight: '600' }}>Costo total:</span> $${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.accentLight, fontWeight: '600' }}>Movimiento mínimo:</span> {((rec.strategy.example.totalCost / rec.strategy.example.strike) * 100)?.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Long Strangle' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 CALL ${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ ~0.20</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: C.positive, borderRadius: R.md, textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: F.sizeLg, fontWeight: 'bold', color: C.textPrimary }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: F.sizeSm, color: 'rgba(255,255,255,0.8)' }}>Δ ~-0.20</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.warning, fontWeight: '600' }}>Costo total:</span> $${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.accentLight, fontWeight: '600' }}>Necesita movimiento mayor</span>
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Iron Condor' && (
                              <div style={{ marginBottom: '12px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.accentLight, fontWeight: '600' }}>🟢 LADO PUT (Bajista):</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: C.negative, borderRadius: R.sm, textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: F.sizeXs, color: 'rgba(255,255,255,0.8)' }}>VENDE PUT</p>
                                    <p style={{ margin: '2px 0 0', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>${rec.strategy.example.strike?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: C.positive, borderRadius: R.sm, textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: F.sizeXs, color: 'rgba(255,255,255,0.8)' }}>COMPRA PUT</p>
                                    <p style={{ margin: '2px 0 0', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.accentLight, fontWeight: '600' }}>🔴 LADO CALL (Alcista):</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: C.negative, borderRadius: R.sm, textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: F.sizeXs, color: 'rgba(255,255,255,0.8)' }}>VENDE CALL</p>
                                    <p style={{ margin: '2px 0 0', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: C.positive, borderRadius: R.sm, textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: F.sizeXs, color: 'rgba(255,255,255,0.8)' }}>COMPRA CALL</p>
                                    <p style={{ margin: '2px 0 0', fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>${rec.strategy.example.strikeUpper! * 1.1?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: C.bg, borderRadius: R.sm }}>
                                  <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>
                                    <span style={{ color: C.positive, fontWeight: '600' }}>Crédito total:</span> $${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: C.accentLight, fontWeight: '600' }}>Ganancia si precio estable</span>
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Resumen Final */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bg, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Gan. Máx</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: 'bold', color: C.positive }}>
                                  {rec.strategy.example.maxProfitPercent === '∞' || rec.strategy.example.maxProfit === 'ilimitado' 
                                    ? <><span style={{ fontSize: F.sizeLg }}>∞</span> <span style={{ fontSize: '10px', opacity: 0.7 }}>%</span></>
                                    : <>{rec.strategy.example.maxProfitPercent}% <span style={{ fontSize: '10px', opacity: 0.7 }}>→ ${typeof rec.strategy.example.maxProfit === 'number' ? rec.strategy.example.maxProfit.toFixed(0) : rec.strategy.example.maxProfit}</span></>}
                                </p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bg, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Pérd. Máx</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: 'bold', color: C.negative }}>
                                  {rec.strategy.example.maxLossPercent === '∞' || rec.strategy.example.maxLoss === 'ilimitado'
                                    ? <><span style={{ fontSize: F.sizeLg }}>∞</span> <span style={{ fontSize: '10px', opacity: 0.7 }}>%</span></>
                                    : <>{rec.strategy.example.maxLossPercent}% <span style={{ fontSize: '10px', opacity: 0.7 }}>→ ${typeof rec.strategy.example.maxLoss === 'number' ? rec.strategy.example.maxLoss.toFixed(0) : rec.strategy.example.maxLoss}</span></>}
                                </p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bg, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Prima/Acc</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: 'bold', color: C.accentLight }}>${rec.strategy.example.premium?.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bg, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Contratos</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: 'bold', color: C.textPrimary }}>{rec.strategy.example.contracts}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bg, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Costo Total</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: 'bold', color: C.warning }}>
                                  {rec.strategy.example.costPercent}% <span style={{ fontSize: '10px', opacity: 0.7 }}>→ ${rec.strategy.example.totalCost?.toFixed(0)}</span>
                                </p>
                              </div>
                            </div>
                            {/* TP / SL */}
                            {rec.strategy.example.takeProfit && rec.strategy.example.stopLoss && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                                <div style={{ padding: '10px', background: C.positiveBg, borderRadius: R.sm, border: `1px solid ${C.positiveBorder}` }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: F.sizeSm }}>🎯</span>
                                    <span style={{ fontSize: '10px', color: C.textMuted }}>Take Profit</span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: 'bold', color: C.positive }}>
                                    {rec.strategy.example.takeProfit.percent > 0 ? '+' : ''}{rec.strategy.example.takeProfit.percent}%
                                    <span style={{ fontSize: F.sizeSm, marginLeft: '8px', opacity: 0.7 }}>
                                      → ${rec.strategy.example.takeProfit.price?.toFixed(2)}
                                    </span>
                                  </p>
                                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: C.textMuted }}>
                                    {rec.strategy.example.takeProfit.description}
                                    {rec.strategy.example.takeProfit.tpPercent && ` (cierra al ${rec.strategy.example.takeProfit.tpPercent}%)`}
                                  </p>
                                </div>
                                <div style={{ padding: '10px', background: C.negativeBg, borderRadius: R.sm, border: `1px solid ${C.negativeBorder}` }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: F.sizeSm }}>🛑</span>
                                    <span style={{ fontSize: '10px', color: C.textMuted }}>Stop Loss</span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: F.sizeXl, fontWeight: 'bold', color: C.negative }}>
                                    {rec.strategy.example.stopLoss.percent}%
                                    <span style={{ fontSize: F.sizeSm, marginLeft: '8px', opacity: 0.7 }}>
                                      → ${rec.strategy.example.stopLoss.price?.toFixed(2)}
                                    </span>
                                  </p>
                                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: C.textMuted }}>
                                    {rec.strategy.example.stopLoss.description}
                                    {rec.strategy.example.stopLoss.slPercent && ` (cierra al ${rec.strategy.example.stopLoss.slPercent}%)`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div style={{ background: C.bgCard, padding: '12px', borderRadius: R.md, marginTop: '12px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: F.sizeSm, color: C.textMuted }}>Condición ideal:</p>
                          <p style={{ margin: 0, fontSize: F.sizeMd, color: C.textSecondary }}>{rec.strategy.idealCondition}</p>
                        </div>
                        <p style={{ margin: '12px 0 0', fontSize: F.sizeMd, color: C.accentLight, fontStyle: 'italic' }}>{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options Expirations */}
              {data.optionsAnalysis?.nextExpirations?.length > 0 && (
                <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>📅 Próximas Caducidades</h3>
                  {data.optionsAnalysis.nextExpirations.map((exp: any, idx: number) => (
                    <div key={idx} style={{ background: C.bg, padding: '16px', borderRadius: R.md, marginBottom: idx < data.optionsAnalysis.nextExpirations.length - 1 ? '12px' : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeBase }}>{exp.date}</h4>
                        <span style={{ fontSize: F.sizeSm, color: C.textMuted }}>{exp.daysToExpiration} días</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                        {exp.calls?.slice(0, 3).map((c: any, i: number) => (
                          <div key={i} style={{ padding: '8px', background: C.bgCard, borderRadius: R.sm, fontSize: F.sizeSm }}>
                            <p style={{ margin: '0 0 4px', color: C.positive }}>CALL Strike ${c.strike?.toFixed(2)}</p>
                            <p style={{ margin: 0, color: C.textMuted }}>Prima: ${c.lastPrice?.toFixed(2)} | IV: {formatIV(c.impliedVolatility)}</p>
                            <p style={{ margin: '4px 0 0', color: C.textMuted }}>Delta: {c.delta?.toFixed(2)} | OI: {c.openInterest?.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Events */}
              {(data.optionsAnalysis?.earningsDate || data.optionsAnalysis?.dividendDate) && (
                <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>📆 Eventos Importantes</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {data.optionsAnalysis.earningsDate && (
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>📊 Earnings</p>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: '600',
                            background: data.optionsAnalysis.earningsEstimate ? C.warningBg : C.positiveBg,
                            color: data.optionsAnalysis.earningsEstimate ? C.warning : C.positive
                          }}>
                            {data.optionsAnalysis.earningsEstimate ? '⚠️ ESTIMADO' : '✓ CONFIRMADO'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: F.sizeLg, fontWeight: '600', color: C.warning }}>{data.optionsAnalysis.earningsDate}</p>
                        {data.optionsAnalysis.earningsEstimate && (
                          <p style={{ margin: '4px 0 0', fontSize: F.sizeXs, color: C.textMuted }}>Fecha puede cambiar</p>
                        )}
                      </div>
                    )}
                    {data.optionsAnalysis.dividendDate && (
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md }}>
                        <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>💰 Dividend</p>
                        <p style={{ margin: 0, fontSize: F.sizeLg, fontWeight: '600', color: C.positive }}>{data.optionsAnalysis.dividendDate}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Checklist Modal */}
              {showChecklist && data && (
                <div 
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px',
                  }}
                  onClick={() => setShowChecklist(false)}
                >
                  <div 
                    style={{
                      background: C.bgCard,
                      borderRadius: '16px',
                      padding: '24px',
                      width: '100%',
                      maxWidth: '600px',
                      maxHeight: '90vh',
                      overflowY: 'auto',
                      border: `1px solid ${C.border}`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeXxl }}>🧠 Checklist Institucional</h3>
                      <button
                        onClick={() => setShowChecklist(false)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: R.md,
                          border: `1px solid ${C.border}`,
                          background: 'transparent',
                          color: C.textMuted,
                          cursor: 'pointer',
                          fontSize: F.sizeBase,
                        }}
                      >
                        ✕ Cerrar
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: '16px' }}>
                      {/* 1. Contexto Mercado */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.accentLight}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.accentLight, fontSize: F.sizeBase }}>🔵 1. CONTEXTO DEL MERCADO</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.marketAligned).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.marketAligned) }}>¿SPY/QQQ en tendencia clara? ({data.technical?.trend || 'lateral'})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.priceAligned).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.priceAligned) }}>¿Precio alineado con tendencia?</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Setup */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.positive}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.positive, fontSize: F.sizeBase }}>🟢 2. SETUP (TU EDGE)</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.breakout).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.breakout) }}>¿Breakout claro de resistencia? (Score: {data.stockEvaluation?.suitabilityScore || 0})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.aboveResistance).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.aboveResistance) }}>¿Precio sobre pivote? (Precio: ${data.optionsAnalysis?.keyLevels?.currentPrice?.toFixed(2)} | Pivote: ${data.optionsAnalysis?.keyLevels?.pivot?.toFixed(2)})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.volumeUp).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.volumeUp) }}>¿Volumen superior al promedio?</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.aboveEMAs).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.aboveEMAs) }}>¿Está por encima de EMAs 8/21/50?</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Ubicación Precio */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.warning}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.warning, fontSize: F.sizeBase }}>🟡 3. UBICACIÓN DEL PRECIO</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.notExtended).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.notExtended) }}>¿No está sobreextendido?</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.hasSpace).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.hasSpace) }}>¿Hay espacio hasta resistencia (${data.optionsAnalysis?.keyLevels?.resistance?.toFixed(2)})?</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Riesgo/Recompensa */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.negative}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.negative, fontSize: F.sizeBase }}>🔴 4. RIESGO / RECOMPENSA</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.goodRiskReward).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.goodRiskReward) }}>¿Spread da al menos 1:1? ({data.optionsAnalysis?.recommendedStrategies?.length || 0} estrategias)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.riskAcceptable).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.riskAcceptable) }}>¿Riesgo {'<'}3% del capital?</span>
                          </div>
                        </div>
                      </div>

                      {/* 5. Tiempo */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.textMuted}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.textMuted, fontSize: F.sizeBase }}>⚫ 5. TIEMPO (EXPIRACIÓN)</h4>
                        
                        {timeValidation ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                              <span style={{ 
                                fontSize: F.sizeSm, 
                                padding: '4px 10px', 
                                borderRadius: '4px', 
                                fontWeight: '600',
                                background: timeValidation.labelColor + '30',
                                color: timeValidation.labelColor
                              }}>
                                {timeValidation.label} (Score: {timeValidation.score}/3)
                              </span>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bgCard, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Dist. Target</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary }}>${timeValidation.distance.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bgCard, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Días Est.</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: timeValidation.estimatedDays <= timeValidation.expirationDays ? C.positive : C.negative }}>
                                  {timeValidation.estimatedDays}d
                                </p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bgCard, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Exp. Days</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: C.accentLight }}>{timeValidation.expirationDays}d</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: C.bgCard, borderRadius: R.sm }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted }}>Exp. Move</p>
                                <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: C.warning }}>${timeValidation.expectedMove.toFixed(2)}</p>
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: F.sizeXs }}>
                                <span>{timeValidation.estimatedDays <= timeValidation.expirationDays ? '✅' : '❌'}</span>
                                <span style={{ color: C.textMuted }}>ADR cabe en exp</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: F.sizeXs }}>
                                <span>{timeValidation.expectedMove >= timeValidation.distance ? '✅' : '❌'}</span>
                                <span style={{ color: C.textMuted }}>Exp move cubre</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: F.sizeXs }}>
                                <span>{timeValidation.expirationDays >= timeValidation.expectedDays ? '✅' : '❌'}</span>
                                <span style={{ color: C.textMuted }}>Setup: {timeValidation.setupType}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: F.sizeXs }}>
                                <span style={{ color: C.textMuted }}>{timeValidation.expirationDays} días → {timeValidation.estimatedDays}d para target</span>
                              </div>
                            </div>
                            
                            <p style={{ margin: 0, fontSize: F.sizeXs, color: timeValidation.score >= 2 ? C.positive : C.warning, fontStyle: 'italic' }}>
                              {timeValidation.message}
                            </p>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.goodTiming).icon}</span>
                            <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.goodTiming) }}>Analizando tiempo...</span>
                          </div>
                        )}
                      </div>

                      {/* 6. Volatilidad */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.accentLight}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.accentLight, fontSize: F.sizeBase }}>🟣 6. VOLATILIDAD</h4>
                        <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>IV Rank: <span style={{ color: data.optionsAnalysis?.ivRank > 50 ? C.warning : C.positive, fontWeight: '600' }}>{(data.optionsAnalysis?.ivRank || 0).toFixed(0)}%</span> - {data.optionsAnalysis?.ivRank > 50 ? 'Alta (vender spreads)' : 'Baja (comprar spreads)'}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.ivFavorable).icon}</span>
                          <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.ivFavorable) }}>¿Estrategia alineada con IV actual?</span>
                        </div>
                      </div>

                      {/* 7. Eventos */}
                      <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, borderLeft: `4px solid ${C.warning}` }}>
                        <h4 style={{ margin: '0 0 12px', color: C.warning, fontSize: F.sizeBase }}>⚠️ 7. EVENTOS</h4>
                        <p style={{ margin: '0 0 8px', fontSize: F.sizeSm, color: C.textMuted }}>
                          Earnings: <span style={{ color: data.optionsAnalysis?.earningsDate ? C.warning : C.positive, fontWeight: '600' }}>
                            {data.optionsAnalysis?.earningsDate || 'Ninguno cercano'}
                          </span>
                          {data.optionsAnalysis?.earningsDaysUntil && data.optionsAnalysis?.earningsDaysUntil <= 30 && (
                            <span style={{ marginLeft: '8px', fontSize: F.sizeXs, padding: '2px 6px', background: data.optionsAnalysis.earningsDaysUntil <= 14 ? C.negativeBg : C.warningBg, borderRadius: '4px', color: data.optionsAnalysis.earningsDaysUntil <= 14 ? C.negative : C.warning }}>
                              {data.optionsAnalysis.earningsDaysUntil <= 0 ? '⚠️ YA PASÓ' : `En ${data.optionsAnalysis.earningsDaysUntil} días`}
                            </span>
                          )}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: F.sizeXl, width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.noEvents).icon}</span>
                          <span style={{ fontSize: F.sizeMd, color: getStatusTextColor(preTradeChecklist.noEvents) }}>¿Sin eventos en {'>'}14 días?</span>
                        </div>
                      </div>

                      {/* DECISIÓN FINAL */}
                      {(() => {
                        const passCount = Object.values(preTradeChecklist).filter(s => s === 'pass').length;
                        const failCount = Object.values(preTradeChecklist).filter(s => s === 'fail').length;
                        const totalChecks = Object.keys(preTradeChecklist).length;
                        let decision = '', decisionColor = '', bgColor = '';
                        
                        if (passCount >= 10) {
                          decision = '✅ ENTRAS';
                          decisionColor = C.positive;
                          bgColor = C.positiveBg;
                        } else if (failCount >= 4) {
                          decision = '❌ NO TRADE';
                          decisionColor = C.negative;
                          bgColor = C.negativeBg;
                        } else {
                          decision = '⚠️ RIESGOSO';
                          decisionColor = C.warning;
                          bgColor = C.warningBg;
                        }
                        
                        return (
                          <div style={{ background: bgColor, padding: '20px', borderRadius: R.lg, border: `2px solid ${decisionColor}`, textAlign: 'center' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 'bold', color: decisionColor }}>{decision}</p>
                            <p style={{ margin: 0, fontSize: F.sizeBase, color: C.textMuted }}>
                              ✅ {passCount} &nbsp; ❌ {failCount} / {totalChecks}
                            </p>
                            <p style={{ margin: '8px 0 0', fontSize: F.sizeSm, color: C.textMuted, fontStyle: 'italic' }}>"Si tengo que convencerme para entrar, ya es un NO."</p>
                          </div>
                        );
                      })()}

                      {/* Botón Cerrar */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                        <button
                          onClick={() => setShowChecklist(false)}
                          style={{
                            padding: '12px 32px', borderRadius: R.md, border: 'none',
                            background: C.positive, color: C.textPrimary, cursor: 'pointer', fontSize: F.sizeBase, fontWeight: '600',
                          }}
                        >
                          ✓ Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!data && !loading && !error && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🎯</p>
              <p>Ingresa un ticker para analizar estrategias de opciones</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Screener */}
          {screenerLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: R.full, border: `3px solid ${C.border}`, borderTopColor: C.accentLight, animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
              <p style={{ color: C.textMuted }}>Analizando acciones...</p>
            </div>
          ) : screenerData ? (
            <div>
              {/* Summary */}
              <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeXl }}>📊 Resumen del Screener</h3>
                  <button
                    onClick={loadScreener}
                    disabled={screenerLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: R.md,
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.accentLight,
                      cursor: screenerLoading ? 'wait' : 'pointer',
                      fontSize: F.sizeBase,
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {screenerLoading ? (
                      <span style={{ display: 'inline-block', width: '14px', height: '14px', border: `2px solid ${C.border}`, borderTopColor: C.accentLight, borderRadius: R.full, animation: 'spin 1s linear infinite' }}></span>
                    ) : (
                      '🔄'
                    )}
                    Refrescar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: F.sizeHero, fontWeight: 'bold', color: C.positive }}>{screenerData.summary?.excellent || 0}</p>
                    <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>Excelentes</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: F.sizeHero, fontWeight: 'bold', color: C.accentLight }}>{screenerData.summary?.buena || 0}</p>
                    <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>Buenas</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: F.sizeHero, fontWeight: 'bold', color: C.warning }}>{screenerData.summary?.regular || 0}</p>
                    <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>Regulares</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: R.md, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: F.sizeHero, fontWeight: 'bold', color: C.negative }}>{screenerData.summary?.notRecommended || 0}</p>
                    <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>No Recomendadas</p>
                  </div>
                  <div 
                    onClick={() => setShowChanges(!showChanges)}
                    style={{ 
                      background: C.bg, 
                      padding: '16px', 
                      borderRadius: R.md, 
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: (symbolChanges.added.length > 0 || symbolChanges.removed.length > 0) ? `2px solid ${C.warning}` : `1px solid ${C.border}`,
                    }}
                  >
                    <p style={{ margin: '0 0 4px', fontSize: F.sizeXl, fontWeight: 'bold', color: C.warning }}>
                      {symbolChanges.added.length > 0 && <span style={{ color: C.positive }}>+{symbolChanges.added.length}</span>}
                      {symbolChanges.added.length > 0 && symbolChanges.removed.length > 0 && ' / '}
                      {symbolChanges.removed.length > 0 && <span style={{ color: C.negative }}>-{symbolChanges.removed.length}</span>}
                      {symbolChanges.added.length === 0 && symbolChanges.removed.length === 0 && <span style={{ color: C.textMuted }}>Sin cambios</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>Ver cambios {showChanges ? '▲' : '▼'}</p>
                  </div>
                </div>

                {/* Detalle de cambios */}
                {showChanges && (
                  <div style={{ marginTop: '16px', padding: '16px', background: C.bg, borderRadius: R.md, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px', color: C.positive, fontSize: F.sizeMd, fontWeight: '600' }}>🟢 Agregadas ({symbolChanges.added.length})</p>
                        {symbolChanges.added.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {symbolChanges.added.map((sym) => (
                              <span
                                key={sym}
                                onClick={() => setSelectedSymbolFromScreener(sym)}
                                style={{
                                  padding: '4px 10px',
                                  background: C.positiveBg,
                                  borderRadius: '4px',
                                  color: C.positive,
                                  fontSize: F.sizeSm,
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                              >
                                {sym}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>Ninguna</p>
                        )}
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px', color: C.negative, fontSize: F.sizeMd, fontWeight: '600' }}>🔴 Removidas ({symbolChanges.removed.length})</p>
                        {symbolChanges.removed.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {symbolChanges.removed.map((sym) => (
                              <span
                                key={sym}
                                style={{
                                  padding: '4px 10px',
                                  background: C.negativeBg,
                                  borderRadius: '4px',
                                  color: C.negative,
                                  fontSize: F.sizeSm,
                                  fontWeight: '600',
                                }}
                              >
                                {sym}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: F.sizeSm, color: C.textMuted }}>Ninguna</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Top Picks */}
              {screenerData.topPicks?.length > 0 && (
                <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: F.sizeXl }}>🏆 Top Picks para Opciones <span style={{ fontSize: F.sizeSm, color: C.textMuted, fontWeight: 'normal' }}>(clic para analizar)</span></h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {screenerData.topPicks.slice(0, 5).map((stock: any, idx: number) => {
                      const isNew = newSymbols.has(stock.symbol);
                      return (
                      <div 
                        key={stock.symbol} 
                        onClick={() => setSelectedSymbolFromScreener(stock.symbol)}
                        style={{ 
                          background: C.bg, 
                          padding: '16px', 
                          borderRadius: R.md, 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          flexWrap: 'wrap', 
                          gap: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: isNew ? `2px solid ${C.positive}` : '1px solid transparent',
                          boxShadow: isNew ? '0 0 10px rgba(63, 185, 80, 0.2)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = C.bgElevated;
                          e.currentTarget.style.borderColor = C.accentLight;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = C.bg;
                          e.currentTarget.style.borderColor = isNew ? C.positive : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: F.sizeXl, fontWeight: 'bold', color: C.accentLight, width: '28px', textAlign: 'center' }}>{idx + 1}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: F.sizeLg, fontWeight: '600', color: C.accentLight }}>{stock.symbol}</p>
                              {isNew && <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: C.positive, color: C.textPrimary, fontWeight: '700' }}>NUEVA</span>}
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: F.sizeSm, color: C.textMuted }}>{stock.name}</p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: C.border, color: C.textMuted }}>IV: {((stock.iv || 0) * 100).toFixed(0)}%</span>
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: C.border, color: C.textMuted }}>Vol: {(stock.volume / 1000000).toFixed(1)}M</span>
                              {stock.nearEarnings && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: C.warningBg, color: C.warning }}>⚠ Earnings</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary }}>${stock.price?.toFixed(2)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: F.sizeSm, color: stock.change >= 0 ? C.positive : C.negative }}>
                              {stock.change >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: C.accentLight }}>{stock.topStrategy}</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: F.sizeXxl, fontWeight: 'bold', color: getRecommendationColor(stock.recommendation) }}>{stock.suitabilityScore}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: getRecommendationColor(stock.recommendation), textTransform: 'uppercase' }}>{stock.recommendation?.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Stocks */}
              <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeXl }}>📋 Todas las Acciones Analizadas</h3>
                  <div style={{ fontSize: F.sizeSm, color: C.textMuted }}>
                    Escaneadas: {screenerData.totalScanned} | Filtradas: {screenerData.filteredCount}
                  </div>
                </div>
                <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={screenerFilter}
                    onChange={(e) => setScreenerFilter(e.target.value)}
                    placeholder="Filtrar por símbolo..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: R.md,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.textSecondary,
                      fontSize: F.sizeBase,
                      outline: 'none',
                    }}
                  />
                  {screenerFilter && (
                    <button
                      onClick={() => setScreenerFilter('')}
                      style={{
                        padding: '10px 16px',
                        borderRadius: R.md,
                        border: `1px solid ${C.border}`,
                        background: 'transparent',
                        color: C.textMuted,
                        cursor: 'pointer',
                        fontSize: F.sizeBase,
                      }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th onClick={() => handleSort('symbol')} style={{ padding: '12px 8px', textAlign: 'left', color: sortField === 'symbol' ? C.accentLight : C.textMuted, fontSize: F.sizeXs, fontWeight: '600', cursor: 'pointer' }}>Símbolo {sortField === 'symbol' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('price')} style={{ padding: '12px 8px', textAlign: 'right', color: sortField === 'price' ? C.accentLight : C.textMuted, fontSize: F.sizeXs, fontWeight: '600', cursor: 'pointer' }}>Precio {sortField === 'price' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('iv')} style={{ padding: '12px 8px', textAlign: 'center', color: sortField === 'iv' ? C.accentLight : C.textMuted, fontSize: F.sizeXs, fontWeight: '600', cursor: 'pointer' }}>IV % {sortField === 'iv' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('volume')} style={{ padding: '12px 8px', textAlign: 'right', color: sortField === 'volume' ? C.accentLight : C.textMuted, fontSize: F.sizeXs, fontWeight: '600', cursor: 'pointer' }}>Volumen {sortField === 'volume' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('suitabilityScore')} style={{ padding: '12px 8px', textAlign: 'center', color: sortField === 'suitabilityScore' ? C.accentLight : C.textMuted, fontSize: F.sizeXs, fontWeight: '600', cursor: 'pointer' }}>Score {sortField === 'suitabilityScore' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', color: C.textMuted, fontSize: F.sizeXs, fontWeight: '600' }}>Earnings</th>
                        <th onClick={() => handleSort('topStrategy')} style={{ padding: '12px 8px', textAlign: 'left', color: sortField === 'topStrategy' ? C.accentLight : C.textMuted, fontSize: F.sizeXs, fontWeight: '600', cursor: 'pointer' }}>Estrategia {sortField === 'topStrategy' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedStocks().map((stock: any) => {
                        const isNew = newSymbols.has(stock.symbol);
                        return (
                        <tr 
                          key={stock.symbol} 
                          onClick={() => setSelectedSymbolFromScreener(stock.symbol)}
                          style={{ 
                            borderBottom: `1px solid ${C.border}`,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            background: isNew ? 'rgba(63, 185, 80, 0.1)' : 'transparent',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = C.bgElevated}
                          onMouseLeave={(e) => e.currentTarget.style.background = isNew ? 'rgba(63, 185, 80, 0.1)' : 'transparent'}
                        >
                          <td style={{ padding: '10px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: F.sizeBase, fontWeight: '600', color: C.accentLight }}>{stock.symbol}</p>
                              {isNew && <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: C.positive, color: C.textPrimary, fontWeight: '700' }}>NUEVA</span>}
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: C.textMuted, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</p>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textPrimary, fontSize: F.sizeMd }}>${stock.price?.toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: C.positive, fontSize: F.sizeSm, fontWeight: '600' }}>
                            {((stock.iv || 0) * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textPrimary, fontSize: F.sizeXs }}>
                            {(stock.volume / 1000000).toFixed(1)}M
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: F.sizeXs, fontWeight: '600', background: getRecommendationColor(stock.recommendation) + '30', color: getRecommendationColor(stock.recommendation) }}>
                              {stock.suitabilityScore}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {stock.earningsDate ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontSize: '10px', color: C.textPrimary }}>{stock.earningsDate}</span>
                                <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: stock.earningsEstimate ? C.warningBg : C.positiveBg, color: stock.earningsEstimate ? C.warning : C.positive }}>
                                  {stock.earningsEstimate ? 'ESTIMADA' : 'CONFIRMADA'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '10px', color: C.textMuted }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: F.sizeXs, color: C.accentLight }}>{stock.topStrategy}</td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🔍</p>
              <p>Error al cargar el screener</p>
              <button onClick={loadScreener} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: R.md, border: 'none', background: C.positive, color: C.textPrimary, cursor: 'pointer', fontWeight: '600' }}>
                Reintentar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FrameworkView({ data }: { data: any }) {
  const fcfYield = data.quote.marketCap ? ((data.summary.freeCashflow || 0) / data.quote.marketCap) * 100 : 0;
  const pe = data.quote?.peRatio || 0;
  const revGrowth = (data.summary.revenueGrowth || 0) * 100;
  const margin = (data.summary.profitMargins || 0) * 100;
  const isFCFPositive = (data.summary.freeCashflow || 0) >= 0;

  let score = 0;
  if (isFCFPositive) score += 2;
  if (fcfYield > 5) score += 2;
  if (revGrowth > 15) score += 2;
  if (margin > 15) score += 2;
  if (pe > 0 && pe < 25) score += 2;

  const decision = score >= 8 ? '💎 FUERTE COMPRA' : score >= 5 ? '🤔 EVALUAR' : '❌ EVITAR';
  const color = score >= 8 ? C.positive : score >= 5 ? C.warning : C.negative;

  const isJoyas = fcfYield > 8 && pe < 25 && revGrowth > 5 && margin > 10;
  const isGrowth = fcfYield < 3 && pe > 25 && revGrowth > 20 && margin > 0;
  const isValueTrap = fcfYield > 8 && pe < 15 && revGrowth < 5 && margin < 10;
  const isBomba = fcfYield < 0 && pe > 25 && revGrowth < 0 && margin < 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', color: C.textPrimary }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>🧠 FRAMEWORK PRO</h1>
        <h2 style={{ fontSize: F.sizeXl, color: C.textMuted, fontWeight: 'normal' }}>¿Barata o Trampa?</h2>
        <p style={{ color: C.accentLight, marginTop: '8px' }}>{data.quote?.shortName} ({data.quote?.symbol})</p>
      </div>

      {/* Filtro FCF */}
      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '16px', borderLeft: `4px solid ${C.warning}` }}>
        <h4 style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>🧩 Filtro Inicial</h4>
        <p style={{ fontSize: F.sizeHero, fontWeight: 'bold', color: isFCFPositive ? C.positive : C.negative, margin: 0 }}>
          {isFCFPositive ? '✅ FCF POSITIVO - Modo Valor' : '⚠️ FCF NEGATIVO - Modo Growth'}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', borderLeft: `4px solid ${C.accentLight}` }}>
          <h4 style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>💰 FCF Yield</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: fcfYield > 5 ? C.positive : C.negative, margin: 0 }}>{fcfYield.toFixed(1)}%</p>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>{fcfYield > 10 ? '💎 Muy barata' : fcfYield > 5 ? '✅ Buena' : fcfYield > 3 ? '😐 Normal' : '⚠️ Cara'}</p>
        </div>
        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', borderLeft: `4px solid ${C.accentLight}` }}>
          <h4 style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>📊 PE Ratio</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: pe < 25 ? C.positive : C.negative, margin: 0 }}>{pe.toFixed(1)}</p>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>{pe < 15 ? 'Value' : pe < 25 ? 'Balanceada' : pe < 40 ? 'Growth' : '🚨 Alta'}</p>
        </div>
        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', borderLeft: `4px solid ${C.accentLight}` }}>
          <h4 style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>📈 Revenue</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: revGrowth > 0 ? C.positive : C.negative, margin: 0 }}>{revGrowth > 0 ? '+' : ''}{revGrowth.toFixed(1)}%</p>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>{revGrowth > 20 ? '🚀 Alto' : revGrowth > 10 ? '✅ Saludable' : revGrowth > 0 ? '🐢 Lento' : '🚨 Problema'}</p>
        </div>
        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', borderLeft: `4px solid ${C.accentLight}` }}>
          <h4 style={{ margin: '0 0 8px', fontSize: F.sizeBase, color: C.textMuted }}>🧾 Margen</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: margin > 10 ? C.positive : C.negative, margin: 0 }}>{margin.toFixed(1)}%</p>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>{margin > 20 ? '💪 Excelente' : margin > 10 ? '✅ Bueno' : '⚠️ Débil'}</p>
        </div>
      </div>

      {/* Score */}
      <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '24px', marginBottom: '24px', borderLeft: '4px solid ' + color }}>
        <h3 style={{ margin: '0 0 16px', textAlign: 'center' }}>🧭 Score: {score}/10</h3>
        <div style={{ padding: '20px', background: color + '20', borderRadius: R.lg, textAlign: 'center' }}>
          <p style={{ fontSize: F.sizeHero, fontWeight: 'bold', color: color, margin: 0 }}>{decision}</p>
        </div>
      </div>

      {/* Escenarios */}
      <div>
        <h3 style={{ margin: '0 0 16px', fontSize: F.sizeXl }}>🔥 AHORA LO IMPORTANTE: LA COMBINACIÓN</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '16px', background: C.bgCard, borderRadius: R.lg, border: isJoyas ? `2px solid ${C.positive}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 8px', color: C.positive, fontSize: '15px' }}>💎 ESCENARIO 1: Joyas Ocultas</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF Yield &gt;8% + PE bajo + Revenue crece + Margen sólido</p>
            {isJoyas && <p style={{ margin: '8px 0 0', fontSize: F.sizeMd, fontWeight: 'bold', color: C.positive }}>✓ ACCIÓN BARATA + GENERA CASH + CRECE</p>}
          </div>
          <div style={{ padding: '16px', background: C.bgCard, borderRadius: R.lg, border: isGrowth ? `2px solid ${C.accentLight}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 8px', color: C.accentLight, fontSize: '15px' }}>🚀 ESCENARIO 2: Growth Caro</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF bajo/neg + PE alto + Revenue &gt;20% + Margen expandiéndose</p>
            {isGrowth && <p style={{ margin: '8px 0 0', fontSize: F.sizeMd, fontWeight: 'bold', color: C.accentLight }}>✓ CARA HOY, PERO PUEDE SER GANADORA</p>}
          </div>
          <div style={{ padding: '16px', background: C.bgCard, borderRadius: R.lg, border: isValueTrap ? `2px solid ${C.negative}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 8px', color: C.negative, fontSize: '15px' }}>⚠️ ESCENARIO 3: Value Trap</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF Yield alto + PE bajo + Revenue estancado + Margen débil</p>
            {isValueTrap && <p style={{ margin: '8px 0 0', fontSize: F.sizeMd, fontWeight: 'bold', color: C.negative }}>✗ PARECE BARATA... PERO ESTÁ MUERIENDO</p>}
          </div>
          <div style={{ padding: '16px', background: C.bgCard, borderRadius: R.lg, border: isBomba ? `2px solid ${C.negative}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 8px', color: C.negative, fontSize: '15px' }}>💣 ESCENARIO 4: Bomba de Tiempo</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF negativo + PE alto + No crece + Margen bajo</p>
            {isBomba && <p style={{ margin: '8px 0 0', fontSize: F.sizeMd, fontWeight: 'bold', color: C.negative }}>✗ SOBREVALORADA + SIN FUNDAMENTOS</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLargeNum(n: number): string {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString();
}

function RiskReport({ data, symbol }: { data: ApiResponse; symbol: string }) {
  const [page, setPage] = useState(1);
  const q = data.quote;
  const s = data.summary;
  const t = data.technical;
  const r = data.recommendation;

  const price = q.regularMarketPrice;
  const change = q.regularMarketChange;
  const changePct = q.regularMarketChangePercent;
  const isPos = change >= 0;
  const mcap = q.marketCap || 0;
  const pe = q.peRatio || s.peRatio || 0;
  const revGrowth = s.revenueGrowthPercent || 0;
  const netMargin = s.profitMarginsPercent || 0;
  const totalRev = s.totalRevenue || 0;
  const companyName = q.longName || q.shortName || symbol;

  const strengthScore = (() => {
    let score = 50;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe > 30) score -= 10;
    if (revGrowth > 10) score += 15;
    else if (revGrowth > 0) score += 5;
    else score -= 10;
    if (netMargin > 20) score += 15;
    else if (netMargin > 10) score += 5;
    if (s.totalCash > s.totalDebt) score += 10;
    else score -= 5;
    if (t?.trend === 'up' || t?.signal === 'buy') score += 10;
    else if (t?.trend === 'down') score -= 5;
    if (r?.confidence > 70) score += 10;
    else if (r?.confidence > 50) score += 5;
    return Math.max(0, Math.min(100, Math.round(score)));
  })();
  const gaugeScore = 100 - strengthScore;
  const riskLabel = gaugeScore <= 30 ? 'Low Risk' : gaugeScore <= 60 ? 'Medium Risk' : 'High Risk';
  const riskColor = gaugeScore <= 30 ? C.positive : gaugeScore <= 60 ? C.warning : C.negative;

  const verAction = data.recommendation?.action || s.verdict || 'HOLD';
  const verColor = verAction === 'COMPRAR' || verAction === 'BUY' ? C.positive : verAction === 'VENDER' || verAction === 'SELL' ? C.negative : C.warning;

  const cardBase = { background: C.bgCard, borderRadius: R.lg, padding: '20px', border: `1px solid ${C.border}` };

  const clipboardText = [
    `${symbol} RISK SCORE REPORT`,
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    '',
    `TICKER: ${symbol} | ${companyName}`,
    `Price: $${price.toFixed(2)} (${isPos ? '+' : ''}${change.toFixed(2)}, ${isPos ? '+' : ''}${changePct.toFixed(2)}%)`,
    '',
    `RISK SCORE: ${gaugeScore}/100 (${riskLabel})`,
    `Strength Score: ${strengthScore}/100`,
    `P/E: ${pe.toFixed(2)}`,
    `Revenue Growth: ${revGrowth >= 0 ? '+' : ''}${revGrowth.toFixed(1)}%`,
    `Net Margin: ${netMargin.toFixed(1)}%`,
    `Market Cap: ${formatLargeNum(mcap)}`,
    `Verdict: ${verAction}`,
  ].join('\n');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setPage(1)} style={{ padding: '8px 20px', borderRadius: R.md, border: `1px solid ${C.border}`, background: page === 1 ? C.positive : 'transparent', color: C.textSecondary, cursor: 'pointer', fontWeight: '500', fontSize: F.sizeMd }}>Page 1 · Overview</button>
          <button onClick={() => setPage(2)} style={{ padding: '8px 20px', borderRadius: R.md, border: `1px solid ${C.border}`, background: page === 2 ? C.positive : 'transparent', color: C.textSecondary, cursor: 'pointer', fontWeight: '500', fontSize: F.sizeMd }}>Page 2 · Deep Dive</button>
        </div>
        <button onClick={() => navigator.clipboard.writeText(clipboardText)} style={{ padding: '8px 16px', borderRadius: R.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: F.sizeMd }}>Copy Report</button>
      </div>

      {page === 1 && (
        <div style={{ background: C.bg, borderRadius: '16px', padding: '32px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeHero, fontWeight: '700', background: C.accentLight, color: C.textPrimary, padding: '6px 16px', borderRadius: R.md }}>{symbol}</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: F.sizeLg, color: C.textPrimary }}>{companyName}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: '600', color: C.textPrimary }}>${price.toFixed(2)}</div>
              <div style={{ color: isPos ? C.positive : C.negative, fontSize: F.sizeBase }}>{isPos ? '+' : ''}{change.toFixed(2)} ({isPos ? '+' : ''}{changePct.toFixed(2)}%)</div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: F.sizeXs, textTransform: 'uppercase', letterSpacing: '2px', color: C.textMuted, marginBottom: '12px' }}>Risk Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: '700', color: riskColor, minWidth: '60px', textAlign: 'right' }}>{gaugeScore}</div>
              <div style={{ flex: 1 }}>
                <div style={{ height: '12px', background: C.bgElevated, borderRadius: R.sm, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${gaugeScore}%`, background: riskColor, borderRadius: R.sm, transition: 'width 0.8s ease-out' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: '700', color: C.textPrimary, textShadow: '0 1px 2px `C.bg80`' }}>{gaugeScore}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 2px' }}>
                  <span style={{ fontSize: '9px', color: C.positive }}>Low</span>
                  <span style={{ fontSize: '9px', color: C.warning }}>Medium</span>
                  <span style={{ fontSize: '9px', color: C.negative }}>High</span>
                </div>
              </div>
              <span style={{ fontSize: F.sizeXs, color: C.textMuted, minWidth: '70px' }}>{riskLabel}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '28px' }}>
            {[
              { label: 'Market Cap', val: formatLargeNum(mcap) },
              { label: 'P/E Ratio', val: pe ? pe.toFixed(2) : 'N/A' },
              { label: 'Revenue TTM', val: formatLargeNum(totalRev) },
              { label: 'Rev. Growth', val: (revGrowth >= 0 ? '+' : '') + revGrowth.toFixed(1) + '%' },
              { label: 'Net Margin', val: netMargin.toFixed(1) + '%' },
              { label: 'Strength', val: strengthScore + '/100' },
            ].map(k => (
              <div key={k.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: C.textMuted }}>{k.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary, marginTop: '6px' }}>{k.val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: F.sizeXs, textTransform: 'uppercase', letterSpacing: '1.5px', color: C.textMuted, marginBottom: '12px' }}>Technical Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {[
                { label: 'RSI (14)', val: t?.rsi?.toFixed(1) || 'N/A' },
                { label: 'Trend', val: t?.trend || 'N/A' },
                { label: 'Signal', val: t?.signal || 'N/A' },
                { label: 'Confidence', val: r?.confidence ? r.confidence + '%' : 'N/A' },
              ].map(k => (
                <div key={k.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: C.textMuted }}>{k.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeBase, fontWeight: '600', color: C.textPrimary, marginTop: '6px' }}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {[
              { title: 'Valuation', color: pe > 25 ? C.warning : C.positive, grade: pe > 25 ? 'Premium' : 'Fair', rows: [
                { label: 'P/E (TTM)', val: pe ? pe.toFixed(2) : 'N/A' },
                { label: 'Market Cap', val: formatLargeNum(mcap) },
                { label: '52W High', val: q.fiftyTwoWeekHigh ? '$' + q.fiftyTwoWeekHigh.toFixed(2) : 'N/A' },
                { label: '52W Low', val: q.fiftyTwoWeekLow ? '$' + q.fiftyTwoWeekLow.toFixed(2) : 'N/A' },
                { label: 'Target Price', val: q.targetMeanPrice ? '$' + q.targetMeanPrice.toFixed(2) : 'N/A' },
              ]},
              { title: 'Financial Health', color: s.totalCash > s.totalDebt ? C.positive : C.warning, grade: s.totalCash > s.totalDebt ? 'Strong' : 'Watch', rows: [
                { label: 'Total Cash', val: formatLargeNum(s.totalCash) },
                { label: 'Total Debt', val: formatLargeNum(s.totalDebt) },
                { label: 'Cash/Debt', val: s.totalDebt > 0 ? (s.totalCash / s.totalDebt).toFixed(2) : 'N/A' },
                { label: 'Profit Margin', val: netMargin.toFixed(1) + '%' },
                { label: 'Cash Class', val: s.cashClassification || 'N/A' },
              ]},
              { title: 'Growth', color: revGrowth > 5 ? C.positive : C.negative, grade: revGrowth > 5 ? 'Growing' : 'Stalling', rows: [
                { label: 'Revenue YoY', val: (revGrowth >= 0 ? '+' : '') + revGrowth.toFixed(1) + '%' },
                { label: 'Avg P/E 6M', val: s.avgPe6Months ? s.avgPe6Months.toFixed(2) : 'N/A' },
                { label: 'Projected Price', val: s.projectedPrice ? '$' + s.projectedPrice.toFixed(2) : 'N/A' },
                { label: 'Potential Return', val: s.potentialReturn ? (s.potentialReturn >= 0 ? '+' : '') + s.potentialReturn.toFixed(1) + '%' : 'N/A' },
                { label: 'Verdict', val: verAction },
              ]},
            ].map(card => (
              <div key={card.title} style={cardBase}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: C.textMuted, marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}` }}>{card.title}</div>
                {card.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: F.sizeMd, borderTop: i > 0 ? `1px solid ${C.bg}` : 'none' }}>
                    <span style={{ color: C.textMuted }}>{r.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '500', color: C.textPrimary }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: F.sizeSm, color: C.textMuted }}>Grade</span>
                  <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: R.sm, fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeMd, fontWeight: '600', background: card.color + '20', color: card.color }}>{card.grade}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: F.sizeXs, textTransform: 'uppercase', letterSpacing: '1.5px', color: C.textMuted, marginBottom: '16px' }}>Score Breakdown · 35/35/30 Weighting</div>
            {[
              { label: 'Valuation', pct: Math.min(100, Math.max(10, pe > 0 && pe < 15 ? 80 : pe < 25 ? 60 : 40)), color: C.accentLight, max: '/35' },
              { label: 'Financial Health', pct: Math.min(100, Math.max(10, s.totalCash > s.totalDebt ? 75 : 45)), color: C.positive, max: '/35' },
              { label: 'Growth', pct: Math.min(100, Math.max(10, revGrowth > 10 ? 85 : revGrowth > 0 ? 60 : 30)), color: C.warning, max: '/30' },
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                <span style={{ width: '120px', fontSize: F.sizeMd, color: C.textMuted }}>{b.label}</span>
                <div style={{ flex: 1, height: '20px', background: C.bgElevated, borderRadius: R.lg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: b.pct + '%', borderRadius: R.lg, background: b.color }}></div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeBase, color: C.textPrimary, width: '50px', textAlign: 'right' }}>{b.pct}</span>
                <span style={{ fontSize: F.sizeXs, color: C.textMuted, width: '40px' }}>{b.max}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
              <span style={{ width: '120px', fontSize: F.sizeMd, fontWeight: '600', color: C.textPrimary }}>Total Score</span>
              <div style={{ flex: 1, height: '24px', background: C.bgElevated, borderRadius: R.lg, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: strengthScore + '%', borderRadius: R.lg, background: `linear-gradient(90deg, ${C.accentLight}, ${C.accentLight}, ${C.positive})` }}></div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeLg, fontWeight: '700', color: C.textPrimary, width: '50px', textAlign: 'right' }}>{strengthScore}</span>
              <span style={{ fontSize: F.sizeXs, color: C.textMuted, width: '40px' }}>/100</span>
            </div>
          </div>
        </div>
      )}

      {page === 2 && (
        <div style={{ background: C.bg, borderRadius: '16px', padding: '32px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeHero, fontWeight: '700', background: C.accentLight, color: C.textPrimary, padding: '6px 16px', borderRadius: R.md }}>{symbol}</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: F.sizeLg, color: C.textPrimary }}>{companyName}</div>
                <div style={{ fontSize: F.sizeSm, color: C.textMuted }}>Deep Dive</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>Report Generated</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeMd, color: C.textPrimary }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>

          <div style={{ fontSize: F.sizeXs, textTransform: 'uppercase', letterSpacing: '2px', color: C.textMuted, marginBottom: '16px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}` }}>Key Fundamentals</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
            {[
              ['Cash', formatLargeNum(s.totalCash)],
              ['Debt', formatLargeNum(s.totalDebt)],
              ['Avg Profit Margin (4Y)', s.avgProfitMargin ? s.avgProfitMargin.toFixed(1) + '%' : 'N/A'],
              ['Revenue Growth', (revGrowth >= 0 ? '+' : '') + revGrowth.toFixed(1) + '%'],
              ['Projected Price', s.projectedPrice ? '$' + s.projectedPrice.toFixed(2) : 'N/A'],
              ['Potential Return', s.potentialReturn ? (s.potentialReturn >= 0 ? '+' : '') + s.potentialReturn.toFixed(1) + '%' : 'N/A'],
              ['Target Low - High', q.targetMeanPrice ? '$' + q.targetMeanPrice.toFixed(2) : 'N/A'],
              ['Support / Resistance', t?.support && t?.resistance ? '$' + t.support.toFixed(2) + ' / $' + t.resistance.toFixed(2) : 'N/A'],
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.bgCard, borderRadius: R.md, fontSize: F.sizeMd, border: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted }}>{r[0]}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '500', color: C.textPrimary }}>{r[1]}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: F.sizeXs, textTransform: 'uppercase', letterSpacing: '2px', color: C.textMuted, marginBottom: '16px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}` }}>Strategy & Targets</div>
          <div style={{ background: `linear-gradient(135deg, ${C.bg}, ${C.bgCard})`, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: '20px', marginBottom: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ fontSize: F.sizeSm, marginBottom: '12px', color: C.textPrimary }}>Price Targets</div>
              {[
                ['Buy Zone Low', r?.buyZoneLow ? '$' + r.buyZoneLow.toFixed(2) : s.buyZoneLow ? '$' + s.buyZoneLow.toFixed(2) : 'N/A'],
                ['Buy Zone High', r?.buyZoneHigh ? '$' + r.buyZoneHigh.toFixed(2) : s.buyZoneHigh ? '$' + s.buyZoneHigh.toFixed(2) : 'N/A'],
                ['Target Price', r?.targetPrice ? '$' + r.targetPrice.toFixed(2) : s.targetMeanPrice ? '$' + s.targetMeanPrice.toFixed(2) : 'N/A'],
                ['Stop Loss', r?.stopLoss ? '$' + r.stopLoss.toFixed(2) : s.stopLoss ? '$' + s.stopLoss.toFixed(2) : 'N/A'],
                ['Target 1', s.target1 ? '$' + s.target1.toFixed(2) : 'N/A'],
                ['Target 2', s.target2 ? '$' + s.target2.toFixed(2) : 'N/A'],
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: F.sizeMd, borderBottom: `1px solid ${C.bg}` }}>
                  <span style={{ color: C.textMuted }}>{r[0]}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '500', color: C.textPrimary }}>{r[1]}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: F.sizeSm, marginBottom: '12px', color: C.textPrimary }}>Recommendation</div>
              <div style={{ padding: '20px', background: verColor + '20', borderRadius: R.lg, textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: F.sizeHero, fontWeight: '700', color: verColor }}>{r?.action || s.verdict || 'HOLD'}</div>
                {r?.confidence && <div style={{ fontSize: F.sizeMd, color: C.textMuted, marginTop: '4px' }}>Confidence: {r.confidence}%</div>}
              </div>
              {r?.reasoning && (
                <div style={{ fontSize: F.sizeSm, color: C.textMuted, padding: '12px', background: C.bg, borderRadius: R.md, lineHeight: '1.5' }}>
                  {r.reasoning}
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '28px 20px', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: F.sizeXs, textTransform: 'uppercase', letterSpacing: '2px', color: C.textMuted, marginBottom: '8px' }}>Bottom Line</div>
            <div style={{ maxWidth: '500px', margin: '16px auto', height: '8px', background: C.bgElevated, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: gaugeScore + '%', background: gaugeScore <= 30 ? C.positive : gaugeScore <= 60 ? C.warning : C.negative, borderRadius: '4px' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '500px', margin: '6px auto 0', fontSize: '10px', color: C.textMuted }}>
              <span>Low Risk</span><span>Medium</span><span>High Risk</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: F.sizeXs, color: C.textMuted, marginTop: '4px' }}>
              Risk Score: {gaugeScore}/100
            </div>
            <div style={{ fontSize: F.sizeXl, fontWeight: '600', marginTop: '20px', color: verColor }}>
              {verAction} · {riskLabel} ({gaugeScore}/100)
            </div>
            <div style={{ fontSize: F.sizeMd, color: C.textMuted, marginTop: '6px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
              {r?.reasoning || `Based on the analysis of ${symbol}, the stock shows a strength score of ${strengthScore}/100 with a risk score of ${gaugeScore}/100. Current P/E is ${pe.toFixed(2)} with revenue growth of ${revGrowth.toFixed(1)}%.`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
