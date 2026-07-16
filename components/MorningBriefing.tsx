'use client';
import { colors as C, radius as R, font as F, spacing as S, shadow } from '@/src/utils/webTheme';
import { useState, useEffect, useCallback } from 'react';

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
  return n >= 100 ? `$${n.toFixed(2)}` : `$${n.toFixed(2)}`;
}

function fmtChange(n: number) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtMarketCap(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

const CONFIDENCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  HIGH: { bg: C.positiveBg, border: C.positiveBorder, text: C.positive },
  MEDIUM: { bg: C.warningBg, border: C.warningBorder, text: C.warning },
  MODERATE: { bg: C.infoBg, border: C.infoBorder, text: C.info },
};

const VIX_COLORS: Record<string, string> = {
  ALTA: C.negative,
  MEDIA: C.warning,
  BAJA: C.positive,
};

// ─── Score Bar ───────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? C.positive : score >= 65 ? C.warning : C.info;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 48, height: 6, borderRadius: R.full,
        background: C.border, overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: color, borderRadius: R.full,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: F.sizeSm, fontWeight: 700, color, fontFamily: F.mono }}>
        {score}
      </span>
    </div>
  );
}

// ─── Level Row ───────────────────────────────────────────────────────────────

function LevelRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0',
    }}>
      <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>{label}</span>
      <span style={{
        fontSize: F.sizeSm, fontWeight: bold ? 700 : 400,
        color, fontFamily: F.mono,
      }}>{value}</span>
    </div>
  );
}

// ─── Pick Card ───────────────────────────────────────────────────────────────

