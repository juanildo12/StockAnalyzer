// Motor de backtest: determinista, sin look-ahead y testeable.
//
// - La señal se calcula con los datos hasta el CIERRE del día D.
// - La orden se ejecuta a la APERTURA del día D+1 (nunca en el mismo día que
//   genera la señal: sin look-ahead).
// - Los costes (comisión + slippage) se descuentan en cada operación.
// - El benchmark se compra y mantiene desde el primer día del periodo.

import {
  cagr,
  dailyReturns,
  annualizedVolatility,
  maxDrawdown,
  sharpe,
  sortino,
} from './indicators';
import { evaluateStrategy, type Signal } from './strategy';
import type {
  BacktestConfig,
  BacktestResult,
  Bar,
  NavPoint,
  SymbolStats,
  TradeRecord,
} from './types';

export interface EngineInput {
  config: BacktestConfig;
  /** Barras por símbolo (histórico completo, ascendente, incluye pre-periodo). */
  barsBySymbol: Record<string, Bar[]>;
  /** Barras del benchmark (mismo formato). */
  benchmarkBars: Bar[];
  /** Señales precalculadas por fecha de señal: { 'YYYY-MM-DD': { SYM: Signal } }. */
  signalMap: Record<string, Record<string, Signal>>;
  /** Fuente de datos (para transparencia en la UI). */
  dataSource?: string;
  notes?: string[];
}

const MS_PER_DAY = 86400000;

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Índice fecha → barra para acceso O(1). */
function indexBars(bars: Bar[]): Map<string, Bar> {
  const map = new Map<string, Bar>();
  for (const b of bars) map.set(b.date, b);
  return map;
}

/** Último precio conocido hasta `date` (forward fill). */
function priceAsOf(index: Map<string, Bar>, dates: string[], date: string): number | null {
  for (let i = dates.length - 1; i >= 0; i--) {
    const bar = index.get(dates[i]);
    if (bar && bar.date <= date) return bar.close;
  }
  return null;
}

function openAsOf(index: Map<string, Bar>, dates: string[], date: string): number | null {
  for (let i = dates.length - 1; i >= 0; i--) {
    const bar = index.get(dates[i]);
    if (bar && bar.date <= date) return bar.open;
  }
  return null;
}

/** Fechas de trading comunes (presencia en el benchmark) dentro del periodo. */
export function tradingCalendar(
  benchmarkBars: Bar[],
  startDate: string,
  endDate: string,
): string[] {
  return benchmarkBars
    .map((b) => b.date)
    .filter((d) => d >= startDate && d <= endDate);
}

/**
 * Calcula el mapa de señales para las estrategias deterministas.
 * Una entrada por cada fecha del calendario.
 */
export function buildSignalMap(
  config: BacktestConfig,
  barsBySymbol: Record<string, Bar[]>,
  dates: string[],
): Record<string, Record<string, Signal>> {
  const map: Record<string, Record<string, Signal>> = {};
  const symbols = config.symbols;

  for (const date of dates) {
    const perSymbol: Record<string, Signal> = {};
    for (const sym of symbols) {
      const bars = barsBySymbol[sym] || [];
      const upto = bars.filter((b) => b.date <= date);
      if (upto.length === 0) {
        perSymbol[sym] = { target: 0, score: 0, reason: 'Sin datos' };
        continue;
      }
      perSymbol[sym] = evaluateStrategy(config.strategy, { symbol: sym, bars: upto });
    }
    map[date] = perSymbol;
  }
  return map;
}

interface PositionState {
  shares: number;
  avgPrice: number;
  costBasis: number; // coste total pagado (incluye costes)
  realized: number; // P&L realizado acumulado del símbolo
}

