'use client';

import { useState, useEffect } from 'react';

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

const DARK = {
  bg: '#0B0B0B',
  card: '#1B1B1B',
  text: '#FFFFFF',
  muted: '#9A9A9A',
  primary: '#B64DFF',
  divider: '#343434',
};

const POS = '#22C55E';
const NEG = '#EF4444';
const WARN = '#F59E0B';

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

function trendBadge(trend: string): { label: string; color: string } {
  if (trend === 'alcista') return { label: '↑ Alcista', color: POS };
  if (trend === 'bajista') return { label: '↓ Bajista', color: NEG };
  return { label: '→ Neutral', color: DARK.muted };
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
        background: DARK.bg,
        borderRadius: '24px',
        padding: '28px',
        border: '1px solid #1F1F1F',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ width: '180px', height: '24px', background: '#1B1B1B', borderRadius: '6px', marginBottom: '20px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: '#1B1B1B', borderRadius: '16px', height: '180px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.picks.length === 0) return null;

  return (
    <div style={{
      background: `linear-gradient(135deg, #0B0B0B 0%, #140B1F 100%)`,
      borderRadius: '24px',
      padding: '28px',
      border: '1px solid #2A1A3A',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🏆</span>
            <h2 style={{ margin: 0, color: DARK.text, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Top 4 Semanal
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', color: DARK.muted, fontSize: '13px' }}>
            Las mejores oportunidades de la semana basadas en 7 modelos de screener
          </p>
        </div>
        <div style={{ color: DARK.muted, fontSize: '12px', whiteSpace: 'nowrap' }}>
          {data.updatedAt ? `Updated ${data.updatedAt}` : ''}
        </div>
      </div>

      {/* Picks Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
      }}>
        {data.picks.map((pick, idx) => {
          const tb = trendBadge(pick.trend);
          const changeColor = pick.changePercent >= 0 ? POS : NEG;
          const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32', DARK.muted];

          return (
            <div key={pick.symbol} style={{
              background: DARK.card,
              borderRadius: '18px',
              padding: '18px',
              border: `1px solid ${idx === 0 ? '#FFD70030' : '#2A2A2A'}`,
              position: 'relative',
              transition: 'border-color 150ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = DARK.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = idx === 0 ? '#FFD70030' : '#2A2A2A'; }}
            >
              {/* Rank badge */}
              <div style={{
                position: 'absolute',
                top: '-8px',
                left: '16px',
                background: rankColors[idx],
                color: idx < 3 ? '#000' : DARK.text,
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}>
                {idx + 1}
              </div>

              {/* Symbol + Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', marginTop: '4px' }}>
                <span style={{ color: DARK.primary, fontWeight: 700, fontSize: '18px', letterSpacing: '-0.01em' }}>
                  {pick.symbol}
                </span>
                <span style={{
                  background: `${DARK.primary}20`,
                  color: DARK.primary,
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}>
                  {pick.compositeScore}
                </span>
              </div>

              {/* Price + Change */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: DARK.text, fontSize: '22px', fontWeight: 700 }}>
                  ${pick.price.toFixed(2)}
                </span>
                <span style={{ color: changeColor, fontWeight: 600, fontSize: '14px' }}>
                  {pick.changePercent >= 0 ? '+' : ''}{pick.changePercent.toFixed(2)}%
                </span>
              </div>

              {/* Sector + Mkt Cap + RSI */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {pick.sector && (
                  <span style={{ color: DARK.muted, fontSize: '11px' }}>
                    {pick.sector}
                  </span>
                )}
                <span style={{ color: DARK.muted, fontSize: '11px' }}>
                  {formatMarketCap(pick.marketCap)}
                </span>
                {pick.rsi !== null && (
                  <span style={{
                    color: pick.rsi > 60 ? WARN : pick.rsi < 40 ? NEG : POS,
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>
                    RSI {Math.round(pick.rsi)}
                  </span>
                )}
              </div>

              {/* Direction signal */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  background: pick.direction === 'ALZA' ? '#22C55E20' : '#EF444420',
                  color: pick.direction === 'ALZA' ? '#22C55E' : '#EF4444',
                  border: `1px solid ${pick.direction === 'ALZA' ? '#22C55E40' : '#EF444440'}`,
                }}>
                  {pick.direction === 'ALZA' ? '▲' : '▼'} {pick.signalLabel}
                </span>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: `${tb.color}18`,
                  color: tb.color,
                  border: `1px solid ${tb.color}30`,
                }}>
                  {tb.label}
                </span>
              </div>

              {/* Reasons */}
              <div style={{ marginBottom: '14px' }}>
                {pick.reasons.map((r, i) => (
                  <div key={i} style={{
                    color: DARK.muted,
                    fontSize: '11px',
                    lineHeight: '1.5',
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '2px',
                  }}>
                    <span style={{ color: DARK.primary }}>•</span>
                    {r}
                  </div>
                ))}
              </div>

              {/* Screener hit badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                {pick.screenerHits.sort((a, b) => a.rank - b.rank).slice(0, 4).map(h => (
                  <span key={h.id} style={{
                    display: 'inline-block',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: '#B64DFF15',
                    color: '#B64DFF',
                    border: '1px solid #B64DFF25',
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
                  padding: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  background: DARK.primary,
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'opacity 150ms',
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
