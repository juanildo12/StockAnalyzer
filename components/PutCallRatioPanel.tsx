'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface RatioComputation {
  ratio: number | null;
  putTotal: number;
  callTotal: number;
  basis: 'volume' | 'openInterest';
  denominatorZero: boolean;
  empty: boolean;
  incomplete: boolean;
}

interface PcrHistoryPoint {
  date: string;
  volumeRatio: number | null;
  oiRatio: number | null;
}

interface PcrPart {
  symbol: string;
  volumeRatio: number | null;
  oiRatio: number | null;
  putVolume: number;
  callVolume: number;
  putOi: number;
  callOi: number;
  error?: string;
}

interface PcrResponse {
  universe: string;
  kind: 'symbol' | 'index' | 'market';
  members: string[];
  spot: number | null;
  volumeRatio: number | null;
  oiRatio: number | null;
  volume: RatioComputation;
  openInterest: RatioComputation;
  zone: 'low' | 'balanced' | 'high' | 'na';
  oiZone: 'low' | 'balanced' | 'high' | 'na';
  volumePercentile: number | null;
  oiPercentile: number | null;
  history: PcrHistoryPoint[];
  parts: PcrPart[];
  source: string;
  asOf: number;
  updatedAt: string;
  notes: string[];
  error?: string;
}

interface Props {
  symbol?: string;
}

const fmtRatio = (v: number | null) => (v == null ? '—' : v.toFixed(2));
const fmtNum = (v: number) => v.toLocaleString('en-US');
const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

/** Non-directional zone colors: no universal buy/sell threshold is implied. */
const ZONE_COLOR: Record<string, string> = {
  low: C.info,
  balanced: C.textSecondary,
  high: C.warning,
  na: C.textMuted,
};
const ZONE_LABEL: Record<string, string> = {
  low: 'Por debajo del neutro',
  balanced: 'Equilibrado',
  high: 'Por encima del neutro',
  na: 'Sin datos',
};

