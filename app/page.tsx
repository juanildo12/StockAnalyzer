'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
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
  WatchlistItem
} from '@/src/services/firebase';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';

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
  const [view, setView] = useState<'analyzer' | 'portfolio' | 'watchlist' | 'informe' | 'framework'>('analyzer');
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistPrices, setWatchlistPrices] = useState<{ [key: string]: { price: number; change: number; changePercent: number } }>({});
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [watchlistForm, setWatchlistForm] = useState({
    symbol: '',
    alertPrice: '',
    alertType: 'above' as 'above' | 'below',
    alertEnabled: true,
  });

  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      loadPortfolio();
      loadWatchlist();
    }
  }, [session]);

  const loadPortfolio = async () => {
    if (!session?.user?.email) return;
    try {
      const items = await getPortfolioFromFirestore(session.user.email);
      setPortfolio(items);
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  };

  const loadWatchlist = async () => {
    if (!session?.user?.email) return;
    try {
      const items = await getWatchlistFromFirestore(session.user.email);
      setWatchlist(items);
      if (items.length > 0) {
        fetchWatchlistPrices(items.map(w => w.symbol));
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const fetchWatchlistPrices = async (symbols: string[]) => {
    try {
      const response = await fetch(`/api/stock?symbols=${symbols.join(',')}`);
      const result = await response.json();
      if (result.quotes) {
        const prices: { [key: string]: { price: number; change: number; changePercent: number } } = {};
        result.quotes.forEach((quote: any) => {
          prices[quote.symbol] = {
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent
          };
        });
        setWatchlistPrices(prices);
      }
    } catch (error) {
      console.error('Error fetching watchlist prices:', error);
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
    if (!session?.user?.email || !watchlistForm.symbol) return;
    try {
      await addWatchlistItem(session.user.email, {
        symbol: watchlistForm.symbol.toUpperCase(),
        addedAt: new Date().toISOString(),
        alertEnabled: watchlistForm.alertEnabled,
        alertPrice: parseFloat(watchlistForm.alertPrice) || 0,
        alertType: watchlistForm.alertType,
      });
      await loadWatchlist();
      setShowWatchlistModal(false);
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  };

  const updateWatchlistAlert = async (symbol: string, alertPrice: number, alertEnabled: boolean, alertType: 'above' | 'below') => {
    if (!session?.user?.email) return;
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
  };

  const removeFromWatchlist = async (symbol: string) => {
    if (!session?.user?.email) return;
    try {
      await removeWatchlistItem(session.user.email, symbol);
      await loadWatchlist();
    } catch (error) {
      console.error('Error removing from watchlist:', error);
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

  const searchStock = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const sym = symbol.toUpperCase();
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

  const addToPortfolio = async () => {
    if (!data || !addForm.shares || !session?.user?.email) return;
    
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
      const updatedPortfolio = await addPortfolioItem(session.user.email, newItem);
      setPortfolio(updatedPortfolio);
      setShowAddModal(false);
      setAddForm({ shares: '', price: '', date: new Date().toISOString().split('T')[0], notes: '', targetPrice: '' });
    } catch (error) {
      console.error('Error adding to portfolio:', error);
    }
  };

  const removeFromPortfolio = async (sym: string) => {
    if (!session?.user?.email) return;
    try {
      const updatedPortfolio = await removePortfolioItem(session.user.email, sym);
      setPortfolio(updatedPortfolio);
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
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #30363d', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#58a6ff' }}>📈 Stock Analyzer</h1>
        
        {!isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <nav style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setView('analyzer')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: view === 'analyzer' ? '#238636' : 'transparent',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Analizador
              </button>
              <button
                onClick={() => setView('portfolio')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: view === 'portfolio' ? '#238636' : 'transparent',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Portafolio ({portfolio.length})
              </button>
              <button
                onClick={() => setView('watchlist')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: view === 'watchlist' ? '#238636' : 'transparent',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Watchlist
              </button>
              <button
                onClick={() => setView('informe')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: view === 'informe' ? '#238636' : 'transparent',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Informe
              </button>
              <button
                onClick={() => setView('framework')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #30363d',
                  background: view === 'framework' ? '#238636' : 'transparent',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                🧠 Framework
              </button>
            </nav>
            {status === 'loading' ? (
              <span style={{ color: '#8b949e', fontSize: '14px' }}>Cargando...</span>
            ) : session ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {session.user?.image && (
                  <img 
                    src={session.user.image} 
                    alt={session.user.name || 'User'} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                  />
                )}
                <span style={{ color: '#c9d1d9', fontSize: '14px' }}>{session.user?.name}</span>
                <button
                  onClick={() => signOut()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #f85149',
                    background: 'transparent',
                    color: '#f85149',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn('google')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#58a6ff',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                Iniciar sesión
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #30363d',
                background: 'transparent',
                color: '#c9d1d9',
                cursor: 'pointer',
                fontSize: '20px',
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
            {menuOpen && (
              <div style={{
                width: '100%',
                background: '#161b22',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <button
                  onClick={() => { setView('analyzer'); setMenuOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #30363d',
                    background: view === 'analyzer' ? '#238636' : 'transparent',
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  Analizador
                </button>
                <button
                  onClick={() => { setView('portfolio'); setMenuOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #30363d',
                    background: view === 'portfolio' ? '#238636' : 'transparent',
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  Portafolio ({portfolio.length})
                </button>
                <button
                  onClick={() => { setView('watchlist'); setMenuOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #30363d',
                    background: view === 'watchlist' ? '#238636' : 'transparent',
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  Watchlist
                </button>
                <button
                  onClick={() => { setView('informe'); setMenuOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #30363d',
                    background: view === 'informe' ? '#238636' : 'transparent',
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  Informe
                </button>
                <button
                  onClick={() => { setView('framework'); setMenuOpen(false); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #30363d',
                    background: view === 'framework' ? '#238636' : 'transparent',
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontWeight: '500',
                    textAlign: 'left',
                  }}
                >
                  🧠 Framework
                </button>
                <div style={{ borderTop: '1px solid #30363d', paddingTop: '12px', marginTop: '4px' }}>
                  {status === 'loading' ? (
                    <span style={{ color: '#8b949e', fontSize: '14px' }}>Cargando...</span>
                  ) : session ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {session.user?.image && (
                        <img 
                          src={session.user.image} 
                          alt={session.user.name || 'User'} 
                          style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                        />
                      )}
                      <span style={{ color: '#c9d1d9', fontSize: '14px', flex: 1 }}>{session.user?.name}</span>
                      <button
                        onClick={() => { signOut(); setMenuOpen(false); }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #f85149',
                          background: 'transparent',
                          color: '#f85149',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Salir
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { signIn('google'); setMenuOpen(false); }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#58a6ff',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                      }}
                    >
                      Iniciar sesión
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </header>

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
                onClick={searchStock}
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
                  {session && (
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
                  )}
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
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#58a6ff' }}>${data.summary.target1?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Target 2</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#58a6ff' }}>${data.summary.target2?.toFixed(2)}</p>
                    </div>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#8b949e' }}>Stop Loss</p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f85149' }}>${data.summary.stopLoss?.toFixed(2)}</p>
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
            {!session ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🔐</p>
                <p style={{ color: '#f0f6fc', fontSize: '18px', marginBottom: '8px' }}>Inicia sesión para ver tu watchlist</p>
                <p>Recibe alertas cuando las acciones alcancen tu precio objetivo</p>
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
                  <h2 style={{ color: '#f0f6fc', marginBottom: '8px' }}>👁️ Mi Watchlist</h2>
                  <p style={{ color: '#8b949e' }}>{watchlist.length} acción{watchlist.length !== 1 ? 'es' : ''} en vigilancia</p>
                </div>

                {watchlist.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: '#161b22', borderRadius: '12px', border: '1px solid #30363d' }}>
                    <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📝</p>
                    <p style={{ color: '#f0f6fc', fontSize: '18px', marginBottom: '8px' }}>Tu watchlist está vacía</p>
                    <p style={{ color: '#8b949e' }}>Analiza una acción y agrégala a tu watchlist</p>
                    <button
                      onClick={() => setView('analyzer')}
                      style={{
                        marginTop: '20px',
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
                      Ir al Analizador
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#161b22', borderRadius: '12px', border: '1px solid #30363d', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 70px 90px 40px', gap: '8px', padding: '12px 16px', background: '#0d1117', borderBottom: '1px solid #30363d', fontSize: '11px', color: '#8b949e', fontWeight: '600', textTransform: 'uppercase' }}>
                      <div>Símbolo</div>
                      <div style={{ textAlign: 'right' }}>Precio</div>
                      <div style={{ textAlign: 'right' }}>Cambio</div>
                      <div style={{ textAlign: 'center' }}>Tipo</div>
                      <div style={{ textAlign: 'right' }}>Objetivo</div>
                      <div></div>
                    </div>
                    
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
                        <div key={item.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 70px 90px 40px', gap: '8px', padding: '10px 16px', borderBottom: '1px solid #30363d', alignItems: 'center', background: isAlertTriggered ? '#2ecc7110' : 'transparent' }}>
                          <div>
                            <div style={{ color: '#58a6ff', fontWeight: '600', fontSize: '14px' }}>{item.symbol}</div>
                            {isAlertTriggered && <div style={{ color: '#2ecc71', fontSize: '10px', marginTop: '2px' }}>🎉 Activa</div>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {priceData ? (
                              <div style={{ color: '#f0f6fc', fontWeight: '500', fontSize: '13px' }}>${currentPrice.toFixed(2)}</div>
                            ) : (
                              <div style={{ color: '#8b949e', fontSize: '12px' }}>...</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: priceChange >= 0 ? '#2ecc71' : '#e74c3c', fontSize: '12px' }}>
                              {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <select
                              value={alertType}
                              onChange={(e) => updateWatchlistAlert(item.symbol, alertPrice, alertEnabled, e.target.value as 'above' | 'below')}
                              disabled={!alertEnabled}
                              style={{ 
                                padding: '4px', 
                                borderRadius: '4px', 
                                border: '1px solid #30363d', 
                                background: alertEnabled ? '#161b22' : '#0d1117', 
                                color: alertEnabled ? '#c9d1d9' : '#8b949e', 
                                fontSize: '11px',
                                width: '100%',
                                cursor: alertEnabled ? 'pointer' : 'not-allowed',
                                opacity: alertEnabled ? 1 : 0.5
                              }}
                            >
                              <option value="above">📈</option>
                              <option value="below">📉</option>
                            </select>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              placeholder="---"
                              value={alertPrice || ''}
                              disabled={!alertEnabled}
                              onChange={(e) => updateWatchlistAlert(item.symbol, parseFloat(e.target.value) || 0, alertEnabled, alertType)}
                              style={{ 
                                width: '100%', 
                                padding: '4px 6px', 
                                borderRadius: '4px', 
                                border: '1px solid #30363d', 
                                background: alertEnabled ? '#161b22' : '#0d1117', 
                                color: alertEnabled ? '#c9d1d9' : '#8b949e', 
                                fontSize: '11px',
                                textAlign: 'right',
                                cursor: alertEnabled ? 'text' : 'not-allowed',
                                opacity: alertEnabled ? 1 : 0.5
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={alertEnabled}
                                onChange={(e) => updateWatchlistAlert(item.symbol, alertPrice, e.target.checked, alertType)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                              />
                              <span style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: alertEnabled ? '#238636' : '#30363d',
                                borderRadius: '18px',
                                transition: '0.2s'
                              }}>
                                <span style={{
                                  position: 'absolute',
                                  height: '12px',
                                  width: '12px',
                                  left: alertEnabled ? '17px' : '3px',
                                  bottom: '3px',
                                  background: 'white',
                                  borderRadius: '50%',
                                  transition: '0.2s'
                                }} />
                              </span>
                            </label>
                            <button
                              onClick={() => removeFromWatchlist(item.symbol)}
                              style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#e74c3c', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                              title="Eliminar"
                            >
                              ×
                            </button>
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
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

      {/* Vista de Framework PRO */}
      {view === 'framework' && data && (
        <FrameworkView data={data} />
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
  );
}

function FrameworkView({ data }: { data: any }) {
  const fcfYield = ((data.summary.freeCashflow || 0) / (data.summary.marketCap || 1)) * 100;
  const pe = data.quote?.peRatio || 0;
  const revGrowth = data.summary.revenueGrowthPercent || 0;
  const margin = data.summary.profitMarginsPercent || 0;
  const isFCFPositive = (data.summary.freeCashflow || 0) >= 0;

  let score = 0;
  if (isFCFPositive) score += 2;
  if (fcfYield > 5) score += 2;
  if (revGrowth > 15) score += 2;
  if (margin > 15) score += 2;
  if (pe < 25) score += 2;

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
