'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { colors as C, radius as R } from '@/src/utils/webTheme';
import CandlestickChart from './CandlestickChart';

interface GexRow {
  strike: number;
  callOi: number;
  putOi: number;
  callGex: number;
  putGex: number;
  netGex: number;
  totalOi: number;
}

interface GammaLevels {
  regime: 'positive' | 'negative' | 'neutral';
  gammaFlip: number | null;
  spotVsFlipPct: number | null;
  gammaWallUp: number | null;
  gammaWallDown: number | null;
  netWall: number | null;
  maxPain: number | null;
  totalNetGex: number;
  totalCallGex: number;
  totalPutGex: number;
  totalOi: number;
  gex: GexRow[];
}

interface GammaBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface GammaResponse {
  symbol: string;
  spot: number;
  asOf: number;
  expiry: string | null;
  dte: number;
  levels: GammaLevels;
  bars?: GammaBar[];
  source: {
    chain: 'yahoo' | 'massive';
    massiveContracts: boolean;
    ivCheck: { strike: number; type: string; yahooIv: number; massiveIv: number | null; deviationPct: number | null }[] | null;
  };
  coverage: { yahooStrikes: number; massiveStrikes: number; extraStrikes: number[] } | null;
  error?: string;
}

interface Props {
  symbol: string;
  onClose?: () => void;
}

const REGIME_META = {
  positive: { label: 'Gamma positivo', desc: 'Los dealers amortigúan los movimientos', color: (c: typeof C) => c.positive, bg: (c: typeof C) => c.positiveBg },
  negative: { label: 'Gamma negativo', desc: 'Los dealers amplifican los movimientos', color: (c: typeof C) => c.negative, bg: (c: typeof C) => c.negativeBg },
  neutral: { label: 'Gamma neutral', desc: 'Sin régimen dominante', color: (c: typeof C) => c.textSecondary, bg: (c: typeof C) => c.bgElevated },
} as const;

