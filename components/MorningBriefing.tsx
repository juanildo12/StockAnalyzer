'use client';
import { colors as C, radius as R, font as F, spacing as S, shadow } from '@/src/utils/webTheme';
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

// ─── Pick Card ───────────────────────────────────────────────────────────────

function PickCard({ pick, rank, onSelect }: { pick: BriefingPick; rank: number; onSelect: (sym: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card padding="0" hover glow={pick.confidence === 'HIGH'}>
      <div style={{ padding: S.lg }}>
        {/* Header row: rank + symbol + confidence + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: S.md, marginBottom: S.sm }}>
          {/* Rank badge */}
          <div style={{
            width: 28, height: 28,
            borderRadius: R.sm,
            background: rank <= 3 ? C.gradientPrimary : C.bgElevated,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: F.sizeSm, fontWeight: 800, color: rank <= 3 ? '#fff' : C.textSecondary,
            fontFamily: F.mono, flexShrink: 0,
          }}>
            {rank}
          </div>

          {/* Symbol + Name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
              <span style={{ fontSize: F.sizeLg, fontWeight: 800, color: C.textPrimary }}>{pick.symbol}</span>
              <Badge variant={CONFIDENCE_VARIANT[pick.confidence]} size="sm">{pick.confidence}</Badge>
            </div>
            <div style={{ fontSize: F.sizeSm, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pick.name}
            </div>
          </div>

          {/* Score */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: F.sizeXl, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, lineHeight: 1 }}>
              {pick.breakoutScore}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>/100</div>
          </div>
        </div>

        {/* Price + Change */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: S.sm, marginBottom: S.md }}>
          <span style={{ fontSize: F.sizeHero, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono }}>
            {fmtPrice(pick.price)}
          </span>
          <span style={{
            fontSize: F.sizeMd, fontWeight: 600,
            color: pick.changePercent >= 0 ? C.positive : C.negative,
            fontFamily: F.mono,
          }}>
            {fmtChange(pick.changePercent)}
          </span>
          <span style={{
            fontSize: F.sizeXs, padding: '2px 8px', borderRadius: R.full,
            background: C.accentGlow, color: C.accentLight, fontWeight: 500,
            marginLeft: 'auto',
          }}>
            {pick.setup}
          </span>
        </div>

        {/* Score breakdown */}
        <div style={{ marginBottom: S.md }}>
          <ScoreBar score={pick.breakoutScore} label="Total" />
        </div>

        {/* Levels grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: S.xs, marginBottom: S.md,
        }}>
          <LevelCell label="ENTRY" value={fmtPrice(pick.levels.entry)} color={C.accentLight} />
          <LevelCell label="TARGET 1" value={fmtPrice(pick.levels.target1)} color={C.positive} />
          <LevelCell label="STOP LOSS" value={fmtPrice(pick.levels.stopLoss)} color={C.negative} />
        </div>

        {/* Technical pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xs, marginBottom: S.sm }}>
          <Pill label="R/R" value={`${pick.levels.riskReward.toFixed(1)}:1`} color={pick.levels.riskReward >= 2 ? C.positive : C.warning} />
          <Pill label="Vol" value={`${pick.technicals.volRatio}x`} color={pick.technicals.volRatio > 2 ? C.positive : C.textSecondary} />
          {pick.technicals.rsi !== null && (
            <Pill label="RSI" value={`${pick.technicals.rsi}`} color={pick.technicals.rsi > 70 ? C.negative : pick.technicals.rsi < 30 ? C.positive : C.textSecondary} />
          )}
          {pick.sector && <Pill label="Sector" value={pick.sector} color={C.textMuted} />}
        </div>

        {/* Reasons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xxs, marginBottom: expanded ? S.md : 0 }}>
          {pick.reasons.map((r, i) => (
            <span key={i} style={{
              fontSize: F.sizeXs, padding: '2px 6px', borderRadius: R.sm,
              background: C.bgElevated, color: C.textMuted,
            }}>{r}</span>
          ))}
        </div>

        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.xs,
            width: '100%', padding: `${S.xs} 0`, marginTop: S.sm,
            background: 'none', border: 'none', borderRadius: R.sm,
            color: C.textMuted, cursor: 'pointer',
            fontSize: F.sizeSm, fontWeight: 500, fontFamily: F.family,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
          onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
        >
          {expanded ? 'Ocultar detalles' : 'Ver niveles completos'}
          <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: S.md, marginTop: S.sm,
          }}>
            {/* Full levels */}
            <div style={{ marginBottom: S.md }}>
              <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm }}>
                Niveles Clave
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.xs }}>
                <LevelRow label="Entrada" value={fmtPrice(pick.levels.entry)} color={C.accentLight} />
                <LevelRow label="Resistencia" value={fmtPrice(pick.levels.resistance)} color={C.warning} />
                <LevelRow label="Soporte" value={fmtPrice(pick.levels.support)} color={C.info} />
                <LevelRow label="Target 2" value={fmtPrice(pick.levels.target2)} color={C.positive} />
                <LevelRow label="Stop Loss" value={fmtPrice(pick.levels.stopLoss)} color={C.negative} />
                <LevelRow label="Market Cap" value={fmtMarketCap(pick.marketCap)} color={C.textSecondary} />
              </div>
            </div>

            {/* Technicals */}
            <div style={{ marginBottom: S.md }}>
              <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm }}>
                Técnicos
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.xs }}>
                <LevelRow label="RSI" value={pick.technicals.rsi !== null ? `${pick.technicals.rsi}` : 'N/A'} color={pick.technicals.rsi !== null && pick.technicals.rsi > 70 ? C.negative : C.textPrimary} />
                <LevelRow label="SMA 50" value={pick.technicals.sma50 !== null ? fmtPrice(pick.technicals.sma50) : 'N/A'} color={C.textSecondary} />
                <LevelRow label="SMA 200" value={pick.technicals.sma200 !== null ? fmtPrice(pick.technicals.sma200) : 'N/A'} color={C.textSecondary} />
                <LevelRow label="Volume Ratio" value={`${pick.technicals.volRatio}x`} color={pick.technicals.volRatio > 2 ? C.positive : C.textSecondary} />
              </div>
            </div>

            {/* Risk note */}
            <div style={{
              padding: S.sm, borderRadius: R.sm,
              background: C.bgElevated, fontSize: F.sizeSm, color: C.textSecondary,
              lineHeight: 1.4,
            }}>
              {pick.riskNote}
            </div>

            {/* CTA */}
            <Button
              variant="primary"
              fullWidth
              style={{ marginTop: S.md }}
              onClick={() => onSelect(pick.symbol)}
            >
              Ver Análisis Completo →
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Level Cell (compact) ────────────────────────────────────────────────────

function LevelCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: S.sm, background: C.bgInput, borderRadius: R.sm, textAlign: 'center',
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
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
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ fontFamily: F.mono, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

// ─── Market Bar ──────────────────────────────────────────────────────────────

function MarketBar({ market }: { market: MarketContext }) {
  if (!market.spy && !market.vix) return null;
  return (
    <Card padding={`${S.sm} ${S.lg}`} hover={false}>
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
    </Card>
  );
}

// ─── Summary Stats ───────────────────────────────────────────────────────────

function SummaryStats({ summary }: { summary: BriefingData['summary'] }) {
  const stats = [
    { label: 'Escaneados', value: summary.totalScanned.toString(), color: C.textPrimary },
    { label: 'Breakouts', value: summary.totalBreakouts.toString(), color: C.accentLight },
    { label: 'Alta Conf.', value: summary.highConfidence.toString(), color: C.positive },
    { label: 'R/R Prom.', value: `${summary.avgRiskReward.toFixed(1)}:1`, color: summary.avgRiskReward >= 2 ? C.positive : C.warning },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: S.sm }}>
      {stats.map((stat, i) => (
        <Card key={i} padding={S.sm} hover={false} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2, fontWeight: 500 }}>{stat.label}</div>
          <div style={{ fontSize: F.sizeLg, fontWeight: 700, color: stat.color, fontFamily: F.mono }}>{stat.value}</div>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface MorningBriefingProps {
  onSelectStock: (symbol: string) => void;
}

export default function MorningBriefing({ onSelectStock }: MorningBriefingProps) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        title="Error cargando briefing"
        description={error}
        actionLabel="Reintentar"
        onAction={fetchData}
      />
    );
  }

  // Empty
  if (!data || data.picks.length === 0) {
    return (
      <EmptyState
        icon={<span style={{ fontSize: 28 }}>◆</span>}
        title="No hay breakouts hoy"
        description="El mercado no está presentando setups claros. Vuelve mañana para un nuevo escaneo."
        actionLabel="Actualizar"
        onAction={fetchData}
      />
    );
  }

  const { picks, summary, market, date, time } = data;

  return (
    <div style={{ padding: `0 ${S.lg}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.xl }}>
        <div>
          <h2 style={{ fontSize: F.sizeHero, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>
            Morning Briefing
          </h2>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>
            {date} · {time}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>↻ Actualizar</Button>
      </div>

      {/* Market Context */}
      <div style={{ marginBottom: S.lg }}>
        <MarketBar market={market} />
      </div>

      {/* Summary Stats */}
      <div style={{ marginBottom: S.xl }}>
        <SummaryStats summary={summary} />
      </div>

      {/* Pick Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {picks.map((pick, i) => (
          <PickCard key={pick.symbol} pick={pick} rank={i + 1} onSelect={onSelectStock} />
        ))}
      </div>

      {/* Footer */}
      <Card padding={S.md} hover={false} style={{ marginTop: S.xl, textAlign: 'center' }}>
        <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>
          Datos: Yahoo Finance + Finnhub · Score: Trend (30) + Volume (30) + Structure (20) + Safety (20)
          {summary.topSectors.length > 0 && (
            <> · Sectores: {summary.topSectors.join(', ')}</>
          )}
        </span>
      </Card>
    </div>
  );
}
