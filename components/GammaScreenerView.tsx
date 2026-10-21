'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { colors as C, radius as R, spacing as S, font as F } from '@/src/utils/webTheme';

// ── Types mirrored from the API ──────────────────────────────────────────────

type GammaRegime = 'positive' | 'negative' | 'neutral' | 'unknown';
type SkewRegime = 'bullish' | 'neutral' | 'bearish' | 'unknown';
type MomentumClass = 'bullish' | 'lean_bullish' | 'neutral' | 'lean_bearish' | 'bearish';

type PlaybookRole =
  | 'upside_target' | 'upside_resistance' | 'downside_target' | 'downside_support'
  | 'bearish_trigger' | 'bullish_trigger' | 'chop_area';

interface PlaybookLevel {
  label: string;
  role: PlaybookRole;
  level: number | null;
  levelLow?: number;
  levelHigh?: number;
  dir: 'up' | 'down' | 'neutral';
  source: 'callWall' | 'putWall' | 'gammaFlip' | 'flip+wall';
}

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
  playbook: PlaybookLevel[];
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

const PLAYBOOK_COLOR: Record<PlaybookRole, (c: typeof C) => string> = {
  upside_target: (c) => c.positive,
  upside_resistance: (c) => c.warning,
  downside_target: (c) => c.negative,
  downside_support: (c) => c.info,
  bearish_trigger: (c) => c.negative,
  bullish_trigger: (c) => c.positive,
  chop_area: (c) => c.textSecondary,
};

// ── Entrada sugerida (derivada SOLO de niveles reales + momentum/régimen) ────
// No inventa precios: el gatillo es el gamma flip, el target la pared opuesta y
// la invalidación el lado opuesto del flip. El sesgo solo se emite cuando el
// momentum y el régimen gamma están ALINEADOS (si no, "esperar").

type EntryBias = 'long' | 'short' | 'wait';

type Horizon = 'day' | 'swing' | 'no';

interface HorizonRec {
  horizon: Horizon;
  label: string;
  color: (c: typeof C) => string;
  why: string;
}

// El mapa de gamma es estructural (el OI se publica tras el cierre previo y los
// niveles son zonas, no señales intradía). Cerca del flip el régimen es ambiguo.
// Por eso: lejos del flip + alineado + líquido → SWING; distancia media → DAY;
// pegado al flip / ilíquido / datos malos → NO OPERABLE.
function recommendHorizon(row: ScreenerRow, aligned: boolean): HorizonRec {
  const dFlip = row.distFlipPct != null ? Math.abs(row.distFlipPct) : null;
  const liq = row.liquidity;
  const dq = row.dataQuality;

  if (row.gammaFlip == null) {
    return {
      horizon: 'no', label: 'NO OPERABLE', color: (c) => c.textMuted,
      why: 'Sin gamma flip válido: no hay referencia para fijar gatillo/invalidación.',
    };
  }
  if (liq === 'low' || liq === 'unknown') {
    return {
      horizon: 'no', label: 'NO OPERABLE', color: (c) => c.textMuted,
      why: `Liquidez ${liq === 'low' ? 'baja' : 'desconocida'}: GEX poco fiable y ejecución costosa.`,
    };
  }
  if (dq.stale || dq.completeness < 0.6) {
    return {
      horizon: 'no', label: 'NO OPERABLE', color: (c) => c.textMuted,
      why: `Datos ${dq.stale ? 'desactualizados' : 'incompletos'} (${Math.round(dq.completeness * 100)}%): el mapa no está fiable.`,
    };
  }
  if (dFlip != null && dFlip < 1) {
    return {
      horizon: 'no', label: 'NO OPERABLE', color: (c) => c.warning,
      why: `Spot pegado al flip (${dFlip.toFixed(2)}%): el régimen cambia de signo a cada tick — aquí el mapa es ruido.`,
    };
  }
  if (!aligned) {
    return {
      horizon: 'no', label: 'NO OPERABLE', color: (c) => c.warning,
      why: 'Momentum y régimen desalineados: sin sesgo claro, no es entrada.',
    };
  }
  if (dFlip != null && dFlip >= 3) {
    return {
      horizon: 'swing', label: 'SWING (días)', color: (c) => c.positive,
      why: `Alineado y a ${dFlip.toFixed(1)}% del flip: los niveles gamma operan bien con días de antelación (el OI es del cierre previo).`,
    };
  }
  return {
    horizon: 'day', label: 'DAY TRADE (intradía)', color: (c) => c.accentLight,
    why: `Alineado pero a ${dFlip != null ? dFlip.toFixed(1) : '?'}% del flip: operable intradía con gestión ajustada; el nivel no es zona firme.`,
  };
}

