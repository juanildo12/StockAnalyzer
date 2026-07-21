'use client';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

import { useState, useEffect, useCallback } from 'react';

interface GrahamScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change?: number;
  changePercent?: number;
  marketCap: number;
  sector?: string;
  industry?: string;
  nnwc: {
    classification: string;
    value: number;
    discountPercent: number;
    displayMessage: string;
  };
  graham: {
    ncav: number;
    ncavPass: boolean;
    netCash: number;
    netCashPass: boolean;
    ev: number;
    evPass: boolean;
    currentRatio: number;
    currentRatioPass: boolean;
    priceToBook: number;
    priceToBookPass: boolean;
  };
  passes: number;
  totalMetrics: number;
  passesAny: boolean;
}

interface ApiResponse {
  results: GrahamScreenerResult[];
  passingCount: number;
  totalScanned: number;
  date: string;
}

const badgeBg = (pass: boolean) => pass ? `${C.positive20}` : `${C.negative20}`;
const badgeBorder = (pass: boolean) => pass ? `${C.positive40}` : `${C.negative40}`;
const badgeText = (pass: boolean) => pass ? C.positive : C.negative;

function MetricBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      background: badgeBg(pass), border: `1px solid ${badgeBorder(pass)}`,
      borderRadius: '4px', padding: '2px 6px', fontSize: '11px',
      color: badgeText(pass), fontWeight: 500,
    }}>
      {pass ? '✅' : '❌'} {label}
    </span>
  );
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-$' : '$';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export default function ScreenerGraham({ onSelect }: { onSelect?: (symbol: string) => void }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'passes' | 'marketCap' | 'price'>('passes');
  const [extraSymbols, setExtraSymbols] = useState<string[]>([]);

  const fetchScreener = useCallback(async (extras: string[]) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (extras.length > 0) params.set('symbols', extras.join(','));
      const res = await fetch(`/api/screener/graham?${params.toString()}`);
      if (!res.ok) throw new Error('Error al obtener datos');
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreener(extraSymbols);
  }, [fetchScreener, extraSymbols]);

  const handleAddSymbol = () => {
    const sym = searchInput.trim().toUpperCase();
    if (!sym || extraSymbols.includes(sym)) return;
    setExtraSymbols(prev => [...prev, sym]);
    setSearchInput('');
  };

  const handleRemoveSymbol = (sym: string) => {
    setExtraSymbols(prev => prev.filter(s => s !== sym));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddSymbol();
  };

  const handleRefresh = () => {
    fetchScreener(extraSymbols);
  };

  const formatClassification = (cls: string): { label: string; color: string } => {
    switch (cls) {
      case 'excelente': return { label: 'Excelente', color: C.positive };
      case 'cumple': return { label: 'Cumple', color: C.warning };
      case 'no-cumple': return { label: 'No cumple', color: C.negative };
      case 'negativo': return { label: 'Negativo', color: C.negative };
      default: return { label: 'Sin datos', color: C.textMuted };
    }
  };

  const results = data?.results || [];
  const sorted = [...results].sort((a, b) => {
    if (sortBy === 'marketCap') return b.marketCap - a.marketCap;
    if (sortBy === 'price') return b.price - a.price;
    return b.passes - a.passes;
  });

  const passColor = data && data.passingCount > 0 ? C.positive : C.textMuted;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Controls bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
        background: C.bgCard, borderRadius: '12px', padding: '16px',
        border: '1px solid ' + C.border,
      }}>
        <div style={{ display: 'flex', gap: '6px', flex: '1 1 300px', alignItems: 'center' }}>
          <input
            placeholder="Agregar ticker (ej: FF)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '8px',
              border: '1px solid ' + C.border, background: C.bg,
              color: C.textSecondary, fontSize: '13px', outline: 'none',
            }}
          />
          <button onClick={handleAddSymbol} style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid ' + C.border,
            background: C.borderLight, color: C.textSecondary, cursor: 'pointer', fontSize: '13px',
          }}>Agregar</button>
          <button onClick={handleRefresh} disabled={loading} style={{
            padding: '8px', borderRadius: '8px', border: '1px solid ' + C.border,
            background: C.borderLight, color: C.textSecondary, cursor: 'pointer', fontSize: '13px',
          }}>{loading ? '...' : '↻'}</button>
        </div>
      </div>

      {/* Extra symbols chips */}
      {extraSymbols.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {extraSymbols.map(sym => (
            <span key={sym} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: C.borderLight, borderRadius: '6px', padding: '4px 10px',
              border: '1px solid ' + C.border, fontSize: '12px', color: C.textSecondary,
            }}>
              {sym}
              <span onClick={() => handleRemoveSymbol(sym)} style={{ cursor: 'pointer', color: C.negative, marginLeft: '4px' }}>✕</span>
            </span>
          ))}
        </div>
      )}

      {/* Summary bar */}
      {data && !loading && (
        <div style={{
          display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
          padding: '12px 16px', background: C.bgCard, borderRadius: '12px',
          border: '1px solid ' + C.border,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: C.textMuted }}>Cumplen:</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: passColor }}>
              {data.passingCount}/{data.totalScanned}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: C.textMuted }}>Ordenar:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{
              padding: '4px 8px', borderRadius: '6px', border: '1px solid ' + C.border,
              background: C.bg, color: C.textSecondary, fontSize: '12px',
            }}>
              <option value="passes">Score</option>
              <option value="marketCap">MarketCap</option>
              <option value="price">Precio</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted }}>
          <div style={{ fontSize: '14px' }}>Escaneando acciones...</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>Analizando balances con criterios Graham</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '16px', background: `${C.negative20}`, border: '1px solid #f8514940',
          borderRadius: '12px', color: C.negative, fontSize: '13px', textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && data && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid ' + C.border }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: C.bgCard, borderBottom: '1px solid ' + C.border }}>
                <TH>Symbol</TH>
                <TH>Precio</TH>
                <TH>MarketCap</TH>
                <TH style={{ minWidth: '90px' }}>NNWC</TH>
                <TH>Score</TH>
                <TH>NCAV</TH>
                <TH>Net Cash</TH>
                <TH>EV</TH>
                <TH>Curr.R</TH>
                <TH>P/B</TH>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: C.textMuted }}>
                    Ninguna acción pasa los criterios Graham hoy
                  </td>
                </tr>
              ) : sorted.map((r, i) => (
                <tr key={r.symbol} style={{
                  background: i % 2 === 0 ? C.bg : C.bgCard,
                  borderBottom: '1px solid ' + C.border,
                  cursor: onSelect ? 'pointer' : undefined,
                  opacity: r.passesAny ? 1 : 0.5,
                }} onClick={() => onSelect?.(r.symbol)}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: C.textPrimary }}>{r.symbol}</div>
                    <div style={{ fontSize: '11px', color: C.textMuted, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: C.textPrimary }}>${r.price.toFixed(2)}</div>
                    {r.changePercent !== undefined && (
                      <div style={{ fontSize: '11px', color: (r.changePercent || 0) >= 0 ? C.positive : C.negative }}>
                        {fmtPct(r.changePercent)}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: C.textSecondary }}>{fmtCompact(r.marketCap)}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                      fontSize: '11px', fontWeight: 500,
                      background: r.nnwc.classification === 'excelente' || r.nnwc.classification === 'cumple' ? `${C.positive20}` : `${C.textMuted20}`,
                      border: `1px solid ${r.nnwc.classification === 'excelente' || r.nnwc.classification === 'cumple' ? `${C.positive40}` : `${C.textMuted40}`}`,
                      color: r.nnwc.classification === 'excelente' || r.nnwc.classification === 'cumple' ? C.positive : C.textMuted,
                    }}>
                      {formatClassification(r.nnwc.classification).label}
                    </span>
                    {r.nnwc.value > 0 && (
                      <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '2px' }}>
                        {fmtCompact(r.nnwc.value)}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                      fontSize: '12px', fontWeight: 600,
                      background: badgeBg(r.passes >= 3), border: `1px solid ${badgeBorder(r.passes >= 3)}`,
                      color: badgeText(r.passes >= 3),
                    }}>
                      {r.passes}/{r.totalMetrics}
                    </span>
                  </td>
                  <td style={tdStyle}><MetricBadge pass={r.graham.ncavPass} label="NCAV" /></td>
                  <td style={tdStyle}><MetricBadge pass={r.graham.netCashPass} label="NetCash" /></td>
                  <td style={tdStyle}><MetricBadge pass={r.graham.evPass} label="EV" /></td>
                  <td style={tdStyle}><MetricBadge pass={r.graham.currentRatioPass} label="CR" /></td>
                  <td style={tdStyle}><MetricBadge pass={r.graham.priceToBookPass} label="P/B" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {data && !loading && (
        <div style={{ textAlign: 'center', fontSize: '11px', color: C.textMuted }}>
          Escaneados {data.totalScanned} acciones | {data.date} | {data.passingCount} pasan al menos un criterio Graham
        </div>
      )}
    </div>
  );
}

function TH({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: '10px 12px', textAlign: 'left', fontSize: '11px',
      color: C.textMuted, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.5px', whiteSpace: 'nowrap', ...style,
    }}>
      {children}
    </th>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};
