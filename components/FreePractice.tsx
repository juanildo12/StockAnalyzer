'use client';

import { useState } from 'react';
import type { SignalAction } from '@/src/types';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import ScoreBar from './ScoreBar';

interface StockInfo {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  signal: SignalAction;
  score: number;
  conviction: string;
  trend: string;
  rsi: number;
  fcfYield: number;
  peRatio: number;
  targetUpside: number;
  revenueGrowth: number;
}

const SIGNAL_ACTIONS: { value: SignalAction; label: string; color: string }[] = [
  { value: 'COMPRAR', label: 'COMPRAR', color: C.positive },
  { value: 'MANTENER', label: 'MANTENER', color: C.warning },
  { value: 'VENDER', label: 'VENDER', color: C.negative },
];

export default function FreePractice() {
  const [query, setQuery] = useState('');
  const [stock, setStock] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userGuess, setUserGuess] = useState<SignalAction | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const fetchStock = async (sym?: string) => {
    const s = (sym || query).trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    setError('');
    setStock(null);
    setUserGuess(null);
    setSubmitted(false);

    try {
      const res = await fetch(`/api/signal?symbol=${s}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Symbol not found');
      }
      const json = await res.json();

      setStock({
        symbol: json.symbol,
        name: json.name || json.symbol,
        price: json.price,
        changePercent: json.changePercent || 0,
        signal: json.signal,
        score: json.score || 0,
        conviction: json.conviction || 'MEDIUM',
        trend: json.details?.trend || 'lateral',
        rsi: json.details?.rsi || 50,
        fcfYield: json.components?.fcfYield || 0,
        peRatio: json.details?.peRatio || 0,
        targetUpside: json.components?.analystTarget || 0,
        revenueGrowth: json.details?.revenueGrowth || 0,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!userGuess || !stock) return;
    setSubmitted(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchStock();
  };

  if (!stock) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '28px' }}>
        <h3 style={{ margin: '0 0 8px', color: C.textPrimary, fontSize: '18px' }}>
          Práctica Libre
        </h3>
        <p style={{ color: C.textSecondary, fontSize: F.sizeMd, marginBottom: '20px' }}>
          Busca cualquier acción, da tu veredicto y compara con el motor de señales real.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: AAPL, MSFT, TSLA..."
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: R.lg,
              border: `1px solid ${C.border}`,
              background: C.bgBase,
              color: C.textPrimary,
              fontSize: F.sizeLg,
              outline: 'none',
            }}
          />
          <button
            onClick={() => fetchStock()}
            disabled={loading}
            style={{
              padding: '14px 24px',
              borderRadius: R.lg,
              border: 'none',
              background: C.gradientPrimary,
              color: C.textPrimary,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '...' : 'Buscar'}
          </button>
        </div>
        {error && (
          <p style={{ color: C.negative, fontSize: F.sizeMd, marginTop: '12px' }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: C.bgCard, borderRadius: R.xl, padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <h3 style={{ margin: 0, color: C.textPrimary, fontSize: '20px' }}>{stock.symbol}</h3>
          <p style={{ margin: '2px 0 0', color: C.textMuted, fontSize: F.sizeMd }}>{stock.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: C.textPrimary }}>
            ${stock.price.toFixed(2)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: F.sizeBase, color: stock.changePercent >= 0 ? C.positive : C.negative }}>
            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '20px 0' }}>
        {[
          { label: 'RSI', value: stock.rsi.toFixed(1), color: stock.rsi < 30 ? C.positive : stock.rsi > 70 ? C.negative : C.textPrimary },
          { label: 'Tendencia', value: stock.trend.charAt(0).toUpperCase() + stock.trend.slice(1),
            color: stock.trend === 'alcista' ? C.positive : stock.trend === 'bajista' ? C.negative : C.warning },
          { label: 'FCF Yield', value: `${stock.fcfYield.toFixed(1)}%`, color: stock.fcfYield > 5 ? C.positive : C.textPrimary },
          { label: 'PE Ratio', value: stock.peRatio.toFixed(1), color: C.textPrimary },
          { label: 'Target Upside', value: `${stock.targetUpside.toFixed(1)}%`, color: stock.targetUpside > 0 ? C.positive : C.negative },
          { label: 'Score', value: `${stock.score}/100`, color: stock.score >= 70 ? C.positive : stock.score >= 40 ? C.warning : C.negative },
        ].map(d => (
          <div key={d.label} style={{ background: C.bgBase, borderRadius: R.md, padding: '10px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 2px', fontSize: '10px', color: C.textMuted, textTransform: 'uppercase' }}>{d.label}</p>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: d.color }}>{d.value}</p>
          </div>
        ))}
      </div>

      {!submitted ? (
        <>
          <p style={{ fontSize: F.sizeMd, color: C.textSecondary, marginBottom: '12px', textAlign: 'center' }}>
            ¿Cuál es tu veredicto para {stock.symbol}?
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {SIGNAL_ACTIONS.map(action => (
              <button key={action.value}
                onClick={() => setUserGuess(action.value)}
                style={{
                  flex: 1, padding: '14px 8px', borderRadius: R.lg,
                  border: `2px solid ${userGuess === action.value ? action.color : C.border}`,
                  background: userGuess === action.value ? `${action.color}20` : 'transparent',
                  color: userGuess === action.value ? action.color : C.textSecondary,
                  fontWeight: userGuess === action.value ? 700 : 500,
                  fontSize: F.sizeBase, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!userGuess}
            style={{
              width: '100%', padding: '14px', borderRadius: R.lg, border: 'none',
              background: !userGuess ? C.border : C.gradientPrimary, color: C.textPrimary,
              fontWeight: 700, fontSize: F.sizeLg, cursor: !userGuess ? 'not-allowed' : 'pointer',
              opacity: !userGuess ? 0.5 : 1,
            }}
          >
            Revelar Señal Real
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '16px',
            padding: '16px 24px', borderRadius: R.lg,
            background: userGuess === stock.signal ? `${C.positive18}` : `${C.negative18}`,
            marginBottom: '16px',
          }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: F.sizeXs, color: C.textMuted }}>Tu veredicto</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: SIGNAL_ACTIONS.find(a => a.value === userGuess)?.color }}>
                {userGuess}
              </p>
            </div>
            <div style={{ fontSize: '32px', color: C.textMuted }}>{userGuess === stock.signal ? '✓' : '✗'}</div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: F.sizeXs, color: C.textMuted }}>Señal real</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: SIGNAL_ACTIONS.find(a => a.value === stock.signal)?.color }}>
                {stock.signal}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <ScoreBar value={stock.score} />
            <span style={{ fontSize: F.sizeMd, color: C.textSecondary }}>
              Confianza: {stock.conviction}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={() => { setStock(null); setQuery(''); }}
              style={{
                padding: '10px 20px', borderRadius: R.lg, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textSecondary, cursor: 'pointer', fontSize: F.sizeMd,
              }}
            >
              Buscar otra
            </button>
            <button
              onClick={() => fetchStock(stock.symbol)}
              style={{
                padding: '10px 20px', borderRadius: R.lg, border: 'none',
                background: C.gradientPrimary, color: C.textPrimary, cursor: 'pointer', fontSize: F.sizeMd,
                fontWeight: 600,
              }}
            >
              Re-analizar {stock.symbol}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