function PickCard({ pick, onSelect }: { pick: BriefingPick; onSelect: (sym: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_COLORS[pick.confidence];

  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      padding: S.lg,
      cursor: 'pointer',
      transition: C.borderLight,
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
    onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: F.sizeXl, fontWeight: 800, color: C.textPrimary }}>{pick.symbol}</span>
          <span style={{
            fontSize: F.sizeXs, padding: '2px 8px', borderRadius: R.full,
            background: conf.bg, border: `1px solid ${conf.border}`, color: conf.text,
            fontWeight: 600,
          }}>{pick.confidence}</span>
        </div>
        <ScoreBar score={pick.breakoutScore} />
      </div>

      {/* Name + Sector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: S.sm }}>
        <span style={{ fontSize: F.sizeMd, color: C.textSecondary }}>{pick.name}</span>
        {pick.sector && (
          <span style={{ fontSize: F.sizeXs, color: C.textMuted, background: C.bgElevated, padding: '2px 8px', borderRadius: R.sm }}>
            {pick.sector}
          </span>
        )}
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
      </div>

      {/* Setup label + Entry window */}
      <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md }}>
        <span style={{
          fontSize: F.sizeSm, padding: '3px 10px', borderRadius: R.sm,
          background: C.accentGlow, color: C.accentLight, fontWeight: 600,
        }}>
          {pick.setup}
        </span>
        <span style={{
          fontSize: F.sizeSm, padding: '3px 10px', borderRadius: R.sm,
          background: C.bgElevated, color: C.textSecondary,
        }}>
          Entry: {pick.entryWindow}
        </span>
      </div>

      {/* Quick Levels */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: S.xs,
        padding: S.sm, background: C.bgInput, borderRadius: R.sm, marginBottom: S.sm,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>Target 1</div>
          <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: C.positive, fontFamily: F.mono }}>{fmtPrice(pick.levels.target1)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>Stop Loss</div>
          <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: C.negative, fontFamily: F.mono }}>{fmtPrice(pick.levels.stopLoss)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>R/R Ratio</div>
          <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: pick.levels.riskReward >= 2 ? C.positive : C.warning, fontFamily: F.mono }}>
            {pick.levels.riskReward.toFixed(1)}:1
          </div>
        </div>
      </div>

      {/* Reasons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: S.sm }}>
        {pick.reasons.map((r, i) => (
          <span key={i} style={{
            fontSize: F.sizeXs, padding: '2px 8px', borderRadius: R.sm,
            background: C.bgElevated, color: C.textSecondary,
          }}>{r}</span>
        ))}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: S.md, marginTop: S.sm,
        }}>
          {/* Full Levels */}
          <div style={{ marginBottom: S.md }}>
            <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary, marginBottom: S.xs }}>Niveles Clave</div>
            <LevelRow label="Entrada (Breakout)" value={fmtPrice(pick.levels.entry)} color={C.accentLight} bold />
            <LevelRow label="Resistencia" value={fmtPrice(pick.levels.resistance)} color={C.warning} />
            <LevelRow label="Soporte" value={fmtPrice(pick.levels.support)} color={C.info} />
            <LevelRow label="Target 1" value={fmtPrice(pick.levels.target1)} color={C.positive} bold />
            <LevelRow label="Target 2" value={fmtPrice(pick.levels.target2)} color={C.positive} />
            <LevelRow label="Stop Loss" value={fmtPrice(pick.levels.stopLoss)} color={C.negative} bold />
          </div>

          {/* Technicals */}
          <div style={{ marginBottom: S.md }}>
            <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary, marginBottom: S.xs }}>Técnicos</div>
            <LevelRow label="RSI" value={pick.technicals.rsi !== null ? `${pick.technicals.rsi}` : 'N/A'} color={pick.technicals.rsi !== null && pick.technicals.rsi > 70 ? C.negative : pick.technicals.rsi !== null && pick.technicals.rsi < 30 ? C.positive : C.textPrimary} />
            <LevelRow label="SMA 50" value={pick.technicals.sma50 !== null ? fmtPrice(pick.technicals.sma50) : 'N/A'} color={C.textSecondary} />
            <LevelRow label="SMA 200" value={pick.technicals.sma200 !== null ? fmtPrice(pick.technicals.sma200) : 'N/A'} color={C.textSecondary} />
            <LevelRow label="Volume Ratio" value={`${pick.technicals.volRatio}x`} color={pick.technicals.volRatio > 2 ? C.positive : C.textSecondary} />
            <LevelRow label="Market Cap" value={fmtMarketCap(pick.marketCap)} color={C.textSecondary} />
          </div>

          {/* Risk Note */}
          <div style={{
            padding: S.sm, borderRadius: R.sm,
            background: C.bgElevated, fontSize: F.sizeSm, color: C.textSecondary,
          }}>
            {pick.riskNote}
          </div>

          {/* Action button */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(pick.symbol); }}
            style={{
              width: '100%', marginTop: S.md, padding: '10px 0',
              background: C.gradientPrimary, color: '#fff',
              border: 'none', borderRadius: R.md, cursor: 'pointer',
              fontSize: F.sizeMd, fontWeight: 600,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Ver Análisis Completo →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Market Bar ──────────────────────────────────────────────────────────────

function MarketBar({ market }: { market: MarketContext }) {
  if (!market.spy && !market.vix) return null;
  return (
    <div style={{
      display: 'flex', gap: S.xl, padding: `${S.sm} ${S.lg}`,
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: R.md, marginBottom: S.lg,
    }}>
      {market.spy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: F.sizeSm, color: C.textMuted }}>S&P 500</span>
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
          <span style={{ fontSize: F.sizeSm, color: C.textMuted }}>VIX</span>
          <span style={{
            fontSize: F.sizeMd, fontWeight: 600,
            color: VIX_COLORS[market.vix.label] || C.textSecondary,
            fontFamily: F.mono,
          }}>
            {market.vix.level.toFixed(2)}
          </span>
          <span style={{
            fontSize: F.sizeXs, padding: '1px 6px', borderRadius: R.sm,
            background: `${VIX_COLORS[market.vix.label]}20`,
            color: VIX_COLORS[market.vix.label],
            fontWeight: 600,
          }}>
            {market.vix.label}
          </span>
        </div>
      )}
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

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{ padding: S.xxl }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 400,
        }}>
          <div style={{
            width: 48, height: 48, border: `3px solid ${C.border}`,
            borderTopColor: C.accent, borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ marginTop: S.lg, color: C.textSecondary, fontSize: F.sizeMd }}>
            Escaneando 120 acciones para breakout setups...
          </p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div style={{ padding: S.xxl, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: S.md }}>📡</div>
        <h3 style={{ color: C.textPrimary, fontSize: F.sizeLg, marginBottom: S.sm }}>
          Error cargando briefing
        </h3>
        <p style={{ color: C.textSecondary, fontSize: F.sizeMd, marginBottom: S.lg }}>{error}</p>
        <button onClick={fetchData} style={{
          padding: `${S.sm} ${S.xl}`, background: C.gradientPrimary, color: '#fff',
          border: 'none', borderRadius: R.md, cursor: 'pointer',
          fontSize: F.sizeMd, fontWeight: 600,
        }}>
          Reintentar
        </button>
      </div>
    );
  }

  // ── Empty State ──
  if (!data || data.picks.length === 0) {
    return (
      <div style={{ padding: S.xxl, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: S.md }}>🔍</div>
        <h3 style={{ color: C.textPrimary, fontSize: F.sizeLg, marginBottom: S.sm }}>
          No hay breakouts de alta probabilidad hoy
        </h3>
        <p style={{ color: C.textSecondary, fontSize: F.sizeMd, marginBottom: S.lg }}>
          El mercado no está presentando setups claros. Vuelve mañana.
        </p>
        <button onClick={fetchData} style={{
          padding: `${S.sm} ${S.xl}`, background: C.bgElevated, color: C.textSecondary,
          border: `1px solid ${C.border}`, borderRadius: R.md, cursor: 'pointer',
          fontSize: F.sizeMd,
        }}>
          Actualizar
        </button>
      </div>
    );
  }

  // ── Main Render ──
  const { picks, summary, market, date, time } = data;

  return (
    <div style={{ padding: `0 ${S.lg}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.lg }}>
        <div>
          <h2 style={{ fontSize: F.sizeHero, fontWeight: 800, color: C.textPrimary, margin: 0 }}>
            Morning Briefing
          </h2>
          <p style={{ fontSize: F.sizeSm, color: C.textMuted, margin: '4px 0 0' }}>
            {date} · {time}
          </p>
        </div>
        <button onClick={fetchData} style={{
          padding: `${S.xs} ${S.md}`, background: C.bgElevated, color: C.textSecondary,
          border: `1px solid ${C.border}`, borderRadius: R.sm, cursor: 'pointer',
          fontSize: F.sizeSm,
        }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Market Context */}
      <MarketBar market={market} />

      {/* Summary Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: S.sm,
        marginBottom: S.xl,
      }}>
        {[
          { label: 'Escaneados', value: summary.totalScanned.toString(), color: C.textPrimary },
          { label: 'Breakouts', value: summary.totalBreakouts.toString(), color: C.accentLight },
          { label: 'Alta Conf.', value: summary.highConfidence.toString(), color: C.positive },
          { label: 'R/R Promedio', value: `${summary.avgRiskReward.toFixed(1)}:1`, color: summary.avgRiskReward >= 2 ? C.positive : C.warning },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: S.sm, background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: R.md, textAlign: 'center',
          }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>{stat.label}</div>
            <div style={{ fontSize: F.sizeLg, fontWeight: 700, color: stat.color, fontFamily: F.mono }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Pick Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {picks.map((pick) => (
          <PickCard key={pick.symbol} pick={pick} onSelect={onSelectStock} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: S.xl, padding: S.md, background: C.bgCard,
        border: `1px solid ${C.border}`, borderRadius: R.md,
        fontSize: F.sizeXs, color: C.textMuted, textAlign: 'center',
      }}>
        Datos: Yahoo Finance + Finnhub · Score basado en Trend (30) + Volume (30) + Structure (20) + Safety (20)
        {summary.topSectors.length > 0 && (
          <> · Sectores calientes: {summary.topSectors.join(', ')}</>
        )}
      </div>
    </div>
  );
}
