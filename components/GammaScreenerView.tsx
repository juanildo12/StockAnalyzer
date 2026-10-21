'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { colors as C, radius as R, spacing as S, font as F } from '@/src/utils/webTheme';

// ── Types mirrored from the API ──────────────────────────────────────────────

type GammaRegime = 'positive' | 'negative' | 'neutral' | 'unknown';
type SkewRegime = 'bullish' | 'neutral' | 'bearish' | 'unknown';
type MomentumClass = 'bullish' | 'lean_bullish' | 'neutral' | 'lean_bearish' | 'bearish';

interface ScreenerRow {
  symbol: string;
  name: string | null;
  exchange: string | null;
  spot: number;
  changePct: number | null;
  asOf: number;
  marketState: string | null;
  priceBasis: 'pre' | 'post' | 'regular';
  edge: number | null;
  edgeBreakdown: { gamma: number; momentum: number; skew: number; proximity: number; liquidity: number } | null;
  edgeAvailable: boolean;
  gammaRegime: GammaRegime;
  skewRegime: SkewRegime;
  skewRiskReversal25: number | null;
  atmIv: number | null;
  momentum: MomentumClass;
  momentumRet20d: number | null;
  relVolume: number | null;
  callWall: number | null;
  putWall: number | null;
  gammaFlip: number | null;
  distCallWallPct: number | null;
  distPutWallPct: number | null;
  distFlipPct: number | null;
  netGex: number;
  netGexNorm: number | null;
  optVolume: number;
  callVolume: number;
  putVolume: number;
  putCallVolumeRatio: number | null;
  totalOi: number;
  callOi: number;
  putOi: number;
  liquidity: 'high' | 'medium' | 'low' | 'unknown';
  expirations: string[];
  dataQuality: { completeness: number; stale: boolean; ageMinutes: number; warnings: string[] };
  warnings: string[];
  isEtf: boolean | null;
  gexByStrike: { strike: number; netGex: number; callGex: number; putGex: number; callOi: number; putOi: number }[];
}

interface ScreenerResponse {
  asOf: number;
  universe: { mode: string; requested: number; scanned: number; limit: number };
  scope: string;
  positioning: { signCalls: number; signPuts: number; assumed: boolean };
  rows: ScreenerRow[];
  errors: { symbol: string; error: string }[];
  notes: string[];
}

type SortKey =
  | 'edge' | 'gammaRegime' | 'netGex' | 'netGexNorm' | 'skew' | 'momentum'
  | 'optVolume' | 'totalOi' | 'relVolume' | 'distCallWall' | 'distPutWall'
  | 'distFlip' | 'dataQuality';

// ── Formatting ───────────────────────────────────────────────────────────────

function fmtGex(n: number): string {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(1) + 'K';
  return sign + '$' + a.toFixed(0);
}

