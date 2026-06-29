'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SignalCard from './SignalCard';
import StockRow from './StockRow';
import StockDetailPanel from './StockDetailPanel';
import EnrichedDataPanel from './EnrichedDataPanel';
import MarketOverviewPanel from './MarketOverviewPanel';
import EarningsCalendarPanel from './EarningsCalendarPanel';
import BullsBearsSection from './BullsBearsSection';
import LearningGuide from './LearningGuide';
import ProSignalsPanel from './ProSignalsPanel';
import RadarDashboardPanel from './RadarDashboardPanel';
import MetricChartPanel from './MetricChartPanel';
import VeredictoPanel from './VeredictoPanel';
import OptionsScreenerPanel from './OptionsScreenerPanel';
import ScreenerRankingsPanel from './ScreenerRankingsPanel';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

const TOP_N_SIGNALS = 30;

interface SignalData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  signal: 'BUY' | 'HOLD' | 'SELL';
  score: number;
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  details: {
    peRatio: number;
    marketCap: number;
    sector?: string;
    trend?: string;
    rsi?: number;
  };
}

interface DetailData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  signal: 'BUY' | 'HOLD' | 'SELL';
  score: number;
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  components: Record<string, number>;
  framework?: {
    fcfYield: number;
    fcfPositive: boolean;
    score: number;
    activeScenarios: string[];
    scenarios: Array<{
      id: string; name: string; icon: string; match: boolean;
      desc: string; verdict: string | null;
    }>;
  };
  details?: {
    peRatio: number;
    marketCap: number;
    sector?: string;
    trend?: string;
    rsi?: number;
    fcf?: number;
  };
}

