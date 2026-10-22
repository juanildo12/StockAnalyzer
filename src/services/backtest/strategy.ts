// Estrategias de señales del backtest. Puras: reciben el histórico (hasta el
// cierre del día evaluado) y devienen la señal objetivo. El motor se encarga
// de convertir la señal en órdenes (ejecución a la apertura del día siguiente).

import { sma, rsi, ema } from './indicators';
import type { BacktestStrategy, Bar } from './types';

export interface Signal {
  /** 1 = mantener posición larga, 0 = sin posición. */
  target: 0 | 1;
  /** Prioridad de la señal cuando hay más candidatos que huecos. */
  score: number;
  reason: string;
}

export interface StrategyContext {
  symbol: string;
  /** Barras hasta el cierre del día evaluado (incluido). */
  bars: Bar[];
  /** Nº de barras de lookback para el momentum (por defecto 252 - 21). */
  momentumLookback?: number;
}

/** Momentum 12-1: retorno de los últimos 12 meses excluyendo el mes más reciente. */
export function momentum12_1(bars: Bar[], lookback = 252, skip = 21): number | null {
  if (bars.length < lookback + skip + 1) return null;
  const endIdx = bars.length - skip - 1;
  const past = bars[endIdx].close;
  const now = bars[bars.length - 1].close;
  if (!past) return null;
  return now / past - 1;
}

export function evaluateStrategy(strategy: BacktestStrategy, ctx: StrategyContext): Signal {
  const { bars } = ctx;
  if (bars.length < 30) {
    return { target: 0, score: 0, reason: 'Historial insuficiente (<30 sesiones)' };
  }

  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);

  switch (strategy) {
    case 'buy-and-hold': {
      return {
        target: 1,
        score: 0,
        reason: 'Buy & hold: se compra al inicio del periodo y se mantiene',
      };
    }

    case 'trend': {
      if (!sma50 || !sma200) {
        return { target: 0, score: 0, reason: 'Sin SMA200 (historial < 200 sesiones)' };
      }
      const above = last.close > sma200;
      const golden = sma50 > sma200;
      if (above && golden) {
        return {
          target: 1,
          score: (last.close - sma200) / sma200,
          reason: `Tendencia alcista: cierre ${last.close.toFixed(2)} > SMA200 ${sma200.toFixed(2)} y SMA50 ${sma50.toFixed(2)} > SMA200`,
        };
      }
      if (!above) {
        return {
          target: 0,
          score: 0,
          reason: `Tendencia bajista: cierre ${last.close.toFixed(2)} < SMA200 ${sma200.toFixed(2)}`,
        };
      }
      return {
        target: 0,
        score: 0,
        reason: `SMA50 ${sma50.toFixed(2)} <= SMA200 ${sma200.toFixed(2)} (sin cruce alcista)`,
      };
    }

    case 'momentum': {
      const mom = momentum12_1(bars, ctx.momentumLookback ?? 252, 21);
      if (mom === null) {
        return { target: 0, score: 0, reason: 'Sin histórico suficiente para momentum 12-1' };
      }
      if (rsi14 !== null && rsi14 > 75) {
        return { target: 0, score: 0, reason: `Momentum positivo pero RSI ${rsi14.toFixed(0)} sobrecompra` };
      }
      if (mom > 0 && sma50 && last.close > sma50) {
        return {
          target: 1,
          score: mom,
          reason: `Momentum 12-1 +${(mom * 100).toFixed(1)}% y cierre sobre SMA50`,
        };
      }
      return { target: 0, score: 0, reason: `Momentum 12-1 ${(mom * 100).toFixed(1)}%` };
    }

    case 'mean-reversion': {
      if (rsi14 === null) {
        return { target: 0, score: 0, reason: 'Sin RSI (historial insuficiente)' };
      }
      const ema21 = ema(closes, 21);
      const belowEma = ema21 !== null && last.close < ema21;
      if (rsi14 < 35 && belowEma) {
        return {
          target: 1,
          score: (35 - rsi14) / 35,
          reason: `Reversión: RSI ${rsi14.toFixed(0)} sobrevendido y cierre bajo EMA21`,
        };
      }
      if (rsi14 > 70) {
        return { target: 0, score: 0, reason: `RSI ${rsi14.toFixed(0)} sobrecomprado` };
      }
      return { target: 0, score: 0, reason: `RSI ${rsi14.toFixed(0)} en zona neutra` };
    }

    case 'ai':
    default:
      return { target: 0, score: 0, reason: 'Estrategia no reconocida' };
  }
}

export const STRATEGIES: { id: BacktestStrategy; label: string; description: string }[] = [
  {
    id: 'trend',
    label: 'Tendencia (SMA50/SMA200)',
    description: 'Largo cuando el cierre está sobre la SMA200 y la SMA50 supera la SMA200.',
  },
  {
    id: 'momentum',
    label: 'Momentum 12-1',
    description: 'Largo con momentum 12-1 positivo y cierre sobre la SMA50; sale con RSI > 75.',
  },
  {
    id: 'mean-reversion',
    label: 'Reversión a la media',
    description: 'Compra con RSI < 35 y cierre bajo la EMA21; sale con RSI > 70.',
  },
  {
    id: 'buy-and-hold',
    label: 'Buy & hold',
    description: 'Compra al inicio del periodo y mantiene la posición.',
  },
  {
    id: 'ai',
    label: 'Agente IA',
    description: 'El modelo de lenguaje decide en cada rebalanceo (requiere OPENROUTER_API_KEY).',
  },
];