interface EntryIdea {
  bias: EntryBias;
  heading: string;
  color: (c: typeof C) => string;
  trigger: number | null;
  triggerText: string;
  target: number | null;
  stop: number | null;
  rationale: string[];
  aligned: boolean;
  horizon: HorizonRec;
}

function buildEntryIdea(row: ScreenerRow): EntryIdea {
  const momBull = row.momentum === 'bullish' || row.momentum === 'lean_bullish';
  const momBear = row.momentum === 'bearish' || row.momentum === 'lean_bearish';
  const flip = row.gammaFlip;
  const spotAboveFlip = flip != null ? row.spot >= flip : null;
  const regimeDir: 'up' | 'down' | 'flat' = row.gammaRegime === 'positive' ? 'up' : row.gammaRegime === 'negative' ? 'down' : 'flat';

  const rationale: string[] = [];
  rationale.push(`Régimen ${GAMMA_META[row.gammaRegime].label}${flip != null ? ` · spot ${spotAboveFlip ? 'por encima' : 'por debajo'} del flip $${flip.toFixed(2)}` : ' · sin flip válido'}`);
  rationale.push(`Momentum ${MOM_META[row.momentum].label}${row.momentumRet20d != null ? ` · 20d ${fmtPct(row.momentumRet20d * 100, 1)}` : ''}`);

  // Alineación: el momentum debe coincidir con el régimen (spot vs flip).
  const longAligned = momBull && regimeDir === 'up';
  const shortAligned = momBear && regimeDir === 'down';

  if (longAligned && flip != null) {
    return {
      bias: 'long',
      heading: 'Al alza (long calls)',
      color: (c) => c.positive,
      trigger: flip,
      triggerText: `Ruptura confirmada sobre el flip $${flip.toFixed(2)}`,
      target: row.callWall,
      stop: row.putWall ?? flip,
      rationale: [...rationale, 'Momentum alcista con gamma positivo → sesgo al alza, apoyado por el colchón de dealers.'],
      aligned: true,
      horizon: recommendHorizon(row, true),
    };
  }
  if (shortAligned && flip != null) {
    return {
      bias: 'short',
      heading: 'A la baja (long puts)',
      color: (c) => c.negative,
      trigger: flip,
      triggerText: `Ruptura confirmada bajo el flip $${flip.toFixed(2)}`,
      target: row.putWall,
      stop: row.callWall ?? flip,
      rationale: [...rationale, 'Momentum bajista con gamma negativo → sesgo a la baja, movimientos amplificados.'],
      aligned: true,
      horizon: recommendHorizon(row, true),
    };
  }

  // Sin alineación: hay momentum pero el régimen lo contradice, o todo neutral.
  let reason: string;
  if (momBear && regimeDir === 'up') reason = 'Momentum bajista pero gamma positivo: los dealers amortiguan caídas → un put aquí es contra-flujo. Espera a que pierda el flip.';
  else if (momBull && regimeDir === 'down') reason = 'Momentum alcista pero gamma negativo: el régimen amplifica y puede revertir → un call aquí es contra-flujo. Espera a que reconquiste el flip.';
  else if (momBull) reason = 'Momentum alcista pero régimen sin sesgo claro (transición/neutral).';
  else if (momBear) reason = 'Momentum bajista pero régimen sin sesgo claro (transición/neutral).';
  else reason = 'Momentum neutral: sin sesgo direccional definido.';

  return {
    bias: 'wait',
    heading: 'Esperar confirmación',
    color: (c) => c.warning,
    trigger: flip,
    triggerText: flip != null ? `Gatillo: cruzar el flip $${flip.toFixed(2)} en la dirección del momentum` : 'Sin flip válido para fijar gatillo',
    target: null,
    stop: null,
    rationale: [...rationale, reason],
    aligned: false,
    horizon: recommendHorizon(row, false),
  };
}

