'use client';

import { useMemo, useState } from 'react';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

interface Trade {
  date: string;
  signalDate: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
  cost: number;
  reason: string;
  pnl?: number;
}

interface NavPoint {
  date: string;
  value: number;
  benchmark: number;
  cash: number;
  invested: number;
}

interface SymbolStats {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  realizedPnl: number;
  returnPct: number;
  contribution: number;
}

interface BacktestResult {
  finalReturn: number;
  maxDrawdown: number;
  sortino: number;
  sharpe: number;
  cagr: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  exposure: number;
  turnover: number;
  totalTrades: number;
  totalCosts: number;
  finalEquity: number;
  benchmarkReturn: number;
  benchmarkMaxDrawdown: number;
  alpha: number;
  nav: NavPoint[];
  trades: Trade[];
  symbolStats: SymbolStats[];
  tradingDays: number;
  dataSource: string;
  notes: string[];
}

const STRATEGIES = [
  { id: 'trend', label: 'Tendencia (SMA50/SMA200)' },
  { id: 'momentum', label: 'Momentum 12-1' },
  { id: 'mean-reversion', label: 'Reversión a la media' },
  { id: 'buy-and-hold', label: 'Buy & hold' },
  { id: 'ai', label: 'Agente IA' },
];

const pct = (v: number, digits = 2) => `${(v * 100).toFixed(digits)}%`;
const money = (v: number) =>
  `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function BacktestPanel() {
  const [symbolsStr, setSymbolsStr] = useState('AAPL,MSFT,SPY');
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [initialCash, setInitialCash] = useState('100000');
  const [strategy, setStrategy] = useState('trend');
  const [benchmark, setBenchmark] = useState('SPY');
  const [commission, setCommission] = useState('5');
  const [slippage, setSlippage] = useState('5');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState('');

  const symbolList = useMemo(
    () =>
      symbolsStr
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    [symbolsStr],
  );

  async function run() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: symbolList,
          startDate,
          endDate,
          initialCash: Number(initialCash),
          strategy,
          benchmark,
          commissionBps: Number(commission),
          slippageBps: Number(slippage),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Error ${res.status}`);
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Error ejecutando el backtest');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '32px 16px',
        fontFamily: F.family,
        color: C.textPrimary,
      }}
    >
      <h1
        style={{
          fontSize: F.sizeHero,
          fontWeight: 700,
          marginBottom: 8,
          background: C.gradientPrimary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Backtest Engine
      </h1>
      <p style={{ color: C.textSecondary, fontSize: F.sizeSm, marginBottom: 24, maxWidth: 720 }}>
        Simula una estrategia sobre histórico diario real. La señal se calcula con el cierre de cada
        sesión y la orden se ejecuta a la <strong>apertura del día siguiente</strong> (sin
        look-ahead). Incluye comisión y slippage configurables.
      </p>

      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: R.xl,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Símbolos (coma)</label>
            <input
              value={symbolsStr}
              onChange={(e) => setSymbolsStr(e.target.value)}
              style={inputStyle}
              placeholder="AAPL,MSFT,SPY"
            />
          </div>
          <div>
            <label style={labelStyle}>Estrategia</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} style={inputStyle}>
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id} style={{ background: C.bgCard, color: C.textPrimary }}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Capital inicial ($)</label>
            <input
              value={initialCash}
              onChange={(e) => setInitialCash(e.target.value)}
              style={inputStyle}
              inputMode="numeric"
            />
          </div>
          <div>
            <label style={labelStyle}>Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Benchmark</label>
            <input
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value.toUpperCase())}
              style={inputStyle}
              placeholder="SPY"
            />
          </div>
          <div>
            <label style={labelStyle}>Comisión (bps)</label>
            <input
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              style={inputStyle}
              inputMode="numeric"
            />
          </div>
          <div>
            <label style={labelStyle}>Slippage (bps)</label>
            <input
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              style={inputStyle}
              inputMode="numeric"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={run}
            disabled={running || symbolList.length === 0}
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
            }}
          >
            {running ? 'Ejecutando…' : 'Ejecutar backtest'}
          </button>
          {running && (
            <span style={{ color: C.textSecondary, fontSize: F.sizeSm }}>
              Calculando {symbolList.length} símbolo(s) sobre {startDate} → {endDate}. Puede tardar unos segundos…
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: C.negativeBg,
            border: `1px solid ${C.negativeBorder}`,
            borderRadius: R.lg,
            padding: 16,
            color: C.negative,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {result && <Results result={result} initialCash={Number(initialCash)} />}
    </div>
  );
}

