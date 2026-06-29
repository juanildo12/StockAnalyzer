'use client';

import { useState, useEffect } from 'react';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

interface OptionsItem {
  symbol: string;
  name: string;
  price: number;
  signal: string;
  trend: string;
  rsi: number;
  volume: number;
  callScore: number;
  putScore: number;
  bias: 'CALL' | 'PUT' | 'NEUTRAL';
  reason: string;
  marketCap?: number;
}

interface OptionsData {
  total: number;
  bestCalls: OptionsItem[];
  bestPuts: OptionsItem[];
  neutral: OptionsItem[];
}

function fmtCompact(n: number) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function scoreColor(s: number): string {
  if (s >= 85) return '#22C55E';
  if (s >= 70) return '#A3E635';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function trendColor(t: string): string {
  if (t === 'alcista') return '#22C55E';
  if (t === 'bajista') return '#EF4444';
  return '#78716C';
}

function OptionsTable({ title, items, biasColor, biasLabel }: {
  title: string; items: OptionsItem[]; biasColor: string; biasLabel: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden',
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${biasColor}20, ${C.bg})`,
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: F.sizeBase, fontWeight: 700, color: biasColor }}>
          {title}
        </span>
        <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>
          {items.length} candidatos
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeSm }}>
          <thead>
            <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}`, fontSize: F.sizeXs }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Símbolo</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>Precio</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Score</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Señal</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Tendencia</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>RSI</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Razón</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s, i) => (
              <tr key={s.symbol} style={{
                borderBottom: i < items.length - 1 ? `1px solid ${C.divider}` : 'none',
                transition: T.normal,
              }}>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ fontWeight: 700, color: C.accent, cursor: 'pointer' }}>
                    {s.symbol}
                  </span>
                  <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>{s.name}</div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: C.textPrimary }}>
                  ${s.price.toFixed(2)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', background: scoreColor(biasLabel === 'CALL' ? s.callScore : s.putScore),
                    color: '#fff', fontWeight: 700, fontSize: F.sizeXs, padding: '2px 8px', borderRadius: R.full,
                  }}>
                    {biasLabel === 'CALL' ? s.callScore : s.putScore}
                  </span>
                </td>
                <td style={{
                  padding: '8px 10px', textAlign: 'center', fontWeight: 600,
                  color: s.signal === 'BUY' ? '#22C55E' : s.signal === 'SELL' ? '#EF4444' : '#F59E0B',
                }}>
                  {s.signal === 'BUY' ? 'COMPRAR' : s.signal === 'SELL' ? 'VENDER' : 'MANTENER'}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: trendColor(s.trend) }}>
                  {s.trend === 'alcista' ? '📈' : s.trend === 'bajista' ? '📉' : '➡️'}
                  {' '}
                  {s.trend || '—'}
                </td>
                <td style={{
                  padding: '8px 10px', textAlign: 'center', fontWeight: 600,
                  color: s.rsi >= 70 ? '#EF4444' : s.rsi <= 30 ? '#22C55E' : C.textPrimary,
                }}>
                  {s.rsi.toFixed(0)}
                </td>
                <td style={{ padding: '8px 10px', color: C.textSecondary, fontSize: F.sizeXs, maxWidth: 220 }}>
                  {s.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OptionsScreenerPanel() {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'calls' | 'puts'>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/options-screener')
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, padding: 32, textAlign: 'center',
      }}>
        <div style={{ color: C.textMuted, fontSize: F.sizeSm }}>
          Analizando ~70 acciones para opciones...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, padding: 32, textAlign: 'center',
      }}>
        <div style={{ color: C.negative, fontSize: F.sizeSm }}>Error: {error}</div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, padding: 32, textAlign: 'center',
      }}>
        <div style={{ color: C.textMuted, fontSize: F.sizeSm }}>No hay datos disponibles</div>
      </div>
    );
  }

  const showCalls = filter === 'all' || filter === 'calls';
  const showPuts = filter === 'all' || filter === 'puts';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden',
      }}>
        <div style={{
          background: C.gradientHero, padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <span style={{ fontSize: F.sizeLg, fontWeight: 700, color: C.textPrimary }}>
              Options Screener
            </span>
            <span style={{ fontSize: F.sizeXs, color: C.textMuted, background: C.bg, padding: '2px 8px', borderRadius: R.full }}>
              {data.total} acciones analizadas
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'calls', 'puts'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 12px', borderRadius: R.md, border: 'none',
                background: filter === f ? C.accent : 'transparent',
                color: filter === f ? '#fff' : C.textSecondary,
                cursor: 'pointer', fontWeight: 600, fontSize: F.sizeXs,
                transition: T.normal,
              }}>
                {f === 'all' ? 'Todos' : f === 'calls' ? '📈 Solo Calls' : '📉 Solo Puts'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showCalls && (
        <OptionsTable
          title="🔥 TOP CALLS"
          items={data.bestCalls}
          biasColor="#22C55E"
          biasLabel="CALL"
        />
      )}
      {showPuts && (
        <OptionsTable
          title="🔻 TOP PUTS"
          items={data.bestPuts}
          biasColor="#EF4444"
          biasLabel="PUT"
        />
      )}
      {filter === 'all' && data.neutral.length > 0 && (
        <OptionsTable
          title="⚖️ MIXED (alto score pero sin bias claro)"
          items={data.neutral}
          biasColor="#F59E0B"
          biasLabel="CALL"
        />
      )}
    </div>
  );
}
