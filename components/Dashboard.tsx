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
              <DashboardHome
                signals={sortedSignals}
                onStockClick={handleStockClick}
                userPlan={userPlan}
              />
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
            fontSize: F.sizeLg, fontWeight: 800, color: '#fff',
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

// ─── Dashboard Home (default view) ───────────────────────────────────────────

function DashboardHome({
  signals,
  onStockClick,
  userPlan,
}: {
  signals: SignalData[];
  onStockClick: (s: string) => void;
  userPlan: string;
}) {
  const isPro = ['pro', 'elite', 'enterprise'].includes(userPlan);
  const topPicks = signals.filter(s => s.signal === 'BUY' && s.score >= 70);
  const heroPick = topPicks[0];
  const bestPicks = topPicks.slice(1, 5);

  return (
    <>
      {/* ─── 1. Top Opportunity (Hero) ────────────────────── */}
      {heroPick && (
        <div>
          <SectionHeader label="Top Opportunity" action={isPro ? { label: 'Open Full Analysis', onClick: () => onStockClick(heroPick.symbol) } : { label: 'Upgrade to Pro', onClick: () => { window.location.href = '/settings/billing'; } }} />
          <HeroCard pick={heroPick} onClick={() => onStockClick(heroPick.symbol)} isPro={isPro} />
        </div>
      )}

      {/* ─── 2. Best Opportunities ────────────────────────── */}
      {bestPicks.length > 0 && (
        <div>
          <SectionHeader label="Best Opportunities" description={`${bestPicks.length} high-conviction picks`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: S.md }}>
            {bestPicks.map((pick, i) => (
              <CompactPickCard key={pick.symbol} pick={pick} rank={i + 2} onClick={() => onStockClick(pick.symbol)} />
            ))}
          </div>
        </div>
      )}

      {/* ─── 3. All Signals (Watchlist) ──────────────────── */}
      {signals.length > 0 && (
        <div>
          <SectionHeader label="All Signals" description={`${signals.length} assets monitored`} />
          <Card padding="0" hover={false}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {signals.map((s, i) => (
                <div key={s.symbol}>
                  {i > 0 && <div style={{ height: 1, background: C.border, marginLeft: S.md, marginRight: S.md }} />}
                  <SignalRow signal={s} onClick={() => onStockClick(s.symbol)} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── Empty state ─────────────────────────────────── */}
      {signals.length === 0 && (
        <div style={{ textAlign: 'center', padding: `${S.xxxl} 0` }}>
          <div style={{ fontSize: 32, marginBottom: S.md }}>&#9670;</div>
          <div style={{ color: C.textMuted, fontSize: F.sizeBase }}>No signals available right now.</div>
        </div>
      )}
    </>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({
  label,
  description,
  action,
}: {
  label: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md }}>
      <div>
        <h2 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeLg, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {label}
        </h2>
        {description && (
          <p style={{ margin: '2px 0 0', color: C.textMuted, fontSize: F.sizeSm }}>{description}</p>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            fontSize: F.sizeSm, color: C.accentLight, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: F.family, padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
          onMouseLeave={e => (e.currentTarget.style.color = C.accentLight)}
        >
          {action.label} &#8594;
        </button>
      )}
    </div>
  );
}

// ─── Hero Card ───────────────────────────────────────────────────────────────

function HeroCard({
  pick,
  onClick,
  isPro,
}: {
  pick: SignalData;
  onClick: () => void;
  isPro: boolean;
}) {
  const scoreColor = pick.score >= 80 ? C.positive : pick.score >= 60 ? C.warning : C.textMuted;

  return (
    <Card padding="0" hover glow>
      <div style={{ padding: `${S.lg} ${S.xl}` }}>
        {/* Top row: Symbol + Score */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: S.md }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: 2 }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                {pick.symbol}
              </span>
              <Badge variant={pick.signal === 'BUY' ? 'positive' : pick.signal === 'SELL' ? 'negative' : 'warning'} size="sm" dot>
                {pick.signal}
              </Badge>
              {pick.conviction && (
                <Badge variant={pick.conviction === 'HIGH' ? 'positive' : pick.conviction === 'MEDIUM' ? 'warning' : 'neutral'} size="sm">
                  {pick.conviction}
                </Badge>
              )}
            </div>
            <div style={{ fontSize: F.sizeSm, color: C.textMuted }}>{pick.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '36px', fontWeight: 800, color: scoreColor, fontFamily: F.mono, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {pick.score}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 2 }}>/100</div>
          </div>
        </div>

        {/* Price + Change */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: S.sm, marginBottom: S.md }}>
          <span style={{ fontSize: F.sizeHero, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono }}>
            ${pick.price.toFixed(2)}
          </span>
          <span style={{
            fontSize: F.sizeMd, fontWeight: 600,
            color: pick.change >= 0 ? C.positive : C.negative,
            fontFamily: F.mono,
          }}>
            {pick.change >= 0 ? '+' : ''}{pick.changePercent.toFixed(2)}%
          </span>
        </div>

        {/* Score Bar */}
        <div style={{ marginBottom: S.md }}>
          <ScoreBar score={pick.score} label="Score" />
        </div>

        {/* Details row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.sm, marginBottom: S.md }}>
          {pick.details?.sector && (
            <span style={{ fontSize: F.sizeXs, padding: '3px 8px', borderRadius: R.full, background: C.bgElevated, color: C.textSecondary }}>
              {pick.details.sector}
            </span>
          )}
          {pick.details?.rsi !== undefined && (
            <span style={{ fontSize: F.sizeXs, padding: '3px 8px', borderRadius: R.full, background: C.bgElevated, color: pick.details.rsi > 70 ? C.negative : pick.details.rsi < 30 ? C.positive : C.textSecondary }}>
              RSI {pick.details.rsi}
            </span>
          )}
          {pick.details?.trend && (
            <span style={{ fontSize: F.sizeXs, padding: '3px 8px', borderRadius: R.full, background: C.bgElevated, color: C.textSecondary }}>
              {pick.details.trend}
            </span>
          )}
          <span style={{
            fontSize: F.sizeXs, padding: '3px 8px', borderRadius: R.full,
            background: pick.riskLevel === 'LOW' ? C.positiveBg : pick.riskLevel === 'HIGH' ? C.negativeBg : C.warningBg,
            color: pick.riskLevel === 'LOW' ? C.positive : pick.riskLevel === 'HIGH' ? C.negative : C.warning,
          }}>
            Risk: {pick.riskLevel}
          </span>
        </div>

        {/* Blurred preview for free users */}
        {!isPro && (
          <div style={{ position: 'relative' }}>
            <div style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
              <div style={{ fontSize: F.sizeSm, color: C.textSecondary, lineHeight: 1.6 }}>
                Detailed AI analysis with entry levels, support/resistance zones, momentum indicators, and risk assessment available with Pro plan.
              </div>
            </div>
            <div style={{
              position: 'absolute', bottom: -S.md, left: 0, right: 0,
              display: 'flex', justifyContent: 'center',
              background: `linear-gradient(180deg, transparent, ${C.bgCard})`,
              paddingTop: S.xxl,
            }}>
              <Button variant="primary" size="sm" onClick={() => { window.location.href = '/settings/billing'; }}>
                Unlock Full Analysis
              </Button>
            </div>
          </div>
        )}

        {/* Pro: direct CTA */}
        {isPro && (
          <Button variant="primary" fullWidth onClick={onClick}>
            Open Full Analysis &#8594;
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Compact Pick Card ───────────────────────────────────────────────────────

function CompactPickCard({
  pick,
  rank,
  onClick,
}: {
  pick: SignalData;
  rank: number;
  onClick: () => void;
}) {
  const scoreColor = pick.score >= 80 ? C.positive : pick.score >= 60 ? C.warning : C.textMuted;

  return (
    <Card padding={`${S.md} ${S.lg}`} hover onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.md, marginBottom: S.sm }}>
        <div style={{
          width: 24, height: 24, borderRadius: R.sm,
          background: rank <= 3 ? C.gradientPrimary : C.bgElevated,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: F.sizeXs, fontWeight: 800, color: rank <= 3 ? '#fff' : C.textSecondary,
          fontFamily: F.mono, flexShrink: 0,
        }}>
          {rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
            <span style={{ fontSize: F.sizeLg, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono }}>{pick.symbol}</span>
            <Badge variant={pick.signal === 'BUY' ? 'positive' : pick.signal === 'SELL' ? 'negative' : 'warning'} size="sm">
              {pick.signal}
            </Badge>
          </div>
          <div style={{ fontSize: F.sizeXs, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pick.name}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: F.sizeXl, fontWeight: 800, color: scoreColor, fontFamily: F.mono, lineHeight: 1 }}>
            {pick.score}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: S.sm }}>
        <span style={{ fontSize: F.sizeLg, fontWeight: 600, color: C.textPrimary, fontFamily: F.mono }}>${pick.price.toFixed(2)}</span>
        <span style={{ fontSize: F.sizeSm, fontWeight: 500, color: pick.change >= 0 ? C.positive : C.negative, fontFamily: F.mono }}>
          {pick.change >= 0 ? '+' : ''}{pick.changePercent.toFixed(2)}%
        </span>
      </div>
      <div style={{ marginTop: S.sm }}>
        <ScoreBar score={pick.score} size="sm" />
      </div>
    </Card>
  );
}