export default function Dashboard({
  onNavigateToAICoach,
}: {
  onNavigateToAICoach?: (symbol: string) => void;
}) {
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [enrichedLoading, setEnrichedLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dashboardSection, setDashboardSection] = useState<'signals' | 'bullsbears' | 'market' | 'opciones' | 'screeners'>('signals');
  const [showLearningGuide, setShowLearningGuide] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load top signals from market screener
  useEffect(() => {
    async function loadSignals() {
      try {
        setLoading(true);
        // Get daily screened stocks
        const screenerRes = await fetch('/api/screener?action=screener');
        const screenerJson = await screenerRes.json();
        const stocks = screenerJson.stocks || screenerJson.screenerStocks || [];
        const symbols = stocks.map((s: any) => s.symbol).filter(Boolean).slice(0, TOP_N_SIGNALS).join(',');

        if (!symbols) {
          setSignals([]);
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/signal?symbols=${symbols}`);
        const json = await res.json();
        if (json.signals) {
          setSignals(json.signals.filter((s: SignalData | null) => s != null));
        }
      } catch (err) {
        setError('Error al cargar señales');
      } finally {
        setLoading(false);
      }
    }
    loadSignals();
  }, []);

  // Handle stock click
  const handleStockClick = useCallback(async (symbol: string) => {
    setSelectedSymbol(symbol);
    setDetailLoading(true);
    setEnrichedLoading(true);
    setDetailData(null);
    setEnrichedData(null);
    try {
      const [signalRes, stockRes] = await Promise.all([
        fetch(`/api/signal?symbol=${symbol}`),
        fetch(`/api/stock?symbol=${symbol}`),
      ]);
      const signalJson = await signalRes.json();
      setDetailData(signalJson);
      if (stockRes.ok) {
        const stockJson = await stockRes.json();
        setEnrichedData({
          polygon: stockJson.polygon,
          finnhub: stockJson.finnhub,
          summary: stockJson.summary,
        });
      }
    } catch (err) {
      setError(`Error al cargar ${symbol}`);
    } finally {
      setDetailLoading(false);
      setEnrichedLoading(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    clearTimeout(searchTimeout.current);
    if (query.length >= 1) {
      searchTimeout.current = setTimeout(() => {
        handleStockClick(query.toUpperCase());
      }, 400);
    }
  }, [handleStockClick]);

  // Handle AI analysis
  const handleAnalyze = () => {
    if (selectedSymbol && onNavigateToAICoach) {
      onNavigateToAICoach(selectedSymbol);
    }
  };

  // Sort signals: BUY first, then HOLD, then SELL; by score descending
  const sortedSignals = [...signals].sort((a, b) => {
    const order = { BUY: 0, HOLD: 1, SELL: 2 };
    const oa = order[a.signal] ?? 3;
    const ob = order[b.signal] ?? 3;
    if (oa !== ob) return oa - ob;
    return b.score - a.score;
  });

  if (error) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', background: C.bg, minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '40px', color: C.negative, background: '#2e0a0a', borderRadius: '12px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          section={dashboardSection}
          onSectionChange={setDashboardSection}
          onLearnClick={() => setShowLearningGuide(true)}
        />

        {/* Main Content */}
        {selectedSymbol && detailData ? (
          <div>
            <button
              onClick={() => setSelectedSymbol(null)}
              style={{
                background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
                fontSize: '14px', padding: '8px 0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              ← Volver al dashboard
            </button>
            <StockDetailPanel
              data={detailData}
              onClose={() => setSelectedSymbol(null)}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
            />
            <EnrichedDataPanel
              polygon={enrichedData?.polygon}
              finnhub={enrichedData?.finnhub}
              summary={enrichedData?.summary}
              loading={enrichedLoading}
            />
            <div style={{ marginTop: '16px' }}>
              <ProSignalsPanel
                symbol={selectedSymbol}
                onAnalyze={handleAnalyze}
              />
            </div>
            <div style={{ marginTop: '16px' }}>
              <RadarDashboardPanel symbol={selectedSymbol} />
            </div>
            <div style={{ marginTop: '16px' }}>
              <MetricChartPanel symbol={selectedSymbol} />
            </div>
            <VeredictoPanel
              symbol={selectedSymbol}
              detailData={detailData}
              summary={enrichedData?.summary ?? null}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {loading ? (
              <LoadingState />
            ) : dashboardSection === 'bullsbears' ? (
              <BullsBearsSection signals={sortedSignals} onStockClick={handleStockClick} />
            ) : dashboardSection === 'market' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <MarketOverviewPanel onStockClick={handleStockClick} />
                <EarningsCalendarPanel />
              </div>
            ) : dashboardSection === 'opciones' ? (
              <OptionsScreenerPanel />
            ) : dashboardSection === 'screeners' ? (
              <ScreenerRankingsPanel />
            ) : (
              <>
                <TopPicksSection signals={sortedSignals} onStockClick={handleStockClick} />
                <DiscoveryFeed signals={sortedSignals} onStockClick={handleStockClick} />
              </>
            )}
          </div>
        )}
      {showLearningGuide && <LearningGuide onClose={() => setShowLearningGuide(false)} />}
      </div>
    </div>
  );
}

function Header({
  searchQuery, onSearchChange, section, onSectionChange, onLearnClick,
}: {
  searchQuery: string; onSearchChange: (q: string) => void;
  section: string; onSectionChange: (s: 'signals' | 'bullsbears' | 'market' | 'opciones' | 'screeners') => void; onLearnClick: () => void;
}) {
  return (
    <div style={{ marginBottom: '24px', background: C.gradientHero, borderRadius: R.lg, padding: '20px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: R.sm, background: 'linear-gradient(135deg, ' + C.accentLight + ', #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', color: 'white' }}>
            P
          </div>
          <h1 style={{ margin: 0, color: C.textPrimary, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em' }}>
            Prospector
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar símbolo..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              style={{
                background: C.bgCard,
                border: '1px solid ' + C.border,
                borderRadius: R.md,
                padding: '8px 16px 8px 36px',
                color: C.textPrimary,
                fontSize: '14px',
                width: '180px',
                outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: C.textMuted }}>🔍</span>
          </div>
          <TabButton active={section === 'signals'} onClick={() => onSectionChange('signals')}>📶 Señales</TabButton>
          <TabButton active={section === 'bullsbears'} onClick={() => onSectionChange('bullsbears')}>🐂🐻 B&B</TabButton>
          <TabButton active={section === 'market'} onClick={() => onSectionChange('market')}>📊 Mercado</TabButton>
          <TabButton active={section === 'opciones'} onClick={() => onSectionChange('opciones')}>🎯 Opciones</TabButton>
          <TabButton active={section === 'screeners'} onClick={() => onSectionChange('screeners')}>📊 Screeners</TabButton>
          <button
            onClick={onLearnClick}
            style={{
              background: 'none',
              border: '1px solid ' + C.border,
              borderRadius: R.md,
              padding: '8px 12px',
              color: C.textMuted,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
            title="Guía de señales"
          >
            📖
          </button>
        </div>
      </div>
      {/* Subtitle */}
      <p style={{ margin: 0, color: C.textMuted, fontSize: '14px', lineHeight: '1.5' }}>
        Señales de inversión basadas en análisis fundamental, técnico y de valor
      </p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: R.md,
        border: active ? '1px solid ' + C.accent : '1px solid ' + C.border,
        background: active ? C.accent : 'transparent',
        color: active ? 'white' : C.textSecondary,
        cursor: 'pointer',
        fontWeight: active ? '600' : '500',
        fontSize: '13px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function TopPicksSection({ signals, onStockClick }: { signals: SignalData[]; onStockClick: (s: string) => void }) {
  const topPicks = signals.filter(s => s.signal === 'BUY' && s.score >= 70).slice(0, 4);

  if (topPicks.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '18px', fontWeight: '700' }}>🔥 Top Picks</h2>
        <span style={{ color: C.textMuted, fontSize: '13px' }}>Nuestras mejores recomendaciones</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {topPicks.map(s => (
          <SignalCard key={s.symbol} data={s} onClick={() => onStockClick(s.symbol)} />
        ))}
      </div>
    </div>
  );
}

function DiscoveryFeed({ signals, onStockClick }: { signals: SignalData[]; onStockClick: (s: string) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '18px', fontWeight: '700' }}>📋 Watchlist</h2>
        <span style={{ color: C.textMuted, fontSize: '13px' }}>{signals.length} activos monitoreados</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {signals.map(s => (
          <StockRow key={s.symbol} data={s} onClick={() => onStockClick(s.symbol)} />
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
      <div style={{ color: C.textMuted, fontSize: '14px' }}>Cargando señales del mercado...</div>
    </div>
  );
}
