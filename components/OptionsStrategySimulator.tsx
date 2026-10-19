'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import {
  MULTIPLIER,
  expiryPnl,
  markToMarketPnl,
  aggregateGreeks,
  payoffCurve,
  mtmCurve,
  riskProfile,
  type StrategyLeg,
  type SimInput,
  type PayoffPoint,
} from '@/src/lib/options/strategy';
import { scenarioMatrix, ivCrush, DEFAULT_IV_SHIFTS } from '@/src/lib/options/whatif';
import { PRESETS, buildPresetLegs, getPreset, type PresetContext } from '@/src/lib/options/presets';

interface SimContract {
  strike: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  mid: number;
  last: number;
  iv: number;
  volume: number;
  openInterest: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  inTheMoney: boolean;
}

interface SimExpiration {
  date: string;
  dte: number;
  calls: SimContract[];
  puts: SimContract[];
}

interface SimResponse {
  symbol: string;
  spot: number;
  asOf: number;
  marketState?: string;
  priceBasis?: 'pre' | 'post' | 'regular';
  expirations: SimExpiration[];
  source: string;
  error?: string;
}

interface Props {
  initialSymbol?: string;
}

const fmtUsd = (v: number) =>
  (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtMoney2 = (v: number) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function OptionsStrategySimulator({ initialSymbol = 'SPY' }: Props) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [input, setInput] = useState(initialSymbol.toUpperCase());
  const [data, setData] = useState<SimResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expiryIdx, setExpiryIdx] = useState(0);
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [style, setStyle] = useState<'european' | 'american'>('american');
  const [crushPct, setCrushPct] = useState(0.4);
  const [elapsedDte, setElapsedDte] = useState(0);

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/options-sim?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json && !json.error) {
        setData(json);
        setExpiryIdx(0);
      } else {
        setError(json?.error || 'Sin datos');
        setData(null);
      }
    } catch {
      setError('Error cargando la cadena de opciones');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(symbol); }, [symbol, fetchData]);

  const exp = data?.expirations && data.expirations.length > 0
    ? data.expirations[Math.min(expiryIdx, data.expirations.length - 1)]
    : null;
  const spot = data?.spot ?? 0;

  const quote = useCallback(
    (type: 'call' | 'put', strike: number, e: SimExpiration | null): SimContract | null => {
      if (!e) return null;
      const arr = type === 'call' ? e.calls : e.puts;
      return arr.find((c) => Math.abs(c.strike - strike) < 1e-6) || null;
    },
    []
  );

  // Re-price existing legs when symbol/expiry/style changes (keep structure).
  const applyPreset = useCallback(
    (presetId: string) => {
      if (!exp) return;
      const preset = getPreset(presetId);
      if (!preset) return;
      const ctx: PresetContext = {
        spot,
        dte: exp.dte,
        quote: (type, strike) => {
          const q = quote(type, strike, exp);
          if (!q) return null;
          return { strike: q.strike, premium: q.mid || q.last, iv: q.iv > 0 ? q.iv : 0.3 };
        },
      };
      const built = buildPresetLegs(preset, ctx, style);
      if (built.length === 0) {
        setError('Los strikes del preset no existen en esta cadena');
        return;
      }
      setError(null);
      setLegs(built);
      setElapsedDte(0);
    },
    [exp, spot, style, quote]
  );

  const updateLeg = (i: number, patch: Partial<StrategyLeg>) => {
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, idx) => idx !== i));
  const addLeg = () => {
    if (!exp) return;
    const atm = quote('call', nearestStrike(exp.calls, spot), exp);
    setLegs((prev) => [
      ...prev,
      {
        type: 'call',
        side: 'long',
        qty: 1,
        strike: atm?.strike ?? nearestStrike(exp.calls, spot),
        premium: atm ? (atm.mid || atm.last) : 0,
        iv: atm && atm.iv > 0 ? atm.iv : 0.3,
        dte: exp.dte,
        style,
      },
    ]);
  };

  // When the expiry changes, refresh each leg's premium/IV/dte to the new chain.
  useEffect(() => {
    if (!exp) return;
    setLegs((prev) =>
      prev.map((l) => {
        const q = quote(l.type, l.strike, exp);
        return {
          ...l,
          dte: exp.dte,
          style,
          premium: q ? (q.mid || q.last) : l.premium,
          iv: q && q.iv > 0 ? q.iv : l.iv,
        };
      })
    );
  }, [expiryIdx, exp, style, quote]);

  const simInput: SimInput = useMemo(() => ({ spot, legs }), [spot, legs]);

  const expiryCurve = useMemo(() => (legs.length ? payoffCurve(legs, spot, 161, 0.5) : []), [legs, spot]);
  const remainDte = exp ? Math.max(exp.dte - elapsedDte, 0) : 0;
  const mtm = useMemo(
    () => (legs.length && data ? mtmCurve(simInput, { remainingDte: remainDte, points: 161, rangePct: 0.5 }) : []),
    [simInput, legs.length, data, remainDte]
  );
  const greeks = useMemo(() => (legs.length ? aggregateGreeks(simInput) : null), [simInput, legs.length]);
  const risk = useMemo(() => (legs.length ? riskProfile(simInput) : null), [simInput, legs.length]);
  const crush = useMemo(
    () => (legs.length ? ivCrush(simInput, crushPct, { elapsedDte }) : null),
    [simInput, legs.length, crushPct, elapsedDte]
  );
  const matrix = useMemo(
    () => (legs.length ? scenarioMatrix(simInput, { elapsedDte }) : null),
    [simInput, legs.length, elapsedDte]
  );

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '20px', marginBottom: S.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: C.textPrimary, fontSize: 18, fontWeight: 700 }}>🎛 Simulador de Estrategias de Opciones</h2>
          <span style={{ color: C.textMuted, fontSize: 12 }}>Payoff · Griegos · What-if · IV Crush</span>
        </div>
        <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 12 }}>
          Modela posiciones multi-pata y analízalas antes de operar. Solo análisis — esta herramienta no ejecuta órdenes.
          Los precios de la cadena son referencias (mid), no garantías de ejecución.
        </p>
        <div style={{ display: 'flex', gap: S.sm, marginTop: S.md, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) setSymbol(input.trim()); }}
            placeholder="Símbolo (ej. AAPL)"
            style={{ background: C.bgInput, border: '1px solid ' + C.border, borderRadius: R.sm, color: C.textPrimary, padding: '8px 12px', fontSize: 13, width: 140 }}
          />
          <button onClick={() => input.trim() && setSymbol(input.trim())} style={btnPrimary}>Cargar</button>
          {data && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 8 }}>
              <span style={{ color: C.textPrimary, fontSize: 13, fontWeight: 600 }}>{data.symbol}</span>
              <span style={{ color: C.textSecondary, fontSize: 13 }}>Spot {fmtMoney2(spot)}</span>
              {data.priceBasis && data.priceBasis !== 'regular' && (
                <span style={chip(data.priceBasis === 'pre' ? C.info : C.warning)}>
                  {data.priceBasis === 'pre' ? 'pre-market' : 'post-market'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && <Shell text="Cargando cadena de opciones..." />}
      {!loading && error && <Shell text={error} onRetry={() => fetchData(symbol)} />}
      {!loading && !error && data && !exp && <Shell text="Sin expiraciones disponibles" />}

      {!loading && !error && exp && (
        <>
          {/* Config card */}
          <div style={card}>
            <SectionTitle title="1 · Estrategia" />
            <div style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap', marginBottom: S.md }}>
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => applyPreset(p.id)} style={presetBtn(p.bias)} title={p.name}>
                  {p.nameEs}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: S.md, flexWrap: 'wrap', alignItems: 'center', marginBottom: S.md }}>
              <label style={labelStyle}>
                Vencimiento
                <select
                  value={expiryIdx}
                  onChange={(e) => setExpiryIdx(Number(e.target.value))}
                  style={selectStyle}
                >
                  {data!.expirations.map((e, i) => (
                    <option key={e.date} value={i}>{e.date} · {e.dte}d</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Estilo
                <select value={style} onChange={(e) => setStyle(e.target.value as any)} style={selectStyle}>
                  <option value="american">Americana (binomial)</option>
                  <option value="european">Europea (BSM)</option>
                </select>
              </label>
            </div>

            {/* Legs table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.textMuted, textAlign: 'left' }}>
                    <th style={th}>Lado</th>
                    <th style={th}>Tipo</th>
                    <th style={th}>Strike</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Prima</th>
                    <th style={th}>IV</th>
                    <th style={th}>DTE</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((l, i) => (
                    <tr key={i} style={{ borderTop: '1px solid ' + C.border }}>
                      <td style={td}>
                        <select value={l.side} onChange={(e) => updateLeg(i, { side: e.target.value as any })} style={inlineSelect}>
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </td>
                      <td style={td}>
                        <select value={l.type} onChange={(e) => updateLeg(i, { type: e.target.value as any })} style={inlineSelect}>
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                        </select>
                      </td>
                      <td style={td}>
                        <input type="number" value={l.strike} step="1"
                          onChange={(e) => updateLeg(i, { strike: Number(e.target.value) })} style={numInput} />
                      </td>
                      <td style={td}>
                        <input type="number" value={l.qty} min={1} step="1"
                          onChange={(e) => updateLeg(i, { qty: Math.max(1, Number(e.target.value)) })} style={numInput} />
                      </td>
                      <td style={td}>
                        <input type="number" value={l.premium} step="0.05"
                          onChange={(e) => updateLeg(i, { premium: Number(e.target.value) })} style={numInput} />
                      </td>
                      <td style={td}>
                        <input type="number" value={l.iv} step="0.01" min={0.01} max={5}
                          onChange={(e) => updateLeg(i, { iv: Number(e.target.value) })} style={numInput} />
                      </td>
                      <td style={{ ...td, color: C.textSecondary }}>{l.dte}</td>
                      <td style={td}>
                        <button onClick={() => removeLeg(i)} style={iconBtn}>×</button>
                      </td>
                    </tr>
                  ))}
                  {legs.length === 0 && (
                    <tr><td colSpan={8} style={{ ...td, color: C.textMuted, padding: '16px 8px' }}>
                      Elige un preset o añade patas manualmente.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={addLeg} style={{ ...btnGhost, marginTop: S.sm }}>+ Añadir pata</button>
          </div>

          {legs.length > 0 && (
            <>
              {/* Payoff chart */}
              <div style={{ ...card, marginTop: S.md }}>
                <SectionTitle title="2 · Payoff y P&L" />
                <PayoffChart
                  spot={spot}
                  expiry={expiryCurve}
                  mtm={mtm}
                  showMtm={remainDte > 0}
                  breakevens={risk?.breakevens ?? []}
                  strikes={legs.map((l) => l.strike)}
                />
                <div style={{ display: 'flex', gap: S.md, marginTop: S.md, flexWrap: 'wrap' }}>
                  <Legend color={C.accent} label="P&L al vencimiento" />
                  {remainDte > 0 && <Legend color={C.info} label={`P&L hoy (-${elapsedDte}d)`} dashed />}
                </div>
                {remainDte > 0 && (
                  <div style={{ marginTop: S.md }}>
                    <label style={{ ...labelStyle, width: '100%' }}>
                      Días transcurridos: <strong style={{ color: C.textPrimary }}>{elapsedDte}</strong> de {exp.dte} (quedan {remainDte})
                      <input type="range" min={0} max={Math.max(exp.dte - 1, 0)} value={elapsedDte}
                        onChange={(e) => setElapsedDte(Number(e.target.value))} style={{ width: '100%', marginTop: 6 }} />
                    </label>
                  </div>
                )}
              </div>

              {/* Risk + Greeks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: S.md, marginTop: S.md }}>
                <div style={card}>
                  <SectionTitle title="3 · Perfil de riesgo" />
                  <Row label={risk!.kind === 'credit' ? 'Crédito neto' : risk!.kind === 'debit' ? 'Débito neto' : 'Cashflow neto'}
                    value={fmtUsd(Math.abs(risk!.netCashflow))}
                    color={risk!.kind === 'credit' ? C.positive : C.textPrimary} />
                  <Row label="Beneficio máximo" value={risk!.maxProfit == null ? 'Ilimitado' : fmtUsd(risk!.maxProfit)}
                    color={risk!.maxProfit == null ? C.positive : C.positive} />
                  <Row label="Pérdida máxima" value={risk!.maxLoss == null ? 'Ilimitada' : fmtUsd(risk!.maxLoss)}
                    color={C.negative} />
                  <Row label="Breakevens" value={risk!.breakevens.length ? risk!.breakevens.map(fmtMoney2).join('  ·  ') : '—'} />
                  <Row label="Margen estimado" value={fmtUsd(risk!.estimatedMargin)} />
                  <div style={{ marginTop: 8, color: C.textMuted, fontSize: 11 }}>
                    Margen estimado propio (Reg-T aproximado), separado del margen que exija tu bróker.
                  </div>
                </div>

                <div style={card}>
                  <SectionTitle title="4 · Griegos agregados" />
                  {greeks && (
                    <>
                      <Row label="Delta" value={(greeks.delta).toFixed(1)} color={greeks.delta >= 0 ? C.positive : C.negative} />
                      <Row label="Gamma" value={(greeks.gamma).toFixed(1)} />
                      <Row label="Theta (por día)" value={fmtUsd(greeks.theta)} color={greeks.theta >= 0 ? C.positive : C.negative} />
                      <Row label="Vega (por 1pp IV)" value={fmtUsd(greeks.vega)} />
                      <Row label="Rho (por 1pp tipo)" value={fmtUsd(greeks.rho)} />
                      <div style={{ marginTop: 8, color: C.textMuted, fontSize: 11 }}>
                        Escalados a la posición (qty × 100 acciones). Theta por día, vega/rho por 1 punto.
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* IV crush */}
              <div style={{ ...card, marginTop: S.md }}>
                <SectionTitle title="5 · IV Crush" />
                <div style={{ display: 'flex', gap: S.md, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={labelStyle}>
                    Caída de IV
                    <span style={{ color: C.accent, fontWeight: 700 }}>{fmtPct(crushPct)}</span>
                    <input type="range" min={0} max={0.9} step={0.05} value={crushPct}
                      onChange={(e) => setCrushPct(Number(e.target.value))} style={{ width: 180 }} />
                  </label>
                  {crush && (
                    <div style={{ display: 'flex', gap: S.lg, flexWrap: 'wrap' }}>
                      <div><div style={miniLabel}>IV actual</div><div style={miniVal}>{fmtPct(crush.preIv)}</div></div>
                      <div><div style={miniLabel}>IV post-evento</div><div style={miniVal}>{fmtPct(crush.postIv)}</div></div>
                      <div><div style={miniLabel}>P&L antes</div><div style={miniVal}>{fmtUsd(crush.pnlBefore)}</div></div>
                      <div><div style={miniLabel}>P&L después</div><div style={miniVal}>{fmtUsd(crush.pnlAfter)}</div></div>
                      <div>
                        <div style={miniLabel}>Impacto</div>
                        <div style={{ ...miniVal, color: crush.delta >= 0 ? C.positive : C.negative }}>
                          {crush.delta >= 0 ? '+' : ''}{fmtUsd(crush.delta)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, color: C.textMuted, fontSize: 11 }}>
                  Escenario: spot sin cambios, IV colapsa tras el evento. Posiciones netas long-vol pierden; short-vol ganan.
                </div>
              </div>

              {/* What-if matrix */}
              {matrix && (
                <div style={{ ...card, marginTop: S.md }}>
                  <SectionTitle title="6 · Matriz What-if (P&L)" />
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, position: 'sticky', left: 0, background: C.bgCard }}>Spot ↓ / IV →</th>
                          {matrix.ivShifts.map((iv) => (
                            <th key={iv} style={th}>{iv >= 0 ? '+' : ''}{(iv * 100).toFixed(0)}pp</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.matrix.map((row, i) => (
                          <tr key={i}>
                            <td style={{ ...td, fontWeight: 600, color: C.textSecondary, position: 'sticky', left: 0, background: C.bgCard }}>
                              {matrix.spotShifts[i] >= 0 ? '+' : ''}{(matrix.spotShifts[i] * 100).toFixed(0)}% ({fmtMoney2(spot * (1 + matrix.spotShifts[i]))})
                            </td>
                            {row.map((cell, j) => (
                              <td key={j} style={{
                                ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                color: cell.pnl >= 0 ? C.positive : C.negative,
                                background: cell.pnl >= 0 ? C.positive06 : C.negative06,
                                borderTop: '1px solid ' + C.border,
                              }}>
                                {fmtUsd(cell.pnl)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 8, color: C.textMuted, fontSize: 11 }}>
                    A {elapsedDte} día(s) transcurrido(s) · quedan {matrix.remainingDte}d. Valoración mark-to-market a cada spot/IV.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── helpers / subcomponents ────────────────────────────────────────────────

function nearestStrike(contracts: SimContract[], spot: number): number {
  if (!contracts.length) return spot;
  return contracts.reduce((b, c) => (Math.abs(c.strike - spot) < Math.abs(b.strike - spot) ? c : b), contracts[0]).strike;
}

function Shell({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 32 }}>
      <div style={{ color: C.textMuted, fontSize: 14 }}>{text}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ ...btnPrimary, marginTop: 12 }}>Reintentar</button>
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: 14, fontWeight: 700 }}>{title}</h3>;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid ' + C.border }}>
      <span style={{ color: C.textSecondary, fontSize: 13 }}>{label}</span>
      <span style={{ color: color || C.textPrimary, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dashed ? '4 3' : undefined} /></svg>
      <span style={{ color: C.textSecondary, fontSize: 11 }}>{label}</span>
    </div>
  );
}

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function PayoffChart({
  spot, expiry, mtm, showMtm, breakevens, strikes,
}: {
  spot: number;
  expiry: PayoffPoint[];
  mtm: PayoffPoint[];
  showMtm: boolean;
  breakevens: number[];
  strikes: number[];
}) {
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const width = Math.max(420, Math.round(measured)) || 720;
  const height = 300;
  const padL = 60, padR = 16, padT = 16, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const all = showMtm ? [...expiry, ...mtm] : expiry;
  if (all.length === 0) return <div ref={wrapRef} style={{ height }} />;

  const xs = all.map((p) => p.spot);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...all.map((p) => p.pnl), 0);
  const yMax = Math.max(...all.map((p) => p.pnl), 0);
  const xScale = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const yScale = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const invX = (px: number) => xMin + ((px - padL) / innerW) * (xMax - xMin);

  const path = (pts: PayoffPoint[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.spot).toFixed(1)},${yScale(p.pnl).toFixed(1)}`).join(' ');

  /** P&L interpolation at a given spot (curves are sorted by spot). */
  const interp = (pts: PayoffPoint[], s: number): number => {
    if (pts.length === 0) return 0;
    if (s <= pts[0].spot) return pts[0].pnl;
    if (s >= pts[pts.length - 1].spot) return pts[pts.length - 1].pnl;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (s >= a.spot && s <= b.spot) {
        const t = (s - a.spot) / (b.spot - a.spot || 1);
        return a.pnl + t * (b.pnl - a.pnl);
      }
    }
    return pts[pts.length - 1].pnl;
  };

  const clampX = (px: number) => Math.max(padL, Math.min(width - padR, px));
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = width / rect.width;
    setHoverX(clampX((e.clientX - rect.left) * scale));
  };
  const onLeave = () => setHoverX(null);

  const yZero = yScale(0);
  const xTicks = 5;
  const yTicks = 5;

  const hoverSpot = hoverX != null ? invX(hoverX) : null;
  const hoverExpiry = hoverSpot != null ? interp(expiry, hoverSpot) : 0;
  const hoverMtm = hoverSpot != null && showMtm ? interp(mtm, hoverSpot) : 0;
  const tipW = 150, tipH = showMtm ? 66 : 44;
  let tipX = (hoverX ?? 0) + 12;
  if (tipX + tipW > width - padR) tipX = (hoverX ?? 0) - tipW - 12;

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg
        width={width} height={height} viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', cursor: 'crosshair' }}
        role="img" aria-label="Curva de payoff"
        onMouseMove={onMove} onMouseLeave={onLeave}
      >
        {/* grid */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = yMin + ((yMax - yMin) * i) / yTicks;
          const y = yScale(v);
          return (
            <g key={'y' + i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.border} strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fill={C.textMuted} fontSize={10}>{fmtUsd(v)}</text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }).map((_, i) => {
          const v = xMin + ((xMax - xMin) * i) / xTicks;
          const x = xScale(v);
          return (
            <text key={'x' + i} x={x} y={height - 8} textAnchor="middle" fill={C.textMuted} fontSize={10}>{fmtMoney2(v)}</text>
          );
        })}

        {/* zero line */}
        <line x1={padL} y1={yZero} x2={width - padR} y2={yZero} stroke={C.textMuted} strokeWidth={1} strokeDasharray="3 3" />

        {/* spot marker */}
        <line x1={xScale(spot)} y1={padT} x2={xScale(spot)} y2={height - padB} stroke={C.textSecondary} strokeWidth={1} strokeDasharray="2 3" />
        <text x={xScale(spot)} y={padT + 10} textAnchor="middle" fill={C.textSecondary} fontSize={10}>spot</text>

        {/* breakevens */}
        {breakevens.map((be, i) => (
          <g key={'be' + i}>
            <line x1={xScale(be)} y1={padT} x2={xScale(be)} y2={height - padB} stroke={C.warning} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
            <text x={xScale(be)} y={height - 8} textAnchor="middle" fill={C.warning} fontSize={9}>{fmtMoney2(be)}</text>
          </g>
        ))}

        {/* strikes */}
        {strikes.map((k, i) => (
          <line key={'k' + i} x1={xScale(k)} y1={padT} x2={xScale(k)} y2={height - padB} stroke={C.borderHover} strokeWidth={1} opacity={0.5} />
        ))}

        {/* curves */}
        {showMtm && <path d={path(mtm)} fill="none" stroke={C.info} strokeWidth={2} strokeDasharray="5 4" />}
        <path d={path(expiry)} fill="none" stroke={C.accent} strokeWidth={2.5} />

        {/* hover crosshair + tooltip */}
        {hoverSpot != null && (
          <g pointerEvents="none">
            <line x1={hoverX!} y1={padT} x2={hoverX!} y2={height - padB} stroke={C.accentLight} strokeWidth={1} opacity={0.8} />
            <circle cx={xScale(hoverSpot)} cy={yScale(hoverExpiry)} r={3.5} fill={C.accent} />
            {showMtm && <circle cx={xScale(hoverSpot)} cy={yScale(hoverMtm)} r={3.5} fill={C.info} />}
            <rect x={tipX} y={padT + 4} width={tipW} height={tipH} rx={6}
              fill={C.bgElevated} stroke={C.borderHover} strokeWidth={1} opacity={0.97} />
            <text x={tipX + 10} y={padT + 22} fill={C.textPrimary} fontSize={11} fontWeight={700}>
              Spot {fmtMoney2(hoverSpot)}
            </text>
            <text x={tipX + 10} y={padT + 38} fill={C.accent} fontSize={11}>
              Vencimiento: {fmtUsd(hoverExpiry)}
            </text>
            {showMtm && (
              <text x={tipX + 10} y={padT + 54} fill={C.info} fontSize={11}>
                Hoy: {fmtUsd(hoverMtm)}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: 20,
};
const btnPrimary: React.CSSProperties = {
  background: C.accent, color: '#04211D', border: 'none', borderRadius: R.sm, padding: '8px 16px',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: C.accent, border: '1px solid ' + C.accentBorder, borderRadius: R.sm,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', color: C.negative, border: 'none', fontSize: 18, cursor: 'pointer', lineHeight: 1,
};
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, color: C.textSecondary, fontSize: 12,
};
const selectStyle: React.CSSProperties = {
  background: C.bgInput, border: '1px solid ' + C.border, borderRadius: R.sm, color: C.textPrimary,
  padding: '6px 10px', fontSize: 13, minWidth: 160,
};
const inlineSelect: React.CSSProperties = {
  background: C.bgInput, border: '1px solid ' + C.border, borderRadius: R.sm, color: C.textPrimary,
  padding: '4px 6px', fontSize: 13,
};
const numInput: React.CSSProperties = {
  background: C.bgInput, border: '1px solid ' + C.border, borderRadius: R.sm, color: C.textPrimary,
  padding: '4px 6px', fontSize: 13, width: 78,
};
const th: React.CSSProperties = { padding: '8px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };
const td: React.CSSProperties = { padding: '6px 8px' };
const miniLabel: React.CSSProperties = { color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 };
const miniVal: React.CSSProperties = { color: C.textPrimary, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' };

function chip(color: string): React.CSSProperties {
  return { background: color + '22', color, border: '1px solid ' + color + '55', borderRadius: R.full, padding: '2px 10px', fontSize: 11, fontWeight: 600 };
}
function presetBtn(bias: string): React.CSSProperties {
  const color = bias === 'bullish' ? C.positive : bias === 'bearish' ? C.negative : bias === 'volatile' ? C.info : C.warning;
  return {
    background: color + '14', color, border: '1px solid ' + color + '44', borderRadius: R.full,
    padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };
}
