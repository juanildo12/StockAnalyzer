'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import { 
  savePortfolioToFirestore, 
  getPortfolioFromFirestore, 
  addPortfolioItem, 
  updatePortfolioItem,
  removePortfolioItem,
  PortfolioItem,
  getWatchlistFromFirestore,
  addWatchlistItem,
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
import AIAnalysisPanel from '@/components/AIAnalysisPanel';
import ScorePanel from '@/components/ScorePanel';
import SmartAlertsPanel from '@/components/SmartAlertsPanel';


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
  profitMarginsPercent: number;
  avgProfitMargin: number;
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
}

function RenderInforme({ informe, data }: { informe: InformeDetail; data?: any }) {
  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const getActionColor = (action: string) => {
    if (action === 'COMPRAR') return '#3fb950';
    if (action === 'VENDER') return '#f85149';
    return '#f0883e';
  };
  
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#f0f6fc', marginBottom: '8px' }}>📋 Análisis Fundamental de {informe.company.name} ({informe.company.symbol})</h2>
        <p style={{ color: '#8b949e', fontSize: '13px' }}>{informe.company.sector} - Riesgo {informe.company.riskLevel}</p>
      </div>

      {/* Datos Clave */}
      {informe.dataKey && (
        <div style={{ background: '#161b22', borderRadius: '12px', padding: '16px', marginBottom: '16px', borderLeft: '4px solid #58a6ff' }}>
          <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '14px', fontWeight: '600' }}>Datos clave (actualizados a {informe.dataKey.lastUpdated}):</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>Precio actual</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '600', color: '#f0f6fc' }}>{informe.dataKey.price}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>Market Cap</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '600', color: '#f0f6fc' }}>{informe.dataKey.marketCap}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>Acciones</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '600', color: '#f0f6fc' }}>{informe.dataKey.sharesOutstanding}</p>
            </div>
          </div>
        </div>
      )}

      {informe.company.description && (
        <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ color: '#c9d1d9', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
            {informe.company.description}
          </p>
        </div>
      )}

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>1. PE Ratio</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>PE Ratio actual (TTM)</td>
              <td style={{ padding: '8px 0', color: informe.peRatio.currentValue < 0 ? '#f85149' : '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.peRatio.current}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.peRatio.classification}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Forward PE</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.peRatio.forward}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '8px' }}>{informe.peRatio.classificationDetail}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>2. Cash y Deudas</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Cash</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.cashDebt.cash}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Deuda Total</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.cashDebt.debt}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Deuda/Equity</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.cashDebt.debtToEquity}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>Cash: {informe.cashDebt.cashClassification} | Deuda: {informe.cashDebt.debtClassification}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '8px' }}>{informe.cashDebt.cashClassificationDetail}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>3. Crecimiento en Ventas 2024-2025</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Crecimiento actual</td>
              <td style={{ padding: '8px 0', color: informe.growth.currentValue >= 0 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>{informe.growth.current}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.growth.classification}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Proyección</td>
              <td style={{ padding: '8px 0', color: '#58a6ff', textAlign: 'right', fontWeight: '600' }}>{informe.growth.projection}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '8px' }}>{informe.growth.momentum}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>4. Profit Margin Promedio (últimos 4 años)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Profit Margin actual</td>
              <td style={{ padding: '8px 0', color: informe.profitMargin.currentValue >= 0 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>{informe.profitMargin.current}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Promedio 4 años</td>
              <td style={{ padding: '8px 0', color: '#f85149', textAlign: 'right', fontWeight: '600' }}>{informe.profitMargin.average4Years}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Clasificación</td>
              <td style={{ padding: '8px 0', color: '#f85149', textAlign: 'right', fontWeight: '600' }}>{informe.profitMargin.classification}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '8px' }}>{informe.profitMargin.classificationDetail}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>5. PE Ratio Promedio (últimos 6 meses)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Histórico</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.peAverage.historical}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Forward</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.peAverage.forward}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>6. Precio Actual y Proyección</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Precio actual</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.projection.currentPrice}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Ventas forward</td>
              <td style={{ padding: '8px 0', color: '#58a6ff', textAlign: 'right', fontWeight: '600' }}>{informe.projection.forwardRevenue}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Retorno potencial</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.projection.returnRange}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '8px' }}>{informe.projection.note}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>7. Comparación con TipRanks</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Price Target</td>
              <td style={{ padding: '8px 0', color: '#58a6ff', textAlign: 'right', fontWeight: '600' }}>{informe.tipRanks.priceTarget}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Upside</td>
              <td style={{ padding: '8px 0', color: informe.tipRanks.upsideValue >= 0 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>{informe.tipRanks.upside}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Consenso</td>
              <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{informe.tipRanks.consensus} ({informe.tipRanks.analystsCount} analistas)</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '8px' }}>{informe.tipRanks.discrepancy}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>📊 Análisis Fundamental (Tabla Resumen)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {informe.summaryTable.rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #30363d' }}>
                <td style={{ padding: '8px 0', color: '#8b949e' }}>{row.metric}</td>
                <td style={{ padding: '8px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{row.value}</td>
              </tr>
            ))}
            {data?.summary?.freeCashflow && (
              <>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  <td style={{ padding: '8px 0', color: '#8b949e' }}>Free Cash Flow</td>
                  <td style={{ padding: '8px 0', color: '#3fb950', textAlign: 'right', fontWeight: '600' }}>{formatNumber(data.summary.freeCashflow)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#8b949e' }}>FCF Yield</td>
                  <td style={{ padding: '8px 0', color: ((data.summary.freeCashflow || 0) / (data.summary.marketCap || 1) * 100) >= 3 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>
                    {(((data.summary.freeCashflow || 0) / (data.summary.marketCap || 1) * 100)).toFixed(2)}%
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>🎯 Precio Objetivo y Recomendación</h3>
        <div style={{ marginTop: '12px', padding: '14px', borderRadius: '8px', background: getActionColor(informe.strategy.verdictAction) + '20', textAlign: 'center' }}>
          <span style={{ color: getActionColor(informe.strategy.verdictAction), fontWeight: 'bold', fontSize: '20px' }}>{informe.strategy.verdictAction}</span>
        </div>
        <p style={{ color: '#c9d1d9', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{informe.priceTargetSection.recommendation}</p>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>🛠 Estrategia Operativa</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Zona de Compra</td>
              <td style={{ padding: '8px 0', color: '#3fb950', textAlign: 'right', fontWeight: '600' }}>{informe.strategy.buyZone}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Target 1</td>
              <td style={{ padding: '8px 0', color: '#58a6ff', textAlign: 'right', fontWeight: '600' }}>{informe.strategy.target1}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Target 2</td>
              <td style={{ padding: '8px 0', color: '#58a6ff', textAlign: 'right', fontWeight: '600' }}>{informe.strategy.target2}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#8b949e' }}>Stop Loss</td>
              <td style={{ padding: '8px 0', color: '#f85149', textAlign: 'right', fontWeight: '600' }}>{informe.strategy.stopLoss}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px', color: '#f0f6fc', fontSize: '16px', fontWeight: '600' }}>🧠 Conclusión Final</h3>
        <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: `4px solid ${getActionColor(informe.strategy.verdictAction)}` }}>
          <p style={{ margin: 0, color: '#c9d1d9', fontSize: '14px', lineHeight: '1.6' }}>{informe.conclusion}</p>
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
    <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e' }}>
      <p>El informe detallado no está disponible para este ticker.</p>
      <p style={{ fontSize: '12px' }}>Intenta analizar otro ticker para ver el nuevo formato.</p>
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
  const [view, setView] = useState<'briefing' | 'analyzer' | 'portfolio' | 'watchlist' | 'informe' | 'risk-report' | 'framework' | 'options' | 'trade-validator' | 'tradestation' | 'screener' | 'dashboard' | 'ai-coach' | 'backtest' | 'inversor-inteligente' | 'trading-trainer' | 'alerts'>('briefing');
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

  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      saveUserEmail(session.user.email, session.user.email);
      loadPortfolio();
      loadWatchlist();
    } else {
      loadPortfolio();
      loadWatchlist();
    }
  }, [session]);

  useEffect(() => {
    loadPortfolio();
  }, []);

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
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlSymbol = searchParams?.get('symbol');
    if (urlSymbol && view === 'analyzer') {
      const upperSymbol = urlSymbol.toUpperCase();
      if (upperSymbol !== symbol) {
        setSymbol(upperSymbol);
      }
      if (!data || data?.quote?.symbol !== upperSymbol) {
        searchStock(upperSymbol);
      }
    }
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

  const getTrendColor = (trend: string) => {
    if (trend === 'alcista') return '#3fb950';
    if (trend === 'bajista') return '#f85149';
    return '#8b949e';
  };

  const getSignalColor = (signal: string) => {
    if (signal === 'comprar') return '#3fb950';
    if (signal === 'vender') return '#f85149';
    return '#8b949e';
  };

  const getActionColor = (action: string) => {
    if (action === 'COMPRAR') return '#3fb950';
    if (action === 'VENDER') return '#f85149';
    return '#f0883e';
  };

  const portfolioSummary = portfolio.reduce((acc, item) => {
    const invested = item.purchasePrice * item.shares;
    const current = (item.currentPrice || item.purchasePrice) * item.shares;
    return {
      totalInvested: acc.totalInvested + invested,
      totalCurrent: acc.totalCurrent + current,
      profitLoss: acc.totalCurrent + current - acc.totalInvested - invested + acc.profitLoss,
    };
  }, { totalInvested: 0, totalCurrent: 0, profitLoss: 0 });

  const portfolioReturn = portfolioSummary.totalInvested > 0 
    ? (portfolioSummary.profitLoss / portfolioSummary.totalInvested) * 100 
    : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', maxWidth: '100%', background: '#0d1117', color: '#c9d1d9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {!isMobile && <Sidebar view={view} onViewChange={setView} userPlan={(session?.user as any)?.plan || 'free'} />}
      <div style={{ flex: 1, minWidth: 0, width: '100%', maxWidth: '100%', marginLeft: isMobile ? 0 : 220, display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #30363d', background: '#0d1117', position: isMobile ? 'sticky' : undefined, top: 0, zIndex: isMobile ? 100 : undefined }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setMenuOpen(!menuOpen)}
              style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: '20px' }}>
              {menuOpen ? '✕' : '☰'}
            </button>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: '#fff' }}>P</div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f0f6fc', letterSpacing: '-0.3px' }}>Prospector</h1>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {status === 'loading' ? (
            <span style={{ color: '#8b949e', fontSize: '14px' }}>Cargando...</span>
          ) : session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {session.user?.image && (
                <img src={session.user.image} alt={session.user.name || 'User'} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              )}
              <span style={{ color: '#c9d1d9', fontSize: '14px' }}>{session.user?.name}</span>
              <button onClick={() => signOut()} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #f85149', background: 'transparent', color: '#f85149', cursor: 'pointer', fontSize: '12px' }}>Salir</button>
            </div>
          ) : (
            <button onClick={() => signIn('google')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#7C3AED', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>Iniciar sesión</button>
          )}
        </div>
      </header>


        {isMobile && menuOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000 }} onClick={() => setMenuOpen(false)} />
        )}
        {isMobile && menuOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '280px', height: '100dvh', background: '#161b22', borderRight: '1px solid #30363d', zIndex: 10001, overflowY: 'auto', padding: '20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#fff' }}>P</div>
                <span style={{ fontSize: '18px', fontWeight: '700', color: '#f0f6fc' }}>Prospector</span>
              </div>
              <button onClick={() => setMenuOpen(false)} style={{ padding: '4px 8px', border: 'none', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: '24px' }}>✕</button>
            </div>
            {[
      { id: 'analyzer', icon: '🔍', label: 'Analizador' },
      { id: 'portfolio', icon: '📁', label: 'Portafolio' },
      { id: 'watchlist', icon: '👁️', label: 'Watchlist' },
      { id: 'screener', icon: '🔎', label: 'Screener' },
      { id: 'informe', icon: '📄', label: 'Informe' },
      { id: 'risk-report', icon: '⚠️', label: 'Risk Report' },
      { id: 'framework', icon: '🧠', label: 'Framework' },
      { id: 'options', icon: '🎯', label: 'Opciones' },
      { id: 'trade-validator', icon: '✅', label: 'Trade Validator' },
      { id: 'tradestation', icon: '📊', label: 'TradeStation' },
      { id: 'dashboard', icon: '📈', label: 'Dashboard' },
      { id: 'ai-coach', icon: '🤖', label: 'FinRobot Coach' },
      { id: 'backtest', icon: '🧪', label: 'Backtest' },
      { id: 'inversor-inteligente', icon: '🧠', label: 'Inv. Inteligente' },
      { id: 'trading-trainer', icon: '🎮', label: 'Trading Trainer' }
            ].map(({ id, icon, label }) => (
              <button key={id} onClick={() => { setView(id); setMenuOpen(false); }}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #30363d', background: view === id ? '#7C3AED' : 'transparent', color: '#c9d1d9', cursor: 'pointer', fontWeight: '500', textAlign: 'left', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>{icon}</span><span>{label} {id === 'portfolio' ? `(${portfolio.length})` : ''}</span>
              </button>
            ))}
            <div style={{ borderTop: '1px solid #30363d', paddingTop: '16px', marginTop: '16px' }}>
              {status === 'loading' ? (
                <span style={{ color: '#8b949e', fontSize: '14px' }}>Cargando...</span>
              ) : session ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {session.user?.image && <img src={session.user.image} alt={session.user.name || 'User'} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
                  <span style={{ color: '#c9d1d9', fontSize: '14px', flex: 1 }}>{session.user?.name}</span>
                  <button onClick={() => { signOut(); setMenuOpen(false); }} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #f85149', background: 'transparent', color: '#f85149', cursor: 'pointer', fontSize: '12px' }}>Salir</button>
                </div>
              ) : (
                <button onClick={() => { signIn('google'); setMenuOpen(false); }} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: 'none', background: '#7C3AED', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>Iniciar sesión</button>
              )}
            </div>
          </div>
        )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {view === 'analyzer' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#f0f6fc', marginBottom: '8px' }}>Analiza Acciones de EE.UU.</h2>
              <p style={{ color: '#8b949e' }}>Ingresa el ticker para obtener un análisis profesional</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px', position: 'relative' }}>
              <input
                type="text"
                value={symbol}
                placeholder="Ej: AAPL, MSFT, GOOGL..."
                onKeyDown={e => { if (e.key === 'Enter') searchStock(); }}
                onChange={e => {
                  setSymbol(e.target.value);
                  setShowSuggestions(true);
                  fetchSuggestions(e.target.value);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#161b22',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', marginTop: '4px', zIndex: 100, maxHeight: '200px', overflow: 'auto' }}>
                  {suggestions.map(s => (
                    <div key={s.symbol} onClick={() => { setSymbol(s.symbol); setShowSuggestions(false); searchStock(); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #30363d' }} onMouseOver={e => (e.currentTarget.style.background = '#238636')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ color: '#58a6ff', fontWeight: '600' }}>{s.symbol}</span>
                      <span style={{ color: '#8b949e', marginLeft: '8px', fontSize: '13px' }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => searchStock()}
                disabled={loading}
                style={{
                  padding: '14px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#238636',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '...' : 'Buscar'}
              </button>
            </div>

            {error && (
              <div style={{ padding: '16px', borderRadius: '8px', background: '#f8514920', color: '#f85149', textAlign: 'center', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {data && (
              <div style={{ display: 'grid', gap: '20px' }}>
                {/* Header */}
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: '28px' }}>{data.quote.symbol}</h2>
                      <p style={{ margin: '4px 0 0', color: '#8b949e' }}>{data.quote.shortName}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#f0f6fc' }}>
                        ${data.quote.regularMarketPrice?.toFixed(2)}
                      </p>
                      <p style={{ margin: '4px 0 0', color: data.quote.regularMarketChangePercent >= 0 ? '#3fb950' : '#f85149', fontSize: '16px', fontWeight: '500' }}>
                        {data.quote.regularMarketChangePercent >= 0 ? '+' : ''}{data.quote.regularMarketChangePercent?.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAddForm({ 
                        shares: '', 
                        price: data.quote.regularMarketPrice.toString(), 
                        date: new Date().toISOString().split('T')[0],
                        notes: '',
                        targetPrice: ''
                      });
                      setShowAddModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#238636',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginBottom: '8px',
                    }}
                  >
                    + Agregar al Portafolio
                  </button>
                  <button
                    onClick={() => openWatchlistModal(data.quote.symbol, data.quote.regularMarketPrice)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: isInWatchlist(data.quote.symbol) ? '1px solid #2ecc71' : '1px solid #30363d',
                        background: isInWatchlist(data.quote.symbol) ? '#2ecc7120' : 'transparent',
                        color: isInWatchlist(data.quote.symbol) ? '#2ecc71' : '#c9d1d9',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginBottom: '8px',
                      }}
                    >
                      {isInWatchlist(data.quote.symbol) ? '✓ En Watchlist' : '+ Agregar a Watchlist'}
                    </button>
                  <a
                    href={`https://www.tipranks.com/stocks/${data.quote.symbol.toLowerCase()}/forecast`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: 'transparent',
                      color: '#58a6ff',
                      fontSize: '14px',
                      fontWeight: '600',
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    📊 Ver Forecast en TipRanks
                  </a>
                </div>

                {/* Tabla de Fundamentales */}
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>📊 Análisis Fundamental</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>PE Actual</td>
                        <td style={{ padding: '12px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{data.summary.peRatio?.toFixed(2) || 'N/A'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>PE Promedio (6M)</td>
                        <td style={{ padding: '12px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{data.summary.avgPe6Months?.toFixed(2) || 'N/A'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Profit Margin Promedio</td>
                        <td style={{ padding: '12px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{data.summary.avgProfitMargin?.toFixed(2) || 'N/A'}%</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Crecimiento Ventas</td>
                        <td style={{ padding: '12px 0', color: data.summary.revenueGrowthPercent >= 0 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>
                          {data.summary.revenueGrowthPercent >= 0 ? '+' : ''}{data.summary.revenueGrowthPercent?.toFixed(2) || 'N/A'}%
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Cash</td>
                        <td style={{ padding: '12px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{formatNumber(data.summary.totalCash)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Deuda</td>
                        <td style={{ padding: '12px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>{formatNumber(data.summary.totalDebt)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Debt/Cash Ratio</td>
                        <td style={{ padding: '12px 0', color: data.summary.debtToCash < 1 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>
                          {data.summary.debtToCash?.toFixed(2) || 'N/A'}x
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Precio Actual</td>
                        <td style={{ padding: '12px 0', color: '#f0f6fc', textAlign: 'right', fontWeight: '600' }}>${data.quote.regularMarketPrice?.toFixed(2)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Precio Proyectado</td>
                        <td style={{ padding: '12px 0', color: '#58a6ff', textAlign: 'right', fontWeight: '600' }}>${data.summary.projectedPrice?.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 0', color: '#8b949e' }}>Retorno %</td>
                        <td style={{ padding: '12px 0', color: data.summary.potentialReturn >= 0 ? '#3fb950' : '#f85149', textAlign: 'right', fontWeight: '600' }}>
                          {data.summary.potentialReturn >= 0 ? '+' : ''}{data.summary.potentialReturn?.toFixed(2) || 'N/A'}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Análisis Técnico */}
                {data.technical && (
                  <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>📈 Análisis Técnico</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Tendencia</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: getTrendColor(data.technical.trend), textTransform: 'capitalize' }}>
                          {data.technical.trend}
                        </p>
                      </div>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Soporte</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#3fb950' }}>${data.technical.support?.toFixed(2)}</p>
                      </div>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Resistencia</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f85149' }}>${data.technical.resistance?.toFixed(2)}</p>
                      </div>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>RSI (14)</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: data.technical.rsi < 30 ? '#3fb950' : data.technical.rsi > 70 ? '#f85149' : '#f0f6fc' }}>
                          {data.technical.rsi?.toFixed(2)}
                        </p>
                      </div>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>SMA 50</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f0f6fc' }}>${data.technical.sma50?.toFixed(2)}</p>
                      </div>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>SMA 200</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f0f6fc' }}>${data.technical.sma200?.toFixed(2)}</p>
                      </div>
                      <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Señal</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: getSignalColor(data.technical.signal), textTransform: 'capitalize' }}>
                          {data.technical.signal}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Precio Objetivo y Recomendación */}
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>🎯 Precio Objetivo y Recomendación</h3>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#8b949e' }}>Veredicto</span>
                      <span style={{ 
                        padding: '6px 16px', 
                        borderRadius: '20px', 
                        background: getActionColor(data.recommendation.action) + '20',
                        color: getActionColor(data.recommendation.action),
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {data.recommendation.action}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#c9d1d9', fontSize: '14px' }}>{data.recommendation.reasoning}</p>
                    <p style={{ margin: '8px 0 0', color: '#8b949e', fontSize: '12px' }}>Confianza: {data.recommendation.confidence}%</p>
                  </div>
                </div>

                {/* Estrategia Operativa */}
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>🛠 Estrategia Operativa</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Zona de Compra</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#3fb950' }}>
                        ${data.summary.buyZoneLow?.toFixed(2)} - ${data.summary.buyZoneHigh?.toFixed(2)}
                      </p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Target 1</p>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#3fb950' }}>${data.summary.target1?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Target 2</p>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#3fb950' }}>${data.summary.target2?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Stop Loss</p>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f85149' }}>${data.summary.stopLoss?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Conclusión Final */}
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>🧠 Conclusión Final</h3>
                  <div style={{ background: getActionColor(data.recommendation.action) + '10', padding: '16px', borderRadius: '8px', borderLeft: `4px solid ${getActionColor(data.recommendation.action)}` }}>
                    <p style={{ margin: 0, color: '#c9d1d9', lineHeight: '1.6' }}>
                      {data.recommendation.action === 'COMPRAR' 
                        ? `✓ ${data.quote.symbol} presenta una oportunidad de inversión atractiva con un potencial de retorno del ${data.summary.potentialReturn?.toFixed(1)}%. Los fundamentales muestran ${data.summary.peRatio < 20 ? 'un PE razonable' : 'un crecimiento sólido'}, y el análisis técnico indica tendencia ${data.technical?.trend || 'lateral'}. La zona de compra recomendada es $${data.summary.buyZoneLow?.toFixed(2)} - $${data.summary.buyZoneHigh?.toFixed(2)}.`
                        : data.recommendation.action === 'MANTENER'
                        ? `→ ${data.quote.symbol} está valorada correctamente. El potencial de retorno del ${data.summary.potentialReturn?.toFixed(1)}% no es suficientemente atractivo para una nueva posición. Mantener seguimiento.`
                        : `✗ ${data.quote.symbol} presenta riesgos significativos. El análisis muestra sobrevaloración con potencial de retorno negativo del ${data.summary.potentialReturn?.toFixed(1)}%. Se recomienda esperar mejores oportunidades.`
                      }
                    </p>
                  </div>
                </div>

                {/* Quantitative Score */}
                <div style={{ marginTop: '8px' }}>
                  <ScorePanel symbol={data.quote.symbol} />
                </div>

                {/* AI Analysis */}
                <div style={{ marginTop: '8px' }}>
                  <AIAnalysisPanel symbol={data.quote.symbol} />
                </div>
              </div>
            )}

            {!data && !loading && !error && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📈</p>
                <p>Ingresa un ticker para analizar</p>
              </div>
            )}
          </>
        ) : view === 'portfolio' ? (
          <>
            {!session ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🔐</p>
                <p style={{ color: '#f0f6fc', fontSize: '18px', marginBottom: '8px' }}>Inicia sesión para ver tu portafolio</p>
                <p>Tu portafolio se guardará en la nube y estará disponible en cualquier dispositivo</p>
                <button
                  onClick={() => signIn('google')}
                  style={{
                    marginTop: '20px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#58a6ff',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '16px',
                  }}
                >
                  Iniciar sesión con Google
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <h2 style={{ color: '#f0f6fc', marginBottom: '8px' }}>Mi Portafolio</h2>
                  <p style={{ color: '#8b949e' }}>Acciones en seguimiento</p>
                </div>

                {portfolio.length > 0 && (
                  <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Total Invertido</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#f0f6fc' }}>${portfolioSummary.totalInvested.toFixed(2)}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Valor Actual</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#f0f6fc' }}>${portfolioSummary.totalCurrent.toFixed(2)}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Retorno</p>
                        <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: portfolioReturn >= 0 ? '#3fb950' : '#f85149' }}>
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
                      <div key={item.symbol} style={{ background: '#161b22', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f0f6fc' }}>{item.symbol}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8b949e' }}>
                              {item.shares} acciones @ ${item.purchasePrice.toFixed(2)} | {item.purchaseDate}
                            </p>
                            {item.targetPrice && (
                              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#58a6ff' }}>
                                Objetivo: ${item.targetPrice.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => openEditModal(item)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #30363d',
                                background: 'transparent',
                                color: '#8b949e',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => removeFromPortfolio(item.symbol)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#f8514920',
                                color: '#f85149',
                                cursor: 'pointer',
                              }}
                              title="Eliminar"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #30363d' }}>
                          <div style={{ fontSize: '11px', color: '#8b949e' }}>
                            Invertido: ${invested.toFixed(2)} | Cartera: {portfolioPercent.toFixed(1)}%
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f0f6fc' }}>${currentValue.toFixed(2)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: profitLoss >= 0 ? '#3fb950' : '#f85149' }}>
                              {profitLoss >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}% (${profitLoss.toFixed(2)})
                            </p>
                          </div>
                        </div>
                        
                        {item.notes && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #30363d', fontSize: '11px', color: '#8b949e', fontStyle: 'italic' }}>
                            📝 {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {portfolio.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                      <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📊</p>
                      <p>No tienes acciones en tu portafolio</p>
                      <p style={{ fontSize: '12px' }}>Analiza una acción y agrégala aquí</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : view === 'watchlist' ? (
          <>
            {!session && watchlist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>📊</div>
                <h2 style={{ color: '#f0f6fc', fontSize: '24px', marginBottom: '8px', fontWeight: '600' }}>Tu Watchlist Personal</h2>
                <p style={{ color: '#8b949e', fontSize: '15px', maxWidth: '400px', margin: '0 auto 24px' }}>Recibe alertas personalizadas cuando las acciones alcancen el precio que tú decides</p>
                <button
                  onClick={() => signIn('google')}
                  style={{
                    padding: '14px 32px',
                    borderRadius: '50px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '15px',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
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
                    <h2 style={{ color: '#f0f6fc', fontSize: '24px', fontWeight: '600', margin: 0 }}>Mi Watchlist</h2>
                    <button
                      onClick={() => setView('analyzer')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid #30363d',
                        background: 'transparent',
                        color: '#58a6ff',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>+</span> Agregar
                    </button>
                  </div>
                  <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>{watchlist.length} {watchlist.length === 1 ? 'acción' : 'acciones'} en seguimiento</p>
                </div>

                {watchlist.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: '#161b22', borderRadius: '16px', border: '1px solid #30363d' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>📋</div>
                    <h3 style={{ color: '#f0f6fc', fontSize: '18px', marginBottom: '8px', fontWeight: '500' }}>Sin acciones vigiladas</h3>
                    <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '20px' }}>Agrega acciones desde el analizador para recibir alertas de precio</p>
                    <button
                      onClick={() => setView('analyzer')}
                      style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#238636',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                      }}
                    >
                      Buscar acciones
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                          background: '#161b22', 
                          borderRadius: '16px', 
                          padding: '20px',
                          border: isAlertTriggered ? '1px solid #2ecc71' : '1px solid transparent',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            {/* Left side - Symbol and Price */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ 
                                  width: '44px', 
                                  height: '44px', 
                                  borderRadius: '12px', 
                                  background: 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#58a6ff',
                                  fontSize: '18px',
                                  fontWeight: '700'
                                }}>
                                  {item.symbol.charAt(0)}
                                </div>
                                <div>
                                  <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px', fontWeight: '600' }}>{item.symbol}</h3>
                                  {priceData && (
                                    <p style={{ margin: 0, color: '#8b949e', fontSize: '12px' }}>Mercado NYSE</p>
                                  )}
                                </div>
                              </div>
                              
                              {priceData ? (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                                  <span style={{ color: '#f0f6fc', fontSize: '28px', fontWeight: '700' }}>${currentPrice.toFixed(2)}</span>
                                  <span style={{ 
                                    color: priceChange >= 0 ? '#2ecc71' : '#e74c3c', 
                                    fontSize: '14px', 
                                    fontWeight: '500',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: priceChange >= 0 ? '#2ecc7115' : '#e74c3c15'
                                  }}>
                                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChangePercent).toFixed(2)}%
                                  </span>
                                </div>
                              ) : watchlistError ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: '#f85149', fontSize: '13px' }}>{watchlistError}</span>
                                  <button
                                    onClick={() => fetchWatchlistPrices([item.symbol])}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      border: '1px solid #30363d',
                                      background: 'transparent',
                                      color: '#58a6ff',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                    }}
                                  >
                                    Reintentar
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #30363d', borderTopColor: '#58a6ff', animation: 'spin 1s linear infinite' }}></div>
                                  <span style={{ color: '#8b949e', fontSize: '14px' }}>Cargando...</span>
                                </div>
                              )}
                            </div>

                            {/* Right side - Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                onClick={() => removeFromWatchlist(item.symbol)}
                                style={{ 
                                  padding: '10px', 
                                  borderRadius: '10px', 
                                  border: 'none', 
                                  background: '#21262d', 
                                  color: '#8b949e', 
                                  cursor: 'pointer',
                                  fontSize: '16px',
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
                            borderTop: '1px solid #30363d'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>{alertEnabled ? '🔔' : '🔕'}</span>
                                <span style={{ color: '#c9d1d9', fontSize: '14px', fontWeight: '500' }}>
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
                                  background: alertEnabled ? '#238636' : '#30363d',
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
                                    background: 'white',
                                    borderRadius: '50%',
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
                                      borderRadius: '12px', 
                                      border: '1px solid #30363d', 
                                      background: '#0d1117', 
                                      color: '#c9d1d9', 
                                      fontSize: '14px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <option value="above">📈Alertar cuando suba a</option>
                                    <option value="below">📉Alertar cuando baje a</option>
                                  </select>
                                  <div style={{ position: 'relative', flex: '0 0 120px' }}>
                                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: '14px' }}>$</span>
                                    <input
                                      type="number"
                                      placeholder="0.00"
                                      value={editingAlert[item.symbol]?.alertPriceInput ?? (alertPrice || '')}
                                      onChange={(e) => setEditingAlert(prev => ({ ...prev, [item.symbol]: { alertType, alertPrice, alertEnabled, alertPriceInput: parseFloat(e.target.value) || 0 } }))}
                                      style={{ 
                                        width: '100%', 
                                        padding: '12px 12px 12px 28px', 
                                        borderRadius: '12px', 
                                        border: '1px solid #30363d', 
                                        background: '#0d1117', 
                                        color: '#c9d1d9', 
                                        fontSize: '14px',
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
                                        borderRadius: '8px', 
                                        border: '1px solid #30363d', 
                                        background: '#21262d', 
                                        color: '#c9d1d9', 
                                        fontSize: '14px',
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
                                        borderRadius: '8px', 
                                        border: 'none', 
                                        background: savingAlert === item.symbol ? '#30363d' : '#238636', 
                                        color: 'white', 
                                        fontSize: '14px',
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
                                background: 'linear-gradient(135deg, #2ecc7130 0%, #2ecc7115 100%)',
                                borderRadius: '12px', 
                                border: '1px solid #2ecc71',
                                color: '#2ecc71', 
                                fontSize: '14px', 
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <span style={{ fontSize: '18px' }}>🎉</span>
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
      <div style={{ width: '100%', maxWidth: isMobile ? '100%' : '1200px', margin: '0 auto', padding: isMobile ? '12px' : '20px', boxSizing: 'border-box' }}>
          {data?.informeDetail ? (
            <RenderInforme informe={data.informeDetail} data={data} />
          ) : data ? (
            <RenderInformeLegacy data={data} formatNumber={formatNumber} getActionColor={getActionColor} />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📋</p>
              <p>Analiza una acción para ver el informe</p>
            </div>
          )}
        </div>
      )}

      {/* Vista de Risk Report */}
      {view === 'risk-report' && (
        data ? <RiskReport data={data} symbol={symbol} /> : (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', textAlign: 'center' }}>
            <div style={{ background: '#0d1117', borderRadius: '16px', padding: '80px 32px', border: '1px solid #30363d' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📊</p>
              <p style={{ color: '#8b949e', fontSize: '16px' }}>Analiza una acción primero para ver su Risk Report</p>
              <p style={{ color: '#8b949e', fontSize: '13px' }}>Usa el Analizador para buscar un ticker</p>
            </div>
          </div>
        )
      )}

      {/* Vista de Framework PRO */}
      {view === 'framework' && data && (
        <FrameworkView data={data} />
      )}

      {/* Vista de Opciones */}
      {view === 'options' && (
        <OptionsView 
          initialSymbol={symbol} 
          currentSymbol={symbol} 
          onSymbolChange={(sym) => setSymbol(sym)} 
          onAnalyzeInMain={(sym) => {
            setSymbol(sym);
            searchStock(sym);
          }} 
        />
      )}

      {/* Vista de Screener */}
      {view === 'screener' && (
        <ScreenerPage />
      )}

      {/* Vista de Trade Validator */}
      {view === 'trade-validator' && (
        <TradeValidator initialSymbol={symbol} onSymbolChange={(sym) => setSymbol(sym)} />
      )}

      {/* Vista de TradeStation */}
      {view === 'tradestation' && (
        <TradeStationPanel />
      )}

      {/* Vista de Briefing */}
      {view === 'briefing' && (
        <Dashboard onNavigateToAICoach={() => setView('ai-coach')} initialSection="briefing" />
      )}

      {/* Vista de Dashboard */}
      {view === 'dashboard' && (
        <Dashboard onNavigateToAICoach={() => setView('ai-coach')} />
      )}

      {/* Vista de AI Coach */}
      {view === 'ai-coach' && (
        <AICoach symbol={symbol} onAnalyzeSymbol={(sym) => setSymbol(sym)} />
      )}

      {/* Vista de Backtest */}
      {view === 'backtest' && (
        <BacktestPanel />
      )}

      {/* Vista de Inversor Inteligente */}
      {view === 'inversor-inteligente' && (
        <ScreenerGraham onSelect={(sym) => { setSymbol(sym); setView('analyzer'); }} />
      )}

      {/* Vista de Trading Trainer */}
      {view === 'trading-trainer' && (
        <TradingTrainer />
      )}

      {/* Vista de Smart Alerts */}
      {view === 'alerts' && (
        <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
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
          <div style={{ background: '#161b22', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#f0f6fc' }}>Agregar {watchlistForm.symbol} a Watchlist</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>🔔 Configurar alerta de precio</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d1117', borderRadius: '8px' }}>
                <span style={{ color: '#c9d1d9', fontSize: '14px' }}>Activar alerta</span>
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
                    background: watchlistForm.alertEnabled ? '#238636' : '#30363d',
                    borderRadius: '24px',
                    transition: '0.3s'
                  }}>
                    <span style={{
                      position: 'absolute',
                      height: '18px',
                      width: '18px',
                      left: watchlistForm.alertEnabled ? '23px' : '3px',
                      bottom: '3px',
                      background: 'white',
                      borderRadius: '50%',
                      transition: '0.3s'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {watchlistForm.alertEnabled && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Tipo de alerta</label>
                  <select
                    value={watchlistForm.alertType}
                    onChange={(e) => setWatchlistForm({ ...watchlistForm, alertType: e.target.value as 'above' | 'below' })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: '#0d1117',
                      color: '#c9d1d9',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="above">📈 Alerta cuando suba a...</option>
                    <option value="below">📉 Alerta cuando baje a...</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Precio objetivo</label>
                  <input
                    type="number"
                    value={watchlistForm.alertPrice}
                    onChange={(e) => setWatchlistForm({ ...watchlistForm, alertPrice: e.target.value })}
                    placeholder="Ej: 150.00"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: '#0d1117',
                      color: '#c9d1d9',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#58a6ff' }}>
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
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: 'transparent',
                  color: '#c9d1d9',
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
                  borderRadius: '8px',
                  border: 'none',
                  background: '#238636',
                  color: 'white',
                  fontSize: '16px',
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
          <div style={{ background: '#161b22', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#f0f6fc' }}>Agregar al Portafolio</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Símbolo</label>
              <input
                type="text"
                value={data?.quote?.symbol || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  opacity: 0.7,
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Número de acciones *</label>
              <input
                type="number"
                value={addForm.shares}
                onChange={e => setAddForm({ ...addForm, shares: e.target.value })}
                placeholder="Ej: 100"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Precio de compra por acción</label>
              <input
                type="number"
                value={addForm.price}
                onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                placeholder="Precio actual"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Fecha de compra</label>
              <input
                type="date"
                value={addForm.date}
                onChange={e => setAddForm({ ...addForm, date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Precio objetivo (opcional)</label>
              <input
                type="number"
                value={addForm.targetPrice}
                onChange={e => setAddForm({ ...addForm, targetPrice: e.target.value })}
                placeholder="Precio objetivo"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Notas (opcional)</label>
              <textarea
                value={addForm.notes}
                onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                placeholder="Notas sobre esta posición..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
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
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: 'transparent',
                  color: '#c9d1d9',
                  fontSize: '16px',
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
                  borderRadius: '8px',
                  border: 'none',
                  background: '#238636',
                  color: 'white',
                  fontSize: '16px',
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
          <div style={{ background: '#161b22', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', color: '#f0f6fc' }}>Editar {editingItem.symbol}</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Número de acciones *</label>
              <input
                type="number"
                value={addForm.shares}
                onChange={e => setAddForm({ ...addForm, shares: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Precio de compra por acción *</label>
              <input
                type="number"
                value={addForm.price}
                onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Fecha de compra</label>
              <input
                type="date"
                value={addForm.date}
                onChange={e => setAddForm({ ...addForm, date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Precio objetivo</label>
              <input
                type="number"
                value={addForm.targetPrice}
                onChange={e => setAddForm({ ...addForm, targetPrice: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '14px' }}>Notas</label>
              <textarea
                value={addForm.notes}
                onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: '#0d1117',
                  color: '#c9d1d9',
                  fontSize: '14px',
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
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: 'transparent',
                  color: '#c9d1d9',
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
                  borderRadius: '8px',
                  border: 'none',
                  background: '#1f6feb',
                  color: 'white',
                  fontSize: '16px',
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
  const router = useRouter();
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
    if (status === 'pass') return { icon: '✅', color: '#3fb950' };
    return { icon: '❌', color: '#f85149' };
  };

  const getStatusTextColor = (status: CheckStatus) => {
    if (status === 'pass') return '#3fb950';
    return '#f85149';
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
    let labelColor = '#f85149';
    if (score === 3) {
      label = 'Óptimo';
      labelColor = '#3fb950';
    } else if (score === 2) {
      label = 'Válido';
      labelColor = '#58a6ff';
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
  }, [searchParams, initialSymbol]);

  useEffect(() => {
    if (selectedSymbolFromScreener) {
      setSymbol(selectedSymbolFromScreener);
      setActiveTab('analyze');
      analyzeOptions(selectedSymbolFromScreener);
      if (onSymbolChange) onSymbolChange(selectedSymbolFromScreener);
      setSelectedSymbolFromScreener(null);
    }
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
    if (activeTab === 'screener' && !screenerData) {
      loadScreener();
    }
  }, [activeTab]);

  const getRecommendationColor = (rec: string) => {
    if (rec === 'excelente') return '#3fb950';
    if (rec === 'buena') return '#58a6ff';
    if (rec === 'regular') return '#f0883e';
    return '#f85149';
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'bajo') return '#3fb950';
    if (risk === 'medio') return '#f0883e';
    return '#f85149';
  };

  const formatIV = (iv: number) => (iv * 100).toFixed(1) + '%';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#f0f6fc', marginBottom: '8px' }}>🎯 Estrategias de Opciones</h2>
        <p style={{ color: '#8b949e', margin: 0, fontSize: '14px' }}>Analiza estrategias de opciones y encuentra acciones ideales para operar</p>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px', minHeight: '24px' }}>
        {data && activeTab === 'analyze' && (
          <button
            onClick={() => setShowChecklist(true)}
            style={{
              padding: '12px 20px',
              borderRadius: '8px',
              border: '2px solid #f0883e',
              background: 'linear-gradient(135deg, #f0883e20 0%, #f0883e10 100%)',
              color: '#f0883e',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
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
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'analyze' ? '#238636' : '#161b22',
            color: '#f0f6fc',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          Analizar Ticker
        </button>
        <button
          onClick={() => setActiveTab('screener')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'screener' ? '#238636' : '#161b22',
            color: '#f0f6fc',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
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
                borderRadius: '8px',
                border: '1px solid #30363d',
                background: '#161b22',
                color: '#c9d1d9',
                fontSize: '16px',
                outline: 'none',
              }}
            />
            <button
              onClick={analyzeOptions}
              disabled={loading}
              style={{
                padding: '14px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#238636',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '...' : 'Analizar'}
            </button>
          </div>

          {error && (
            <div style={{ padding: '16px', borderRadius: '8px', background: '#f8514920', color: '#f85149', textAlign: 'center', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {data && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Header */}
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: '28px' }}>{data.quote?.symbol}</h2>
                    <p style={{ margin: '4px 0 0', color: '#8b949e' }}>{data.quote?.shortName}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#f0f6fc' }}>${data.quote?.price?.toFixed(2)}</p>
                    <p style={{ margin: '4px 0 0', color: data.quote?.change >= 0 ? '#3fb950' : '#f85149', fontSize: '16px' }}>
                      {data.quote?.change >= 0 ? '+' : ''}{data.quote?.changePercent?.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock Evaluation */}
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>📊 Evaluación para Opciones</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>Score de Suitabilidad</p>
                    <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: getRecommendationColor(data.stockEvaluation?.recommendation) }}>
                      {data.stockEvaluation?.suitabilityScore || 0}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: getRecommendationColor(data.stockEvaluation?.recommendation), textTransform: 'uppercase', fontWeight: '600' }}>
                      {data.stockEvaluation?.recommendation?.replace('_', ' ')}
                    </p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>Mejor Estrategia</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#58a6ff' }}>{data.stockEvaluation?.topStrategy}</p>
                    <div style={{ marginTop: '12px' }}>
                      {data.stockEvaluation?.reasons?.slice(0, 2).map((r: string, i: number) => (
                        <p key={i} style={{ margin: '4px 0 0', fontSize: '12px', color: '#8b949e' }}>• {r}</p>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>Tendencia</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: data.technical?.trend === 'alcista' ? '#3fb950' : data.technical?.trend === 'bajista' ? '#f85149' : '#f0883e', textTransform: 'capitalize' }}>
                      {data.technical?.trend || 'lateral'}
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#8b949e' }}>RSI: {data.technical?.rsi?.toFixed(1)}</p>
                  </div>
                </div>
              </div>

              {/* IV Analysis */}
              {data.optionsAnalysis && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>📈 Volatilidad Implícita (IV)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>IV Actual</p>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#58a6ff' }}>{formatIV(data.optionsAnalysis.impliedVolatility)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>IV Rank</p>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: data.optionsAnalysis.ivRank > 50 ? '#f0883e' : '#3fb950' }}>{data.optionsAnalysis.ivRank?.toFixed(0)}%</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>IV Percentile</p>
                      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#f0f6fc' }}>{data.optionsAnalysis.ivPercentile?.toFixed(0)}%</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Comparación Histórica</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#58a6ff' }}>{data.optionsAnalysis.ivComparison?.interpretation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Levels */}
              {data.optionsAnalysis && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>🎯 Niveles Clave</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Soporte</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#3fb950' }}>${data.optionsAnalysis.keyLevels?.support?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Pivote</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#f0f6fc' }}>${data.optionsAnalysis.keyLevels?.pivot?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Resistencia</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#f85149' }}>${data.optionsAnalysis.keyLevels?.resistance?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Strategies */}
              {data.optionsAnalysis?.recommendedStrategies?.length > 0 && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>🏆 Estrategias Recomendadas</h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {data.optionsAnalysis.recommendedStrategies.map((rec: any, idx: number) => (
                      <div key={idx} style={{ background: '#0d1117', padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${getRiskColor(rec.strategy.riskLevel)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <h4 style={{ margin: 0, color: '#f0f6fc', fontSize: '16px' }}>{idx + 1}. {rec.strategy.name}</h4>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: getRiskColor(rec.strategy.riskLevel) + '30', color: getRiskColor(rec.strategy.riskLevel) }}>
                              Riesgo {rec.strategy.riskLevel.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Score</p>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#58a6ff' }}>{rec.suitabilityScore?.toFixed(0)}%</p>
                          </div>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#c9d1d9' }}>{rec.strategy.description}</p>
                        
                        {/* Ejemplo Práctico */}
                        {rec.strategy.example && rec.strategy.example.totalCost > 0 && (
                          <div style={{ background: '#1a2332', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: '13px', color: '#58a6ff', fontWeight: '600' }}>📋 PLAN DE ACCIÓN</p>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ padding: '4px 10px', background: '#0d1117', borderRadius: '4px', fontSize: '12px', color: '#8b949e' }}>
                                  📅 {rec.strategy.example.expiration}
                                </span>
                                <span style={{ padding: '4px 10px', background: '#0d1117', borderRadius: '4px', fontSize: '12px', color: '#8b949e' }}>
                                  ⏱ {rec.strategy.example.daysToExpiration} días
                                </span>
                              </div>
                            </div>

                            {/* Instrucciones de Compra/Venta */}
                            {rec.strategy.name === 'Bull Call Spread' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 CALL ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: '#da3633', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 VENDE</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 CALL ${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.deltaUpper?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#3fb950', fontWeight: '600' }}>Costo neto:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#58a6ff', fontWeight: '600' }}>Ganancia máx:</span> ${((rec.strategy.example.strikeUpper! - rec.strategy.example.strike) * 100 - rec.strategy.example.totalCost)?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Bull Put Spread' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: '#da3633', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 VENDE</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '12px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 PUT ${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.deltaUpper?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#3fb950', fontWeight: '600' }}>Crédito neto:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#58a6ff', fontWeight: '600' }}>Ganancia máx:</span> ${rec.strategy.example.totalCost?.toFixed(2)} (crédito recibido)
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Covered Call' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '16px', background: '#da3633', borderRadius: '8px', textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 VENDE (si tienes 100 acciones de {data.quote?.symbol})</p>
                                  <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold', color: 'white' }}>1 CALL ${rec.strategy.example.strike?.toFixed(2)}</p>
                                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px', marginTop: '8px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#3fb950', fontWeight: '600' }}>Prima Recibida:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#f0883e', fontWeight: '600' }}>Renuncias a ganancias sobre:</span> ${rec.strategy.example.strike?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Cash-Secured Put' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '16px', background: '#da3633', borderRadius: '8px', textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 VENDE</p>
                                  <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold', color: 'white' }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px', marginTop: '8px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#3fb950', fontWeight: '600' }}>Prima Recibida:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#f0883e', fontWeight: '600' }}>Margen requerido:</span> $${(rec.strategy.example.strike * 100)?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Protective Put' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ padding: '16px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                  <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA (para proteger 100 acciones)</p>
                                  <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold', color: 'white' }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>Δ {rec.strategy.example.delta?.toFixed(2)}</p>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px', marginTop: '8px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#f0883e', fontWeight: '600' }}>Costo:</span> ${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#58a6ff', fontWeight: '600' }}>Protección hasta:</span> $${rec.strategy.example.strike?.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Long Straddle' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 CALL ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ ~0.50</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ ~-0.50</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#f0883e', fontWeight: '600' }}>Costo total:</span> $${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#58a6ff', fontWeight: '600' }}>Movimiento mínimo:</span> {((rec.strategy.example.totalCost / rec.strategy.example.strike) * 100)?.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Long Strangle' && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 CALL ${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ ~0.20</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '120px', padding: '12px', background: '#238636', borderRadius: '8px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>📌 COMPRA</p>
                                    <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'white' }}>1 PUT ${rec.strategy.example.strike?.toFixed(2)}</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Δ ~-0.20</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#f0883e', fontWeight: '600' }}>Costo total:</span> $${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#58a6ff', fontWeight: '600' }}>Necesita movimiento mayor</span>
                                  </p>
                                </div>
                              </div>
                            )}
                            {rec.strategy.name === 'Iron Condor' && (
                              <div style={{ marginBottom: '12px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#58a6ff', fontWeight: '600' }}>🟢 LADO PUT (Bajista):</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: '#da3633', borderRadius: '6px', textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>VENDE PUT</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>${rec.strategy.example.strike?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: '#238636', borderRadius: '6px', textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>COMPRA PUT</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#58a6ff', fontWeight: '600' }}>🔴 LADO CALL (Alcista):</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: '#da3633', borderRadius: '6px', textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>VENDE CALL</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>${rec.strategy.example.strikeUpper?.toFixed(2)}</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: '110px', padding: '10px', background: '#238636', borderRadius: '6px', textAlign: 'center' }}>
                                    <p style={{ margin: '0', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>COMPRA CALL</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>${rec.strategy.example.strikeUpper! * 1.1?.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '10px', background: '#0d1117', borderRadius: '6px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>
                                    <span style={{ color: '#3fb950', fontWeight: '600' }}>Crédito total:</span> $${rec.strategy.example.totalCost?.toFixed(2)} | 
                                    <span style={{ color: '#58a6ff', fontWeight: '600' }}>Ganancia si precio estable</span>
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Resumen Final */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #30363d' }}>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#0d1117', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Gan. Máx</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#3fb950' }}>
                                  {rec.strategy.example.maxProfitPercent === '∞' || rec.strategy.example.maxProfit === 'ilimitado' 
                                    ? <><span style={{ fontSize: '16px' }}>∞</span> <span style={{ fontSize: '10px', opacity: 0.7 }}>%</span></>
                                    : <>{rec.strategy.example.maxProfitPercent}% <span style={{ fontSize: '10px', opacity: 0.7 }}>→ ${typeof rec.strategy.example.maxProfit === 'number' ? rec.strategy.example.maxProfit.toFixed(0) : rec.strategy.example.maxProfit}</span></>}
                                </p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#0d1117', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Pérd. Máx</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#f85149' }}>
                                  {rec.strategy.example.maxLossPercent === '∞' || rec.strategy.example.maxLoss === 'ilimitado'
                                    ? <><span style={{ fontSize: '16px' }}>∞</span> <span style={{ fontSize: '10px', opacity: 0.7 }}>%</span></>
                                    : <>{rec.strategy.example.maxLossPercent}% <span style={{ fontSize: '10px', opacity: 0.7 }}>→ ${typeof rec.strategy.example.maxLoss === 'number' ? rec.strategy.example.maxLoss.toFixed(0) : rec.strategy.example.maxLoss}</span></>}
                                </p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#0d1117', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Prima/Acc</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#58a6ff' }}>${rec.strategy.example.premium?.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#0d1117', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Contratos</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#f0f6fc' }}>{rec.strategy.example.contracts}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#0d1117', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Costo Total</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#f0883e' }}>
                                  {rec.strategy.example.costPercent}% <span style={{ fontSize: '10px', opacity: 0.7 }}>→ ${rec.strategy.example.totalCost?.toFixed(0)}</span>
                                </p>
                              </div>
                            </div>
                            {/* TP / SL */}
                            {rec.strategy.example.takeProfit && rec.strategy.example.stopLoss && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                                <div style={{ padding: '10px', background: '#3fb95020', borderRadius: '6px', border: '1px solid #3fb95040' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '12px' }}>🎯</span>
                                    <span style={{ fontSize: '10px', color: '#8b949e' }}>Take Profit</span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#3fb950' }}>
                                    {rec.strategy.example.takeProfit.percent > 0 ? '+' : ''}{rec.strategy.example.takeProfit.percent}%
                                    <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>
                                      → ${rec.strategy.example.takeProfit.price?.toFixed(2)}
                                    </span>
                                  </p>
                                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#8b949e' }}>
                                    {rec.strategy.example.takeProfit.description}
                                    {rec.strategy.example.takeProfit.tpPercent && ` (cierra al ${rec.strategy.example.takeProfit.tpPercent}%)`}
                                  </p>
                                </div>
                                <div style={{ padding: '10px', background: '#f8514920', borderRadius: '6px', border: '1px solid #f8514940' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '12px' }}>🛑</span>
                                    <span style={{ fontSize: '10px', color: '#8b949e' }}>Stop Loss</span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#f85149' }}>
                                    {rec.strategy.example.stopLoss.percent}%
                                    <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7 }}>
                                      → ${rec.strategy.example.stopLoss.price?.toFixed(2)}
                                    </span>
                                  </p>
                                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#8b949e' }}>
                                    {rec.strategy.example.stopLoss.description}
                                    {rec.strategy.example.stopLoss.slPercent && ` (cierra al ${rec.strategy.example.stopLoss.slPercent}%)`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8b949e' }}>Condición ideal:</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#c9d1d9' }}>{rec.strategy.idealCondition}</p>
                        </div>
                        <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#58a6ff', fontStyle: 'italic' }}>{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options Expirations */}
              {data.optionsAnalysis?.nextExpirations?.length > 0 && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>📅 Próximas Caducidades</h3>
                  {data.optionsAnalysis.nextExpirations.map((exp: any, idx: number) => (
                    <div key={idx} style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', marginBottom: idx < data.optionsAnalysis.nextExpirations.length - 1 ? '12px' : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, color: '#f0f6fc', fontSize: '14px' }}>{exp.date}</h4>
                        <span style={{ fontSize: '12px', color: '#8b949e' }}>{exp.daysToExpiration} días</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                        {exp.calls?.slice(0, 3).map((c: any, i: number) => (
                          <div key={i} style={{ padding: '8px', background: '#161b22', borderRadius: '6px', fontSize: '12px' }}>
                            <p style={{ margin: '0 0 4px', color: '#3fb950' }}>CALL Strike ${c.strike?.toFixed(2)}</p>
                            <p style={{ margin: 0, color: '#8b949e' }}>Prima: ${c.lastPrice?.toFixed(2)} | IV: {formatIV(c.impliedVolatility)}</p>
                            <p style={{ margin: '4px 0 0', color: '#8b949e' }}>Delta: {c.delta?.toFixed(2)} | OI: {c.openInterest?.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Events */}
              {(data.optionsAnalysis?.earningsDate || data.optionsAnalysis?.dividendDate) && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>📆 Eventos Importantes</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {data.optionsAnalysis.earningsDate && (
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>📊 Earnings</p>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            fontWeight: '600',
                            background: data.optionsAnalysis.earningsEstimate ? '#f0883e30' : '#3fb95030',
                            color: data.optionsAnalysis.earningsEstimate ? '#f0883e' : '#3fb950'
                          }}>
                            {data.optionsAnalysis.earningsEstimate ? '⚠️ ESTIMADO' : '✓ CONFIRMADO'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#f0883e' }}>{data.optionsAnalysis.earningsDate}</p>
                        {data.optionsAnalysis.earningsEstimate && (
                          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#8b949e' }}>Fecha puede cambiar</p>
                        )}
                      </div>
                    )}
                    {data.optionsAnalysis.dividendDate && (
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>💰 Dividend</p>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#3fb950' }}>{data.optionsAnalysis.dividendDate}</p>
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
                      background: '#161b22',
                      borderRadius: '16px',
                      padding: '24px',
                      width: '100%',
                      maxWidth: '600px',
                      maxHeight: '90vh',
                      overflowY: 'auto',
                      border: '1px solid #30363d',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '20px' }}>🧠 Checklist Institucional</h3>
                      <button
                        onClick={() => setShowChecklist(false)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #30363d',
                          background: 'transparent',
                          color: '#8b949e',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        ✕ Cerrar
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: '16px' }}>
                      {/* 1. Contexto Mercado */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #58a6ff' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#58a6ff', fontSize: '14px' }}>🔵 1. CONTEXTO DEL MERCADO</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.marketAligned).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.marketAligned) }}>¿SPY/QQQ en tendencia clara? ({data.technical?.trend || 'lateral'})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.priceAligned).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.priceAligned) }}>¿Precio alineado con tendencia?</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Setup */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #00d4aa' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#00d4aa', fontSize: '14px' }}>🟢 2. SETUP (TU EDGE)</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.breakout).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.breakout) }}>¿Breakout claro de resistencia? (Score: {data.stockEvaluation?.suitabilityScore || 0})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.aboveResistance).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.aboveResistance) }}>¿Precio sobre pivote? (Precio: ${data.optionsAnalysis?.keyLevels?.currentPrice?.toFixed(2)} | Pivote: ${data.optionsAnalysis?.keyLevels?.pivot?.toFixed(2)})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.volumeUp).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.volumeUp) }}>¿Volumen superior al promedio?</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.aboveEMAs).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.aboveEMAs) }}>¿Está por encima de EMAs 8/21/50?</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Ubicación Precio */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #f0883e' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#f0883e', fontSize: '14px' }}>🟡 3. UBICACIÓN DEL PRECIO</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.notExtended).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.notExtended) }}>¿No está sobreextendido?</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.hasSpace).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.hasSpace) }}>¿Hay espacio hasta resistencia (${data.optionsAnalysis?.keyLevels?.resistance?.toFixed(2)})?</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Riesgo/Recompensa */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #f85149' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#f85149', fontSize: '14px' }}>🔴 4. RIESGO / RECOMPENSA</h4>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.goodRiskReward).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.goodRiskReward) }}>¿Spread da al menos 1:1? ({data.optionsAnalysis?.recommendedStrategies?.length || 0} estrategias)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.riskAcceptable).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.riskAcceptable) }}>¿Riesgo {'<'}3% del capital?</span>
                          </div>
                        </div>
                      </div>

                      {/* 5. Tiempo */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #6e7681' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#8b949e', fontSize: '14px' }}>⚫ 5. TIEMPO (EXPIRACIÓN)</h4>
                        
                        {timeValidation ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                              <span style={{ 
                                fontSize: '12px', 
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
                              <div style={{ textAlign: 'center', padding: '8px', background: '#161b22', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Dist. Target</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#f0f6fc' }}>${timeValidation.distance.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#161b22', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Días Est.</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: timeValidation.estimatedDays <= timeValidation.expirationDays ? '#3fb950' : '#f85149' }}>
                                  {timeValidation.estimatedDays}d
                                </p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#161b22', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Exp. Days</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#58a6ff' }}>{timeValidation.expirationDays}d</p>
                              </div>
                              <div style={{ textAlign: 'center', padding: '8px', background: '#161b22', borderRadius: '6px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#8b949e' }}>Exp. Move</p>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#f0883e' }}>${timeValidation.expectedMove.toFixed(2)}</p>
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                                <span>{timeValidation.estimatedDays <= timeValidation.expirationDays ? '✅' : '❌'}</span>
                                <span style={{ color: '#8b949e' }}>ADR cabe en exp</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                                <span>{timeValidation.expectedMove >= timeValidation.distance ? '✅' : '❌'}</span>
                                <span style={{ color: '#8b949e' }}>Exp move cubre</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                                <span>{timeValidation.expirationDays >= timeValidation.expectedDays ? '✅' : '❌'}</span>
                                <span style={{ color: '#8b949e' }}>Setup: {timeValidation.setupType}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                                <span style={{ color: '#8b949e' }}>{timeValidation.expirationDays} días → {timeValidation.estimatedDays}d para target</span>
                              </div>
                            </div>
                            
                            <p style={{ margin: 0, fontSize: '11px', color: timeValidation.score >= 2 ? '#3fb950' : '#f0883e', fontStyle: 'italic' }}>
                              {timeValidation.message}
                            </p>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.goodTiming).icon}</span>
                            <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.goodTiming) }}>Analizando tiempo...</span>
                          </div>
                        )}
                      </div>

                      {/* 6. Volatilidad */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #a371f7' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#a371f7', fontSize: '14px' }}>🟣 6. VOLATILIDAD</h4>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>IV Rank: <span style={{ color: data.optionsAnalysis?.ivRank > 50 ? '#f0883e' : '#3fb950', fontWeight: '600' }}>{(data.optionsAnalysis?.ivRank || 0).toFixed(0)}%</span> - {data.optionsAnalysis?.ivRank > 50 ? 'Alta (vender spreads)' : 'Baja (comprar spreads)'}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.ivFavorable).icon}</span>
                          <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.ivFavorable) }}>¿Estrategia alineada con IV actual?</span>
                        </div>
                      </div>

                      {/* 7. Eventos */}
                      <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #f0883e' }}>
                        <h4 style={{ margin: '0 0 12px', color: '#f0883e', fontSize: '14px' }}>⚠️ 7. EVENTOS</h4>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>
                          Earnings: <span style={{ color: data.optionsAnalysis?.earningsDate ? '#f0883e' : '#3fb950', fontWeight: '600' }}>
                            {data.optionsAnalysis?.earningsDate || 'Ninguno cercano'}
                          </span>
                          {data.optionsAnalysis?.earningsDaysUntil && data.optionsAnalysis?.earningsDaysUntil <= 30 && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 6px', background: data.optionsAnalysis.earningsDaysUntil <= 14 ? '#f8514930' : '#f0883e30', borderRadius: '4px', color: data.optionsAnalysis.earningsDaysUntil <= 14 ? '#f85149' : '#f0883e' }}>
                              {data.optionsAnalysis.earningsDaysUntil <= 0 ? '⚠️ YA PASÓ' : `En ${data.optionsAnalysis.earningsDaysUntil} días`}
                            </span>
                          )}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{getStatusIcon(preTradeChecklist.noEvents).icon}</span>
                          <span style={{ fontSize: '13px', color: getStatusTextColor(preTradeChecklist.noEvents) }}>¿Sin eventos en {'>'}14 días?</span>
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
                          decisionColor = '#3fb950';
                          bgColor = '#3fb95020';
                        } else if (failCount >= 4) {
                          decision = '❌ NO TRADE';
                          decisionColor = '#f85149';
                          bgColor = '#f8514920';
                        } else {
                          decision = '⚠️ RIESGOSO';
                          decisionColor = '#f0883e';
                          bgColor = '#f0883e20';
                        }
                        
                        return (
                          <div style={{ background: bgColor, padding: '20px', borderRadius: '12px', border: `2px solid ${decisionColor}`, textAlign: 'center' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 'bold', color: decisionColor }}>{decision}</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#8b949e' }}>
                              ✅ {passCount} &nbsp; ❌ {failCount} / {totalChecks}
                            </p>
                            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6e7681', fontStyle: 'italic' }}>"Si tengo que convencerme para entrar, ya es un NO."</p>
                          </div>
                        );
                      })()}

                      {/* Botón Cerrar */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                        <button
                          onClick={() => setShowChecklist(false)}
                          style={{
                            padding: '12px 32px', borderRadius: '8px', border: 'none',
                            background: '#238636', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
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
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #30363d', borderTopColor: '#58a6ff', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
              <p style={{ color: '#8b949e' }}>Analizando acciones...</p>
            </div>
          ) : screenerData ? (
            <div>
              {/* Summary */}
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px' }}>📊 Resumen del Screener</h3>
                  <button
                    onClick={loadScreener}
                    disabled={screenerLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: 'transparent',
                      color: '#58a6ff',
                      cursor: screenerLoading ? 'wait' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {screenerLoading ? (
                      <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #30363d', borderTopColor: '#58a6ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                    ) : (
                      '🔄'
                    )}
                    Refrescar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#3fb950' }}>{screenerData.summary?.excellent || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Excelentes</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#58a6ff' }}>{screenerData.summary?.buena || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Buenas</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#f0883e' }}>{screenerData.summary?.regular || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Regulares</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#f85149' }}>{screenerData.summary?.notRecommended || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>No Recomendadas</p>
                  </div>
                  <div 
                    onClick={() => setShowChanges(!showChanges)}
                    style={{ 
                      background: '#0d1117', 
                      padding: '16px', 
                      borderRadius: '8px', 
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: (symbolChanges.added.length > 0 || symbolChanges.removed.length > 0) ? '2px solid #f0883e' : '1px solid #30363d',
                    }}
                  >
                    <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 'bold', color: '#f0883e' }}>
                      {symbolChanges.added.length > 0 && <span style={{ color: '#3fb950' }}>+{symbolChanges.added.length}</span>}
                      {symbolChanges.added.length > 0 && symbolChanges.removed.length > 0 && ' / '}
                      {symbolChanges.removed.length > 0 && <span style={{ color: '#f85149' }}>-{symbolChanges.removed.length}</span>}
                      {symbolChanges.added.length === 0 && symbolChanges.removed.length === 0 && <span style={{ color: '#8b949e' }}>Sin cambios</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>Ver cambios {showChanges ? '▲' : '▼'}</p>
                  </div>
                </div>

                {/* Detalle de cambios */}
                {showChanges && (
                  <div style={{ marginTop: '16px', padding: '16px', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px', color: '#3fb950', fontSize: '13px', fontWeight: '600' }}>🟢 Agregadas ({symbolChanges.added.length})</p>
                        {symbolChanges.added.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {symbolChanges.added.map((sym) => (
                              <span
                                key={sym}
                                onClick={() => setSelectedSymbolFromScreener(sym)}
                                style={{
                                  padding: '4px 10px',
                                  background: '#3fb95020',
                                  borderRadius: '4px',
                                  color: '#3fb950',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                              >
                                {sym}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '12px', color: '#484f58' }}>Ninguna</p>
                        )}
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px', color: '#f85149', fontSize: '13px', fontWeight: '600' }}>🔴 Removidas ({symbolChanges.removed.length})</p>
                        {symbolChanges.removed.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {symbolChanges.removed.map((sym) => (
                              <span
                                key={sym}
                                style={{
                                  padding: '4px 10px',
                                  background: '#f8514920',
                                  borderRadius: '4px',
                                  color: '#f85149',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                }}
                              >
                                {sym}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '12px', color: '#484f58' }}>Ninguna</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Top Picks */}
              {screenerData.topPicks?.length > 0 && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '18px' }}>🏆 Top Picks para Opciones <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 'normal' }}>(clic para analizar)</span></h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {screenerData.topPicks.slice(0, 5).map((stock: any, idx: number) => {
                      const isNew = newSymbols.has(stock.symbol);
                      return (
                      <div 
                        key={stock.symbol} 
                        onClick={() => setSelectedSymbolFromScreener(stock.symbol)}
                        style={{ 
                          background: '#0d1117', 
                          padding: '16px', 
                          borderRadius: '8px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          flexWrap: 'wrap', 
                          gap: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: isNew ? '2px solid #3fb950' : '1px solid transparent',
                          boxShadow: isNew ? '0 0 10px rgba(63, 185, 80, 0.2)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#1a2332';
                          e.currentTarget.style.borderColor = '#58a6ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#0d1117';
                          e.currentTarget.style.borderColor = isNew ? '#3fb950' : 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#58a6ff', width: '28px', textAlign: 'center' }}>{idx + 1}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#58a6ff' }}>{stock.symbol}</p>
                              {isNew && <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: '#3fb950', color: 'white', fontWeight: '700' }}>NUEVA</span>}
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8b949e' }}>{stock.name}</p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#30363d', color: '#8b949e' }}>IV: {((stock.iv || 0) * 100).toFixed(0)}%</span>
                              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#30363d', color: '#8b949e' }}>Vol: {(stock.volume / 1000000).toFixed(1)}M</span>
                              {stock.nearEarnings && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#f0883e30', color: '#f0883e' }}>⚠ Earnings</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#f0f6fc' }}>${stock.price?.toFixed(2)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: stock.change >= 0 ? '#3fb950' : '#f85149' }}>
                              {stock.change >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#58a6ff' }}>{stock.topStrategy}</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: getRecommendationColor(stock.recommendation) }}>{stock.suitabilityScore}</p>
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
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px' }}>📋 Todas las Acciones Analizadas</h3>
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>
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
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: '#0d1117',
                      color: '#c9d1d9',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  {screenerFilter && (
                    <button
                      onClick={() => setScreenerFilter('')}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid #30363d',
                        background: 'transparent',
                        color: '#8b949e',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <th onClick={() => handleSort('symbol')} style={{ padding: '12px 8px', textAlign: 'left', color: sortField === 'symbol' ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Símbolo {sortField === 'symbol' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('price')} style={{ padding: '12px 8px', textAlign: 'right', color: sortField === 'price' ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Precio {sortField === 'price' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('iv')} style={{ padding: '12px 8px', textAlign: 'center', color: sortField === 'iv' ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>IV % {sortField === 'iv' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('volume')} style={{ padding: '12px 8px', textAlign: 'right', color: sortField === 'volume' ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Volumen {sortField === 'volume' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('suitabilityScore')} style={{ padding: '12px 8px', textAlign: 'center', color: sortField === 'suitabilityScore' ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Score {sortField === 'suitabilityScore' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                        <th style={{ padding: '12px 8px', textAlign: 'center', color: '#8b949e', fontSize: '11px', fontWeight: '600' }}>Earnings</th>
                        <th onClick={() => handleSort('topStrategy')} style={{ padding: '12px 8px', textAlign: 'left', color: sortField === 'topStrategy' ? '#58a6ff' : '#8b949e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Estrategia {sortField === 'topStrategy' && (sortDir === 'asc' ? '↑' : '↓')}</th>
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
                            borderBottom: '1px solid #30363d',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            background: isNew ? 'rgba(63, 185, 80, 0.1)' : 'transparent',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#1a2332'}
                          onMouseLeave={(e) => e.currentTarget.style.background = isNew ? 'rgba(63, 185, 80, 0.1)' : 'transparent'}
                        >
                          <td style={{ padding: '10px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#58a6ff' }}>{stock.symbol}</p>
                              {isNew && <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: '#3fb950', color: 'white', fontWeight: '700' }}>NUEVA</span>}
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#8b949e', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</p>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#f0f6fc', fontSize: '13px' }}>${stock.price?.toFixed(2)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: '#3fb950', fontSize: '12px', fontWeight: '600' }}>
                            {((stock.iv || 0) * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#f0f6fc', fontSize: '11px' }}>
                            {(stock.volume / 1000000).toFixed(1)}M
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: getRecommendationColor(stock.recommendation) + '30', color: getRecommendationColor(stock.recommendation) }}>
                              {stock.suitabilityScore}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {stock.earningsDate ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontSize: '10px', color: '#f0f6fc' }}>{stock.earningsDate}</span>
                                <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: stock.earningsEstimate ? '#f0883e30' : '#3fb95030', color: stock.earningsEstimate ? '#f0883e' : '#3fb950' }}>
                                  {stock.earningsEstimate ? 'ESTIMADA' : 'CONFIRMADA'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#484f58' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: '11px', color: '#58a6ff' }}>{stock.topStrategy}</td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🔍</p>
              <p>Error al cargar el screener</p>
              <button onClick={loadScreener} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#238636', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
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
  const color = score >= 8 ? '#3fb950' : score >= 5 ? '#f0883e' : '#f85149';

  const isJoyas = fcfYield > 8 && pe < 25 && revGrowth > 5 && margin > 10;
  const isGrowth = fcfYield < 3 && pe > 25 && revGrowth > 20 && margin > 0;
  const isValueTrap = fcfYield > 8 && pe < 15 && revGrowth < 5 && margin < 10;
  const isBomba = fcfYield < 0 && pe > 25 && revGrowth < 0 && margin < 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', color: '#f0f6fc' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>🧠 FRAMEWORK PRO</h1>
        <h2 style={{ fontSize: '18px', color: '#8b949e', fontWeight: 'normal' }}>¿Barata o Trampa?</h2>
        <p style={{ color: '#58a6ff', marginTop: '8px' }}>{data.quote?.shortName} ({data.quote?.symbol})</p>
      </div>

      {/* Filtro FCF */}
      <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '16px', borderLeft: '4px solid #f0883e' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>🧩 Filtro Inicial</h4>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: isFCFPositive ? '#3fb950' : '#f85149', margin: 0 }}>
          {isFCFPositive ? '✅ FCF POSITIVO - Modo Valor' : '⚠️ FCF NEGATIVO - Modo Growth'}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #58a6ff' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>💰 FCF Yield</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: fcfYield > 5 ? '#3fb950' : '#f85149', margin: 0 }}>{fcfYield.toFixed(1)}%</p>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '4px 0 0' }}>{fcfYield > 10 ? '💎 Muy barata' : fcfYield > 5 ? '✅ Buena' : fcfYield > 3 ? '😐 Normal' : '⚠️ Cara'}</p>
        </div>
        <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #58a6ff' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>📊 PE Ratio</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: pe < 25 ? '#3fb950' : '#f85149', margin: 0 }}>{pe.toFixed(1)}</p>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '4px 0 0' }}>{pe < 15 ? 'Value' : pe < 25 ? 'Balanceada' : pe < 40 ? 'Growth' : '🚨 Alta'}</p>
        </div>
        <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #58a6ff' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>📈 Revenue</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: revGrowth > 0 ? '#3fb950' : '#f85149', margin: 0 }}>{revGrowth > 0 ? '+' : ''}{revGrowth.toFixed(1)}%</p>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '4px 0 0' }}>{revGrowth > 20 ? '🚀 Alto' : revGrowth > 10 ? '✅ Saludable' : revGrowth > 0 ? '🐢 Lento' : '🚨 Problema'}</p>
        </div>
        <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', borderLeft: '4px solid #58a6ff' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#8b949e' }}>🧾 Margen</h4>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: margin > 10 ? '#3fb950' : '#f85149', margin: 0 }}>{margin.toFixed(1)}%</p>
          <p style={{ fontSize: '12px', color: '#8b949e', margin: '4px 0 0' }}>{margin > 20 ? '💪 Excelente' : margin > 10 ? '✅ Bueno' : '⚠️ Débil'}</p>
        </div>
      </div>

      {/* Score */}
      <div style={{ background: '#161b22', borderRadius: '12px', padding: '24px', marginBottom: '24px', borderLeft: '4px solid ' + color }}>
        <h3 style={{ margin: '0 0 16px', textAlign: 'center' }}>🧭 Score: {score}/10</h3>
        <div style={{ padding: '20px', background: color + '20', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: color, margin: 0 }}>{decision}</p>
        </div>
      </div>

      {/* Escenarios */}
      <div>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>🔥 AHORA LO IMPORTANTE: LA COMBINACIÓN</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '16px', background: '#161b22', borderRadius: '12px', border: isJoyas ? '2px solid #3fb950' : '1px solid #30363d' }}>
            <h4 style={{ margin: '0 0 8px', color: '#3fb950', fontSize: '15px' }}>💎 ESCENARIO 1: Joyas Ocultas</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>FCF Yield &gt;8% + PE bajo + Revenue crece + Margen sólido</p>
            {isJoyas && <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 'bold', color: '#3fb950' }}>✓ ACCIÓN BARATA + GENERA CASH + CRECE</p>}
          </div>
          <div style={{ padding: '16px', background: '#161b22', borderRadius: '12px', border: isGrowth ? '2px solid #58a6ff' : '1px solid #30363d' }}>
            <h4 style={{ margin: '0 0 8px', color: '#58a6ff', fontSize: '15px' }}>🚀 ESCENARIO 2: Growth Caro</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>FCF bajo/neg + PE alto + Revenue &gt;20% + Margen expandiéndose</p>
            {isGrowth && <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 'bold', color: '#58a6ff' }}>✓ CARA HOY, PERO PUEDE SER GANADORA</p>}
          </div>
          <div style={{ padding: '16px', background: '#161b22', borderRadius: '12px', border: isValueTrap ? '2px solid #f85149' : '1px solid #30363d' }}>
            <h4 style={{ margin: '0 0 8px', color: '#f85149', fontSize: '15px' }}>⚠️ ESCENARIO 3: Value Trap</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>FCF Yield alto + PE bajo + Revenue estancado + Margen débil</p>
            {isValueTrap && <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 'bold', color: '#f85149' }}>✗ PARECE BARATA... PERO ESTÁ MUERIENDO</p>}
          </div>
          <div style={{ padding: '16px', background: '#161b22', borderRadius: '12px', border: isBomba ? '2px solid #f85149' : '1px solid #30363d' }}>
            <h4 style={{ margin: '0 0 8px', color: '#f85149', fontSize: '15px' }}>💣 ESCENARIO 4: Bomba de Tiempo</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#8b949e' }}>FCF negativo + PE alto + No crece + Margen bajo</p>
            {isBomba && <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 'bold', color: '#f85149' }}>✗ SOBREVALORADA + SIN FUNDAMENTOS</p>}
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
  const riskColor = gaugeScore <= 30 ? '#22c55e' : gaugeScore <= 60 ? '#f59e0b' : '#ef4444';

  const verAction = data.recommendation?.action || s.verdict || 'HOLD';
  const verColor = verAction === 'COMPRAR' || verAction === 'BUY' ? '#3fb950' : verAction === 'VENDER' || verAction === 'SELL' ? '#ef4444' : '#f59e0b';

  const cardBase = { background: '#161b22', borderRadius: '12px', padding: '20px', border: '1px solid #30363d' };

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
          <button onClick={() => setPage(1)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #30363d', background: page === 1 ? '#238636' : 'transparent', color: '#c9d1d9', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>Page 1 · Overview</button>
          <button onClick={() => setPage(2)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #30363d', background: page === 2 ? '#238636' : 'transparent', color: '#c9d1d9', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>Page 2 · Deep Dive</button>
        </div>
        <button onClick={() => navigator.clipboard.writeText(clipboardText)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: '13px' }}>Copy Report</button>
      </div>

      {page === 1 && (
        <div style={{ background: '#0d1117', borderRadius: '16px', padding: '32px', border: '1px solid #30363d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #30363d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: '700', background: '#1a6df5', color: '#fff', padding: '6px 16px', borderRadius: '8px' }}>{symbol}</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px', color: '#f0f6fc' }}>{companyName}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: '600', color: '#f0f6fc' }}>${price.toFixed(2)}</div>
              <div style={{ color: isPos ? '#3fb950' : '#ef4444', fontSize: '14px' }}>{isPos ? '+' : ''}{change.toFixed(2)} ({isPos ? '+' : ''}{changePct.toFixed(2)}%)</div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#8b949e', marginBottom: '12px' }}>Risk Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: '700', color: riskColor, minWidth: '60px', textAlign: 'right' }}>{gaugeScore}</div>
              <div style={{ flex: 1 }}>
                <div style={{ height: '12px', background: '#21262d', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${gaugeScore}%`, background: riskColor, borderRadius: '6px', transition: 'width 0.8s ease-out' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: '700', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{gaugeScore}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '0 2px' }}>
                  <span style={{ fontSize: '9px', color: '#22c55e' }}>Low</span>
                  <span style={{ fontSize: '9px', color: '#f59e0b' }}>Medium</span>
                  <span style={{ fontSize: '9px', color: '#ef4444' }}>High</span>
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#8b949e', minWidth: '70px' }}>{riskLabel}</span>
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
              <div key={k.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b949e' }}>{k.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: '600', color: '#f0f6fc', marginTop: '6px' }}>{k.val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#8b949e', marginBottom: '12px' }}>Technical Snapshot</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {[
                { label: 'RSI (14)', val: t?.rsi?.toFixed(1) || 'N/A' },
                { label: 'Trend', val: t?.trend || 'N/A' },
                { label: 'Signal', val: t?.signal || 'N/A' },
                { label: 'Confidence', val: r?.confidence ? r.confidence + '%' : 'N/A' },
              ].map(k => (
                <div key={k.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8b949e' }}>{k.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: '600', color: '#f0f6fc', marginTop: '6px' }}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {[
              { title: 'Valuation', color: pe > 25 ? '#f59e0b' : '#22c55e', grade: pe > 25 ? 'Premium' : 'Fair', rows: [
                { label: 'P/E (TTM)', val: pe ? pe.toFixed(2) : 'N/A' },
                { label: 'Market Cap', val: formatLargeNum(mcap) },
                { label: '52W High', val: q.fiftyTwoWeekHigh ? '$' + q.fiftyTwoWeekHigh.toFixed(2) : 'N/A' },
                { label: '52W Low', val: q.fiftyTwoWeekLow ? '$' + q.fiftyTwoWeekLow.toFixed(2) : 'N/A' },
                { label: 'Target Price', val: q.targetMeanPrice ? '$' + q.targetMeanPrice.toFixed(2) : 'N/A' },
              ]},
              { title: 'Financial Health', color: s.totalCash > s.totalDebt ? '#22c55e' : '#f59e0b', grade: s.totalCash > s.totalDebt ? 'Strong' : 'Watch', rows: [
                { label: 'Total Cash', val: formatLargeNum(s.totalCash) },
                { label: 'Total Debt', val: formatLargeNum(s.totalDebt) },
                { label: 'Cash/Debt', val: s.totalDebt > 0 ? (s.totalCash / s.totalDebt).toFixed(2) : 'N/A' },
                { label: 'Profit Margin', val: netMargin.toFixed(1) + '%' },
                { label: 'Cash Class', val: s.cashClassification || 'N/A' },
              ]},
              { title: 'Growth', color: revGrowth > 5 ? '#22c55e' : '#ef4444', grade: revGrowth > 5 ? 'Growing' : 'Stalling', rows: [
                { label: 'Revenue YoY', val: (revGrowth >= 0 ? '+' : '') + revGrowth.toFixed(1) + '%' },
                { label: 'Avg P/E 6M', val: s.avgPe6Months ? s.avgPe6Months.toFixed(2) : 'N/A' },
                { label: 'Projected Price', val: s.projectedPrice ? '$' + s.projectedPrice.toFixed(2) : 'N/A' },
                { label: 'Potential Return', val: s.potentialReturn ? (s.potentialReturn >= 0 ? '+' : '') + s.potentialReturn.toFixed(1) + '%' : 'N/A' },
                { label: 'Verdict', val: verAction },
              ]},
            ].map(card => (
              <div key={card.title} style={cardBase}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#8b949e', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>{card.title}</div>
                {card.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: '13px', borderTop: i > 0 ? '1px solid #0d1117' : 'none' }}>
                    <span style={{ color: '#8b949e' }}>{r.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '500', color: '#f0f6fc' }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>Grade</span>
                  <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: '600', background: card.color + '20', color: card.color }}>{card.grade}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#8b949e', marginBottom: '16px' }}>Score Breakdown · 35/35/30 Weighting</div>
            {[
              { label: 'Valuation', pct: Math.min(100, Math.max(10, pe > 0 && pe < 15 ? 80 : pe < 25 ? 60 : 40)), color: '#3b82f6', max: '/35' },
              { label: 'Financial Health', pct: Math.min(100, Math.max(10, s.totalCash > s.totalDebt ? 75 : 45)), color: '#22c55e', max: '/35' },
              { label: 'Growth', pct: Math.min(100, Math.max(10, revGrowth > 10 ? 85 : revGrowth > 0 ? 60 : 30)), color: '#f59e0b', max: '/30' },
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                <span style={{ width: '120px', fontSize: '13px', color: '#8b949e' }}>{b.label}</span>
                <div style={{ flex: 1, height: '20px', background: '#21262d', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: b.pct + '%', borderRadius: '10px', background: b.color }}></div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#f0f6fc', width: '50px', textAlign: 'right' }}>{b.pct}</span>
                <span style={{ fontSize: '11px', color: '#8b949e', width: '40px' }}>{b.max}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #30363d' }}>
              <span style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: '#f0f6fc' }}>Total Score</span>
              <div style={{ flex: 1, height: '24px', background: '#21262d', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: strengthScore + '%', borderRadius: '10px', background: 'linear-gradient(90deg, #1a6df5, #3b82f6, #22c55e)' }}></div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', fontWeight: '700', color: '#f0f6fc', width: '50px', textAlign: 'right' }}>{strengthScore}</span>
              <span style={{ fontSize: '11px', color: '#8b949e', width: '40px' }}>/100</span>
            </div>
          </div>
        </div>
      )}

      {page === 2 && (
        <div style={{ background: '#0d1117', borderRadius: '16px', padding: '32px', border: '1px solid #30363d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #30363d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: '700', background: '#1a6df5', color: '#fff', padding: '6px 16px', borderRadius: '8px' }}>{symbol}</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px', color: '#f0f6fc' }}>{companyName}</div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Deep Dive</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#8b949e' }}>Report Generated</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#f0f6fc' }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>

          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#8b949e', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>Key Fundamentals</div>
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
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#161b22', borderRadius: '8px', fontSize: '13px', border: '1px solid #30363d' }}>
                <span style={{ color: '#8b949e' }}>{r[0]}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '500', color: '#f0f6fc' }}>{r[1]}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#8b949e', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #30363d' }}>Strategy & Targets</div>
          <div style={{ background: 'linear-gradient(135deg, #0d1117, #161b22)', border: '1px solid #30363d', borderRadius: '12px', padding: '20px', marginBottom: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', marginBottom: '12px', color: '#f0f6fc' }}>Price Targets</div>
              {[
                ['Buy Zone Low', r?.buyZoneLow ? '$' + r.buyZoneLow.toFixed(2) : s.buyZoneLow ? '$' + s.buyZoneLow.toFixed(2) : 'N/A'],
                ['Buy Zone High', r?.buyZoneHigh ? '$' + r.buyZoneHigh.toFixed(2) : s.buyZoneHigh ? '$' + s.buyZoneHigh.toFixed(2) : 'N/A'],
                ['Target Price', r?.targetPrice ? '$' + r.targetPrice.toFixed(2) : s.targetMeanPrice ? '$' + s.targetMeanPrice.toFixed(2) : 'N/A'],
                ['Stop Loss', r?.stopLoss ? '$' + r.stopLoss.toFixed(2) : s.stopLoss ? '$' + s.stopLoss.toFixed(2) : 'N/A'],
                ['Target 1', s.target1 ? '$' + s.target1.toFixed(2) : 'N/A'],
                ['Target 2', s.target2 ? '$' + s.target2.toFixed(2) : 'N/A'],
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderBottom: '1px solid #0d1117' }}>
                  <span style={{ color: '#8b949e' }}>{r[0]}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: '500', color: '#f0f6fc' }}>{r[1]}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '12px', marginBottom: '12px', color: '#f0f6fc' }}>Recommendation</div>
              <div style={{ padding: '20px', background: verColor + '20', borderRadius: '12px', textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: verColor }}>{r?.action || s.verdict || 'HOLD'}</div>
                {r?.confidence && <div style={{ fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>Confidence: {r.confidence}%</div>}
              </div>
              {r?.reasoning && (
                <div style={{ fontSize: '12px', color: '#8b949e', padding: '12px', background: '#0d1117', borderRadius: '8px', lineHeight: '1.5' }}>
                  {r.reasoning}
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '28px 20px', borderTop: '1px solid #30363d' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: '#8b949e', marginBottom: '8px' }}>Bottom Line</div>
            <div style={{ maxWidth: '500px', margin: '16px auto', height: '8px', background: '#21262d', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: gaugeScore + '%', background: gaugeScore <= 30 ? '#22c55e' : gaugeScore <= 60 ? '#f59e0b' : '#ef4444', borderRadius: '4px' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '500px', margin: '6px auto 0', fontSize: '10px', color: '#8b949e' }}>
              <span>Low Risk</span><span>Medium</span><span>High Risk</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
              Risk Score: {gaugeScore}/100
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginTop: '20px', color: verColor }}>
              {verAction} · {riskLabel} ({gaugeScore}/100)
            </div>
            <div style={{ fontSize: '13px', color: '#8b949e', marginTop: '6px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
              {r?.reasoning || `Based on the analysis of ${symbol}, the stock shows a strength score of ${strengthScore}/100 with a risk score of ${gaugeScore}/100. Current P/E is ${pe.toFixed(2)} with revenue growth of ${revGrowth.toFixed(1)}%.`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
