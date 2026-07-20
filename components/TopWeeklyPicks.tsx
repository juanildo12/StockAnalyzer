'use client';

import { useState, useEffect } from 'react';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

interface Hit {
  id: string;
  name: string;
  rank: number;
}

interface Pick {
  symbol: string;
  price: number;
  changePercent: number;
  sector: string;
  marketCap: number;
  compositeScore: number;
  screenerHits: Hit[];
  rsi: number | null;
  trend: string;
  direction: 'ALZA' | 'BAJA';
  signalLabel: string;
  reasons: string[];
}

interface TopWeeklyData {
  updatedAt: string;
  picks: Pick[];
}

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

function trendBadge(trend: string): { label: string; color: string } {
  if (trend === 'alcista') return { label: '↑ Alcista', color: C.positive };
  if (trend === 'bajista') return { label: '↓ Bajista', color: C.negative };
  return { label: '→ Neutral', color: C.textMuted };
}

export default function TopWeeklyPicks({ onStockClick }: { onStockClick?: (symbol: string) => void }) {
  const [data, setData] = useState<TopWeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/screener/top-weekly')
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{
        background: C.bg,
        borderRadius: '24px',
        padding: '28px',
        border: `1px solid ${C.border}`,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ width: '180px', height: '24px', background: C.bgCard, borderRadius: R.sm, marginBottom: '20px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: S.lg }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: C.bgCard, borderRadius: R.xl, height: '180px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.picks.length === 0) return null;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.bg} 0%, ${C.bgCard} 100%)`,
      borderRadius: '24px',
      padding: '28px',
      border: `1px solid ${C.border}`,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
            <span style={{ fontSize: '26px' }}>🏆</span>
            <h2 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeXxl, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Top 4 Semanal
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: F.sizeMd }}>
            Las mejores oportunidades de la semana basadas en 7 modelos de screener
          </p>
        </div>
        <div style={{ color: C.textMuted, fontSize: F.sizeSm, whiteSpace: 'nowrap' }}>
          {data.updatedAt ? `Updated ${data.updatedAt}` : ''}
        </div>
      </div>

      {/* Picks Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: S.lg,
      }}>
        {data.picks.map((pick, idx) => {
          const tb = trendBadge(pick.trend);
          const changeColor = pick.changePercent >= 0 ? C.positive : C.negative;
          const rankColors = [C.warning, C.textMuted, C.warning, C.textMuted];

          return (
            <div key={pick.symbol} style={{
              background: C.bgCard,
              borderRadius: '18px',
              padding: '18px',
              border: `1px solid ${idx === 0 ? `${C.warning}30` : C.border}`,
              position: 'relative',
              transition: `border-color ${T.fast}`,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentLight; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = idx === 0 ? `${C.warning}30` : C.border; }}
            >
              {/* Rank badge */}
              <div style={{
                position: 'absolute',
                top: '-8px',
                left: S.lg,
                background: rankColors[idx],
                color: idx < 3 ? '#000' : C.textPrimary,
                width: '28px',
                height: '28px',
                borderRadius: R.full,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: F.sizeBase,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}>
                {idx + 1}
              </div>

              {/* Symbol + Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md, marginTop: S.xs }}>
                <span style={{ color: C.accentLight, fontWeight: 700, fontSize: F.sizeLg, letterSpacing: '-0.01em' }}>
                  {pick.symbol}
                </span>
                <span style={{
                  background: `${C.accentLight}20`,
                  color: C.accentLight,
                  fontWeight: 700,
                  fontSize: F.sizeMd,
                  padding: '3px 10px',
                  borderRadius: R.full,
                }}>
                  {pick.compositeScore}
                </span>
              </div>

              {/* Price + Change */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: S.md, marginBottom: S.md }}>
                <span style={{ color: C.textPrimary, fontSize: F.sizeXl, fontWeight: 700 }}>
                  ${pick.price.toFixed(2)}
                </span>
                <span style={{ color: changeColor, fontWeight: 600, fontSize: F.sizeBase }}>
                  {pick.changePercent >= 0 ? '+' : ''}{pick.changePercent.toFixed(2)}%
                </span>
              </div>

              {/* Sector + Mkt Cap + RSI */}
              <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
                {pick.sector && (
                  <span style={{ color: C.textMuted, fontSize: F.sizeXs }}>
                    {pick.sector}
                  </span>
                )}
                <span style={{ color: C.textMuted, fontSize: F.sizeXs }}>
                  {formatMarketCap(pick.marketCap)}
                </span>
                {pick.rsi !== null && (
                  <span style={{
                    color: pick.rsi > 60 ? C.warning : pick.rsi < 40 ? C.negative : C.positive,
                    fontSize: F.sizeXs,
                    fontWeight: 600,
                  }}>
                    RSI {Math.round(pick.rsi)}
                  </span>
                )}
              </div>

              {/* Direction signal */}
              <div style={{ display: 'flex', gap: S.sm, marginBottom: S.sm, alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: S.xs,
                  padding: `${S.xs} ${S.sm}`,
                  borderRadius: R.md,
                  fontSize: F.sizeBase,
                  fontWeight: 700,
                  background: pick.direction === 'ALZA' ? `${C.positive}20` : `${C.negative}20`,
                  color: pick.direction === 'ALZA' ? C.positive : C.negative,
                  border: `1px solid ${pick.direction === 'ALZA' ? `${C.positive}40` : `${C.negative}40`}`,
                }}>
                  {pick.direction === 'ALZA' ? '▲' : '▼'} {pick.signalLabel}
                </span>
                <span style={{
                  display: 'inline-block',
                  padding: `${S.xxs} ${S.md}`,
                  borderRadius: R.full,
                  fontSize: F.sizeXs,
                  fontWeight: 600,
                  background: `${tb.color}18`,
                  color: tb.color,
                  border: `1px solid ${tb.color}30`,
                }}>
                  {tb.label}
                </span>
              </div>

              {/* Reasons */}
              <div style={{ marginBottom: S.md }}>
                {pick.reasons.map((r, i) => (
                  <div key={i} style={{
                    color: C.textMuted,
                    fontSize: F.sizeXs,
                    lineHeight: '1.5',
                    display: 'flex',
                    gap: S.xs,
                    marginBottom: S.xxs,
                  }}>
                    <span style={{ color: C.accentLight }}>•</span>
                    {r}
                  </div>
                ))}
              </div>

              {/* Screener hit badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.xs, marginBottom: S.sm }}>
                {pick.screenerHits.sort((a, b) => a.rank - b.rank).slice(0, 4).map(h => (
                  <span key={h.id} style={{
                    display: 'inline-block',
                    padding: `${S.xxs} 7px`,
                    borderRadius: R.sm,
                    fontSize: '10px',
                    fontWeight: 600,
                    background: `${C.accent}15`,
                    color: C.accent,
                    border: `1px solid ${C.accent}25`,
                  }}>
                    {h.name} #{h.rank}
                  </span>
                ))}
              </div>

              {/* Ver button */}
              <button
                onClick={() => onStockClick?.(pick.symbol)}
                style={{
                  width: '100%',
                  padding: S.sm,
                  borderRadius: R.md,
                  border: 'none',
                  background: C.accent,
                  color: C.textPrimary,
                  fontSize: F.sizeMd,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: `opacity ${T.fast}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Ver Análisis
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