function fmtGex(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtOi(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

export default function GammaLevelsPanel({ symbol, onClose }: Props) {
  const [data, setData] = useState<GammaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Zoom del gráfico de precio: nº de sesiones visibles (null = todas)
  const [candleCount, setCandleCount] = useState<number | null>(null);
  // Zoom del gráfico GEX: media-ventana de strikes como fracción del spot
  const [gexPct, setGexPct] = useState(0.08);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gamma-levels?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (json && !json.error) setData(json);
      else setError(json?.error || 'Sin datos');
    } catch {
      setError('Error cargando Gamma Levels');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset de zoom al cambiar de símbolo
  useEffect(() => { setCandleCount(null); setGexPct(0.08); }, [symbol]);

  const totalBars = data?.bars?.length ?? 0;
  const visibleBars = useMemo(() => {
    const bars = data?.bars ?? [];
    if (candleCount == null) return bars;
    return bars.slice(-Math.min(candleCount, bars.length));
  }, [data, candleCount]);

  const zoomCandles = useCallback((dir: 'in' | 'out') => {
    setCandleCount((prev) => {
      const total = totalBars || 1;
      const cur = prev ?? total;
      const next = dir === 'in' ? Math.round(cur / 1.5) : Math.round(cur * 1.5);
      const clamped = Math.max(15, Math.min(total, next));
      return clamped >= total ? null : clamped;
    });
  }, [totalBars]);

  const zoomGex = useCallback((dir: 'in' | 'out') => {
    setGexPct((p) => {
      const next = dir === 'in' ? p / 1.5 : p * 1.5;
      return Math.max(0.02, Math.min(0.5, next));
    });
  }, []);

  const candleWrapRef = useWheelZoom<HTMLDivElement>(zoomCandles);
  const gexWrapRef = useWheelZoom<HTMLDivElement>(zoomGex);

  // Window of strikes around spot: ±gexPct or top 24 by |netGex|, whichever keeps context
  const rows = useMemo(() => {
    if (!data?.levels?.gex?.length) return [] as GexRow[];
    const { gex, spot } = { gex: data.levels.gex, spot: data.spot };
    const lo = spot * (1 - gexPct);
    const hi = spot * (1 + gexPct);
    const inWindow = gex.filter((r) => r.strike >= lo && r.strike <= hi);
    return (inWindow.length >= 4 ? inWindow : [...gex].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)).slice(0, 24).sort((a, b) => a.strike - b.strike));
  }, [data, gexPct]);

  if (loading) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '32px', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, fontSize: '14px' }}>Calculando exposición gamma...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '24px', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, fontSize: '13px' }}>{error || 'Sin datos'}</div>
        <button onClick={fetchData} style={{ marginTop: '12px', background: C.accent, color: 'white', border: 'none', borderRadius: R.sm, padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const lv = data.levels;
  const meta = REGIME_META[lv.regime];
  const maxAbsGex = Math.max(...rows.map((r) => Math.abs(r.netGex)), 1);

  return (
    <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: C.textPrimary, fontSize: '16px', fontWeight: '700' }}>🎯 Gamma Levels</h3>
            <p style={{ margin: 0, color: C.textMuted, fontSize: '12px' }}>
              Mapa de exposición gamma de dealers · {data.symbol} · ${data.spot.toFixed(2)} · {data.dte} DTE{data.expiry ? ` (${data.expiry})` : ''}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
          )}
        </div>

        {/* Regime banner */}
        <div style={{
          marginTop: '16px', padding: '14px 16px', borderRadius: R.lg,
          background: `linear-gradient(135deg, ${meta.bg(C)}44, ${C.bg})`,
          border: `1px solid ${meta.color(C)}44`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ color: meta.color(C), fontSize: '15px', fontWeight: '700' }}>{meta.label}</div>
            <div style={{ color: C.textSecondary, fontSize: '12px', marginTop: '2px' }}>{meta.desc}</div>
          </div>
          {lv.gammaFlip != null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '600' }}>GAMMA FLIP</div>
              <div style={{ color: C.warning, fontSize: '20px', fontWeight: '800', lineHeight: 1 }}>
                ${lv.gammaFlip.toFixed(2)}
                {lv.spotVsFlipPct != null && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: lv.spotVsFlipPct >= 0 ? C.positive : C.negative, marginLeft: '6px' }}>
                    {lv.spotVsFlipPct >= 0 ? '+' : ''}{lv.spotVsFlipPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat chips */}
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <Chip label="Wall ↑ (resistencia)" value={lv.gammaWallUp != null ? `$${lv.gammaWallUp.toFixed(2)}` : '—'} color={C.negative} hint="Máx. GEX call" />
        <Chip label="Wall ↓ (soporte)" value={lv.gammaWallDown != null ? `$${lv.gammaWallDown.toFixed(2)}` : '—'} color={C.positive} hint="Máx. GEX put" />
        <Chip label="Max Pain" value={lv.maxPain != null ? `$${lv.maxPain.toFixed(2)}` : '—'} color={C.info} hint="Dolor mínimo al venc." />
        <Chip label="GEX neto" value={fmtGex(lv.totalNetGex)} color={lv.totalNetGex >= 0 ? C.positive : C.negative} hint={`OI total ${fmtOi(lv.totalOi)}`} />
      </div>

      {/* Mini candlestick chart with gamma overlays */}
      {data.bars && data.bars.length > 2 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
            <span style={{ color: C.textSecondary, fontSize: '12px', fontWeight: '600' }}>Precio + niveles gamma</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: C.textMuted, fontSize: '11px' }}>{visibleBars.length} de {totalBars} sesiones</span>
              <ZoomControls
                onZoomIn={() => zoomCandles('in')}
                onZoomOut={() => zoomCandles('out')}
                onReset={() => setCandleCount(null)}
                disabledIn={(candleCount ?? totalBars) <= 15}
                disabledOut={candleCount == null}
              />
            </div>
          </div>
          <div ref={candleWrapRef} style={{ touchAction: 'pan-y' }}>
            <CandlestickChart
              data={visibleBars}
              gammaFlip={lv.gammaFlip ?? undefined}
              gammaWallUp={lv.gammaWallUp ?? undefined}
              gammaWallDown={lv.gammaWallDown ?? undefined}
              height={220}
              animate={false}
            />
          </div>
        </div>
      )}

      {/* Diverging GEX bar chart */}
      {rows.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
            <span style={{ color: C.textSecondary, fontSize: '12px', fontWeight: '600' }}>GEX neto por strike</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: C.textMuted, fontSize: '11px' }}>Calls + · Puts − · $ por 1% de movimiento</span>
              <ZoomControls
                onZoomIn={() => zoomGex('in')}
                onZoomOut={() => zoomGex('out')}
                onReset={() => setGexPct(0.08)}
                disabledIn={gexPct <= 0.02}
                disabledOut={gexPct >= 0.5}
              />
            </div>
          </div>
          <div ref={gexWrapRef}>
            <GexChart
              rows={rows}
              spot={data.spot}
              flip={lv.gammaFlip}
              wallUp={lv.gammaWallUp}
              wallDown={lv.gammaWallDown}
              maxPain={lv.maxPain}
              maxAbsGex={maxAbsGex}
            />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
            <Legend color={C.warning} label="Gamma flip" dashed />
            <Legend color={C.negative} label="Wall ↑" dashed />
            <Legend color={C.positive} label="Wall ↓" dashed />
            <Legend color={C.info} label="Max pain" dashed />
            <Legend color={C.accent} label="Spot" dashed />
          </div>
        </div>
      )}

      {/* IV cross-check footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid ' + C.borderLight, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ color: C.textMuted, fontSize: '11px' }}>
          {data.source.chain === 'massive' ? '⛓ Massive · ' : ''}
          OI/IV: Yahoo{data.source.massiveContracts ? ' + Massive (cross-check IV)' : ''}
          {data.coverage ? ` · ${data.coverage.yahooStrikes} strikes${data.coverage.extraStrikes.length ? ` (+${data.coverage.extraStrikes.length} en Massive)` : ''}` : ''}
        </span>
        <span style={{ color: C.textMuted, fontSize: '11px' }}>{new Date(data.asOf).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

function Chip({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: R.md, background: C.bgElevated, border: '1px solid ' + C.borderLight }}>
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
      <div style={{ color, fontSize: '18px', fontWeight: '800', lineHeight: 1 }}>{value}</div>
      <div style={{ color: C.textMuted, fontSize: '10px', marginTop: '4px' }}>{hint}</div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: C.textMuted, fontSize: '11px' }}>
      <svg width="16" height="8" aria-hidden>
        <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3,2' : undefined} />
      </svg>
      {label}
    </span>
  );
}

function ZoomControls({ onZoomIn, onZoomOut, onReset, disabledIn, disabledOut }: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  disabledIn?: boolean;
  disabledOut?: boolean;
}) {
  const btn = (label: string, title: string, onClick: () => void, disabled?: boolean, fontSize = 15) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: C.bgElevated, border: '1px solid ' + C.borderLight, borderRadius: R.sm,
        color: disabled ? C.textMuted : C.textSecondary, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: `${fontSize}px`, fontWeight: '700', lineHeight: 1, padding: 0, opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      {btn('−', 'Zoom out', onZoomOut, disabledOut)}
      {btn('+', 'Zoom in', onZoomIn, disabledIn)}
      {btn('⟲', 'Reset zoom', onReset, false, 12)}
    </div>
  );
}

function useElementWidth<T extends HTMLElement>(fallback = 760) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || fallback);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

function useWheelZoom<T extends HTMLElement>(onZoom: (dir: 'in' | 'out') => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onZoom);
  cb.current = onZoom;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      cb.current(e.deltaY < 0 ? 'in' : 'out');
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);
  return ref;
}

function GexChart({ rows, spot, flip, wallUp, wallDown, maxPain, maxAbsGex }: {
  rows: GexRow[];
  spot: number;
  flip: number | null;
  wallUp: number | null;
  wallDown: number | null;
  maxPain: number | null;
  maxAbsGex: number;
}) {
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>();
  const width = Math.max(380, Math.round(measured));
  const rowH = 36;
  const padT = 10;
  const padB = 10;
  const padL = 76;
  const padR = 108;
  const height = rows.length * rowH + padT + padB;
  const plotL = padL;
  const plotR = width - padR;
  const centerX = (plotL + plotR) / 2;
  const halfW = (plotR - plotL) / 2;
  const barH = rowH - 14;

  const rowCenterY = (i: number) => padT + i * rowH + rowH / 2;

  // y positions for level lines (between rows when level not exactly a strike)
  const yFor = (price: number | null): number | null => {
    if (price == null) return null;
    const first = rows[0].strike;
    const last = rows[rows.length - 1].strike;
    if (price < first || price > last) return null;
    let idx = rows.findIndex((r) => r.strike >= price);
    if (idx < 0) idx = rows.length - 1;
    const exact = rows[idx].strike === price ? idx : Math.max(0, idx - 0.5);
    return rowCenterY(exact);
  };

  const levels: { y: number | null; color: string; label: string; value: number | null }[] = [
    { y: yFor(flip), color: C.warning, label: 'γFLIP', value: flip },
    { y: yFor(wallUp), color: C.negative, label: 'WALL↑', value: wallUp },
    { y: yFor(wallDown), color: C.positive, label: 'WALL↓', value: wallDown },
    { y: yFor(maxPain), color: C.info, label: 'PAIN', value: maxPain },
    { y: yFor(spot), color: C.accent, label: 'SPOT', value: spot },
  ].filter((l) => l.y != null && l.value != null);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} role="img" aria-label="GEX neto por strike">
        {/* alternating row bands */}
        {rows.map((_, i) =>
          i % 2 === 1 ? (
            <rect key={`bg${i}`} x={plotL - 6} y={padT + i * rowH} width={width - padL - 2} height={rowH} fill={C.bgElevated} opacity="0.5" />
          ) : null
        )}

        {/* vertical grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={plotL + (plotR - plotL) * f} y1={padT} x2={plotL + (plotR - plotL) * f} y2={height - padB}
            stroke={C.borderLight} strokeWidth="1" strokeDasharray="3,4" opacity="0.6" />
        ))}
        {/* zero axis */}
        <line x1={centerX} y1={padT} x2={centerX} y2={height - padB} stroke={C.border} strokeWidth="1.5" />

        {rows.map((r, i) => {
          const cy = rowCenterY(i);
          const barW = (Math.abs(r.netGex) / maxAbsGex) * halfW * 0.86;
          const isPositive = r.netGex >= 0;
          const barColor = isPositive ? C.positive : C.negative;
          const nearSpot = Math.abs(r.strike - spot) / spot < 0.002;
          const barY = cy - barH / 2;
          return (
            <g key={r.strike}>
              {/* spot row highlight */}
              {nearSpot && (
                <rect x={plotL - 6} y={padT + i * rowH} width={width - padL - 2} height={rowH} fill={C.accent} opacity="0.08" />
              )}
              {/* strike label */}
              <text x={padL - 14} y={cy - 2} fontSize="14" fill={nearSpot ? C.accent : C.textPrimary}
                textAnchor="end" fontWeight={nearSpot ? '800' : '700'} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                {r.strike % 1 === 0 ? r.strike : r.strike.toFixed(1)}
              </text>
              {/* OI under strike */}
              <text x={padL - 14} y={cy + 12} fontSize="11" fill={C.textSecondary} textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight="500">
                OI {fmtOi(r.totalOi)}
              </text>
              {/* net GEX bar */}
              <rect
                x={isPositive ? centerX : centerX - barW}
                y={barY}
                width={Math.max(barW, 2)}
                height={barH}
                rx="4"
                fill={barColor}
                opacity={nearSpot ? 1 : 0.85}
              />
              {/* value at bar end */}
              <text
                x={isPositive ? centerX + barW + 8 : centerX - barW - 8}
                y={cy + 4}
                fontSize="12"
                fill={C.textPrimary}
                textAnchor={isPositive ? 'start' : 'end'}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontWeight="700"
              >
                {fmtGex(r.netGex)}
              </text>
            </g>
          );
        })}

        {/* horizontal level markers + right-gutter labels */}
        {levels.map((l) => {
          const label = `${l.label} $${l.value!.toFixed(2)}`;
          const labelW = label.length * 7.2 + 16;
          const lx = width - labelW - 4;
          return (
            <g key={l.label}>
              <line x1={plotL - 4} y1={l.y!} x2={plotR + 6} y2={l.y!} stroke={l.color} strokeWidth="1.5" strokeDasharray="5,4" opacity="0.85" />
              <rect x={lx} y={l.y! - 10} width={labelW} height="20" rx="5" fill={C.bgCard} stroke={l.color} strokeWidth="1.2" opacity="0.98" />
              <text x={lx + labelW / 2} y={l.y! + 4.5} fontSize="11.5" fill={l.color} fontWeight="800" textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
