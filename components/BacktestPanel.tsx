'use client';

import { useState } from 'react';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

interface Trade {
  date: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
}

interface BacktestResult {
  finalReturn: number;
  maxDrawdown: number;
  sortino: number;
  totalTrades: number;
  nav: { date: string; value: number }[];
  trades: Trade[];
  benchmarkReturn: number;
}

export default function BacktestPanel() {
  const [symbolsStr, setSymbolsStr] = useState('AAPL,MSFT,GOOGL');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [initialCash, setInitialCash] = useState('100000');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState('');

  async function run() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, startDate, endDate, initialCash: Number(initialCash) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '32px 16px',
      fontFamily: F.family,
      color: C.textPrimary,
    }}>
      <h1 style={{ fontSize: F.sizeHero, fontWeight: 700, marginBottom: 24, background: C.gradientPrimary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Backtest Engine
      </h1>

      <div style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: R.xl,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 6 }}>Symbols</label>
            <input value={symbolsStr} onChange={e => setSymbolsStr(e.target.value)}
              style={inputStyle} placeholder="AAPL,MSFT,GOOGL" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 6 }}>Initial Capital</label>
            <input value={initialCash} onChange={e => setInitialCash(e.target.value)}
              style={inputStyle} placeholder="100000" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 6 }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 6 }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <button onClick={run} disabled={running}
          style={{
            background: C.gradientPrimary,
            color: '#fff',
            border: 'none',
            borderRadius: R.md,
            padding: '10px 24px',
            fontSize: F.sizeBase,
            fontWeight: 600,
            cursor: running ? 'not-allowed' : 'pointer',
            opacity: running ? 0.6 : 1,
            transition: T.normal,
          }}>
          {running ? 'Running...' : 'Run Backtest'}
        </button>
      </div>

      {error && (
        <div style={{
          background: C.negativeBg,
          border: `1px solid ${C.negativeBorder}`,
          borderRadius: R.lg,
          padding: 16,
          color: C.negative,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {result && <Results result={result} initialCash={Number(initialCash)} />}
    </div>
  );
}

function Results({ result, initialCash }: { result: BacktestResult; initialCash: number }) {
  const finalValue = initialCash * (1 + result.finalReturn);
  const bmValue = initialCash * (1 + result.benchmarkReturn);

  return (
    <div>
      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard label="Final Return" value={`${(result.finalReturn * 100).toFixed(2)}%`}
          color={result.finalReturn >= 0 ? C.positive : C.negative} />
        <MetricCard label="Final Portfolio" value={`$${finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color={C.textPrimary} />
        <MetricCard label="Max Drawdown" value={`${(result.maxDrawdown * 100).toFixed(2)}%`} color={C.negative} />
        <MetricCard label="Sortino Ratio" value={result.sortino.toFixed(2)}
          color={result.sortino > 1 ? C.positive : C.warning} />
        <MetricCard label="Total Trades" value={String(result.totalTrades)} color={C.info} />
        <MetricCard label="Benchmark Return" value={`${(result.benchmarkReturn * 100).toFixed(2)}%`}
          color={result.benchmarkReturn >= 0 ? C.positive : C.negative} />
        <MetricCard label="Benchmark Final" value={`$${bmValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color={C.textSecondary} />
      </div>

      {/* NAV chart */}
      <div style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: R.xl,
        padding: 24,
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: F.sizeLg, fontWeight: 600, marginBottom: 16 }}>Equity Curve vs Benchmark</h3>
        <svg viewBox="0 0 800 300" style={{ width: '100%', height: 'auto' }}>
          {navChart(result.nav, result.benchmarkReturn, initialCash)}
        </svg>
      </div>

      {/* Trade log */}
      {result.trades.length > 0 && (
        <div style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: R.xl,
          padding: 24,
        }}>
          <h3 style={{ fontSize: F.sizeLg, fontWeight: 600, marginBottom: 16 }}>Trade Log</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeSm }}>
              <thead>
                <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Symbol</th>
                  <th style={thStyle}>Side</th>
                  <th style={thStyle}>Shares</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Value</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
                    <td style={tdStyle}>{t.date}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{t.symbol}</td>
                    <td style={{ ...tdStyle, color: t.side === 'buy' ? C.positive : C.negative }}>{t.side.toUpperCase()}</td>
                    <td style={tdStyle}>{t.shares}</td>
                    <td style={tdStyle}>${t.price.toFixed(2)}</td>
                    <td style={tdStyle}>${t.value.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      padding: 16,
      transition: T.normal,
    }}>
      <div style={{ fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: F.sizeXxl, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function navChart(nav: { date: string; value: number }[], bmReturn: number, initialCash: number) {
  if (nav.length < 2) return null;

  const values = nav.map(n => n.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 800;
  const h = 280;
  const pad = 20;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');

  // Benchmark line (straight from initial to final)
  const bmStart = initialCash;
  const bmEnd = initialCash * (1 + bmReturn);

  const bmPoints = [
    `${pad},${h - pad - ((bmStart - min) / range) * (h - 2 * pad)}`,
    `${w - pad},${h - pad - ((bmEnd - min) / range) * (h - 2 * pad)}`,
  ].join(' ');

  return (
    <>
      <polyline points={points} fill="none" stroke={C.accent} strokeWidth="2" />
      <line x1={bmPoints.split(' ')[0].split(',')[0]} y1={bmPoints.split(' ')[0].split(',')[1]}
        x2={bmPoints.split(' ')[1].split(',')[0]} y2={bmPoints.split(' ')[1].split(',')[1]}
        stroke={C.textMuted} strokeWidth="1.5" strokeDasharray="6,4" />
      <text x={w - 80} y={20} fill={C.accent} fontSize="11" fontFamily="Inter">Portfolio</text>
      <text x={w - 80} y={36} fill={C.textMuted} fontSize="11" fontFamily="Inter">Benchmark</text>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.bgInput,
  border: `1px solid ${C.border}`,
  borderRadius: R.md,
  padding: '8px 12px',
  color: C.textPrimary,
  fontSize: F.sizeMd,
  fontFamily: F.family,
  outline: 'none',
  boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: F.sizeSm,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: F.sizeSm,
  whiteSpace: 'nowrap',
};
