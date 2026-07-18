'use client';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import { useState, useEffect, useCallback } from 'react';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import Button from '@/src/components/ui/Button';
import ScoreBar from '@/src/components/ui/ScoreBar';
import { SkeletonBriefing } from '@/src/components/ui/Skeleton';
import EmptyState from '@/src/components/ui/EmptyState';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BriefingPick {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  sector: string;
  marketCap: number;
  breakoutScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'MODERATE';
  entryWindow: string;
  levels: {
    entry: number;
    resistance: number;
    support: number;
    target1: number;
    target2: number;
    stopLoss: number;
    riskReward: number;
  };
  technicals: {
    rsi: number | null;
    sma50: number | null;
    sma200: number | null;
    volRatio: number;
  };
  reasons: string[];
  setup: string;
  riskNote: string;
}

interface MarketContext {
  spy: { price: number; change: number } | null;
  vix: { level: number; label: string } | null;
}

interface BriefingData {
  date: string;
  time: string;
  market: MarketContext;
  summary: {
    totalScanned: number;
    totalBreakouts: number;
    highConfidence: number;
    avgRiskReward: number;
    topSectors: string[];
  };
  picks: BriefingPick[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtChange(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtMarketCap(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

const CONFIDENCE_VARIANT: Record<string, 'positive' | 'warning' | 'info'> = {
  HIGH: 'positive',
  MEDIUM: 'warning',
  MODERATE: 'info',
};

const VIX_COLORS: Record<string, string> = {
  ALTA: C.negative,
  MEDIA: C.warning,
  BAJA: C.positive,
};

function getScoreColor(score: number): string {
  if (score >= 80) return C.positive;
  if (score >= 60) return C.warning;
  if (score >= 40) return C.info;
  return C.textMuted;
}

// ─── Research Card ───────────────────────────────────────────────────────────

function ResearchCard({ pick, rank, onSelect, isPro }: { pick: BriefingPick; rank: number; onSelect: (sym: string) => void; isPro: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = getScoreColor(pick.breakoutScore);

  return (
    <Card padding="0" hover glow={pick.confidence === 'HIGH'}>
      <div style={{ padding: `${S.lg} ${S.xl}` }}>
        {/* Row 1: Rank + Symbol + Confidence + Score */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.md, marginBottom: S.md }}>
          {/* Rank */}
          <div style={{
            width: 32, height: 32, borderRadius: R.sm,
            background: rank <= 3 ? C.gradientPrimary : C.bgElevated,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: F.sizeMd, fontWeight: 800, color: rank <= 3 ? '#fff' : C.textSecondary,
            fontFamily: F.mono, flexShrink: 0,
          }}>
            {rank}
          </div>

          {/* Symbol + Name + Confidence */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
              <span style={{ fontSize: F.sizeXl, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                {pick.symbol}
              </span>
              <Badge variant={CONFIDENCE_VARIANT[pick.confidence]} size="sm" dot>{pick.confidence}</Badge>
              {pick.setup && (
                <span style={{
                  fontSize: F.sizeXs, padding: '1px 6px', borderRadius: R.sm,
                  background: C.accentGlow, color: C.accentLight, fontWeight: 500,
                }}>
                  {pick.setup}
                </span>
              )}
            </div>
            <div style={{ fontSize: F.sizeSm, color: C.textMuted, marginTop: 1 }}>
              {pick.name}
            </div>
          </div>

          {/* Score */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: scoreColor, fontFamily: F.mono, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {pick.breakoutScore}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 2 }}>/100</div>
          </div>
        </div>

        {/* Row 2: Price + Change */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: S.sm, marginBottom: S.md }}>
          <span style={{ fontSize: F.sizeHero, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.01em' }}>
            {fmtPrice(pick.price)}
          </span>
          <span style={{
            fontSize: F.sizeMd, fontWeight: 600,
            color: pick.changePercent >= 0 ? C.positive : C.negative,
            fontFamily: F.mono,
          }}>
            {fmtChange(pick.changePercent)}
          </span>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted, marginLeft: 'auto' }}>
            {fmtMarketCap(pick.marketCap)}
          </span>
        </div>

        {/* Row 3: Score Bar */}
        <div style={{ marginBottom: S.md }}>
          <ScoreBar score={pick.breakoutScore} label="Score" />
        </div>

        {/* Row 4: Key Levels — always visible */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: S.xs, marginBottom: S.md,
        }}>
          <LevelCell label="ENTRY" value={fmtPrice(pick.levels.entry)} color={C.accentLight} />
          <LevelCell label="TARGET 1" value={fmtPrice(pick.levels.target1)} color={C.positive} />
          <LevelCell label="STOP LOSS" value={fmtPrice(pick.levels.stopLoss)} color={C.negative} />
        </div>

        {/* Row 5: Technical Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xs, marginBottom: S.md }}>
          <Pill label="R/R" value={`${pick.levels.riskReward.toFixed(1)}:1`} color={pick.levels.riskReward >= 2 ? C.positive : C.warning} />
          <Pill label="Vol" value={`${pick.technicals.volRatio}x`} color={pick.technicals.volRatio > 2 ? C.positive : C.textSecondary} />
          {pick.technicals.rsi !== null && (
            <Pill label="RSI" value={`${pick.technicals.rsi}`} color={pick.technicals.rsi > 70 ? C.negative : pick.technicals.rsi < 30 ? C.positive : C.textSecondary} />
          )}
          {pick.sector && <Pill label="" value={pick.sector} color={C.textMuted} />}
        </div>

        {/* ─── Free / Pro Split ────────────────────────────────────── */}
        {!isPro ? (
          /* FREE: Blurred teaser + upgrade CTA */
          <div style={{ position: 'relative' }}>
            {/* Blurred content preview */}
            <div style={{
              filter: 'blur(6px)',
              pointerEvents: 'none',
              userSelect: 'none',
              marginBottom: S.sm,
            }}>
              {/* Reasons preview */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xxs, marginBottom: S.sm }}>
                {pick.reasons.slice(0, 4).map((r, i) => (
                  <span key={i} style={{
                    fontSize: F.sizeXs, padding: '2px 6px', borderRadius: R.sm,
                    background: C.bgElevated, color: C.textMuted,
                  }}>{r}</span>
                ))}
              </div>
              {/* Hidden levels preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.xs }}>
                <LevelRow label="Resistencia" value={fmtPrice(pick.levels.resistance)} color={C.warning} />
                <LevelRow label="Soporte" value={fmtPrice(pick.levels.support)} color={C.info} />
                <LevelRow label="Target 2" value={fmtPrice(pick.levels.target2)} color={C.positive} />
                <LevelRow label="R/R" value={`${pick.levels.riskReward.toFixed(1)}:1`} color={C.textSecondary} />
              </div>
            </div>

            {/* Upgrade CTA overlay */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: `${S.xl} ${S.lg} ${S.md}`,
              background: `linear-gradient(180deg, transparent 0%, ${C.bgCard} 30%)`,
            }}>
              <div style={{
                fontSize: F.sizeSm, color: C.textMuted, marginBottom: S.sm,
                textAlign: 'center', lineHeight: 1.4,
              }}>
                Full AI analysis, levels & risk assessment
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.location.href = '/settings/billing'}
              >
                Unlock Full Analysis — Pro
              </Button>
            </div>
          </div>
        ) : (
          /* PRO: Full content */
          <div>
            {/* Reasons */}
            {pick.reasons.length > 0 && (
              <div style={{ marginBottom: S.md }}>
                <div style={{
                  fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm,
                }}>
                  Key Signals
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xs }}>
                  {pick.reasons.map((r, i) => (
                    <span key={i} style={{
                      fontSize: F.sizeSm, padding: '3px 8px', borderRadius: R.sm,
                      background: C.bgElevated, color: C.textSecondary, lineHeight: 1.3,
                    }}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Expand toggle for full details */}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.xs,
                width: '100%', padding: `${S.xs} 0`, marginBottom: expanded ? 0 : S.xs,
                background: 'none', border: 'none', borderRadius: R.sm,
                color: C.accentLight, cursor: 'pointer',
                fontSize: F.sizeSm, fontWeight: 500, fontFamily: F.family,
                transition: T.fast,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = C.accentLight)}
            >
              {expanded ? 'Collapse details' : 'View full breakdown'}
              <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
            </button>

            {/* Expanded details */}
            {expanded && (
              <div style={{
                borderTop: `1px solid ${C.border}`,
                paddingTop: S.md, marginTop: S.sm,
              }}>
                {/* Full Levels */}
                <SectionTitle>Niveles Clave</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.xs, marginBottom: S.lg }}>
                  <LevelRow label="Entrada" value={fmtPrice(pick.levels.entry)} color={C.accentLight} />
                  <LevelRow label="Resistencia" value={fmtPrice(pick.levels.resistance)} color={C.warning} />
                  <LevelRow label="Soporte" value={fmtPrice(pick.levels.support)} color={C.info} />
                  <LevelRow label="Target 1" value={fmtPrice(pick.levels.target1)} color={C.positive} />
                  <LevelRow label="Target 2" value={fmtPrice(pick.levels.target2)} color={C.positive} />
                  <LevelRow label="Stop Loss" value={fmtPrice(pick.levels.stopLoss)} color={C.negative} />
                  <LevelRow label="R/R Ratio" value={`${pick.levels.riskReward.toFixed(1)}:1`} color={pick.levels.riskReward >= 2 ? C.positive : C.warning} />
                  <LevelRow label="Market Cap" value={fmtMarketCap(pick.marketCap)} color={C.textSecondary} />
                </div>

                {/* Technicals */}
                <SectionTitle>Técnicos</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.xs, marginBottom: S.lg }}>
                  <LevelRow label="RSI" value={pick.technicals.rsi !== null ? `${pick.technicals.rsi}` : 'N/A'} color={pick.technicals.rsi !== null && pick.technicals.rsi > 70 ? C.negative : C.textPrimary} />
                  <LevelRow label="SMA 50" value={pick.technicals.sma50 !== null ? fmtPrice(pick.technicals.sma50) : 'N/A'} color={C.textSecondary} />
                  <LevelRow label="SMA 200" value={pick.technicals.sma200 !== null ? fmtPrice(pick.technicals.sma200) : 'N/A'} color={C.textSecondary} />
                  <LevelRow label="Volume Ratio" value={`${pick.technicals.volRatio}x`} color={pick.technicals.volRatio > 2 ? C.positive : C.textSecondary} />
                </div>

                {/* Risk Note */}
                <SectionTitle>Risk Assessment</SectionTitle>
                <div style={{
                  padding: S.md, borderRadius: R.sm,
                  background: C.bgElevated, fontSize: F.sizeSm, color: C.textSecondary,
                  lineHeight: 1.5, marginBottom: S.lg,
                }}>
                  {pick.riskNote}
                </div>

                {/* CTA */}
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => onSelect(pick.symbol)}
                >
                  Open Full Analysis →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Section Title ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm,
    }}>
      {children}
    </div>
  );
}

