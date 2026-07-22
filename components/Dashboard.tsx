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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadSignals = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const screenerRes = await fetch('/api/screener?action=screener');
      const screenerJson = await screenerRes.json();
      const stocks = screenerJson.stocks || screenerJson.screenerStocks || [];
      const symbols = stocks.map((s: any) => s.symbol).filter(Boolean).slice(0, TOP_N_SIGNALS).join(',');

      if (!symbols) {
        setSignals([]);
        return;
      }

      const res = await fetch(`/api/signal?symbols=${symbols}`);
      const json = await res.json();
      if (json.signals) {
        setSignals(json.signals.filter((s: SignalData | null) => s != null));
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Error cargando señales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSignals(false);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadSignals]);

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
      setError(`Error cargando ${symbol}`);
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
            Reintentar
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
          lastUpdated={lastUpdated}
          onRefresh={() => loadSignals(false)}
          refreshing={loading && !!lastUpdated}
        />

        {selectedSymbol && detailData ? (
          <div style={{ animation: 'fadeIn 0.15s ease forwards' }}>
            <button
              onClick={() => setSelectedSymbol(null)}
              style={{
                background: 'none', border: 'none', color: C.accentLight, cursor: 'pointer',
                fontSize: F.sizeSm, padding: '8px 0', marginBottom: S.lg,
                display: 'flex', alignItems: 'center', gap: S.xs, fontFamily: F.family, fontWeight: 500,
                transition: T.fast,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = C.accent; e.currentTarget.style.transform = 'translateX(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.accentLight; e.currentTarget.style.transform = 'translateX(0)'; }}
            >
              &#8592; Volver al panel
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
            <FrameworkView
              quote={quoteData}
              summary={enrichedData?.summary}
            />
          </div>
        ) : loading ? (
          <LoadingState />
        ) : (
          <div key={activeTab} style={{ display: 'flex', flexDirection: 'column', gap: S.xl, animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
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
  searchQuery, onSearchChange, activeTab, onTabChange, lastUpdated, onRefresh, refreshing,
}: {
  searchQuery: string; onSearchChange: (q: string) => void;
  activeTab: DashboardTab; onTabChange: (v: DashboardTab) => void;
  lastUpdated: Date | null; onRefresh: () => void; refreshing: boolean;
}) {
  const timeAgo = lastUpdated ? (() => {
    const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m`;
  })() : '';

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
            Panel
          </h1>
          {lastUpdated && (
            <span style={{
              fontSize: F.sizeXs, color: C.textMuted, background: C.bgElevated,
              padding: '2px 8px', borderRadius: R.sm,
            }}>
              {timeAgo} atrás
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Actualizar datos"
            style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.sm,
              padding: `${S.sm} ${S.sm}`, color: C.textMuted, cursor: refreshing ? 'wait' : 'pointer',
              fontSize: F.sizeSm, display: 'flex', alignItems: 'center', gap: S.xs,
              transition: T.fast, fontFamily: F.family,
            }}
            onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.color = C.textPrimary; e.currentTarget.style.borderColor = C.borderHover; } }}
            onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.5s ease', transform: refreshing ? 'rotate(360deg)' : 'none' }}>&#8635;</span>
            <span style={{ fontSize: F.sizeXs }}>Refresh</span>
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Buscar símbolo..."
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
      </div>

      <div style={{ display: 'flex', gap: S.xs }}>
        {([['dashboard', 'Resumen'], ['screener', 'Screener'], ['market', 'Mercado']] as const).map(([key, label]) => (
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
  const SHIMMER = `linear-gradient(90deg, ${C.bgElevated} 25%, ${C.bgCardHover} 50%, ${C.bgElevated} 75%)`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.lg, paddingTop: S.xl }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg,
          padding: `${S.md} ${S.lg}`, display: 'flex', alignItems: 'center', gap: S.md,
          animation: `fadeInUp 0.2s ease ${i * 0.05}s both`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: R.sm,
            background: SHIMMER, backgroundSize: '200% 100%',
            animation: 'shimmerModern 1.5s ease-in-out infinite',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              width: 80, height: 14, borderRadius: R.sm,
              background: SHIMMER, backgroundSize: '200% 100%',
              marginBottom: 4,
              animation: `shimmerModern 1.5s ease-in-out infinite ${0.05 * i}s`,
            }} />
            <div style={{
              width: 160, height: 10, borderRadius: R.sm,
              background: SHIMMER, backgroundSize: '200% 100%',
              animation: `shimmerModern 1.5s ease-in-out infinite ${0.05 * i}s`,
            }} />
          </div>
          <div style={{
            width: 50, height: 14, borderRadius: R.sm,
            background: SHIMMER, backgroundSize: '200% 100%',
            animation: `shimmerModern 1.5s ease-in-out infinite ${0.05 * i}s`,
          }} />
        </div>
      ))}
    </div>
  );
}

function FrameworkView({ quote, summary }: { quote: any; summary: any }) {
  if (!quote || !summary) return null;

  const marketCap = quote.marketCap || 0;
  const fcfYield = marketCap > 0 ? ((summary.freeCashflow || 0) / marketCap) * 100 : 0;
  const pe = quote.peRatio || 0;
  const revGrowth = (summary.revenueGrowth || 0) * 100;
  const margin = (summary.profitMargins || 0) * 100;
  const isFCFPositive = (summary.freeCashflow || 0) >= 0;

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

  const cardStyle = { background: C.bgCard, borderRadius: R.lg, padding: '20px', borderLeft: `4px solid ${C.accentLight}` };

  return (
    <div style={{ marginTop: S.md, animation: 'fadeInUp 0.3s ease forwards' }}>
      <div style={{ background: C.bgCard, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '22px', margin: '0 0 4px', color: C.textPrimary }}>🧠 FRAMEWORK PRO</h3>
          <p style={{ fontSize: F.sizeLg, color: C.textMuted, fontWeight: 'normal', margin: 0 }}>¿Barata o Trampa?</p>
        </div>

        <div style={{ background: C.bgCardHover, borderRadius: R.lg, padding: '16px', marginBottom: '16px', borderLeft: `4px solid ${C.warning}` }}>
          <h4 style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted }}>🧩 Filtro Inicial</h4>
          <p style={{ fontSize: F.sizeLg, fontWeight: 'bold', color: isFCFPositive ? C.positive : C.negative, margin: 0 }}>
            {isFCFPositive ? '✅ FCF POSITIVO — Modo Valor' : '⚠️ FCF NEGATIVO — Modo Growth'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={cardStyle}>
            <h4 style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted }}>💰 FCF Yield</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: fcfYield > 5 ? C.positive : C.negative, margin: 0 }}>{fcfYield.toFixed(1)}%</p>
            <p style={{ fontSize: F.sizeXs, color: C.textMuted, margin: '4px 0 0' }}>{fcfYield > 10 ? '💎 Muy barata' : fcfYield > 5 ? '✅ Buena' : fcfYield > 3 ? '😐 Normal' : '⚠️ Cara'}</p>
          </div>
          <div style={cardStyle}>
            <h4 style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted }}>📊 PE Ratio</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: pe < 25 ? C.positive : C.negative, margin: 0 }}>{pe.toFixed(1)}</p>
            <p style={{ fontSize: F.sizeXs, color: C.textMuted, margin: '4px 0 0' }}>{pe < 15 ? 'Value' : pe < 25 ? 'Balanceada' : pe < 40 ? 'Growth' : '🚨 Alta'}</p>
          </div>
          <div style={cardStyle}>
            <h4 style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted }}>📈 Revenue</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: revGrowth > 0 ? C.positive : C.negative, margin: 0 }}>{revGrowth > 0 ? '+' : ''}{revGrowth.toFixed(1)}%</p>
            <p style={{ fontSize: F.sizeXs, color: C.textMuted, margin: '4px 0 0' }}>{revGrowth > 20 ? '🚀 Alto' : revGrowth > 10 ? '✅ Saludable' : revGrowth > 0 ? '🐢 Lento' : '🚨 Problema'}</p>
          </div>
          <div style={cardStyle}>
            <h4 style={{ margin: '0 0 6px', fontSize: F.sizeSm, color: C.textMuted }}>🧾 Margen</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: margin > 10 ? C.positive : C.negative, margin: 0 }}>{margin.toFixed(1)}%</p>
            <p style={{ fontSize: F.sizeXs, color: C.textMuted, margin: '4px 0 0' }}>{margin > 20 ? '💪 Excelente' : margin > 10 ? '✅ Bueno' : '⚠️ Débil'}</p>
          </div>
        </div>

        <div style={{ background: C.bgCard, borderRadius: R.lg, padding: '20px', marginBottom: '20px', borderLeft: `4px solid ${color}` }}>
          <h4 style={{ margin: '0 0 12px', textAlign: 'center', fontSize: F.sizeBase }}>🧭 Score: {score}/10</h4>
          <div style={{ padding: '14px', background: color + '20', borderRadius: R.lg, textAlign: 'center' }}>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color, margin: 0 }}>{decision}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <div style={{ padding: '14px', background: C.bgCard, borderRadius: R.lg, border: isJoyas ? `2px solid ${C.positive}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 6px', color: C.positive, fontSize: '14px' }}>💎 Joyas Ocultas</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF &gt;8% + PE bajo + crece + margen sólido</p>
            {isJoyas && <p style={{ margin: '6px 0 0', fontSize: F.sizeSm, fontWeight: 'bold', color: C.positive }}>✓ BARATA + GENERA CASH + CRECE</p>}
          </div>
          <div style={{ padding: '14px', background: C.bgCard, borderRadius: R.lg, border: isGrowth ? `2px solid ${C.accentLight}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 6px', color: C.accentLight, fontSize: '14px' }}>🚀 Growth Caro</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF bajo + PE alto + Revenue &gt;20%</p>
            {isGrowth && <p style={{ margin: '6px 0 0', fontSize: F.sizeSm, fontWeight: 'bold', color: C.accentLight }}>✓ CARA, PERO PUEDE SER GANADORA</p>}
          </div>
          <div style={{ padding: '14px', background: C.bgCard, borderRadius: R.lg, border: isValueTrap ? `2px solid ${C.negative}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 6px', color: C.negative, fontSize: '14px' }}>⚠️ Value Trap</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF alto + PE bajo + revenue estancado</p>
            {isValueTrap && <p style={{ margin: '6px 0 0', fontSize: F.sizeSm, fontWeight: 'bold', color: C.negative }}>✗ PARECE BARATA... PERO MUERE</p>}
          </div>
          <div style={{ padding: '14px', background: C.bgCard, borderRadius: R.lg, border: isBomba ? `2px solid ${C.negative}` : `1px solid ${C.border}` }}>
            <h4 style={{ margin: '0 0 6px', color: C.negative, fontSize: '14px' }}>💣 Bomba de Tiempo</h4>
            <p style={{ margin: 0, fontSize: F.sizeXs, color: C.textMuted }}>FCF negativo + PE alto + no crece</p>
            {isBomba && <p style={{ margin: '6px 0 0', fontSize: F.sizeSm, fontWeight: 'bold', color: C.negative }}>✗ SOBREVALORADA + SIN FUNDAMENTOS</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
