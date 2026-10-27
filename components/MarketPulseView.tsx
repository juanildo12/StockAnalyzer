'use client';

import { useCallback, useEffect, useState } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

// ── Tipos espejo del motor puro (src/lib/market/pulse.ts) ────────────────────

type PulseZone = 'extreme-fear' | 'fear' | 'neutral' | 'greed' | 'extreme-greed' | 'na';
type ComponentKey = 'momentum' | 'breadth' | 'volatility' | 'safeHaven' | 'credit' | 'hedge';

interface PulseComponent {
  key: ComponentKey;
  label: string;
  weight: number;
  score: number | null;
  valueLabel: string;
  detail: string;
  contribution: number | null;
  available: boolean;
}

interface PulsePoint { date: string; score: number }

interface BucketStat {
  bucket: string;
  min: number;
  max: number;
  samples: number;
  pUp: number | null;
  pDown: number | null;
  ci95: [number, number] | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  p10: number | null;
  p90: number | null;
}

interface HorizonForecast {
  horizon: number;
  bucket: string;
  samples: number;
  pUp: number | null;
  pDown: number | null;
  ci95: [number, number] | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  p10: number | null;
  p90: number | null;
  baselinePUp: number | null;
  edgePp: number | null;
}

interface MarketPulseResponse {
  asOf: string;
  score: number | null;
  zone: PulseZone;
  label: string;
  delta5d: number | null;
  delta21d: number | null;
  components: PulseComponent[];
  history: PulsePoint[];
  probabilities: HorizonForecast[];
  buckets: BucketStat[];
  baseline: { samples: number; pUp: number | null } | null;
  meta: {
    sessions: number;
    firstScoreDate: string | null;
    symbols: string[];
    missingSymbols: string[];
    normWindow: number;
    minHistory: number;
    dataQuality: number;
    warnings: string[];
  };
  source: string;
  updatedAt: string;
  cached?: boolean;
  notes: string[];
  error?: string;
  detail?: string;
}

const ZONE_COLOR: Record<PulseZone, string> = {
  'extreme-fear': '#ef4444',
  fear: '#f97316',
  neutral: '#eab308',
  greed: '#22c55e',
  'extreme-greed': '#16a34a',
  na: C.textMuted,
};

const ZONE_ORDER: PulseZone[] = ['extreme-fear', 'fear', 'neutral', 'greed', 'extreme-greed'];

const HORIZON_LABEL: Record<number, string> = {
  5: '1 semana',
  10: '2 semanas',
  21: '1 mes',
};