// ─── Level Cell (compact) ────────────────────────────────────────────────────

function LevelCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: `${S.sm} ${S.xs}`, background: C.bgInput, borderRadius: R.sm, textAlign: 'center',
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: F.sizeMd, fontWeight: 700, color, fontFamily: F.mono }}>
        {value}
      </div>
    </div>
  );
}

// ─── Level Row (expanded) ────────────────────────────────────────────────────

function LevelRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${S.xs} ${S.sm}`, borderRadius: R.sm, background: C.bgInput,
      border: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: F.sizeSm, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: F.sizeSm, fontWeight: 600, color, fontFamily: F.mono }}>{value}</span>
    </div>
  );
}

// ─── Pill (technical indicator) ──────────────────────────────────────────────

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: F.sizeXs, padding: '2px 8px', borderRadius: R.full,
      background: C.bgElevated, color, fontWeight: 500,
    }}>
      {label && <span style={{ color: C.textMuted }}>{label}</span>}
      <span style={{ fontFamily: F.mono, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

// ─── Market Bar (compact header) ─────────────────────────────────────────────

function MarketBar({ market }: { market: MarketContext }) {
  if (!market.spy && !market.vix) return null;
  return (
    <div style={{ display: 'flex', gap: S.xl, alignItems: 'center' }}>
      {market.spy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted, fontWeight: 500 }}>S&P 500</span>
          <span style={{ fontSize: F.sizeMd, fontWeight: 600, color: C.textPrimary, fontFamily: F.mono }}>
            {fmtPrice(market.spy.price)}
          </span>
          <span style={{
            fontSize: F.sizeSm, fontWeight: 600,
            color: market.spy.change >= 0 ? C.positive : C.negative,
            fontFamily: F.mono,
          }}>
            {fmtChange(market.spy.change)}
          </span>
        </div>
      )}
      {market.vix && (
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted, fontWeight: 500 }}>VIX</span>
          <span style={{
            fontSize: F.sizeMd, fontWeight: 600,
            color: VIX_COLORS[market.vix.label] || C.textSecondary,
            fontFamily: F.mono,
          }}>
            {market.vix.level.toFixed(2)}
          </span>
          <Badge
            variant={market.vix.label === 'BAJA' ? 'positive' : market.vix.label === 'MEDIA' ? 'warning' : 'negative'}
            size="sm"
          >
            {market.vix.label}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ─── Summary Stats (compact) ─────────────────────────────────────────────────

function SummaryStats({ summary, isPro }: { summary: BriefingData['summary']; isPro: boolean }) {
  const stats = [
    { label: 'Scanned', value: summary.totalScanned.toString(), color: C.textPrimary },
    { label: 'Breakouts', value: summary.totalBreakouts.toString(), color: C.accentLight },
    { label: 'High Conv.', value: summary.highConfidence.toString(), color: C.positive },
    { label: 'Avg R/R', value: `${summary.avgRiskReward.toFixed(1)}:1`, color: summary.avgRiskReward >= 2 ? C.positive : C.warning },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: S.sm,
    }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          padding: `${S.sm} ${S.md}`, borderRadius: R.sm,
          background: C.bgCard, border: `1px solid ${C.border}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2, fontWeight: 500 }}>
            {stat.label}
          </div>
          <div style={{ fontSize: F.sizeLg, fontWeight: 700, color: stat.color, fontFamily: F.mono }}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface MorningBriefingProps {
  onSelectStock: (symbol: string) => void;
  userPlan?: string;
}

