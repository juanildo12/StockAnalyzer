'use client';

import { useState, useEffect, useRef } from 'react';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  pe: number | null;
  fcfYield: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  sector: string;
  industry: string;
  category: 'joya' | 'growth' | 'valueTrap' | 'bomba' | null;
  reasons: string[];
  ema200: number | null;
  ema200Distance: number | null;
}

interface ApiResponse {
  stocks: StockData[];
  joyas: StockData[];
  growths: StockData[];
  traps: StockData[];
  bombas: StockData[];
  total: number;
  classified: number;
  timestamp: number;
}

const CATEGORIES = [
  { key: 'joyas', label: 'Joyas Ocultas', emoji: '\uD83D\uDC8E', color: '#2DD4BF', bg: '#2DD4BF15', border: '#2DD4BF40', desc: 'FCF >8% + PE bajo + crece + margen sólido' },
  { key: 'growths', label: 'Growth Caro', emoji: '\uD83D\uDE80', color: '#A78BFA', bg: '#A78BFA15', border: '#A78BFA40', desc: 'FCF bajo + PE alto + Revenue >20%' },
  { key: 'traps', label: 'Value Trap', emoji: '\u26A0\uFE0F', color: '#FBBF24', bg: '#FBBF2415', border: '#FBBF2440', desc: 'FCF alto + PE bajo + revenue estancado' },
  { key: 'bombas', label: 'Bomba de Tiempo', emoji: '\uD83D\uDCA3', color: '#F87171', bg: '#F8717115', border: '#F8717140', desc: 'FCF negativo + PE alto + no crece' },
] as const;

function fmtMCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function StockClassification({ onSelect }: { onSelect?: (symbol: string) => void }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('joyas');
  const [searchInput, setSearchInput] = useState('');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    fetch('/api/screener/classification')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!data) return;
    const allClassified = [...(data.joyas || []), ...(data.growths || []), ...(data.traps || []), ...(data.bombas || [])];
    const needsEma = allClassified.filter(s => s.ema200Distance == null).map(s => s.symbol);
    if (needsEma.length === 0) return;

    let cancelled = false;
    const chunkSize = 40;
    const fetchChunk = (chunk: string[]) =>
      fetch(`/api/screener/classification/ema?symbols=${encodeURIComponent(chunk.join(','))}`)
        .then(r => r.json())
        .then(json => {
          if (cancelled || !json?.results) return;
          setData(prev => {
            if (!prev) return prev;
            const apply = (arr: any[]) => arr.map(s => json.results[s.symbol] ? { ...s, ...json.results[s.symbol] } : s);
            return {
              ...prev,
              joyas: apply(prev.joyas),
              growths: apply(prev.growths),
              traps: apply(prev.traps),
              bombas: apply(prev.bombas),
            };
          });
        })
        .catch(() => {});

    (async () => {
      for (let i = 0; i < needsEma.length; i += chunkSize) {
        if (cancelled) return;
        await fetchChunk(needsEma.slice(i, i + chunkSize));
      }
    })();

    return () => { cancelled = true; };
  }, [!!data]);

  const activeData = data ? ((data as any)[activeTab] || []) as StockData[] : [];
  const filtered = searchInput
    ? activeData.filter(s => s.symbol.toLowerCase().includes(searchInput.toLowerCase()) || s.name.toLowerCase().includes(searchInput.toLowerCase()))
    : activeData;

  const activeCat = CATEGORIES.find(c => c.key === activeTab)!;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
          Clasificación Fundamental
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0' }}>
          Acciones categorizadas por perfil fundamental — {data?.total || 0} escaneadas, {data?.classified || 0} clasificadas
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const count = data ? ((data as any)[cat.key] || []).length : 0;
          const active = activeTab === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: R.md,
                border: `1px solid ${active ? cat.border : C.border}`,
                background: active ? cat.bg : C.bgCard,
                color: active ? cat.color : C.textSecondary,
                cursor: 'pointer', fontWeight: active ? 600 : 400,
                fontSize: 13, transition: 'all 0.15s ease', fontFamily: F.family,
              }}
            >
              <span style={{ fontSize: 16 }}>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: R.full,
                background: active ? cat.color + '25' : C.bg, color: active ? cat.color : C.textMuted,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div style={{
        padding: '10px 14px', borderRadius: R.md,
        background: activeCat.bg, border: `1px solid ${activeCat.border}`,
        marginBottom: 16, fontSize: 12, color: activeCat.color,
        fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>{activeCat.emoji}</span>
        {activeCat.desc}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Buscar por ticker o nombre..."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: R.md,
            border: `1px solid ${C.border}`, background: C.bgCard,
            color: C.textSecondary, fontSize: 13, outline: 'none', fontFamily: F.family,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
          <div style={{ fontSize: 28, marginBottom: 12, animation: 'bounce 1.4s infinite ease-in-out' }}>{activeCat.emoji}</div>
          <p style={{ fontSize: 13 }}>Escaneando {900}+ acciones (SPY + NASDAQ)...</p>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Esto puede tardar 30-60 segundos</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.negative, fontSize: 13 }}>
          Error: {error}
        </div>
      )}

      {/* Stock Cards */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted, fontSize: 13 }}>
              {searchInput ? 'No se encontraron resultados' : 'No hay acciones en esta categoría'}
            </div>
          )}
          {filtered.map(s => (
            <div
              key={s.symbol}
              onClick={() => onSelect?.(s.symbol)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: R.md,
                border: `1px solid ${C.border}`, background: C.bgCard,
                cursor: onSelect ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.bgCardHover; e.currentTarget.style.borderColor = C.borderHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.bgCard; e.currentTarget.style.borderColor = C.border; }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{s.symbol}</span>
                  <span style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                  {s.sector && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: R.full,
                      background: C.bg, color: C.textMuted, flexShrink: 0,
                    }}>
                      {s.sector}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.ema200Distance != null && (
                    <span style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4,
                      background: s.ema200Distance >= 0 ? '#2DD4BF15' : '#F8717115',
                      color: s.ema200Distance >= 0 ? '#2DD4BF' : '#F87171',
                      border: `1px solid ${s.ema200Distance >= 0 ? '#2DD4BF40' : '#F8717140'}`,
                      whiteSpace: 'nowrap', fontWeight: 600,
                    }}>
                      EMA200 {s.ema200Distance >= 0 ? '+' : ''}{s.ema200Distance.toFixed(1)}%
                    </span>
                  )}
                  {s.reasons.map((r, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4,
                      background: activeCat.bg, color: activeCat.color,
                      border: `1px solid ${activeCat.border}`, whiteSpace: 'nowrap',
                    }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                  ${s.price.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: s.changePct >= 0 ? C.positive : C.negative, fontWeight: 500 }}>
                  {fmtPct(s.changePct)}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  {fmtMCap(s.marketCap)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