// ─── Signal Row ──────────────────────────────────────────────────────────────

function SignalRow({
  signal,
  onClick,
}: {
  signal: SignalData;
  onClick: () => void;
}) {
  const scoreColor = signal.score >= 80 ? C.positive : signal.score >= 60 ? C.warning : C.textMuted;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: S.md,
        padding: `${S.md} ${S.lg}`,
        cursor: 'pointer',
        transition: T.fast,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = C.bgCardHover)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Symbol + Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: F.sizeBase, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono }}>{signal.symbol}</span>
          <Badge
            variant={signal.signal === 'BUY' ? 'positive' : signal.signal === 'SELL' ? 'negative' : 'warning'}
            size="sm"
          >
            {signal.signal}
          </Badge>
        </div>
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {signal.name}
        </div>
      </div>

      {/* Price + Change */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
        <div style={{ fontSize: F.sizeBase, fontWeight: 600, color: C.textPrimary, fontFamily: F.mono }}>${signal.price.toFixed(2)}</div>
        <div style={{ fontSize: F.sizeXs, fontWeight: 500, color: signal.change >= 0 ? C.positive : C.negative, fontFamily: F.mono }}>
          {signal.change >= 0 ? '+' : ''}{signal.changePercent.toFixed(2)}%
        </div>
      </div>

      {/* Score */}
      <div style={{ width: 60, flexShrink: 0 }}>
        <ScoreBar score={signal.score} size="sm" showValue />
      </div>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.lg, paddingTop: S.xl }}>
      {/* Skeleton hero card */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: `${S.lg} ${S.xl}` }}>
        <div style={{ display: 'flex', gap: S.md, marginBottom: S.md }}>
          <div style={{ width: 120, height: 20, borderRadius: R.sm, background: C.bgElevated }} />
          <div style={{ width: 60, height: 20, borderRadius: R.sm, background: C.bgElevated }} />
        </div>
        <div style={{ width: 180, height: 28, borderRadius: R.sm, background: C.bgElevated, marginBottom: S.sm }} />
        <div style={{ width: 100, height: 16, borderRadius: R.sm, background: C.bgElevated, marginBottom: S.md }} />
        <div style={{ height: 4, borderRadius: R.full, background: C.bgElevated }} />
      </div>
      {/* Skeleton rows */}
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: `${S.md} ${S.lg}`, display: 'flex', alignItems: 'center', gap: S.md }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: 80, height: 14, borderRadius: R.sm, background: C.bgElevated, marginBottom: 4 }} />
            <div style={{ width: 160, height: 10, borderRadius: R.sm, background: C.bgElevated }} />
          </div>
          <div style={{ width: 60, height: 14, borderRadius: R.sm, background: C.bgElevated }} />
        </div>
      ))}
    </div>
  );
}
