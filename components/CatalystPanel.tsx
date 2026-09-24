'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

interface Catalyst {
  type: string;
  title: string;
  description?: string;
  date: string;
  importance: number;
  confidence: number;
  status: string;
  source: string;
  link?: string;
  emoji: string;
  meta?: Record<string, any>;
}

interface CalendarDay {
  iso: string;
  label: string;
  events: Catalyst[];
}

interface Roadmap {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  upcoming: Catalyst[];
  news: any[];
  analysts: any[] | null;
  generatedAt: number;
}

function impChip(n: number) {
  if (n >= 85) return { label: `Alta ${n}`, color: '#F87171', bg: '#F8717115', border: '#F8717140' };
  if (n >= 60) return { label: `Notable ${n}`, color: '#FBBF24', bg: '#FBBF2415', border: '#FBBF2440' };
  return { label: `${n}`, color: '#8B90A5', bg: '#8B90A515', border: '#8B90A540' };
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  earnings: { label: 'Ganancias', color: '#34D399' },
  dividend: { label: 'Dividendo', color: '#A78BFA' },
  ipo: { label: 'IPO', color: '#38BDF8' },
  economic: { label: 'Macro', color: '#34D399' },
  analyst: { label: 'Analistas', color: '#F472B6' },
  news: { label: 'Mercado', color: '#8B90A5' },
  split: { label: 'Split', color: '#A78BFA' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts * 1000) / 1000);
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export default function CatalystPanel({ onSelectStock }: { onSelectStock?: (symbol: string) => void }) {
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [selected, setSelected] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([]);
  const [showSug, setShowSug] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCalendar = useCallback((offset: number) => {
    setLoading(true);
    setError('');
    setDays(null);
    fetch('/api/catalysts')
      .then(r => r.json())
      .then(d => { setDays(d.days || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const loadSymbol = useCallback((sym: string) => {
    setLoading(true);
    setError('');
    setSelected(null);
    fetch(`/api/catalysts?symbol=${encodeURIComponent(sym)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setSelected(d);
        setQuery('');
        setShowSug(false);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { loadCalendar(0); }, [loadCalendar]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onQuery = (q: string) => {
    setQuery(q);
    setShowSug(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 1) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setSuggestions((d.results || []).slice(0, 8));
      } catch { setSuggestions([]); }
    }, 250);
  };

  const visibleDays = days || [];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
          ⚡ Catalizadores
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0' }}>
          {selected
            ? `Próximos eventos que pueden mover a ${selected.symbol}`
            : 'Calendario semanal de ganancias, IPOs y eventos de mercado que mueven acciones'}
        </p>
      </div>

      {/* Search */}
      <div ref={searchRef} style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type="text"
          value={query}
          onChange={e => onQuery(e.target.value)}
          onFocus={() => query.trim().length > 0 && setShowSug(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && suggestions.length > 0) loadSymbol(suggestions[0].symbol);
          }}
          placeholder="Buscar ticker y ver su hoja de ruta de catalizadores (ej. AAPL, NVDA)..."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: R.md,
            border: `1px solid ${C.border}`, background: C.bgCard,
            color: C.textSecondary, fontSize: 13, outline: 'none', fontFamily: F.family,
            boxSizing: 'border-box',
          }}
        />
        {showSug && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
            background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: R.md,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)', overflow: 'hidden',
          }}>
            {suggestions.map(s => (
              <button
                key={s.symbol}
                onClick={() => loadSymbol(s.symbol)}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%',
                  padding: '9px 14px', background: 'transparent', border: 'none',
                  borderBottom: `1px solid ${C.divider}`, color: C.textPrimary,
                  cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: F.family,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bgCardHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                <span style={{ color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted, fontSize: 13 }}>
          Buscando catalizadores...
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.negative, fontSize: 13 }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && selected && (
        <div>
          {/* Back */}
          <button
            onClick={() => { setSelected(null); loadCalendar(0); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
              background: 'transparent', border: 'none', color: C.textMuted,
              cursor: 'pointer', fontSize: 13, fontFamily: F.family,
            }}
          >
            ← Calendario de la semana
          </button>

          {/* Stock header */}
          <div style={{
            padding: '16px 18px', borderRadius: R.xl, marginBottom: 14,
            background: C.gradientHero, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary }}>{selected.symbol}</span>
                <span style={{ fontSize: 13, color: C.textMuted }}>{selected.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.textPrimary }}>${selected.price.toFixed(2)}</span>
                <span style={{ color: selected.changePct >= 0 ? C.positive : C.negative, fontWeight: 600 }}>
                  {selected.changePct >= 0 ? '+' : ''}{selected.changePct.toFixed(2)}%
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onSelectStock?.(selected.symbol)}
                style={{
                  padding: '8px 14px', borderRadius: R.md, border: 'none', cursor: 'pointer',
                  background: C.accent, color: C.textPrimary, fontWeight: 600, fontSize: 12.5, fontFamily: F.family,
                }}
              >
                Análisis completo
              </button>
            </div>
          </div>

          {/* Upcoming catalysts */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Próximos catalizadores ({selected.upcoming.length})
            </div>
            {selected.upcoming.length === 0 && (
              <div style={{
                padding: '18px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`,
                background: '#0d1117', color: C.textMuted, fontSize: 12.5, textAlign: 'center',
              }}>
                No hay eventos programados en los próximos 45 días. Las noticias recientes están abajo.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.upcoming.map((c, i) => {
                const im = impChip(c.importance);
                const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 14px', borderRadius: R.md,
                    border: `1px solid ${C.border}`, background: C.bgCard,
                  }}>
                    <div style={{
                      minWidth: 62, textAlign: 'center' as const, padding: '6px 4px', borderRadius: R.sm,
                      background: im.bg, border: `1px solid ${im.border}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: im.color, textTransform: 'capitalize' }}>{im.label}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>{c.emoji} {c.title}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: R.full,
                          background: tm.color + '18', color: tm.color, border: `1px solid ${tm.color}40`,
                        }}>
                          {tm.label}
                        </span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(c.date)}</span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>· {c.status}</span>
                      </div>
                      {c.description && (
                        <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>{c.description}</div>
                      )}
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                        {c.source}
                        {c.link && <span> · <a href={c.link} target="_blank" rel="noreferrer" style={{ color: C.accent }}>ver fuente</a></span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analyst sentiment */}
          {selected.analysts && selected.analysts.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Consenso de analistas
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected.analysts.map((a, i) => {
                  const buy = (a.strongBuy || 0) + (a.buy || 0);
                  const hold = a.hold || 0;
                  const sell = (a.sell || 0) + (a.strongSell || 0);
                  const total = buy + hold + sell;
                  const pBuy = total > 0 ? Math.round((buy / total) * 100) : 0;
                  return (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: R.md, minWidth: 180,
                      border: `1px solid ${C.border}`, background: C.bgCard,
                    }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Período {a.period}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: pBuy >= 60 ? C.positive : pBuy >= 40 ? C.warning : C.negative }}>
                        {pBuy}% comprar
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {buy} compra · {hold} mantiene · {sell} vende
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent news */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Por qué se mueve · noticias recientes
            </div>
            {selected.news.length === 0 && (
              <div style={{ padding: '18px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`, color: C.textMuted, fontSize: 12.5, textAlign: 'center' }}>
                Sin noticias recientes.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.news.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noreferrer"
                  style={{
                    display: 'block', padding: '10px 14px', borderRadius: R.md, textDecoration: 'none',
                    border: `1px solid ${C.border}`, background: C.bgCard, transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.bgCardHover; e.currentTarget.style.borderColor = C.borderHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.bgCard; e.currentTarget.style.borderColor = C.border; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{n.source} · {timeAgo(n.datetime)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4 }}>{n.headline}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly calendar */}
      {!loading && !error && !selected && (
        <div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F87171' }} /> Alta actividad (≥85)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FBBF24' }} /> Notable (60)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#8B90A5' }} /> Background (30)
            </span>
          </div>

          {days && days.length === 0 && (
            <div style={{
              padding: '20px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`,
              background: '#0d1117', color: C.textMuted, fontSize: 12.5, textAlign: 'center',
            }}>
              Sin eventos programados para los próximos 7 días. Prueba buscar un ticker arriba para ver su hoja de ruta.
            </div>
          )}

          {days && visibleDays.map(d => {
            return (
              <div key={d.iso} style={{
                padding: '12px 14px', borderRadius: R.lg, marginBottom: 10,
                border: `1px solid ${C.border}`, background: C.bgCard,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, textTransform: 'capitalize',
                }}>
                  {d.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: R.full, color: C.accent,
                    background: C.accent12,
                  }}>
                    {d.events.length} eventos
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {d.events.map((c, i) => {
                    const im = impChip(c.importance);
                    const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
                    const metaSymbol = c.meta?.symbol;
                    const clickable = metaSymbol != null;
                    return (
                      <div
                        key={i}
                        onClick={() => clickable && loadSymbol(metaSymbol)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                          borderRadius: R.sm, cursor: clickable ? 'pointer' : 'default',
                          borderLeft: `3px solid ${im.color}`,
                          background: clickable ? 'transparent' : '#0d1117',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => { if (clickable) e.currentTarget.style.background = C.bgCardHover; }}
                        onMouseLeave={e => { if (clickable) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 15 }}>{c.emoji}</span>
                        <span style={{
                          fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                          background: tm.color + '16', color: tm.color, border: `1px solid ${tm.color}35`, flexShrink: 0,
                        }}>
                          {tm.label}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textPrimary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title}
                        </span>
                        {metaSymbol && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 4,
                            background: C.accent12, color: C.accentLight, cursor: 'pointer', flexShrink: 0,
                          }}>
                            {metaSymbol} →
                          </span>
                        )}
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: im.bg, color: im.color, border: `1px solid ${im.border}`, flexShrink: 0,
                        }}>
                          {im.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}