export default function MorningBriefing({ onSelectStock, userPlan = 'free' }: MorningBriefingProps) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPro = ['pro', 'elite', 'enterprise'].includes(userPlan);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/morning-briefing?t=${Date.now()}`);
      if (!res.ok) throw new Error('Error loading briefing');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Loading
  if (loading) return <SkeletonBriefing />;

  // Error
  if (error) {
    return (
      <EmptyState
        icon={<span style={{ fontSize: 28 }}>⚠</span>}
        iconColor={C.negative}
        title="Error loading briefing"
        description={error}
        actionLabel="Retry"
        onAction={fetchData}
      />
    );
  }

  // Empty
  if (!data || data.picks.length === 0) {
    return (
      <EmptyState
        icon={<span style={{ fontSize: 28 }}>◆</span>}
        title="No breakouts today"
        description="The market isn't showing clear setups right now. Check back tomorrow for a new scan."
        actionLabel="Refresh"
        onAction={fetchData}
      />
    );
  }

  const { picks, summary, market, date, time } = data;

  return (
    <div style={{ padding: `0 ${S.lg}`, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: S.lg, flexWrap: 'wrap', gap: S.md,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
            <h2 style={{
              fontSize: F.sizeHero, fontWeight: 800, color: C.textPrimary,
              margin: 0, letterSpacing: '-0.02em',
            }}>
              AI Briefing
            </h2>
            {!isPro && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: R.full,
                background: C.gradientPrimary, color: '#fff', letterSpacing: '0.04em',
              }}>
                PRO
              </span>
            )}
          </div>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>
            {date} · {time}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
          <MarketBar market={market} />
          <Button variant="ghost" size="sm" onClick={fetchData}>↻</Button>
        </div>
      </div>

      {/* ─── Summary Stats ──────────────────────────────────────── */}
      <div style={{ marginBottom: S.xl }}>
        <SummaryStats summary={summary} isPro={isPro} />
      </div>

      {/* ─── Top Pick CTA (Free only) ──────────────────────────── */}
      {!isPro && picks.length > 0 && (
        <div style={{
          marginBottom: S.xl, padding: `${S.md} ${S.lg}`,
          borderRadius: R.lg,
          background: `linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.05))`,
          border: `1px solid ${C.accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: S.md,
        }}>
          <div>
            <div style={{ fontSize: F.sizeMd, fontWeight: 600, color: C.textPrimary, marginBottom: 2 }}>
              Today's Top Pick: {picks[0].symbol}
            </div>
            <div style={{ fontSize: F.sizeSm, color: C.textMuted }}>
              Score {picks[0].breakoutScore}/100 · {picks[0].setup} · R/R {picks[0].levels.riskReward.toFixed(1)}:1
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => window.location.href = '/settings/billing'}>
            Upgrade to Pro
          </Button>
        </div>
      )}

      {/* ─── Pick Cards ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {picks.map((pick, i) => (
          <ResearchCard
            key={pick.symbol}
            pick={pick}
            rank={i + 1}
            onSelect={onSelectStock}
            isPro={isPro}
          />
        ))}
      </div>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <div style={{
        marginTop: S.xl, padding: S.md, textAlign: 'center',
        borderRadius: R.sm, background: C.bgCard, border: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>
          Data: Yahoo Finance + Finnhub · Score: Trend (30) + Volume (30) + Structure (20) + Safety (20)
          {summary.topSectors.length > 0 && (
            <> · Sectors: {summary.topSectors.join(', ')}</>
          )}
        </span>
      </div>
    </div>
  );
}
