'use client';

import { useState, useEffect, useMemo } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface RankingRow {
  symbol: string;
  scores: Record<string, number>;
  total: number;
}

interface ScreenerDetailViewProps {
  screener: {
    id: string;
    name: string;
    icon: string;
    description: string;
    formulas: string[];
    rankings: RankingRow[];
  };
  onBack: () => void;
  onViewStock: (symbol: string) => void;
}

interface EnrichedStock {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  closes: number[];
  rsi: number | null;
  trend: string;
}

function Sparkline({ values, width = 60, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${((max - v) / range) * height}`).join(' ');
  const color = values[values.length - 1] >= values[0] ? C.positive : C.negative;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function trendColor(trend: string): string {
  if (trend === 'alcista') return C.positive;
  if (trend === 'bajista') return C.negative;
  return C.textMuted;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

export default function ScreenerDetailView({ screener, onBack, onViewStock }: ScreenerDetailViewProps) {
  const [enriched, setEnriched] = useState<Map<string, EnrichedStock>>(new Map());
  const [loading, setLoading] = useState(true);

  const symbols = useMemo(() => screener.rankings.map(r => r.symbol), [screener.rankings]);

  useEffect(() => {
    let cancelled = false;
    const syms = screener.rankings.map(r => r.symbol);
    if (syms.length === 0) return;
    setLoading(true);
    fetch(`/api/screener/detail?symbols=${syms.join(',')}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const map = new Map<string, EnrichedStock>();
        (data.stocks || []).forEach((s: EnrichedStock) => map.set(s.symbol, s));
        setEnriched(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [screener.rankings]);

  const rows = useMemo(() => {
    return screener.rankings.map(r => ({
      ...r,
      detail: enriched.get(r.symbol),
    }));
  }, [screener.rankings, enriched]);

  return (
    <div style={{
      background: C.bg,
      borderRadius: '24px',
      padding: '28px',
      border: `1px solid ${C.border}`,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              padding: '8px 14px',
              color: C.textMuted,
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 150ms',
              flexShrink: 0,
              marginTop: '4px',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.bgCardHover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            ← Volver
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>{screener.icon}</span>
              <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {screener.name}
              </h2>
            </div>
            <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: '13px', lineHeight: 1.5, maxWidth: '600px' }}>
              {screener.description}
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {screener.formulas.map((f, i) => (
                <span key={f} style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: `${C.accent20}`,
                  color: C.accent,
                  border: `1px solid ${C.accent40}`,
                }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ color: C.textMuted, fontSize: '12px', whiteSpace: 'nowrap' }}>
          {screener.rankings.length} stocks
        </div>
      </div>

      <div style={{ height: '1px', background: C.border, marginBottom: '20px' }} />

      {/* Table */}
      <div style={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: '600px',
        borderRadius: '12px',
        border: `1px solid ${C.border}`,
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
          minWidth: '700px',
        }}>
          <thead>
            <tr style={{
              color: C.textMuted,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              background: C.bgCard,
            }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2, minWidth: '60px' }}>
                Symbol
              </th>
              <th style={{ textAlign: 'right', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Price
              </th>
              <th style={{ textAlign: 'right', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Change%
              </th>
              <th style={{ textAlign: 'center', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2, minWidth: '70px' }}>
                Sparkline
              </th>
              <th style={{ textAlign: 'right', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Volume
              </th>
              <th style={{ textAlign: 'right', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Range
              </th>
              <th style={{ textAlign: 'center', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                RSI
              </th>
              <th style={{ textAlign: 'center', padding: '10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Trend
              </th>
              <th style={{ textAlign: 'right', padding: '10px 0 10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Score
              </th>
              <th style={{ textAlign: 'center', padding: '10px 0 10px 8px', position: 'sticky', top: 0, background: C.bgCard, zIndex: 2 }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: C.textMuted }}>
                  Loading stock data...
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const d = row.detail;
                const changeColor = d ? (d.changePercent >= 0 ? C.positive : C.negative) : C.textMuted;
                return (
                  <tr key={row.symbol} style={{
                    borderBottom: idx < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                    transition: 'background 150ms',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bgCardHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        onClick={() => onViewStock(row.symbol)}
                        style={{ color: C.accent, fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                      >
                        {row.symbol}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textPrimary, fontWeight: 600 }}>
                      {d ? `$${d.price.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: changeColor, fontWeight: 600 }}>
                      {d ? `${d.changePercent >= 0 ? '+' : ''}${d.changePercent.toFixed(2)}%` : '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {d && d.closes.length >= 2 ? <Sparkline values={d.closes} /> : '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted }}>
                      {d ? formatVolume(d.volume) : '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted }}>
                      {d ? `$${d.low.toFixed(1)}-$${d.high.toFixed(1)}` : '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {d && d.rsi !== null ? (
                        <span style={{
                          color: d.rsi > 60 ? C.positive : d.rsi < 40 ? C.negative : C.textMuted,
                          fontWeight: 700,
                          fontSize: '14px',
                        }}>
                          {d.rsi}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {d ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: `${trendColor(d.trend)}20`,
                          color: trendColor(d.trend),
                        }}>
                          {d.trend === 'alcista' ? '↑ Alcista' : d.trend === 'bajista' ? '↓ Bajista' : '→ Neutral'}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px 0 10px 8px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        background: row.total >= 220 ? `${C.positive20}` : row.total >= 160 ? `${C.warning20}` : `${C.negative20}`,
                        color: row.total >= 220 ? C.positive : row.total >= 160 ? C.warning : C.negative,
                        fontWeight: 700,
                        fontSize: '14px',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        minWidth: '46px',
                        textAlign: 'center',
                      }}>
                        {row.total}
                      </span>
                    </td>
                    <td style={{ padding: '10px 0 10px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => onViewStock(row.symbol)}
                        style={{
                          background: C.accent,
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          color: C.textPrimary,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'opacity 150ms',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <div style={{ color: C.textMuted, fontSize: '13px', textAlign: 'center', padding: '24px' }}>
          No data available
        </div>
      )}
    </div>
  );
}
