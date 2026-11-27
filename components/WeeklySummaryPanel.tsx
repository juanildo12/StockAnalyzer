'use client';

import { useCallback, useEffect, useState } from 'react';
import { colors as C, font as F, radius as R } from '@/src/utils/webTheme';
import type { WeeklySummaryResult } from '@/src/lib/market/weeklySummary';

interface WeeklySummaryResponse extends WeeklySummaryResult {
  source: string;
  updatedAt: string;
  cached?: boolean;
  error?: string;
}

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return 'N/D';
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function num(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return 'N/D';
  return n.toFixed(digits);
}

function biasMeta(bias: string | undefined): { label: string; color: string } {
  if (bias === 'bullish') return { label: 'Alcista', color: C.positive };
  if (bias === 'bearish') return { label: 'Bajista', color: C.negative };
  return { label: 'Neutral', color: C.warning };
}

export default function WeeklySummaryPanel({ onOpenSymbol }: { onOpenSymbol?: (symbol: string) => void }) {
  const [data, setData] = useState<WeeklySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/weekly-summary${force ? '?force=1' : ''}`);
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen semanal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const bias = biasMeta(data?.outlook?.bias);
  const conf = data?.outlook?.confidence || 'low';

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 14, borderRadius: R.xl,
      background: C.gradientCard, border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: '-0.2px' }}>
            Resumen semanal
          </h3>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: R.full,
            background: data?.reviewWindow ? C.accent12 : C.bgElevated,
            color: data?.reviewWindow ? C.accent : C.textSecondary,
            border: `1px solid ${data?.reviewWindow ? C.accentBorder : C.border}`,
          }}>
            {data?.reviewWindow ? `Viernes / fin de semana · ${data.weekday}` : 'Avance de la próxima semana'}
          </span>
          {data?.weekLabel && (
            <span style={{ fontSize: 11.5, color: C.textSecondary }}>
              Semana {data.weekKey} · {data.weekLabel} → próxima {data.nextWeek.label}
            </span>
          )}
        </div>
        <button
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="Actualizar resumen semanal"
          style={{
            padding: '4px 10px', borderRadius: R.sm, border: `1px solid ${C.border}`,
            background: C.bgCard, color: C.textSecondary, cursor: 'pointer',
            fontSize: 11.5, fontFamily: F.family,
          }}
        >
          {loading ? '…' : '↻ Actualizar'}
        </button>
      </div>

      {loading && !data && (
        <div style={{ padding: '22px 0', fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
          Analizando cierre semanal, eventos y noticias...
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 10, padding: '9px 11px', borderRadius: R.md,
          border: `1px solid ${C.negativeBorder}`, background: C.negativeBg,
          color: C.negative, fontSize: 11.5,
        }}>
          {error}
        </div>
      )}

      {data && !error && (
        <>
          <div style={{
            marginTop: 12, padding: '11px 13px', borderRadius: R.md,
            border: `1px solid ${C.border}`, background: C.bgCard,
            borderLeft: `3px solid ${bias.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: bias.color }}>{bias.label}</span>
              <span style={{
                fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: R.full,
                background: C.bgElevated, color: C.textSecondary, textTransform: 'uppercase',
              }}>
                Confianza {conf}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted }}>
                señal {num(data.outlook.score, 2)} · {data.aiUsed ? 'síntesis IA + datos' : 'motor determinista'}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, lineHeight: 1.45 }}>
              {data.outlook.headline}
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
            gap: 6, marginTop: 10,
          }}>
            {data.indices.map(i => (
              <div key={i.symbol} style={{
                padding: '8px 10px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgCard,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textSecondary }}>{i.symbol}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, marginTop: 2 }}>
                  {num(i.close, 2)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: (i.weeklyReturnPct ?? 0) >= 0 ? C.positive : C.negative }}>
                  {pct(i.weeklyReturnPct)} semanal
                </div>
              </div>
            ))}
            {data.pulse && (
              <div style={{
                padding: '8px 10px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgCard,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textSecondary }}>Market Pulse</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, marginTop: 2 }}>
                  {num(data.pulse.score, 0)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary }}>
                  {data.pulse.zone || 'N/D'} · 5d {pct(data.pulse.pUp5d, 0)} alza
                </div>
              </div>
            )}
            {data.newsSentiment && (
              <div style={{
                padding: '8px 10px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgCard,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textSecondary }}>Noticias</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, marginTop: 2 }}>
                  {pct(data.newsSentiment.net * 100, 0)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary }}>
                  {data.newsSentiment.total} clasificadas
                </div>
              </div>
            )}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 10, marginTop: 10,
          }}>
            <div style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgCard }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.textSecondary, marginBottom: 6 }}>
                Escenarios
              </div>
              {data.outlook.scenarios.map((s, i) => (
                <div key={i} style={{ marginBottom: 7 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? C.accent : C.textPrimary }}>{s.label}: </span>
                  <span style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.45 }}>{s.text}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgCard }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.textSecondary, marginBottom: 6 }}>
                Riesgos y eventos clave
              </div>
              {data.outlook.risks.slice(0, 5).map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5, marginBottom: 4 }}>
                  <span style={{ color: C.warning, marginRight: 5 }}>•</span>{r}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgCard }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: C.textSecondary, marginBottom: 6 }}>
                A vigilar · {data.events.length} catalizadores
              </div>
              {data.events.slice(0, 6).map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 12 }}>{e.emoji || '•'}</span>
                  <span style={{ fontSize: 10.5, color: C.textMuted, fontFamily: F.mono, flexShrink: 0 }}>{e.iso.slice(5)}</span>
                  <span
                    onClick={e.symbol && onOpenSymbol ? () => onOpenSymbol(e.symbol as string) : undefined}
                    style={{
                      fontSize: 11, color: e.symbol ? C.accent : C.textSecondary,
                      fontWeight: e.symbol ? 700 : 400,
                      cursor: e.symbol && onOpenSymbol ? 'pointer' : 'default',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {e.title}{e.symbol ? ' →' : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 9.5, color: e.importance >= 85 ? C.negative : C.textMuted, flexShrink: 0 }}>
                    {e.importance}
                  </span>
                </div>
              ))}
              {data.events.length === 0 && (
                <div style={{ fontSize: 11, color: C.textMuted }}>Sin eventos cargados para la próxima semana.</div>
              )}
            </div>
          </div>

          {(data.warnings.length > 0 || data.notes.length > 0) && (
            <div style={{ marginTop: 10, fontSize: 10.5, color: C.textMuted, lineHeight: 1.5 }}>
              {[...data.warnings, ...data.notes.filter(n => !data.warnings.includes(n))].slice(0, 4).map((n, i) => (
                <div key={i}>· {n}</div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted }}>
            Fuente: {data.source} · actualizado {new Date(data.updatedAt).toLocaleString('es-ES')}. Frecuencias históricas y lectura de noticias; no es recomendación financiera.
          </div>
        </>
      )}
    </div>
  );
}