function EntrySuggestionCard({ row }: { row: ScreenerRow }) {
  const idea = buildEntryIdea(row);
  const col = idea.color(C);
  const hz = idea.horizon;
  const hzCol = hz.color(C);
  const fmt$ = (v: number | null) => (v != null ? `$${v.toFixed(2)}` : '—');
  return (
    <div style={{ marginBottom: S.md, border: `1px solid ${col}55`, borderRadius: R.md, overflow: 'hidden', background: col + '0E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: '10px 12px', borderBottom: `1px solid ${col}33`, flexWrap: 'wrap' }}>
        <span style={{ fontSize: F.sizeSm, fontWeight: 800, color: col }}>
          {idea.bias === 'long' ? '🟢' : idea.bias === 'short' ? '🔴' : '⏸'} Sesgo: {idea.heading}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: F.sizeXs, fontWeight: 800, padding: '2px 8px', borderRadius: R.full, background: hzCol + '22', color: hzCol, border: `1px solid ${hzCol}55` }}>
          {hz.label}
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: F.sizeSm, color: C.textSecondary, marginBottom: S.xs }}>{idea.triggerText}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: S.sm, marginTop: S.xs }}>
          <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: S.sm }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>Gatillo (flip)</div>
            <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: C.textPrimary }}>{fmt$(idea.trigger)}</div>
          </div>
          <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: S.sm }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>{idea.bias === 'short' ? 'Target (put wall)' : 'Target (call wall)'}</div>
            <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: idea.target != null ? col : C.textMuted }}>{fmt$(idea.target)}</div>
          </div>
          <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: S.sm }}>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>Invalidación</div>
            <div style={{ fontSize: F.sizeMd, fontWeight: 700, color: C.textPrimary }}>{fmt$(idea.stop)}</div>
          </div>
        </div>
        <div style={{ marginTop: S.sm, padding: '8px 10px', borderRadius: R.sm, background: hzCol + '12', border: `1px solid ${hzCol}33` }}>
          <div style={{ fontSize: F.sizeXs, fontWeight: 700, color: hzCol }}>Horizonte: {hz.label}</div>
          <div style={{ fontSize: F.sizeXs, color: C.textSecondary, marginTop: 2, lineHeight: 1.5 }}>{hz.why}</div>
        </div>
        <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18, color: C.textSecondary, fontSize: F.sizeXs, lineHeight: 1.6 }}>
          {idea.rationale.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: S.xs }}>
          Derivado de los niveles gamma reales (flip/walls) y del momentum/régimen. No es una señal de ejecución ni garantía.
        </div>
      </div>
    </div>
  );
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
      {/* playbook levels */}
      {row.playbook.map((p, i) => {
        if (p.role === 'chop_area' && p.levelLow != null && p.levelHigh != null) {
          const x1 = x(p.levelLow), x2 = x(p.levelHigh);
          return (
            <rect key={`chop${i}`} x={Math.min(x1, x2)} y={pad.t} width={Math.abs(x2 - x1)} height={H - pad.t - pad.b}
              fill={C.textSecondary} opacity={0.10} />
          );
        }
        if (p.level == null) return null;
        const lx = x(p.level);
        if (lx < pad.l || lx > W - pad.r) return null;
        const col = PLAYBOOK_COLOR[p.role](C);
        return (
          <line key={`pb${i}`} x1={lx} y1={pad.t} x2={lx} y2={H - pad.b} stroke={col} strokeWidth={1.2} strokeDasharray="5 3" opacity={0.9} />
        );
      })}
      {/* spot marker */}
      <line x1={spotX} y1={pad.t} x2={spotX} y2={H - pad.b} stroke={C.accentLight} strokeWidth={1.5} strokeDasharray="3 3" />
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

        {/* Entrada sugerida (niveles reales + momentum/régimen) */}
        <EntrySuggestionCard row={row} />

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
        <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: R.sm, marginBottom: S.sm }}>
          <GexByStrikeChart row={row} />
        </div>

        {/* Playbook legend */}
        {row.playbook.length > 0 && (
          <div style={{ marginBottom: S.md }}>
            <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary, marginBottom: S.xs }}>Playbook de niveles</div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: R.sm, overflow: 'hidden' }}>
              {row.playbook.map((p, i) => {
                const col = PLAYBOOK_COLOR[p.role](C);
                const price = p.role === 'chop_area'
                  ? `${p.levelLow!.toFixed(1)} – ${p.levelHigh!.toFixed(1)}`
                  : `$${p.level!.toFixed(2)}`;
                const dist = p.role === 'chop_area' || p.level == null ? null : ((p.level - row.spot) / row.spot) * 100;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: '6px 10px', borderBottom: i < row.playbook.length - 1 ? `1px solid ${C.border}` : 'none', background: C.bgInput }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: col, flexShrink: 0, border: p.role === 'chop_area' ? `1px solid ${col}` : 'none', opacity: p.role === 'chop_area' ? 0.4 : 1 }} />
                    <span style={{ flex: 1, fontSize: F.sizeSm, color: col, fontWeight: 600 }}>{p.label}</span>
                    <span style={{ fontSize: F.sizeSm, color: C.textPrimary, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{price}</span>
                    <span style={{ width: 58, textAlign: 'right', fontSize: F.sizeXs, color: dist == null ? C.textMuted : dist >= 0 ? C.positive : C.negative }}>{dist == null ? '—' : fmtPct(dist, 1)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: S.xs }}>
              Etiquetas direccionales según la posición del nivel respecto al spot. Los precios provienen de los niveles gamma reales; no son garantías.
            </div>
          </div>
        )}

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