function fmt(v: number | null | undefined, digits = 0, suffix = '%'): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}${suffix}`;
}

function fmtSigned(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;
}

function fmtDate(d: string): string {
  try {
    return new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return d;
  }
}

function polar(cx: number, cy: number, r: number, value: number) {
  const angle = Math.PI - (value / 100) * Math.PI;
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 50 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

function Gauge({ score, zone }: { score: number | null; zone: PulseZone }) {
  const cx = 150;
  const cy = 138;
  const r = 110;
  const color = ZONE_COLOR[zone];
  return (
    <svg width="300" height="158" viewBox="0 0 300 158" role="img" aria-label={`Índice ${score ?? 'sin datos'}`}>
      {ZONE_ORDER.map((z, i) => (
        <path
          key={z}
          d={arcPath(cx, cy, r, i * 20, (i + 1) * 20)}
          fill="none"
          stroke={ZONE_COLOR[z]}
          strokeWidth={12}
          strokeLinecap="butt"
          opacity={0.28}
        />
      ))}
      {score != null && (
        <>
          <path
            d={arcPath(cx, cy, r, 0, Math.max(0, Math.min(100, score)))}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
          />
          {(() => {
            const p = polar(cx, cy, r, Math.max(0, Math.min(100, score)));
            return <circle cx={p.x} cy={p.y} r={7} fill={color} stroke={C.bg} strokeWidth={2} />;
          })()}
        </>
      )}
      <text x={cx} y={cy - 24} textAnchor="middle" fontSize="46" fontWeight="800" fill={color}>
        {score == null ? '—' : score.toFixed(0)}
      </text>
      <text x={20} y={cy + 14} fontSize="11" fill={C.textMuted}>Miedo</text>
      <text x={280} y={cy + 14} fontSize="11" fill={C.textMuted} textAnchor="end">Codicia</text>
    </svg>
  );
}

function Sparkline({ history }: { history: PulsePoint[] }) {
  const pts = history.slice(-504);
  if (pts.length < 2) return null;
  const w = 560;
  const h = 120;
  const pad = 4;
  const min = 0;
  const max = 100;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(pts.length - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Histórico del índice">
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      <line x1={pad} x2={w - pad} y1={y(80)} y2={y(80)} stroke="#ef444455" strokeDasharray="3 4" />
      <line x1={pad} x2={w - pad} y1={y(20)} y2={y(20)} stroke="#22c55e55" strokeDasharray="3 4" />
      <line x1={pad} x2={w - pad} y1={y(50)} y2={y(50)} stroke={C.border} strokeDasharray="2 5" />
      <path d={area} fill={C.textMuted} opacity={0.08} />
      <path d={path} fill="none" stroke={C.textSecondary} strokeWidth={1.6} />
      <circle cx={x(pts.length - 1)} cy={y(last.score)} r={3.5} fill={ZONE_COLOR[zoneOf(last.score)]} />
    </svg>
  );
}

function zoneOf(score: number): PulseZone {
  if (score < 20) return 'extreme-fear';
  if (score < 40) return 'fear';
  if (score < 60) return 'neutral';
  if (score < 80) return 'greed';
  return 'extreme-greed';
}

function ProbBar({ pUp, pDown }: { pUp: number | null; pDown: number | null }) {
  const up = Math.max(0, Math.min(100, pUp ?? 0));
  const down = Math.max(0, Math.min(100, pDown ?? 0));
  const flat = Math.max(0, 100 - up - down);
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: R.full, overflow: 'hidden', background: C.border, marginTop: S.xs }}>
      <div style={{ width: `${up}%`, background: '#22c55e' }} />
      <div style={{ width: `${flat}%`, background: C.textMuted, opacity: 0.45 }} />
      <div style={{ width: `${down}%`, background: '#ef4444' }} />
    </div>
  );
}

function ProbCard({ p }: { p: HorizonForecast }) {
  const label = HORIZON_LABEL[p.horizon] ?? `${p.horizon} sesiones`;
  const edge = p.edgePp;
  return (
    <div style={{ flex: '1 1 220px', minWidth: 200, padding: S.md, border: `1px solid ${C.border}`, borderRadius: R.md, background: C.bgElevated ?? 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: S.sm }}>
        <span style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>{label}</span>
        <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{p.horizon} sesiones</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: '#22c55e' }}>{fmt(p.pUp, 0)}</span>
        <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>al alza</span>
        <span style={{ marginLeft: 'auto', fontSize: F.sizeSm, fontWeight: 700, color: '#ef4444' }}>{fmt(p.pDown, 0)}</span>
        <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>a la baja</span>
      </div>
      <ProbBar pUp={p.pUp} pDown={p.pDown} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.xs, marginTop: S.sm, fontSize: F.sizeXs, color: C.textSecondary }}>
        <span>Muestra</span>
        <span style={{ textAlign: 'right', color: C.textPrimary, fontWeight: 600 }}>{p.samples} días</span>
        <span>IC 95%</span>
        <span style={{ textAlign: 'right', color: C.textPrimary, fontWeight: 600 }}>
          {p.ci95 ? `${p.ci95[0].toFixed(0)}–${p.ci95[1].toFixed(0)}%` : '—'}
        </span>
        <span>Retorno medio</span>
        <span style={{ textAlign: 'right', color: C.textPrimary, fontWeight: 600 }}>{fmt(p.avgReturnPct, 1)}</span>
        <span>Retorno mediano</span>
        <span style={{ textAlign: 'right', color: C.textPrimary, fontWeight: 600 }}>{fmt(p.medianReturnPct, 1)}</span>
        <span>Base incondicional</span>
        <span style={{ textAlign: 'right', color: C.textPrimary, fontWeight: 600 }}>{fmt(p.baselinePUp, 0)}</span>
      </div>
      {edge != null && (
        <div style={{ marginTop: S.xs, fontSize: F.sizeXs, color: edge >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {edge >= 0 ? '▲' : '▼'} {Math.abs(edge).toFixed(1)} pp vs base incondicional
        </div>
      )}
    </div>
  );
}

function ComponentRow({ c }: { c: PulseComponent }) {
  const color = c.score == null ? C.textMuted : c.score >= 60 ? '#22c55e' : c.score < 40 ? '#ef4444' : C.warning;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.1fr) minmax(120px, 1fr) 64px', gap: S.sm, alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>{c.label}</div>
        <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>{c.valueLabel}</div>
      </div>
      <div>
        <div style={{ height: 8, borderRadius: R.full, background: C.border, overflow: 'hidden' }}>
          <div style={{ width: `${c.score ?? 0}%`, height: '100%', background: color, opacity: c.available ? 1 : 0.25 }} />
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{c.detail}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: F.sizeSm, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{c.score == null ? '—' : c.score.toFixed(0)}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>peso {Math.round(c.weight * 100)}%</div>
      </div>
    </div>
  );
}

export default function MarketPulseView() {
  const [data, setData] = useState<MarketPulseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/market-pulse${force ? '?force=1' : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar el Market Pulse');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const head = data?.score != null ? data : null;
  const color = head ? ZONE_COLOR[head.zone] : C.textMuted;
  const horizons = head?.probabilities.map((x) => x.horizon) ?? [21];
  const main = head?.probabilities.find((p) => p.horizon === Math.max(...horizons));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '4px 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.md, flexWrap: 'wrap', marginBottom: S.lg }}>
        <div style={{ flex: '1 1 320px' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Market Pulse</h1>
          <p style={{ color: C.textSecondary, fontSize: F.sizeSm, margin: '4px 0 0', lineHeight: 1.5 }}>
            Índice tipo <strong>Fear &amp; Greed</strong> y probabilidad histórica de que el S&amp;P suba o baje,
            condicionada al estado actual del mercado.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          {data && <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>Datos al {fmtDate(data.asOf)}</span>}
          <button
            onClick={() => load(true)}
            disabled={loading}
            style={{ padding: '7px 13px', borderRadius: R.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, fontSize: F.sizeXs, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: S.md, borderRadius: R.md, border: `1px solid ${C.negative}44`, background: C.negative + '11', color: C.negative, fontSize: F.sizeSm, marginBottom: S.md }}>
          {error}
        </div>
      )}

      {!data && loading && (
        <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: F.sizeSm }}>Calculando el índice con datos diarios…</div>
      )}

      {data && data.score == null && (
        <div style={{ padding: S.md, borderRadius: R.md, border: `1px solid ${C.warning}44`, background: C.warning + '11', color: C.warning, fontSize: F.sizeSm, marginBottom: S.md }}>
          No hay datos suficientes para calcular el índice. {data.meta.warnings.join(' ')}
        </div>
      )}

      {head && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) minmax(280px, 1fr)', gap: S.md, marginBottom: S.md }}>
            <div style={{ padding: S.md, border: `1px solid ${C.border}`, borderRadius: R.lg, background: color + '0A' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: S.sm }}>
                <span style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textSecondary }}>Índice actual</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: R.full, background: color + '22', color, border: `1px solid ${color}55` }}>
                  {head.label}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Gauge score={head.score} zone={head.zone} />
              </div>
              <div style={{ display: 'flex', gap: S.sm, justifyContent: 'center', flexWrap: 'wrap', marginTop: -4 }}>
                <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>
                  5d <strong style={{ color: (head.delta5d ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>{fmtSigned(head.delta5d)}</strong>
                </span>
                <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>
                  1m <strong style={{ color: (head.delta21d ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>{fmtSigned(head.delta21d)}</strong>
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 6 }}>
                0 = miedo extremo · 100 = codicia extrema
              </div>
            </div>

            <div style={{ padding: S.md, border: `1px solid ${C.border}`, borderRadius: R.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: S.sm, flexWrap: 'wrap' }}>
                <span style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>Probabilidad histórica condicional</span>
                <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>bucket {head.score == null ? '—' : head.score.toFixed(0)} · n={main?.samples ?? 0}</span>
              </div>
              <p style={{ margin: '4px 0 10px', fontSize: F.sizeXs, color: C.textSecondary, lineHeight: 1.5 }}>
                Días históricos con un índice en el mismo rango ({main?.bucket ?? '—'}) y lo que hizo el S&amp;P
                en las siguientes sesiones. Es una frecuencia, no una predicción.
              </p>
              <div style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap' }}>
                {head.probabilities.map((p) => <ProbCard key={p.horizon} p={p} />)}
              </div>
              <div style={{ marginTop: S.sm, fontSize: F.sizeXs, color: C.textMuted }}>
                Base incondicional (todos los días) del horizonte principal: {fmt(main?.baselinePUp, 0)} al alza
                {main && main.samples < 30 ? ' · muestra pequeña: interpreta con cautela' : ''}.
              </div>
            </div>
          </div>

          <div style={{ padding: S.md, border: `1px solid ${C.border}`, borderRadius: R.lg, marginBottom: S.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: S.sm, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>Evolución del índice (2 años)</span>
              <span style={{ fontSize: 10, color: C.textMuted }}>líneas: 20 / 50 / 80 · punto = hoy</span>
            </div>
            <Sparkline history={head.history} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.35fr) minmax(280px, 1fr)', gap: S.md }}>
            <div style={{ padding: S.md, border: `1px solid ${C.border}`, borderRadius: R.lg }}>
              <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary, marginBottom: S.xs }}>Componentes</div>
              <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: S.sm }}>
                Cada componente se normaliza con su percentil de los últimos {head.meta.normWindow} días;
                100 = codicia. Calidad de datos: {head.meta.dataQuality}%.
              </div>
              {head.components.map((c) => <ComponentRow key={c.key} c={c} />)}
              {head.meta.warnings.length > 0 && (
                <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18, color: C.warning, fontSize: F.sizeXs, lineHeight: 1.6 }}>
                  {head.meta.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>

            <div style={{ padding: S.md, border: `1px solid ${C.border}`, borderRadius: R.lg }}>
              <div style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>Histórico por nivel del índice</div>
              <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: S.sm }}>
                S&amp;P en las {main?.horizon ?? 21} sesiones siguientes. El sombreado marca el rango actual.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeXs }}>
                  <thead>
                    <tr style={{ color: C.textMuted, textAlign: 'right' }}>
                      <th style={{ textAlign: 'left', padding: '5px 4px', fontWeight: 600 }}>Rango</th>
                      <th style={{ padding: '5px 4px', fontWeight: 600 }}>n</th>
                      <th style={{ padding: '5px 4px', fontWeight: 600 }}>Al alza</th>
                      <th style={{ padding: '5px 4px', fontWeight: 600 }}>Ret. medio</th>
                      <th style={{ padding: '5px 4px', fontWeight: 600 }}>p10–p90</th>
                    </tr>
                  </thead>
                  <tbody>
                    {head.buckets.map((b) => {
                      const isCurrent = b.bucket === main?.bucket;
                      return (
                        <tr key={b.bucket} style={{ background: isCurrent ? color + '18' : 'transparent', color: C.textSecondary }}>
                          <td style={{ padding: '6px 4px', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? C.textPrimary : C.textSecondary }}>
                            {b.bucket}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.samples}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (b.pUp ?? 0) >= 50 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                            {fmt(b.pUp, 0)}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.avgReturnPct, 1)}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.textMuted }}>
                            {fmt(b.p10, 1)} … {fmt(b.p90, 1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: S.sm, fontSize: F.sizeXs, color: C.textSecondary, lineHeight: 1.5 }}>
                Si el patrón histórico se rompe (por ejemplo, en una crisis con el índice «neutral»), esta tabla
                lo hará evidente: no se oculta.
              </div>
            </div>
          </div>

          <div style={{ marginTop: S.md, padding: S.md, borderRadius: R.md, border: `1px dashed ${C.border}`, background: C.bgElevated ?? 'transparent' }}>
            <div style={{ fontSize: F.sizeXs, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>Cómo leerlo</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: F.sizeXs, color: C.textSecondary, lineHeight: 1.65 }}>
              {head.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            <div style={{ marginTop: S.sm, fontSize: 10, color: C.textMuted }}>
              Fuente: {head.source}. {head.cached ? 'Respuesta cacheada. ' : ''}Actualizado {new Date(head.updatedAt).toLocaleString('es-ES')}.
              No es asesoramiento financiero.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