export function runEngine(input: EngineInput): BacktestResult {
  const { config, barsBySymbol, benchmarkBars, signalMap } = input;
  const symbols = config.symbols;
  const notes: string[] = [...(input.notes || [])];

  const bmIndex = indexBars(benchmarkBars);
  const dates = tradingCalendar(benchmarkBars, config.startDate, config.endDate);

  if (dates.length < 2) {
    throw new Error('No hay suficientes sesiones en el periodo indicado.');
  }

  const symbolIndexes: Record<string, Map<string, Bar>> = {};
  const symbolDates: Record<string, string[]> = {};
  for (const sym of symbols) {
    const bars = barsBySymbol[sym] || [];
    symbolIndexes[sym] = indexBars(bars);
    symbolDates[sym] = bars.map((b) => b.date);
  }

  const costRate = (config.commissionBps + config.slippageBps) / 10000;

  let cash = config.initialCash;
  const positions: Record<string, PositionState> = {};
  const trades: TradeRecord[] = [];
  const nav: NavPoint[] = [];

  let totalCosts = 0;
  let tradedValue = 0;
  let exposureAcc = 0;

  // Órdenes pendientes generadas por la señal del cierre de D → se ejecutan a
  // la apertura de D+1.
  interface PendingOrder {
    symbol: string;
    side: 'buy' | 'sell';
    value: number; // valor objetivo de la posición (para buys) o valor a vender
    reason: string;
    signalDate: string; // cierre que generó la orden
    full?: boolean; // cierre total de la posición (no venta parcial)
  }
  let pending: PendingOrder[] = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const isLast = i === dates.length - 1;

    // 1) Ejecutar las órdenes pendientes a la APERTURA de hoy (se generaron
    //    con el cierre de ayer, así que siempre caen dentro del periodo).
    if (pending.length > 0) {
      for (const order of pending) {
        const open = openAsOf(symbolIndexes[order.symbol], symbolDates[order.symbol], date);
        if (open === null || open <= 0) continue;

        const pos = positions[order.symbol];

        if (order.side === 'sell') {
          if (!pos || pos.shares <= 0) continue;
          const shares = order.full
            ? pos.shares
            : Math.min(pos.shares, Math.floor(order.value / open));
          if (shares <= 0) continue;
          const gross = shares * open;
          const cost = gross * costRate;
          const pnl = gross - cost - (pos.costBasis * shares) / pos.shares;
          cash += gross - cost;
          pos.shares -= shares;
          pos.costBasis = (pos.costBasis * (pos.shares)) / (pos.shares + shares);
          pos.realized += pnl;
          totalCosts += cost;
          tradedValue += gross;
          trades.push({
            date,
            signalDate: order.signalDate,
            symbol: order.symbol,
            side: 'sell',
            shares,
            price: open,
            value: gross,
            cost,
            reason: order.reason,
            pnl,
          });
          if (pos.shares <= 0) delete positions[order.symbol];
        } else {
          const budget = Math.min(order.value, cash);
          if (budget <= 0) continue;
          const shares = Math.floor(budget / (open * (1 + costRate)));
          if (shares <= 0) continue;
          const gross = shares * open;
          const cost = gross * costRate;
          if (gross + cost > cash) continue;
          cash -= gross + cost;
          if (!pos) {
            positions[order.symbol] = {
              shares,
              avgPrice: open,
              costBasis: gross + cost,
              realized: 0,
            };
          } else {
            pos.shares += shares;
            pos.costBasis += gross + cost;
            pos.avgPrice = pos.costBasis / pos.shares;
          }
          totalCosts += cost;
          tradedValue += gross;
          trades.push({
            date,
            signalDate: order.signalDate,
            symbol: order.symbol,
            side: 'buy',
            shares,
            price: open,
            value: gross,
            cost,
            reason: order.reason,
          });
        }
      }
      pending = [];
    }

    // 2) Valorar la cartera al CIERRE de hoy.
    let positionsValue = 0;
    for (const sym of Object.keys(positions)) {
      const price = priceAsOf(symbolIndexes[sym], symbolDates[sym], date) ?? positions[sym].avgPrice;
      positionsValue += positions[sym].shares * price;
    }
    const equity = cash + positionsValue;
    const invested = equity > 0 ? positionsValue / equity : 0;
    exposureAcc += invested;

    // 3) Benchmark: buy & hold desde el primer día del periodo.
    const bmFirst = bmIndex.get(dates[0]);
    const bmNow = bmIndex.get(date);
    const benchmarkValue = bmFirst && bmNow && bmFirst.close > 0
      ? config.initialCash * (bmNow.close / bmFirst.close)
      : config.initialCash;

    nav.push({ date, value: equity, benchmark: benchmarkValue, cash, invested });

    // 4) Generar órdenes con la señal del CIERRE de hoy (se ejecutan mañana).
    if (!isLast) {
      const signals = signalMap[date];
      if (signals) {
        const slotWeight = 1 / Math.max(1, symbols.length);
        const next: PendingOrder[] = [];

        for (const sym of symbols) {
          const signal = signals[sym];
          if (!signal) continue;
          const pos = positions[sym];
          const price = priceAsOf(symbolIndexes[sym], symbolDates[sym], date);
          const currentValue = pos && price !== null ? pos.shares * price : 0;
          const targetValue = signal.target === 1 ? equity * slotWeight : 0;

          if (signal.target === 1) {
            if (targetValue - currentValue > equity * 0.02) {
              next.push({
                symbol: sym,
                side: 'buy',
                value: targetValue - currentValue,
                reason: signal.reason,
                signalDate: date,
              });
            } else if (currentValue > targetValue * 1.1 && currentValue > equity * 0.02) {
              next.push({
                symbol: sym,
                side: 'sell',
                value: currentValue - targetValue,
                reason: signal.reason,
                signalDate: date,
              });
            }
          } else if (pos && pos.shares > 0) {
            next.push({
              symbol: sym,
              side: 'sell',
              value: currentValue,
              reason: signal.reason,
              signalDate: date,
              full: true,
            });
          }
        }
        pending = next;
      }
    }
  }

  // ── Métricas ──────────────────────────────────────────────────────────────
  const equitySeries = nav.map((n) => n.value);
  const bmSeries = nav.map((n) => n.benchmark);
  const returns = dailyReturns(equitySeries);
  const finalEquity = equitySeries[equitySeries.length - 1];
  const finalReturn = config.initialCash > 0 ? (finalEquity - config.initialCash) / config.initialCash : 0;
  const years = Math.max(
    (parseDate(dates[dates.length - 1]).getTime() - parseDate(dates[0]).getTime()) / (365.25 * MS_PER_DAY),
    1 / 365.25,
  );

  const sells = trades.filter((t) => t.side === 'sell' && typeof t.pnl === 'number');
  const wins = sells.filter((t) => (t.pnl as number) > 0);
  const losses = sells.filter((t) => (t.pnl as number) <= 0);
  const grossProfit = wins.reduce((acc, t) => acc + (t.pnl as number), 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl as number), 0));
  const avgEquity = equitySeries.reduce((a, b) => a + b, 0) / equitySeries.length;

  const symbolStats: SymbolStats[] = symbols.map((sym) => {
    const symTrades = trades.filter((t) => t.symbol === sym);
    const symSells = symTrades.filter((t) => t.side === 'sell' && typeof t.pnl === 'number');
    const realized = symTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const first = priceAsOf(symbolIndexes[sym], symbolDates[sym], dates[0]);
    const last = priceAsOf(symbolIndexes[sym], symbolDates[sym], dates[dates.length - 1]);
    const returnPct = first && last && first > 0 ? last / first - 1 : 0;
    // Contribución aproximada:PnL realizado + variación del valor de la posición no cerrada.
    return {
      symbol: sym,
      trades: symTrades.length,
      wins: symSells.filter((t) => (t.pnl as number) > 0).length,
      losses: symSells.filter((t) => (t.pnl as number) <= 0).length,
      realizedPnl: realized,
      returnPct,
      contribution: avgEquity > 0 ? realized / avgEquity : 0,
    };
  });

  const benchmarkReturn = config.initialCash > 0 ? (bmSeries[bmSeries.length - 1] - config.initialCash) / config.initialCash : 0;

  return {
    config,
    finalReturn,
    maxDrawdown: maxDrawdown(equitySeries),
    sortino: sortino(returns),
    sharpe: sharpe(returns),
    cagr: cagr(config.initialCash, finalEquity, years),
    volatility: annualizedVolatility(returns),
    winRate: sells.length > 0 ? wins.length / sells.length : 0,
    // Infinity no es serializable en JSON: se limita a 99 y se anota.
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    exposure: nav.length > 0 ? exposureAcc / nav.length : 0,
    turnover: avgEquity > 0 ? tradedValue / avgEquity / years : 0,
    totalTrades: trades.length,
    totalCosts,
    finalEquity,
    benchmarkReturn,
    benchmarkMaxDrawdown: maxDrawdown(bmSeries),
    alpha: finalReturn - benchmarkReturn,
    nav,
    trades,
    symbolStats,
    tradingDays: dates.length,
    dataSource: input.dataSource || 'desconocida',
    notes,
  };
}
