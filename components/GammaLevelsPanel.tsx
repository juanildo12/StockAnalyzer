'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
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

type PlaybookRole = 'upside_target' | 'upside_resistance' | 'downside_target' | 'downside_support' | 'bearish_trigger' | 'bullish_trigger' | 'chop_area';

interface PlaybookLevel {
  label: string;
  role: PlaybookRole;
  level: number | null;
  levelLow?: number;
  levelHigh?: number;
  dir: 'up' | 'down' | 'neutral';
  source: 'callWall' | 'putWall' | 'gammaFlip' | 'flip+wall';
}

interface GammaResponse {
  symbol: string;
  spot: number;
  asOf: number;
  expiry: string | null;
  dte: number;
  levels: GammaLevels;
  playbook?: PlaybookLevel[];
  bars?: GammaBar[];
  source: {
    chain: 'yahoo' | 'massive';
    massiveContracts: boolean;
    ivCheck: { strike: number; type: string; yahooIv: number; massiveIv: number | null; deviationPct: number | null }[] | null;
  };
  coverage: { yahooStrikes: number; massiveStrikes: number; extraStrikes: number[] } | null;
  marketState?: string;
  priceBasis?: 'pre' | 'post' | 'regular';
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

const PLAYBOOK_COLOR: Record<PlaybookRole, (c: typeof C) => string> = {
  upside_target: (c) => c.positive,
  upside_resistance: (c) => c.warning,
  downside_target: (c) => c.negative,
  downside_support: (c) => c.info,
  bearish_trigger: (c) => c.negative,
  bullish_trigger: (c) => c.positive,
  chop_area: (c) => c.textSecondary,
};

/** Chip que indica de dónde sale el precio usado como spot (pre/post/cierre). */
function PriceBasisBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      marginLeft: '6px', fontSize: '10px', fontWeight: '700', padding: '1px 6px',
      borderRadius: R.full, background: color + '22', color, textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  );
}

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
  // Panel de ayuda "¿Cómo leer esto?"
  const [helpOpen, setHelpOpen] = useState(false);
  // Refresco manual en curso (botón "Actualizar")
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    if (opts?.force) setRefreshing(true);
    setError(null);
    try {
      const url = `/api/gamma-levels?symbol=${encodeURIComponent(symbol)}${opts?.force ? '&force=1' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json && !json.error) setData(json);
      else setError(json?.error || 'Sin datos');
    } catch {
      setError('Error cargando Gamma Levels');
    } finally {
      if (!opts?.silent) setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh silencioso cada 60s y al volver a la pestaña: así el spot
  // pre/post-market y el régimen se mueven sin recargar (el OI es diario).
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') fetchData({ silent: true }); };
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [fetchData]);

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
        <button onClick={() => fetchData({ force: true })} style={{ marginTop: '12px', background: C.accent, color: 'white', border: 'none', borderRadius: R.sm, padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
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
              Mapa de exposición gamma de dealers · {data.symbol} · ${data.spot.toFixed(2)}
              {data.priceBasis === 'pre' && <PriceBasisBadge label="pre-market" color={C.warning} />}
              {data.priceBasis === 'post' && <PriceBasisBadge label="post-market" color={C.warning} />}
              {data.priceBasis === 'regular' && (data.marketState === 'REGULAR'
                ? <PriceBasisBadge label="en vivo" color={C.positive} />
                : <PriceBasisBadge label="último cierre" color={C.textMuted} />)}
              {' · '}{data.dte} DTE{data.expiry ? ` (${data.expiry})` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => fetchData({ force: true })}
              disabled={refreshing}
              title="Actualizar ahora (ignora la caché)"
              style={{
                background: 'none',
                border: '1px solid ' + C.borderLight,
                color: refreshing ? C.textMuted : C.textSecondary,
                cursor: refreshing ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600',
                padding: '5px 10px', borderRadius: R.sm, whiteSpace: 'nowrap',
              }}
            >
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>⟳</span>
              {' '}{refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
            <button
              onClick={() => setHelpOpen((v) => !v)}
              title="¿Cómo leer estos gráficos?"
              style={{
                background: helpOpen ? C.accent + '22' : 'none',
                border: '1px solid ' + (helpOpen ? C.accent : C.borderLight),
                color: helpOpen ? C.accent : C.textSecondary,
                cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                padding: '5px 10px', borderRadius: R.sm, whiteSpace: 'nowrap',
              }}
            >
              {helpOpen ? '✕ Cerrar ayuda' : '? Ayuda'}
            </button>
            {onClose && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
            )}
          </div>
        </div>

        {helpOpen && <HelpSection />}

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

      {/* Playbook legend */}
      {data.playbook && data.playbook.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ color: C.textSecondary, fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>Playbook de niveles</div>
          <div style={{ border: '1px solid ' + C.borderLight, borderRadius: R.md, overflow: 'hidden' }}>
            {data.playbook.map((p, i) => {
              const col = PLAYBOOK_COLOR[p.role](C);
              const price = p.role === 'chop_area'
                ? `${p.levelLow!.toFixed(2)} – ${p.levelHigh!.toFixed(2)}`
                : `$${p.level!.toFixed(2)}`;
              const dist = p.role === 'chop_area' || p.level == null ? null : ((p.level - data.spot) / data.spot) * 100;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', borderBottom: i < data.playbook!.length - 1 ? '1px solid ' + C.borderLight : 'none', background: C.bgElevated }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: col, flexShrink: 0, opacity: p.role === 'chop_area' ? 0.4 : 1, border: p.role === 'chop_area' ? `1px solid ${col}` : 'none' }} />
                  <span style={{ flex: 1, fontSize: '12.5px', color: col, fontWeight: 700 }}>{p.label}</span>
                  <span style={{ fontSize: '12.5px', color: C.textPrimary, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{price}</span>
                  <span style={{ width: '58px', textAlign: 'right', fontSize: '11px', color: dist == null ? C.textMuted : dist >= 0 ? C.positive : C.negative }}>
                    {dist == null ? '—' : `${dist >= 0 ? '+' : ''}${dist.toFixed(1)}%`}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ color: C.textMuted, fontSize: '11px', marginTop: '6px' }}>
            Etiquetas direccionales según la posición del nivel respecto al spot. Precios de los niveles gamma reales; no son garantías.
          </div>
        </div>
      )}

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
            <Legend color={C.warning} label="Línea divisora (gamma flip)" dashed />
            <Legend color={C.negative} label="Upside target (wall ↑)" dashed />
            <Legend color={C.positive} label="Downside target (wall ↓)" dashed />
            <Legend color={C.info} label="Max pain" dashed />
            <Legend color={C.accent} label="Spot" dashed />
            <Legend color={C.positive} label="Zona slow grind alcista" />
            <Legend color={C.negative} label="Zona slow grind bajista" />
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

function HelpRow({ term, color, children }: { term: string; color: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '10px 0', borderTop: '1px solid ' + C.borderLight }}>
      <div style={{ minWidth: '128px', color, fontSize: '12.5px', fontWeight: '700', lineHeight: '1.5' }}>{term}</div>
      <div style={{ color: C.textSecondary, fontSize: '12.5px', lineHeight: '1.55', flex: 1 }}>{children}</div>
    </div>
  );
}

function HelpSection() {
  const eq = { color: C.textPrimary, fontWeight: 600 } as const;
  return (
    <div style={{
      marginTop: '16px', padding: '16px 18px', borderRadius: R.lg,
      background: C.bgElevated, border: '1px solid ' + C.borderLight,
    }}>
      <div style={{ color: C.textPrimary, fontSize: '13.5px', fontWeight: '700', marginBottom: '4px' }}>
        ¿Cómo leer estos gráficos?
      </div>
      <p style={{ margin: '0 0 8px', color: C.textSecondary, fontSize: '12.5px', lineHeight: '1.55' }}>
        Todo gira en torno al <b style={eq}>GEX</b> (Gamma Exposure): cuánta gamma tienen los <i>dealers</i> por strike de opciones.
        Para cubrirse, los dealers <b style={eq}>compran cuando el precio baja y venden cuando sube</b> (si su gamma es positiva) o al revés.
        El GEX se lee como <b style={eq}>$ de cobertura por cada 1% de movimiento</b>. Las <b style={eq}>calls</b> cuentan positivo y las
        <b style={eq}> puts</b> negativo (convención: dealers largos en calls, cortos en puts).
      </p>

      {/* Régimen */}
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', margin: '14px 0 2px' }}>RÉGIMEN</div>
      <HelpRow term="Gamma positivo" color={C.positive}>
        El spot está <b style={eq}>por encima</b> del flip. Los dealers amortiguan: compran caídas y venden subidas →
        mercado más <b style={eq}>pegajoso</b>, rangos y baja volatilidad.
      </HelpRow>
      <HelpRow term="Gamma negativo" color={C.negative}>
        El spot está <b style={eq}>por debajo</b> del flip. Los dealers amplifican: venden caídas y compran subidas →
        movimientos más <b style={eq}>bruscos</b>, tendencias y squeezes.
      </HelpRow>

      {/* Niveles */}
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', margin: '14px 0 2px' }}>NIVELES CLAVE</div>
      <HelpRow term="Gamma Flip" color={C.warning}>
        Precio donde el régimen cambia de signo. Por encima → positivo (calma); por debajo → negativo (volatilidad).
        Es el nivel "bisagra".
      </HelpRow>
      <HelpRow term="Wall ↑ (resistencia)" color={C.negative}>
        Strike con más GEX de <b style={eq}>calls</b>. Al acercarse, los dealers venden y el precio tiende a <b style={eq}>frenar</b>.
      </HelpRow>
      <HelpRow term="Wall ↓ (soporte)" color={C.positive}>
        Strike con más GEX de <b style={eq}>puts</b>. Al acercarse, los dealers compran y el precio tiende a <b style={eq}>rebotar</b>.
      </HelpRow>
      <HelpRow term="Max Pain" color={C.info}>
        Strike donde <b style={eq}>más contratos expiran sin valor</b> (mínimo "dolor" para los compradores). El precio tiende a
        gravitar ahí cerca del vencimiento. Solo relevante con pocos DTE.
      </HelpRow>
      <HelpRow term="GEX neto" color={C.textPrimary}>
        Suma de todo el mapa. Positivo = devolatilizador global; negativo = volátil. Incluye el <b style={eq}>OI total</b> (contratos abiertos).
      </HelpRow>

      {/* Cómo leer cada gráfico */}
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', margin: '14px 0 2px' }}>LOS GRÁFICOS</div>
      <HelpRow term="Precio + niveles" color={C.accent}>
        Últimas 60 sesiones con los niveles gamma superpuestos: <b style={eq}>γFLIP</b> (ámbar), <b style={eq}>γWALL↑/↓</b> (violeta).
        Fíjate dónde está el precio respecto a esos niveles. <b style={eq}>Zoom:</b> rueda del ratón o botones −/+/⟲.
      </HelpRow>
      <HelpRow term="GEX por strike" color={C.accent}>
        Barras por strike: <b style={eq}>derecha (verde +)</b> = gamma neta positiva (imán), <b style={eq}>izquierda (rojo −)</b> = negativa (acelerador).
        El largo es la magnitud. Cada etiqueta trae el strike y su <b style={eq}>OI</b> (más OI = nivel más relevante; poco OI = ruido).
      </HelpRow>

      {/* Cómo usarlo */}
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', margin: '14px 0 2px' }}>CÓMO USARLO (heurística)</div>
      <ol style={{ margin: '2px 0 0', paddingLeft: '20px', color: C.textSecondary, fontSize: '12.5px', lineHeight: '1.7' }}>
        <li>Mira el <b style={eq}>régimen</b> y la distancia al flip.</li>
        <li>Define el <b style={eq}>rango</b>: Wall ↓ = suelo probable, Wall ↑ = techo probable.</li>
        <li><b style={eq}>Ruptura del flip</b> = cambio de régimen → más probabilidad de movimiento direccional.</li>
        <li>Cerca del vencimiento, <b style={eq}>Max Pain</b> actúa de imán.</li>
      </ol>

      <p style={{ margin: '14px 0 0', paddingTop: '10px', borderTop: '1px solid ' + C.borderLight, color: C.textMuted, fontSize: '11px', lineHeight: '1.55' }}>
        ⚠️ Es una guía de <i>estructura de mercado</i>, no una señal de entrada/salida. Datos de Yahoo + Massive (free tier), asume la
        convención dealers-largos-en-calls / cortos-en-puts, y analiza <b style={eq}>una expiración a la vez</b> (la del encabezado).
      </p>
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

  // Niveles clave con lenguaje llano (además del valor)
  const levels: { y: number | null; color: string; label: string; value: number | null }[] = [
    { y: yFor(flip), color: C.warning, label: 'Línea divisora', value: flip },
    { y: yFor(wallUp), color: C.negative, label: 'Upside target', value: wallUp },
    { y: yFor(wallDown), color: C.positive, label: 'Downside target', value: wallDown },
    { y: yFor(maxPain), color: C.info, label: 'Max pain', value: maxPain },
    { y: yFor(spot), color: C.accent, label: 'Spot', value: spot },
  ].filter((l) => l.y != null && l.value != null);

  // Zonas interpretadas: comportamiento esperado entre la divisora y los targets
  const yWallUp = yFor(wallUp);
  const yWallDown = yFor(wallDown);
  const yFlip = yFor(flip);
  const zones: { yTop: number; yBot: number; title: string; color: string }[] = [];
  if (yWallUp != null && yFlip != null && yFlip - yWallUp > 6)
    zones.push({ yTop: yWallUp, yBot: yFlip, title: 'Slow grind alcista', color: C.positive });
  if (yWallDown != null && yFlip != null && yWallDown - yFlip > 6)
    zones.push({ yTop: yFlip, yBot: yWallDown, title: 'Slow grind bajista', color: C.negative });

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} role="img" aria-label="GEX neto por strike">
        {/* alternating row bands */}
        {rows.map((_, i) =>
          i % 2 === 1 ? (
            <rect key={`bg${i}`} x={plotL - 6} y={padT + i * rowH} width={width - padL - 2} height={rowH} fill={C.bgElevated} opacity="0.5" />
          ) : null
        )}

        {/* zone tints (fondo por comportamiento esperado) */}
        {zones.map((z, i) => (
          <rect key={`zone${i}`} x={plotL - 6} y={z.yTop} width={width - padL - 2} height={Math.max(0, z.yBot - z.yTop)} fill={z.color} opacity="0.08" />
        ))}

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

        {/* zone labels (encima de las barras, con halo para legibilidad) */}
        {zones.map((z, i) => {
          if (z.yBot - z.yTop < 26) return null;
          const cx = plotL + (plotR - plotL) * 0.5;
          return (
            <text key={`zl${i}`} x={cx} y={(z.yTop + z.yBot) / 2 + 4} fontSize="12" fontWeight="800"
              fill={z.color} textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              stroke={C.bgCard} strokeWidth="4" strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>
              {z.title}
            </text>
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