// ── Help panel ───────────────────────────────────────────────────────────────

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.accentBorder}`, borderRadius: R.md, padding: S.lg, marginBottom: S.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
        <h3 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeLg, fontWeight: 700 }}>📖 Guía del Gamma Screener</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      <HelpBlock title="¿Qué es?">
        Un screener cuantitativo que rankea acciones y ETFs de <strong style={{ color: C.textPrimary }}>NYSE / NASDAQ / AMEX</strong> según el
        <strong style={{ color: C.textPrimary }}> posicionamiento del mercado de opciones</strong> (exposición gamma estimada de los dealers),
        el <em>skew</em> de volatilidad, el <em>momentum</em> y la <em>liquidez</em>. Su objetivo es señalarte <strong style={{ color: C.textPrimary }}>qué candidatos
        merecen análisis</strong> y cuáles excluir — no predice el futuro ni genera órdenes.
      </HelpBlock>

      <HelpBlock title="1 · Leer la tabla">
        <HelpRow n="SYMBOL">Ticker, liquidez de opciones (high/medium/low) y si es ETF.</HelpRow>
        <HelpRow n="SPOT">Precio actual del subyacente y cambio del día. La etiqueta indica si es precio en vivo, pre-market o post-market.</HelpRow>
        <HelpRow n="EDGE"><strong>Edge Score</strong>: calidad del candidato de 0 a 100 (ver punto 4). Mide <em>calidad</em>, no probabilidad de ganar.</HelpRow>
        <HelpRow n="GAMMA">Régimen de gamma (ver punto 3).</HelpRow>
        <HelpRow n="SKEW">Sesgo de volatilidad: CALL-SIDE / PUT-SIDE / NEUTRAL (ver punto 3).</HelpRow>
        <HelpRow n="MOMENTUM">Clasificación técnica en 5 niveles (bullish → bearish).</HelpRow>
        <HelpRow n="OPT VOL / OI">Volumen de opciones y open interest agregados del símbolo.</HelpRow>
        <HelpRow n="NET GEX">Exposición gamma neta estimada ($ por 1% de movimiento).</HelpRow>
        <HelpRow n="WALLS / FLIP">Call Wall, Put Wall y Gamma Flip con su distancia ↔ al spot (ver punto 5).</HelpRow>
      </HelpBlock>

      <HelpBlock title="2 · Botones, filtros y orden">
        Usa los <strong>presets</strong> (Highest Edge, Positive/Negative Gamma, Bullish/Bearish Momentum, Near Flip/Walls, High Liquidity) para
        saltar directo a una idea. Refina con los filtros: <em>slider de Edge</em>, <em>régimen</em>, <em>skew</em>, <em>momentum</em>, <em>exchange</em> y el tamaño de escaneo.
        Pulsa cualquier <strong>cabecera de columna</strong> para ordenar (▲/▼). Haz clic en una <strong>fila</strong> para abrir el detalle del símbolo sin perder filtros ni orden.
      </HelpBlock>

      <HelpBlock title="3 · GEX, Gamma Regime y Skew">
        <HelpRow n="GEX">
          <strong>Gamma Exposure</strong> estima cuánto gamma mueve el mercado por cada 1% del subyacente. Convención:
          <code style={code}>gamma·OI·100·spot²·0.01</code>. Se asume dealer <em>long calls / short puts</em> (configurable).
        </HelpRow>
        <HelpRow n="Gamma">
          <span style={{ color: C.positive }}>POS GAMMA</span> (dealers amortiguan el movimiento, mercado más "pegajoso"),
          <span style={{ color: C.negative }}> NEG GAMMA</span> (amplifican, movimientos más violentos),
          <span style={{ color: C.warning }}> TRANSITION</span> (cerca del flip) o <em>UNKNOWN</em> sin datos.
        </HelpRow>
        <HelpRow n="Skew">
          <span style={{ color: C.positive }}>CALL-SIDE</span> = la volatilidad de los calls está más cara (25Δ risk reversal positivo).
          <span style={{ color: C.negative }}> PUT-SIDE</span> = los puts cotizan con prima (protección). <span style={{ color: C.textSecondary }}>NEUTRAL</span> = equilibrado.
        </HelpRow>
        <div style={{ marginTop: 4, color: C.textMuted, fontSize: F.sizeXs }}>
          ⚠️ El open interest <strong>no</strong> revela la posición real del dealer → todo GEX es una <strong>estimación</strong> bajo un supuesto documentado.
        </div>
      </HelpBlock>

      <HelpBlock title="4 · Edge Score (0-100)">
        Combina, con pesos configurables: <strong>gamma</strong> (25%), <strong>momentum</strong> (20%), <strong>skew</strong> (20%),
        <strong> proximidad</strong> a niveles (15%) y <strong>liquidez/OI</strong> (20%). Se aplica una <strong>penalización por calidad de datos</strong>: si faltan datos,
        el score baja o se marca <em>N/A</em> (nunca se infla un símbolo sin datos).
        <div style={{ marginTop: 4 }}>Recuerda: mide la <strong>calidad del candidato</strong>, no la probabilidad de beneficio.</div>
      </HelpBlock>

      <HelpBlock title="5 · Call Wall, Put Wall y Gamma Flip">
        <HelpRow n="Call Wall">Strike con la mayor concentración de gamma de calls (posible zona de resistencia/atracción). Con <em>scope</em> elegible: nearest / weekly / monthly / all.</HelpRow>
        <HelpRow n="Put Wall">Strike con la mayor concentración de gamma de puts (posible zona de soporte).</HelpRow>
        <HelpRow n="Gamma Flip">Precio del subyacente donde el <strong>GEX neto cambia de signo</strong> (grid de spot + cruce por cero interpolado). Si no hay cruce válido → <em>N/A</em>, nunca se inventa un nivel.</HelpRow>
        <HelpRow n="DIST"><code style={code}>(nivel − spot)/spot × 100</code>. Positivo = nivel por encima del spot; negativo = por debajo.</HelpRow>
        <div style={{ marginTop: 4, color: C.textMuted, fontSize: F.sizeXs }}>
          Los niveles provienen del OI real del día anterior; no son soportes/resistencias garantizados.
        </div>
      </HelpBlock>

      <HelpBlock title="6 · Detalle del símbolo (clic en la fila)">
        Abre el panel lateral con: spot y cambio, régimen de gamma, walls y flip con distancias en $ y %, <strong>breakdown del Edge Score</strong>,
        <strong> GEX neto por strike</strong> (gráfico), estadísticas (P/C volumen, ATM IV, risk reversal 25Δ, retorno 20d, volumen relativo) y
        <strong> calidad de datos + avisos</strong>. Marca el spot actual sobre el perfil de gamma.
      </HelpBlock>

      <div style={{ marginTop: S.sm, padding: '10px 12px', background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: R.sm, color: C.textSecondary, fontSize: F.sizeSm }}>
        ⚠️ <strong style={{ color: C.textPrimary }}>Aviso:</strong> herramienta de análisis educativo. El GEX es una estimación, no una posición
        observada. El universo escaneado es un subconjunto líquido priorizado (no un barrido completo en vivo). No es asesoría financiera.
      </div>
    </div>
  );
}

function HelpBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: S.md }}>
      <div style={{ color: C.accent, fontSize: F.sizeMd, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: C.textSecondary, fontSize: F.sizeSm, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function HelpRow({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: S.sm, marginTop: 4 }}>
      {n && <span style={{ color: C.accentLight, fontWeight: 700, fontSize: F.sizeSm, minWidth: 70, flexShrink: 0 }}>{n}</span>}
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

const code: React.CSSProperties = {
  background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 5px',
  fontSize: F.sizeXs, fontFamily: 'monospace', color: C.accentLight,
};

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
  const [showHelp, setShowHelp] = useState(false);

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
          <button onClick={() => setShowHelp((v) => !v)}
            style={{ background: showHelp ? C.accent : 'transparent', color: showHelp ? '#06231f' : C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: R.full, padding: '5px 14px', fontSize: F.sizeSm, fontWeight: 700, cursor: 'pointer' }}>
            {showHelp ? '✕ Cerrar ayuda' : '? Cómo usar'}
          </button>
          <button onClick={() => load(true)} disabled={loading}
            style={{ background: C.accent, color: '#06231f', border: 'none', borderRadius: R.sm, padding: '6px 14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontSize: F.sizeSm }}>
            {loading ? '…' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

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