function defaultStart(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}

function Results({ result, initialCash }: { result: BacktestResult; initialCash: number }) {
  const bmValue = initialCash * (1 + result.benchmarkReturn);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <MetricCard
          label="Retorno final"
          value={pct(result.finalReturn)}
          color={result.finalReturn >= 0 ? C.positive : C.negative}
        />
        <MetricCard label="Capital final" value={money(result.finalEquity)} color={C.textPrimary} />
        <MetricCard label="CAGR" value={pct(result.cagr)} color={result.cagr >= 0 ? C.positive : C.negative} />
        <MetricCard
          label="Máx. drawdown"
          value={pct(result.maxDrawdown)}
          color={C.negative}
        />
        <MetricCard
          label="Sortino"
          value={result.sortino.toFixed(2)}
          color={result.sortino > 1 ? C.positive : C.warning}
        />
        <MetricCard
          label="Sharpe"
          value={result.sharpe.toFixed(2)}
          color={result.sharpe > 1 ? C.positive : C.warning}
        />
        <MetricCard
          label="Volatilidad anual"
          value={pct(result.volatility)}
          color={C.textSecondary}
        />
        <MetricCard
          label="Win rate"
          value={pct(result.winRate, 1)}
          color={result.winRate >= 0.5 ? C.positive : C.warning}
        />
        <MetricCard label="Factor beneficio" value={result.profitFactor.toFixed(2)} color={C.info} />
        <MetricCard
          label="Benchmark"
          value={pct(result.benchmarkReturn)}
          color={result.benchmarkReturn >= 0 ? C.positive : C.negative}
        />
        <MetricCard
          label="Alpha vs benchmark"
          value={pct(result.alpha)}
          color={result.alpha >= 0 ? C.positive : C.negative}
        />
        <MetricCard label="Operaciones" value={String(result.totalTrades)} color={C.info} />
        <MetricCard label="Coste total" value={money(result.totalCosts)} color={C.warning} />
        <MetricCard label="Exposición media" value={pct(result.exposure, 1)} color={C.textSecondary} />
        <MetricCard label="Turnover anual" value={pct(result.turnover, 1)} color={C.textSecondary} />
        <MetricCard label="Sesiones" value={String(result.tradingDays)} color={C.textSecondary} />
        <MetricCard label="Benchmark final" value={money(bmValue)} color={C.textSecondary} />
      </div>

      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: R.xl,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: F.sizeLg, fontWeight: 600, marginBottom: 4 }}>Curva de capital</h3>
        <p style={{ color: C.textMuted, fontSize: F.sizeXs, marginBottom: 16 }}>
          Cartera (sólido) vs {result.trades.length >= 0 ? 'benchmark' : ''} buy &amp; hold (discontinuo).
        </p>
        <EquityChart nav={result.nav} initialCash={initialCash} />
      </div>

      {result.symbolStats.length > 0 && (
        <div
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: R.xl,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: F.sizeLg, fontWeight: 600, marginBottom: 16 }}>Resultado por símbolo</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeSm }}>
              <thead>
                <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                  <th style={thStyle}>Símbolo</th>
                  <th style={thStyle}>Operaciones</th>
                  <th style={thStyle}>Aciertos</th>
                  <th style={thStyle}>P&amp;L realizado</th>
                  <th style={thStyle}>Retorno buy &amp; hold</th>
                </tr>
              </thead>
              <tbody>
                {result.symbolStats.map((s) => (
                  <tr key={s.symbol} style={{ borderBottom: `1px solid ${C.divider}` }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.symbol}</td>
                    <td style={tdStyle}>{s.trades}</td>
                    <td style={tdStyle}>
                      {s.wins}/{s.wins + s.losses}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: s.realizedPnl >= 0 ? C.positive : C.negative,
                      }}
                    >
                      {money(s.realizedPnl)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: s.returnPct >= 0 ? C.positive : C.negative,
                      }}
                    >
                      {pct(s.returnPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.trades.length > 0 && (
        <div
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: R.xl,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: F.sizeLg, fontWeight: 600, marginBottom: 16 }}>
            Bitácora de operaciones ({result.trades.length})
          </h3>
          <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeSm }}>
              <thead>
                <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                  <th style={thStyle}>Ejecución</th>
                  <th style={thStyle}>Señal</th>
                  <th style={thStyle}>Símbolo</th>
                  <th style={thStyle}>Lado</th>
                  <th style={thStyle}>Acciones</th>
                  <th style={thStyle}>Precio</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Coste</th>
                  <th style={thStyle}>P&amp;L</th>
                  <th style={thStyle}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
                    <td style={tdStyle}>{t.date}</td>
                    <td style={{ ...tdStyle, color: C.textMuted }}>{t.signalDate}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{t.symbol}</td>
                    <td style={{ ...tdStyle, color: t.side === 'buy' ? C.positive : C.negative }}>
                      {t.side === 'buy' ? 'COMPRA' : 'VENTA'}
                    </td>
                    <td style={tdStyle}>{t.shares}</td>
                    <td style={tdStyle}>${t.price.toFixed(2)}</td>
                    <td style={tdStyle}>${t.value.toFixed(0)}</td>
                    <td style={{ ...tdStyle, color: C.warning }}>${t.cost.toFixed(2)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color:
                          t.pnl === undefined
                            ? C.textMuted
                            : t.pnl >= 0
                              ? C.positive
                              : C.negative,
                      }}
                    >
                      {t.pnl === undefined ? '—' : money(t.pnl)}
                    </td>
                    <td style={{ ...tdStyle, color: C.textSecondary, maxWidth: 320, whiteSpace: 'normal' }}>
                      {t.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: R.xl,
          padding: 16,
          color: C.textMuted,
          fontSize: F.sizeXs,
          lineHeight: 1.6,
        }}
      >
        <div>Fuente de datos: {result.dataSource}</div>
        {result.notes.map((n, i) => (
          <div key={i}>• {n}</div>
        ))}
        <div style={{ marginTop: 8 }}>
          Resultados simulados sobre histórico real. No es una recomendación de inversión: el
          pasado no garantiza el futuro y no se modelan comisiones de FIN, spread real ni
          liquidez del mercado.
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: R.lg,
        padding: 16,
        transition: T.normal,
      }}
    >
      <div style={{ fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: F.sizeXxl, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EquityChart({ nav, initialCash }: { nav: NavPoint[]; initialCash: number }) {
  if (nav.length < 2) {
    return <p style={{ color: C.textMuted, fontSize: F.sizeSm }}>Sin datos para el gráfico.</p>;
  }

  const w = 900;
  const h = 320;
  const pad = 30;

  const all = nav.map((n) => n.value).concat(nav.map((n) => n.benchmark));
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;

  const x = (i: number) => pad + (i / (nav.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);

  const portfolio = nav.map((n, i) => `${x(i).toFixed(1)},${y(n.value).toFixed(1)}`).join(' ');
  const bench = nav.map((n, i) => `${x(i).toFixed(1)},${y(n.benchmark).toFixed(1)}`).join(' ');

  const last = nav[nav.length - 1];

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
        <line
          x1={pad}
          y1={y(initialCash)}
          x2={w - pad}
          y2={y(initialCash)}
          stroke={C.textMuted}
          strokeWidth="1"
          strokeDasharray="3,4"
          opacity={0.6}
        />
        <text x={pad + 4} y={y(initialCash) - 6} fill={C.textMuted} fontSize="10" fontFamily="Inter">
          capital inicial
        </text>
        <polyline points={bench} fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeDasharray="6,4" />
        <polyline points={portfolio} fill="none" stroke={C.accent} strokeWidth="2.2" />
        <text x={w - 150} y={22} fill={C.accent} fontSize="11" fontFamily="Inter">
          Cartera
        </text>
        <text x={w - 150} y={38} fill={C.textMuted} fontSize="11" fontFamily="Inter">
          Benchmark
        </text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, fontSize: F.sizeXs, marginTop: 8 }}>
        <span>{nav[0].date}</span>
        <span>
          Cartera {money(last.value)} · Benchmark {money(last.benchmark)}
        </span>
        <span>{last.date}</span>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: F.sizeSm,
  color: C.textSecondary,
  marginBottom: 6,
};

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
  position: 'sticky',
  top: 0,
  background: C.bgCard,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: F.sizeSm,
  whiteSpace: 'nowrap',
};