export default function PutCallRatioPanel({ symbol }: Props) {
  const [mode, setMode] = useState<'symbol' | 'market'>('symbol');
  const [basis, setBasis] = useState<'volume' | 'openInterest'>('volume');
  const [data, setData] = useState<PcrResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const qs = mode === 'market'
        ? 'universe=market'
        : symbol ? `symbol=${encodeURIComponent(symbol.toUpperCase())}` : '';
      if (!qs) { setError('Elige un símbolo o el mercado agregado'); setData(null); setLoading(false); return; }
      const res = await fetch(`/api/put-call-ratio?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (json && !json.error) setData(json);
      else { setError(json?.error || 'Sin datos'); setData(null); }
    } catch {
      setError('Error cargando Put/Call Ratio');
      setData(null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [mode, symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const comp = data ? (basis === 'volume' ? data.volume : data.openInterest) : null;
  const ratio = data ? (basis === 'volume' ? data.volumeRatio : data.oiRatio) : null;
  const zone = data ? (basis === 'volume' ? data.zone : data.oiZone) : 'na';
  const percentile = data ? (basis === 'volume' ? data.volumePercentile : data.oiPercentile) : null;

  return (
    <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h3 style={{ margin: '0 0 2px', color: C.textPrimary, fontSize: 15, fontWeight: 700 }}>⚖️ Put/Call Ratio</h3>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 11 }}>
            {data ? data.universe : mode === 'market' ? 'Mercado agregado' : symbol || '—'}
          </p>
        </div>
        <button onClick={() => setShowHelp((v) => !v)} style={helpBtn(showHelp)}>?</button>
        <button onClick={() => fetchData()} disabled={loading} style={refreshBtn} title="Actualizar (fuerza origen)">
          {loading ? '…' : '↻'}
        </button>
      </div>

      {showHelp && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid ' + C.border, background: C.bgElevated, color: C.textSecondary, fontSize: 12, lineHeight: 1.6 }}>
          <strong style={{ color: C.textPrimary }}>¿Qué es?</strong> Compara la actividad de puts vs. calls. Existen <strong style={{ color: C.accent }}>dos medidas independientes</strong> que no deben confundirse:
          {' '}<strong>Ratio de volumen</strong> = volumen de puts ÷ volumen de calls (contratos negociados hoy);
          {' '}<strong>Ratio de OI</strong> = open interest de puts ÷ open interest de calls (contratos vivos).<br />
          <span style={{ color: C.warning }}>Interpretación contextual:</span> un ratio alto <em>no</em> es automáticamente bajista ni uno bajo alcista. Depende del activo, la fuente y la metodología. Esta herramienta no marca umbrales universales de compra/venta.
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid ' + C.border }}>
        <div style={segGroup}>
          <SegBtn active={mode === 'symbol'} onClick={() => setMode('symbol')}>Símbolo</SegBtn>
          <SegBtn active={mode === 'market'} onClick={() => setMode('market')}>Mercado</SegBtn>
        </div>
        <div style={segGroup}>
          <SegBtn active={basis === 'volume'} onClick={() => setBasis('volume')}>Volumen</SegBtn>
          <SegBtn active={basis === 'openInterest'} onClick={() => setBasis('openInterest')}>Open Interest</SegBtn>
        </div>
      </div>

      {loading && !data && <div style={{ padding: 28, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Calculando ratio…</div>}
      {!loading && error && (
        <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          {error}
          <div><button onClick={() => fetchData()} style={{ ...refreshBtn, marginTop: 10, width: 'auto', padding: '6px 16px' }}>Reintentar</button></div>
        </div>
      )}

      {data && comp && (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Gauge */}
            <SemicircleGauge ratio={ratio} color={ZONE_COLOR[zone]} percentile={percentile} />

            {/* Readouts */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {basis === 'volume' ? 'Ratio por volumen' : 'Ratio por open interest'}
              </div>
              <div style={{ color: ZONE_COLOR[zone], fontSize: 34, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                {fmtRatio(ratio)}
              </div>
              <div style={{ color: C.textSecondary, fontSize: 12, marginTop: 2 }}>{ZONE_LABEL[zone]}</div>

              <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Mini label="Puts" value={fmtNum(basis === 'volume' ? comp.putTotal : comp.putTotal)} color={C.negative} />
                <Mini label="Calls" value={fmtNum(comp.callTotal)} color={C.positive} />
                {percentile != null && <Mini label="Percentil (histórico)" value={`${percentile}%`} color={C.textPrimary} />}
              </div>

              <div style={{ marginTop: 12, color: C.textMuted, fontSize: 11, lineHeight: 1.5 }}>
                Fuente: <span style={{ color: C.textSecondary }}>{data.source}</span><br />
                Actualizado: <span style={{ color: C.textSecondary }}>{fmtTime(data.updatedAt)}</span>
                {data.spot != null && <> · Spot <span style={{ color: C.textSecondary }}>{data.spot.toFixed(2)}</span></>}
              </div>
            </div>
          </div>

          {/* Zero-denominator / incomplete banners */}
          {comp.denominatorZero && (
            <Banner color={C.warning} text="Volumen/OI de calls = 0 → el ratio no está definido para esta base." />
          )}
          {comp.empty && <Banner color={C.warning} text="Sin datos usables de la cadena para esta selección." />}
          {comp.incomplete && !comp.empty && (
            <Banner color={C.textMuted} text="Algunos contratos tenían datos incompletos y se excluyeron del cálculo." />
          )}

          {/* History sparkline */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600 }}>Evolución histórica</span>
              <span style={{ color: C.textMuted, fontSize: 11 }}>
                {data.history.length >= 5 ? `${data.history.length} días` : 'Aún sin datos suficientes'}
              </span>
            </div>
            <HistorySpark history={data.history} basis={basis} />
          </div>

          {/* Members (market/index) */}
          {data.members.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: C.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Desglose por miembro</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: C.textMuted, textAlign: 'right' }}>
                      <th style={{ ...thCell, textAlign: 'left' }}>Símbolo</th>
                      <th style={thCell}>Vol P/C</th>
                      <th style={thCell}>OI P/C</th>
                      <th style={thCell}>Puts Vol</th>
                      <th style={thCell}>Calls Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.parts.map((p) => (
                      <tr key={p.symbol} style={{ borderTop: '1px solid ' + C.border }}>
                        <td style={{ ...tdCell, textAlign: 'left', color: C.textPrimary, fontWeight: 600 }}>
                          {p.symbol}{p.error ? <span style={{ color: C.textMuted }}> · sin datos</span> : ''}
                        </td>
                        <td style={{ ...tdCell, color: C.textPrimary }}>{fmtRatio(p.volumeRatio)}</td>
                        <td style={{ ...tdCell, color: C.textPrimary }}>{fmtRatio(p.oiRatio)}</td>
                        <td style={{ ...tdCell, color: C.negative }}>{fmtNum(p.putVolume)}</td>
                        <td style={{ ...tdCell, color: C.positive }}>{fmtNum(p.callVolume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {data.notes.length > 0 && (
            <div style={{ marginTop: 14, color: C.textMuted, fontSize: 11, lineHeight: 1.6 }}>
              {data.notes.map((n, i) => <div key={i}>· {n}</div>)}
            </div>
          )}

          <div style={{ marginTop: 12, color: C.textMuted, fontSize: 10.5, fontStyle: 'italic' }}>
            El ratio se interpreta según contexto, fuente y metodología. No es una señal de compra/venta. No es asesoría financiera.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── subcomponents ──────────────────────────────────────────────────────────

/** Semicircular gauge. Maps ratio 0..2 → 180°..0°, neutral 1.0 at top. */
function SemicircleGauge({ ratio, color, percentile }: { ratio: number | null; color: string; percentile: number | null }) {
  const W = 180, H = 108, cx = W / 2, cy = 96, r = 72;
  // Arc spans 180° (left) .. 0° (right); value 0 → left, 2 → right.
  const RATIO_MAX = 2;
  const clampVal = ratio == null ? null : Math.max(0, Math.min(RATIO_MAX, ratio));
  const frac = clampVal == null ? 0 : clampVal / RATIO_MAX;

  const polar = (angleDeg: number, radius: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
  };
  const arcPath = (startDeg: number, endDeg: number, radius: number) => {
    const s = polar(startDeg, radius);
    const e = polar(endDeg, radius);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = startDeg > endDeg ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${radius} ${radius} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  // 180° (left) to 0° (right): value grows left→right.
  const startDeg = 180;
  const endDeg = 180 - frac * 180;
  const needle = polar(180 - frac * 180, r - 6);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Put/Call ratio gauge">
      {/* track */}
      <path d={arcPath(180, 0, r)} fill="none" stroke={C.border} strokeWidth={12} strokeLinecap="round" />
      {/* value arc */}
      {ratio != null && frac > 0.001 && (
        <path d={arcPath(startDeg, endDeg, r)} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
      )}
      {/* neutral 1.0 marker at top (90°) */}
      <line x1={cx} y1={cy - r - 7} x2={cx} y2={cy - r + 7} stroke={C.textMuted} strokeWidth={1.5} strokeDasharray="2 2" />
      {/* ticks 0 / 1 / 2 */}
      <text x={polar(180, r).x + 2} y={cy + 14} fill={C.textMuted} fontSize={9} textAnchor="middle">0</text>
      <text x={cx} y={cy - r - 10} fill={C.textMuted} fontSize={9} textAnchor="middle">1.0</text>
      <text x={polar(0, r).x - 2} y={cy + 14} fill={C.textMuted} fontSize={9} textAnchor="middle">2</text>
      {/* needle */}
      {ratio != null && (
        <>
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={5} fill={C.bgCard} stroke={color} strokeWidth={2} />
        </>
      )}
      {ratio == null && (
        <text x={cx} y={cy - r / 2} fill={C.textMuted} fontSize={13} textAnchor="middle">sin datos</text>
      )}
    </svg>
  );
}

function HistorySpark({ history, basis }: { history: PcrHistoryPoint[]; basis: 'volume' | 'openInterest' }) {
  const W = 320, H = 64, pad = 8;
  const series = history
    .map((h) => ({ date: h.date, v: basis === 'volume' ? h.volumeRatio : h.oiRatio }))
    .filter((p): p is { date: string; v: number } => p.v != null);

  if (series.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 11, background: C.bgElevated, borderRadius: R.sm, border: '1px solid ' + C.border }}>
        Se necesitan al menos 2 días de datos para trazar la evolución.
      </div>
    );
  }
  const vals = series.map((s) => s.v);
  const lo = Math.min(...vals, 1.0), hi = Math.max(...vals, 1.0);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const yNeutral = y(1.0);

  return (
    <div style={{ background: C.bgElevated, borderRadius: R.sm, border: '1px solid ' + C.border, padding: 4 }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Histórico Put/Call">
        <line x1={pad} y1={yNeutral} x2={W - pad} y2={yNeutral} stroke={C.textMuted} strokeWidth={1} strokeDasharray="3 3" />
        <path d={d} fill="none" stroke={C.accent} strokeWidth={2} />
        {series.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.v)} r={i === series.length - 1 ? 3 : 1.6} fill={i === series.length - 1 ? C.accentLight : C.accent} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, fontSize: 9, padding: '0 6px 2px' }}>
        <span>{series[0].date}</span>
        <span>neutro 1.0</span>
        <span>{series[series.length - 1].date}</span>
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ color: C.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ color, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function Banner({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: R.sm, background: color + '14', border: '1px solid ' + color + '44', color, fontSize: 11.5 }}>
      {text}
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: active ? C.accent : 'transparent', color: active ? '#04211D' : C.textSecondary,
      borderRadius: R.sm,
    }}>{children}</button>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────
const segGroup: React.CSSProperties = {
  display: 'inline-flex', gap: 2, background: C.bgInput, border: '1px solid ' + C.border,
  borderRadius: R.md, padding: 2,
};
const refreshBtn: React.CSSProperties = {
  background: C.bgInput, color: C.textSecondary, border: '1px solid ' + C.border, borderRadius: R.sm,
  width: 30, height: 30, fontSize: 15, cursor: 'pointer', lineHeight: 1,
};
const thCell: React.CSSProperties = { padding: '6px 8px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'right' };
const tdCell: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
function helpBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? C.accent : C.bgInput, color: active ? '#04211D' : C.textSecondary,
    border: '1px solid ' + (active ? C.accent : C.border), borderRadius: '50%', width: 30, height: 30,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  };
}
