'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import StockDetailPanel from './StockDetailPanel';
import EnrichedDataPanel from './EnrichedDataPanel';
import MarketOverviewPanel from './MarketOverviewPanel';
import EarningsCalendarPanel from './EarningsCalendarPanel';
import ProSignalsPanel from './ProSignalsPanel';
import RadarDashboardPanel from './RadarDashboardPanel';
import MetricChartPanel from './MetricChartPanel';
import VeredictoPanel from './VeredictoPanel';
import ScreenerRankingsPanel from './ScreenerRankingsPanel';
import TopWeeklyPicks from './TopWeeklyPicks';
import MorningBriefing from './MorningBriefing';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import Button from '@/src/components/ui/Button';
import ScoreBar from '@/src/components/ui/ScoreBar';
import { colors as C, radius as R, font as F, spacing as S, transition as T } from '@/src/utils/webTheme';

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

type DashboardTab = 'dashboard' | 'screener' | 'market';

export default function Dashboard({
  onNavigateToAICoach,
  initialSection,
}: {
  onNavigateToAICoach?: (symbol: string) => void;
  initialSection?: 'briefing' | 'signals' | 'bullsbears' | 'market' | 'opciones' | 'screeners';
}) {
  const { data: session } = useSession();
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [enrichedLoading, setEnrichedLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [technicalData, setTechnicalData] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    initialSection === 'market' ? 'market' : initialSection === 'screeners' ? 'screener' : 'dashboard'
  );
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let active = true;
    async function loadSignals() {
      try {
        setLoading(true);
        const screenerRes = await fetch('/api/screener?action=screener');
        const screenerJson = await screenerRes.json();
        const stocks = screenerJson.stocks || screenerJson.screenerStocks || [];
        const symbols = stocks.map((s: any) => s.symbol).filter(Boolean).slice(0, TOP_N_SIGNALS).join(',');

        if (!symbols) {
          if (active) { setSignals([]); setLoading(false); }
          return;
        }

        const res = await fetch(`/api/signal?symbols=${symbols}`);
        const json = await res.json();
        if (active && json.signals) {
          setSignals(json.signals.filter((s: SignalData | null) => s != null));
        }
      } catch (err) {
        if (active) setError('Error loading signals');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSignals();
    return () => { active = false; };
  }, []);

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
        setQuoteData(stockJson.quote ?? null);
        setTechnicalData(stockJson.technical ?? null);
      }
    } catch (err) {
      setError(`Error loading ${symbol}`);
    } finally {
      setDetailLoading(false);
      setEnrichedLoading(false);
    }
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    clearTimeout(searchTimeout.current);
    if (query.length >= 1) {
      searchTimeout.current = setTimeout(() => {
        handleStockClick(query.toUpperCase());
      }, 400);
    }
  }, [handleStockClick]);

  const handleAnalyze = () => {
    if (selectedSymbol && onNavigateToAICoach) {
      onNavigateToAICoach(selectedSymbol);
    }
  };

  const sortedSignals = [...signals].sort((a, b) => {
    const order = { BUY: 0, HOLD: 1, SELL: 2 };
    const oa = order[a.signal] ?? 3;
    const ob = order[b.signal] ?? 3;
    if (oa !== ob) return oa - ob;
    return b.score - a.score;
  });

  const userPlan = (session?.user as any)?.plan || 'free';

  if (error) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px', background: C.bg, minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '40px', color: C.negative, background: C.negativeBg, borderRadius: R.lg, border: `1px solid ${C.negativeBorder}` }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#9888;</div>
          <div style={{ fontSize: F.sizeMd, fontWeight: 500 }}>{error}</div>
          <Button variant="secondary" size="sm" onClick={() => { setError(null); window.location.reload(); }} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: `${S.xl} ${S.lg}` }}>
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {selectedSymbol && detailData ? (
          <div>
            <button
              onClick={() => setSelectedSymbol(null)}
              style={{
                background: 'none', border: 'none', color: C.accentLight, cursor: 'pointer',
                fontSize: F.sizeSm, padding: '8px 0', marginBottom: S.lg,
                display: 'flex', alignItems: 'center', gap: S.xs, fontFamily: F.family, fontWeight: 500,
              }}
            >
              &#8592; Back to dashboard
            </button>
            <StockDetailPanel
              symbol={detailData.symbol}
              name={detailData.name}
              price={detailData.price}
              change={detailData.change}
              changePercent={detailData.changePercent}
              sector={detailData.details?.sector}
              marketCap={detailData.details?.marketCap}
              peRatio={detailData.details?.peRatio}
              technical={technicalData}
              score={detailData.score}
              userPlan={userPlan}
              onClose={() => setSelectedSymbol(null)}
              onAddPortfolio={() => {}}
              onAddWatchlist={() => {}}
              inWatchlist={false}
            />
            <EnrichedDataPanel
              polygon={enrichedData?.polygon}
              finnhub={enrichedData?.finnhub}
              summary={enrichedData?.summary}
              loading={enrichedLoading}
            />
            <div style={{ marginTop: S.md }}>
              <ProSignalsPanel symbol={selectedSymbol} onAnalyze={handleAnalyze} />
            </div>
            <div style={{ marginTop: S.md }}>
              <RadarDashboardPanel symbol={selectedSymbol} />
            </div>
            <div style={{ marginTop: S.md }}>
              <MetricChartPanel symbol={selectedSymbol} />
            </div>
            <VeredictoPanel
              symbol={selectedSymbol}
              detailData={detailData}
              summary={enrichedData?.summary ?? null}
              quote={quoteData}
              technical={technicalData}
            />
          </div>
        ) : loading ? (
          <LoadingState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.xl }}>
            {activeTab === 'dashboard' && (
              <MorningBriefing onSelectStock={handleStockClick} userPlan={userPlan} />
            )}
            {activeTab === 'screener' && (
              <>
                <TopWeeklyPicks onStockClick={handleStockClick} />
                <ScreenerRankingsPanel onStockClick={handleStockClick} />
              </>
            )}
            {activeTab === 'market' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: S.lg }}>
                <MarketOverviewPanel onStockClick={handleStockClick} />
                <EarningsCalendarPanel />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function DashboardHeader({
  searchQuery, onSearchChange, activeTab, onTabChange,
}: {
  searchQuery: string; onSearchChange: (q: string) => void;
  activeTab: DashboardTab; onTabChange: (v: DashboardTab) => void;
}) {
  return (
    <div style={{ marginBottom: S.xxl }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.lg, gap: S.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <div style={{
            width: 32, height: 32, borderRadius: R.sm,
            background: C.gradientPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: F.sizeLg, fontWeight: 800, color: C.textPrimary,
          }}>
            &#9670;
          </div>
          <h1 style={{ margin: 0, color: C.textPrimary, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: R.md,
              padding: `${S.sm} ${S.md} ${S.sm} 36px`,
              color: C.textPrimary,
              fontSize: F.sizeBase,
              width: '200px',
              outline: 'none',
              fontFamily: F.family,
              transition: T.fast,
            }}
            onFocus={e => (e.currentTarget.style.borderColor = C.accentBorder)}
            onBlur={e => (e.currentTarget.style.borderColor = C.border)}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: F.sizeSm }}>&#128269;</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: S.xs }}>
        {([['dashboard', 'Overview'], ['screener', 'Screener'], ['market', 'Market']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            style={{
              padding: `${S.sm} ${S.md}`,
              borderRadius: R.sm,
              border: 'none',
              background: activeTab === key ? C.bgElevated : 'transparent',
              color: activeTab === key ? C.textPrimary : C.textMuted,
              cursor: 'pointer',
              fontWeight: activeTab === key ? 600 : 400,
              fontSize: F.sizeSm,
              fontFamily: F.family,
              transition: T.fast,
              borderBottom: activeTab === key ? `2px solid ${C.accent}` : '2px solid transparent',
            }}
            onMouseEnter={e => { if (activeTab !== key) e.currentTarget.style.color = C.textSecondary; }}
            onMouseLeave={e => { if (activeTab !== key) e.currentTarget.style.color = C.textMuted; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.lg, paddingTop: S.xl }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: `${S.md} ${S.lg}`, display: 'flex', alignItems: 'center', gap: S.md }}>
          <div style={{ width: 28, height: 28, borderRadius: R.sm, background: C.bgElevated }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: 80, height: 14, borderRadius: R.sm, background: C.bgElevated, marginBottom: 4 }} />
            <div style={{ width: 160, height: 10, borderRadius: R.sm, background: C.bgElevated }} />
          </div>
          <div style={{ width: 50, height: 14, borderRadius: R.sm, background: C.bgElevated }} />
        </div>
      ))}
    </div>
  );
}