function fmtVol(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function fmtPct(n: number | null, digits = 2): string {
  if (n == null || !isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(digits) + '%';
}

function fmtTime(ts: number): string {
  try { return new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

// ── Color / label maps (non-directional where required) ─────────────────────

const GAMMA_META: Record<GammaRegime, { label: string; color: (c: typeof C) => string; bg: (c: typeof C) => string }> = {
  positive: { label: 'POS GAMMA', color: (c) => c.positive, bg: (c) => c.positiveBg },
  negative: { label: 'NEG GAMMA', color: (c) => c.negative, bg: (c) => c.negativeBg },
  neutral: { label: 'TRANSITION', color: (c) => c.warning, bg: (c) => c.warningBg },
  unknown: { label: 'UNKNOWN', color: (c) => c.textMuted, bg: (c) => c.textMuted + '22' },
};

const SKEW_META: Record<SkewRegime, { label: string; color: (c: typeof C) => string }> = {
  bullish: { label: 'CALL-SIDE', color: (c) => c.positive },
  bearish: { label: 'PUT-SIDE', color: (c) => c.negative },
  neutral: { label: 'NEUTRAL', color: (c) => c.textSecondary },
  unknown: { label: 'UNKNOWN', color: (c) => c.textMuted },
};

const MOM_META: Record<MomentumClass, { label: string; color: (c: typeof C) => string }> = {
  bullish: { label: '▲ BULLISH', color: (c) => c.positive },
  lean_bullish: { label: '▲ lean bull', color: (c) => c.positive },
  neutral: { label: '→ neutral', color: (c) => c.textSecondary },
  lean_bearish: { label: '▼ lean bear', color: (c) => c.negative },
  bearish: { label: '▼ BEARISH', color: (c) => c.negative },
};

function edgeColor(edge: number | null): string {
  if (edge == null) return C.textMuted;
  if (edge >= 80) return C.positive;
  if (edge >= 65) return C.accentLight;
  if (edge >= 50) return C.warning;
  return C.negative;
}

// ── Presets ──────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  label: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  filter: (r: ScreenerRow) => boolean;
}

const PRESETS: Preset[] = [
  { id: 'edge', label: 'Highest Edge', sort: 'edge', dir: 'desc', filter: () => true },
  { id: 'pos', label: 'Positive Gamma', sort: 'edge', dir: 'desc', filter: (r) => r.gammaRegime === 'positive' },
  { id: 'neg', label: 'Negative Gamma', sort: 'edge', dir: 'desc', filter: (r) => r.gammaRegime === 'negative' },
  { id: 'bull', label: 'Bullish Momentum', sort: 'edge', dir: 'desc', filter: (r) => r.momentum === 'bullish' || r.momentum === 'lean_bullish' },
  { id: 'bear', label: 'Bearish Momentum', sort: 'edge', dir: 'desc', filter: (r) => r.momentum === 'bearish' || r.momentum === 'lean_bearish' },
  { id: 'nearflip', label: 'Near Gamma Flip', sort: 'distFlip', dir: 'asc', filter: (r) => r.distFlipPct != null && Math.abs(r.distFlipPct!) <= 1.5 },
  { id: 'nearcall', label: 'Near Call Wall', sort: 'distCallWall', dir: 'asc', filter: (r) => r.distCallWallPct != null && Math.abs(r.distCallWallPct!) <= 2 },
  { id: 'nearput', label: 'Near Put Wall', sort: 'distPutWall', dir: 'asc', filter: (r) => r.distPutWallPct != null && Math.abs(r.distPutWallPct!) <= 2 },
  { id: 'liq', label: 'High Liquidity', sort: 'totalOi', dir: 'desc', filter: (r) => r.liquidity === 'high' },
];

// ── GEX-by-strike chart (drill-down) ────────────────────────────────────────

function GexByStrikeChart({ row }: { row: ScreenerRow }) {
  const data = row.gexByStrike;
  const W = 520, H = 200, pad = { l: 40, r: 12, t: 12, b: 24 };
  if (data.length === 0) return <div style={{ color: C.textMuted, fontSize: F.sizeSm, padding: S.md }}>Sin datos de GEX por strike.</div>;
  const strikes = data.map((d) => d.strike);
  const minK = Math.min(...strikes), maxK = Math.max(...strikes);
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.netGex)));
  const x = (k: number) => pad.l + ((k - minK) / (maxK - minK || 1)) * (W - pad.l - pad.r);
  const zeroY = pad.t + (H - pad.t - pad.b) / 2;
  const y = (g: number) => zeroY - (g / maxAbs) * ((H - pad.t - pad.b) / 2);
  const bw = Math.max(1.5, ((W - pad.l - pad.r) / data.length) * 0.7);
  const spotX = x(row.spot);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <line x1={pad.l} y1={zeroY} x2={W - pad.r} y2={zeroY} stroke={C.border} strokeWidth={1} />
      {data.map((d) => {
        const cx = x(d.strike);
        const gy = y(d.netGex);
        const positive = d.netGex >= 0;
        return (
          <rect
            key={d.strike}
            x={cx - bw / 2}
            y={Math.min(gy, zeroY)}
            width={bw}
            height={Math.max(1, Math.abs(gy - zeroY))}
            fill={positive ? C.positive : C.negative}
            opacity={0.85}
          />
        );
      })}
      {/* spot marker */}
      <line x1={spotX} y1={pad.t} x2={spotX} y2={H - pad.b} stroke={C.accentLight} strokeWidth={1} strokeDasharray="3 3" />
      <text x={spotX} y={pad.t + 9} fill={C.accentLight} fontSize={9} textAnchor="middle">spot {row.spot.toFixed(1)}</text>
      <text x={pad.l - 4} y={zeroY + 3} fill={C.textMuted} fontSize={9} textAnchor="end">0</text>
      <text x={x(minK)} y={H - 6} fill={C.textMuted} fontSize={9} textAnchor="middle">{minK}</text>
      <text x={x(maxK)} y={H - 6} fill={C.textMuted} fontSize={9} textAnchor="middle">{maxK}</text>
      <text x={pad.l - 4} y={pad.t + 8} fill={C.textMuted} fontSize={9} textAnchor="end">+{fmtGex(maxAbs)}</text>
      <text x={pad.l - 4} y={H - pad.b} fill={C.textMuted} fontSize={9} textAnchor="end">-{fmtGex(maxAbs)}</text>
    </svg>
  );
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ row, onClose }: { row: ScreenerRow; onClose: () => void }) {
  const g = GAMMA_META[row.gammaRegime];
  const s = SKEW_META[row.skewRegime];
  const m = MOM_META[row.momentum];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(640px, 92vw)', height: '100%', background: C.bgCard, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', padding: S.lg }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.md }}>
          <div>
            <div style={{ fontSize: F.sizeXl, fontWeight: 700, color: C.textPrimary }}>{row.symbol}</div>
            <div style={{ fontSize: F.sizeSm, color: C.textSecondary }}>{row.name || '—'} · {row.exchange || '—'}{row.isEtf ? ' · ETF' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textSecondary, borderRadius: R.sm, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: S.md, alignItems: 'baseline', marginBottom: S.md }}>
          <span style={{ fontSize: F.sizeXxl, fontWeight: 700, color: C.textPrimary }}>${row.spot.toFixed(2)}</span>
          <span style={{ fontSize: F.sizeSm, color: (row.changePct ?? 0) >= 0 ? C.positive : C.negative }}>{fmtPct(row.changePct)}</span>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{row.priceBasis === 'regular' ? 'en vivo' : row.priceBasis + '-market'} · {fmtTime(row.asOf)}</span>
        </div>

        <div style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap', marginBottom: S.md }}>
          <span style={{ background: g.bg(C), color: g.color(C), padding: '3px 8px', borderRadius: R.sm, fontSize: F.sizeXs, fontWeight: 600 }}>{g.label}</span>
          <span style={{ color: s.color(C), fontSize: F.sizeXs, fontWeight: 600 }}>SKEW {s.label}</span>
          <span style={{ color: m.color(C), fontSize: F.sizeXs, fontWeight: 600 }}>{m.label}</span>
          <span style={{ color: edgeColor(row.edge), fontSize: F.sizeXs, fontWeight: 700 }}>EDGE {row.edge ?? '—'}</span>
        </div>

        {/* Edge breakdown */}
        {row.edgeBreakdown && (
          <div style={{ marginBottom: S.md }}>
            <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary, marginBottom: S.xs }}>Edge Score breakdown</div>
            {(['gamma', 'momentum', 'skew', 'proximity', 'liquidity'] as const).map((k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: 3 }}>
                <span style={{ width: 90, fontSize: F.sizeXs, color: C.textSecondary, textTransform: 'capitalize' }}>{k}</span>
                <div style={{ flex: 1, height: 6, background: C.bgInput, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${row.edgeBreakdown![k]}%`, height: '100%', background: C.accent }} />
                </div>
                <span style={{ width: 28, fontSize: F.sizeXs, color: C.textMuted, textAlign: 'right' }}>{row.edgeBreakdown![k]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Levels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: S.sm, marginBottom: S.md }}>
          {[
            { label: 'Call Wall', val: row.callWall, dist: row.distCallWallPct },
            { label: 'Gamma Flip', val: row.gammaFlip, dist: row.distFlipPct },
            { label: 'Put Wall', val: row.putWall, dist: row.distPutWallPct },
          ].map((it) => (
            <div key={it.label} style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: S.sm }}>
              <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>{it.label}</div>
              <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: C.textPrimary }}>{it.val != null ? '$' + it.val.toFixed(2) : 'N/A'}</div>
              <div style={{ fontSize: F.sizeXs, color: it.dist == null ? C.textMuted : it.dist >= 0 ? C.positive : C.negative }}>{fmtPct(it.dist, 2)}</div>
            </div>
          ))}
        </div>

        {/* GEX by strike */}
        <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary, marginBottom: S.xs }}>GEX neto por strike {row.gammaFlip != null ? `· flip ≈ ${row.gammaFlip.toFixed(2)}` : '· flip N/A'}</div>
        <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, marginBottom: S.md }}>
          <GexByStrikeChart row={row} />
        </div>

        {/* Vol / OI stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.sm, marginBottom: S.md }}>
          {[
            ['Net GEX', fmtGex(row.netGex)],
            ['Net GEX / OI', row.netGexNorm != null ? row.netGexNorm.toFixed(1) : '—'],
            ['Options Volume', fmtVol(row.optVolume)],
            ['Open Interest', fmtVol(row.totalOi)],
            ['Put/Call Vol', row.putCallVolumeRatio != null ? row.putCallVolumeRatio.toFixed(2) : '—'],
            ['ATM IV', row.atmIv != null ? (row.atmIv * 100).toFixed(1) + '%' : '—'],
            ['25Δ Risk Reversal', row.skewRiskReversal25 != null ? (row.skewRiskReversal25 * 100).toFixed(2) + ' pp' : '—'],
            ['20d Return', fmtPct(row.momentumRet20d)],
            ['Rel Volume', row.relVolume != null ? row.relVolume.toFixed(2) + 'x' : '—'],
            ['Liquidity', row.liquidity],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: F.sizeSm, padding: '3px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textSecondary }}>{k}</span>
              <span style={{ color: C.textPrimary, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Data quality */}
        <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary, marginBottom: S.xs }}>Calidad de datos · {Math.round(row.dataQuality.completeness * 100)}%</div>
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: S.xs }}>
          {row.dataQuality.stale ? `⚠️ precio con retraso (${Math.round(row.dataQuality.ageMinutes)} min)` : 'Precio fresco'}
          {' · '}expiraciones: {row.expirations.join(', ') || '—'}
        </div>
        {row.warnings.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: F.sizeXs, color: C.warning }}>
            {row.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, fontStyle: 'italic', marginTop: S.md }}>
          GEX es una estimación. El open interest no revela la posición real del dealer. Edge Score = calidad del
          candidato, no probabilidad de beneficio. Niveles calculados desde la cadena real; N/A cuando no aplica.
        </div>
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function GammaScreenerView() {
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>('edge');
  const [sortKey, setSortKey] = useState<SortKey>('edge');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState(40);
  const [minEdge, setMinEdge] = useState(0);
  const [regimeFilter, setRegimeFilter] = useState('all');
  const [skewFilter, setSkewFilter] = useState('all');
  const [momFilter, setMomFilter] = useState('all');
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [selected, setSelected] = useState<ScreenerRow | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (refresh) params.set('refresh', '1');
      const res = await fetch(`/api/gamma-screener?${params.toString()}`);
      const json = await res.json();
      if (json && !json.error) setData(json);
      else setError(json?.error || 'Sin datos');
    } catch {
      setError('Error cargando el Gamma Screener');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const p = PRESETS.find((x) => x.id === preset);
    let r = data.rows;
    if (p) r = r.filter(p.filter);
    if (minEdge > 0) r = r.filter((x) => x.edge != null && x.edge >= minEdge);
    if (regimeFilter !== 'all') r = r.filter((x) => x.gammaRegime === regimeFilter);
    if (skewFilter !== 'all') r = r.filter((x) => x.skewRegime === skewFilter);
    if (momFilter !== 'all') {
      if (momFilter === 'bullish') r = r.filter((x) => x.momentum === 'bullish' || x.momentum === 'lean_bullish');
      else if (momFilter === 'bearish') r = r.filter((x) => x.momentum === 'bearish' || x.momentum === 'lean_bearish');
      else r = r.filter((x) => x.momentum === momFilter);
    }
    if (exchangeFilter.trim()) r = r.filter((x) => (x.exchange || '').toUpperCase().includes(exchangeFilter.trim().toUpperCase()));

    const get = (row: ScreenerRow): number | null => {
      switch (sortKey) {
        case 'edge': return row.edge;
        case 'netGex': return row.netGex;
        case 'netGexNorm': return row.netGexNorm;
        case 'skew': return row.skewRiskReversal25;
        case 'optVolume': return row.optVolume;
        case 'totalOi': return row.totalOi;
        case 'relVolume': return row.relVolume;
        case 'distCallWall': return row.distCallWallPct;
        case 'distPutWall': return row.distPutWallPct;
        case 'distFlip': return row.distFlipPct;
        case 'dataQuality': return row.dataQuality.completeness;
        case 'gammaRegime': return { positive: 2, neutral: 1, negative: 0, unknown: -1 }[row.gammaRegime] ?? -1;
        case 'momentum': return { bullish: 4, lean_bullish: 3, neutral: 2, lean_bearish: 1, bearish: 0 }[row.momentum] ?? -1;
        default: return row.edge;
      }
    };
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * sign;
    });
  }, [data, preset, minEdge, regimeFilter, skewFilter, momFilter, exchangeFilter, sortKey, sortDir]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const HeadCell = ({ label, k, align = 'right', width }: { label: string; k: SortKey; align?: 'left' | 'right'; width?: number }) => (
    <th
      onClick={() => setSort(k)}
      style={{
        position: 'sticky', top: 0, zIndex: 2, background: C.bgElevated, color: sortKey === k ? C.accentLight : C.textSecondary,
        fontSize: F.sizeXs, fontWeight: 600, textAlign: align, padding: '7px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
        borderBottom: `1px solid ${C.border}`, minWidth: width,
      }}
    >
      {label}{sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const cell: React.CSSProperties = { padding: '6px 8px', fontSize: F.sizeSm, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` };

  return (
    <div style={{ padding: S.lg, maxWidth: 1500, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: S.md, marginBottom: S.md }}>
        <div>
          <h2 style={{ margin: 0, fontSize: F.sizeXxl, fontWeight: 700, color: C.textPrimary }}>Gamma Screener</h2>
          <div style={{ fontSize: F.sizeSm, color: C.textSecondary }}>
            Posicionamiento de opciones (GEX estimado), skew, momentum y liquidez · NYSE / NASDAQ / AMEX
          </div>
        </div>
        <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
          {data && <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{rows.length} resultados · escaneados {data.universe.scanned} de {data.universe.requested} · {fmtTime(data.asOf)}</span>}
          <button onClick={() => load(true)} disabled={loading}
            style={{ background: C.accent, color: '#06231f', border: 'none', borderRadius: R.sm, padding: '6px 14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontSize: F.sizeSm }}>
            {loading ? '…' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {/* Disclaimer bar */}
      <div style={{ fontSize: F.sizeXs, color: C.textMuted, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: '6px 10px', marginBottom: S.md }}>
        Universo: subconjunto líquido priorizado ({data?.universe.mode === 'custom' ? 'lista personalizada' : `${data?.universe.requested ?? 0} candidatos, top ${data?.universe.limit ?? limit}`}). GEX es una <b>estimación</b> (calls + / puts −, supuesto del dealer). El OI no revela la posición real. Edge Score mide calidad del candidato, no probabilidad de beneficio.
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: S.sm }}>
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => { setPreset(p.id); setSortKey(p.sort); setSortDir(p.dir); }}
            style={{
              background: preset === p.id ? C.accent : C.bgInput, color: preset === p.id ? '#06231f' : C.textSecondary,
              border: `1px solid ${preset === p.id ? C.accent : C.border}`, borderRadius: R.sm, padding: '4px 10px', fontSize: F.sizeXs, fontWeight: 600, cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap', alignItems: 'center', marginBottom: S.md, fontSize: F.sizeXs }}>
        <label style={{ color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
          Edge ≥ <input type="range" min={0} max={95} step={5} value={minEdge} onChange={(e) => setMinEdge(Number(e.target.value))} />
          <b style={{ color: C.textPrimary, width: 24 }}>{minEdge}</b>
        </label>
        <select value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value)} style={{ background: C.bgInput, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: '4px 8px' }}>
          <option value="all">Régimen: todos</option>
          <option value="positive">Positive gamma</option>
          <option value="negative">Negative gamma</option>
          <option value="neutral">Transitional</option>
        </select>
        <select value={skewFilter} onChange={(e) => setSkewFilter(e.target.value)} style={{ background: C.bgInput, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: '4px 8px' }}>
          <option value="all">Skew: todos</option>
          <option value="bullish">Call-side</option>
          <option value="bearish">Put-side</option>
          <option value="neutral">Neutral</option>
        </select>
        <select value={momFilter} onChange={(e) => setMomFilter(e.target.value)} style={{ background: C.bgInput, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: '4px 8px' }}>
          <option value="all">Momentum: todos</option>
          <option value="bullish">Alcista</option>
          <option value="bearish">Bajista</option>
          <option value="neutral">Neutral</option>
        </select>
        <input value={exchangeFilter} onChange={(e) => setExchangeFilter(e.target.value)} placeholder="Exchange (NYSE/NASDAQ/AMEX)"
          style={{ background: C.bgInput, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: '4px 8px', width: 170 }} />
        <label style={{ color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
          Escanear
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ background: C.bgInput, color: C.textPrimary, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: '4px 8px' }}>
            <option value={20}>20</option><option value={40}>40</option><option value={60}>60</option><option value={120}>120</option>
          </select>
        </label>
      </div>

      {error && <div style={{ color: C.negative, fontSize: F.sizeSm, marginBottom: S.sm }}>{error}</div>}

      {/* Table */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: R.md, overflow: 'auto', maxHeight: '68vh', background: C.bgCard }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1180 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: C.bgElevated, color: C.textSecondary, fontSize: F.sizeXs, textAlign: 'left', padding: '7px 8px', borderBottom: `1px solid ${C.border}`, minWidth: 110 }}>SYMBOL</th>
              <HeadCell label="SPOT" k="edge" />
              <HeadCell label="EDGE" k="edge" width={64} />
              <HeadCell label="GAMMA" k="gammaRegime" />
              <HeadCell label="SKEW" k="skew" />
              <HeadCell label="MOMENTUM" k="momentum" />
              <HeadCell label="OPT VOL" k="optVolume" />
              <HeadCell label="OI" k="totalOi" />
              <HeadCell label="NET GEX" k="netGex" />
              <HeadCell label="CALL WALL" k="distCallWall" />
              <HeadCell label="PUT WALL" k="distPutWall" />
              <HeadCell label="GAMMA FLIP" k="distFlip" />
              <HeadCell label="DIST" k="distFlip" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={13} style={{ padding: S.xl, textAlign: 'center', color: C.textMuted, fontSize: F.sizeSm }}>Calculando GEX sobre el universo… (puede tardar unos segundos)</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={13} style={{ padding: S.xl, textAlign: 'center', color: C.textMuted, fontSize: F.sizeSm }}>Sin resultados con los filtros actuales.</td></tr>
            )}
            {rows.map((r) => {
              const g = GAMMA_META[r.gammaRegime];
              const sk = SKEW_META[r.skewRegime];
              const mo = MOM_META[r.momentum];
              const dist = r.distFlipPct ?? r.distCallWallPct ?? r.distPutWallPct;
              return (
                <tr key={r.symbol} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.bgCardHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...cell, position: 'sticky', left: 0, background: C.bgCard, borderRight: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700, color: C.textPrimary }}>{r.symbol}</div>
                    <div style={{ fontSize: 10, color: r.liquidity === 'high' ? C.positive : r.liquidity === 'low' ? C.warning : C.textMuted }}>{r.liquidity}{r.isEtf ? ' · ETF' : ''}</div>
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: C.textPrimary }}>
                    {r.spot.toFixed(2)}
                    <span style={{ marginLeft: 6, fontSize: F.sizeXs, color: (r.changePct ?? 0) >= 0 ? C.positive : C.negative }}>{fmtPct(r.changePct, 1)}</span>
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: edgeColor(r.edge) }}>{r.edge ?? 'N/A'}</span>
                  </td>
                  <td style={cell}>
                    <span style={{ background: g.bg(C), color: g.color(C), padding: '2px 6px', borderRadius: R.sm, fontSize: 10, fontWeight: 600 }}>{g.label}</span>
                  </td>
                  <td style={{ ...cell, color: sk.color(C), fontSize: F.sizeXs, fontWeight: 600 }}>{sk.label}</td>
                  <td style={{ ...cell, color: mo.color(C), fontSize: F.sizeXs, fontWeight: 600 }}>{mo.label}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.textSecondary }}>{fmtVol(r.optVolume)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.textSecondary }}>{fmtVol(r.totalOi)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: r.netGex >= 0 ? C.positive : C.negative, fontWeight: 600 }}>{fmtGex(r.netGex)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.textSecondary }}>
                    {r.callWall != null ? r.callWall.toFixed(1) : 'N/A'}
                    <span style={{ marginLeft: 4, fontSize: 10, color: (r.distCallWallPct ?? 0) >= 0 ? C.positive : C.negative }}>{fmtPct(r.distCallWallPct, 1)}</span>
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: C.textSecondary }}>
                    {r.putWall != null ? r.putWall.toFixed(1) : 'N/A'}
                    <span style={{ marginLeft: 4, fontSize: 10, color: (r.distPutWallPct ?? 0) >= 0 ? C.positive : C.negative }}>{fmtPct(r.distPutWallPct, 1)}</span>
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: C.textSecondary }}>{r.gammaFlip != null ? r.gammaFlip.toFixed(2) : 'N/A'}</td>
                  <td style={{ ...cell, textAlign: 'right', color: (dist ?? 0) >= 0 ? C.positive : C.negative }}>{fmtPct(dist, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
