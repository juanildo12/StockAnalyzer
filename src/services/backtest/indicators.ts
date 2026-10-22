// Indicadores y métricas del backtest. Todo puro (sin I/O) para poder testearlo.

export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

export function ema(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  let e = 0;
  for (let i = 0; i < period; i++) e += values[i];
  e /= period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

/** RSI de Wilder (media suavizada, la estándar). */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** ATR (True Range medio) en precio absoluto. */
export function atr(bars: { high: number; low: number; close: number }[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - prevClose),
      Math.abs(bars[i].low - prevClose),
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let sum = 0;
  for (let i = trs.length - period; i < trs.length; i++) sum += trs[i];
  return sum / period;
}

/** Rendimientos diarios (fracciones) a partir de una serie de valores. */
export function dailyReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    if (!prev) continue;
    out.push((values[i] - prev) / prev);
  }
  return out;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let acc = 0;
  for (const v of values) acc += (v - mean) * (v - mean);
  return Math.sqrt(acc / (values.length - 1));
}

/** Desviación downside: raíz de la media de los min(retorno, 0)². */
export function downsideDeviation(returns: number[]): number {
  const downside = returns.filter((r) => r < 0);
  if (downside.length === 0) return 0;
  let acc = 0;
  for (const r of downside) acc += r * r;
  return Math.sqrt(acc / downside.length);
}

/** Sortino: retorno medio / desviación downside (anualizado si `periodsPerYear`). */
export function sortino(returns: number[], periodsPerYear = 252): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const dd = downsideDeviation(returns);
  if (dd === 0) return 0;
  return (mean / dd) * Math.sqrt(periodsPerYear);
}

/** Sharpe (exceso sobre la tasa libre, anualizado). */
export function sharpe(returns: number[], periodsPerYear = 252, riskFree = 0): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sd = stdev(returns);
  if (sd === 0) return 0;
  return ((mean - riskFree / periodsPerYear) / sd) * Math.sqrt(periodsPerYear);
}

export function maxDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/** CAGR a partir del número de años efectivo. */
export function cagr(initial: number, final: number, years: number): number {
  if (initial <= 0 || years <= 0) return 0;
  if (final <= 0) return -1;
  return Math.pow(final / initial, 1 / years) - 1;
}

/** Volatilidad anualizada de los rendimientos diarios. */
export function annualizedVolatility(returns: number[], periodsPerYear = 252): number {
  return stdev(returns) * Math.sqrt(periodsPerYear);
}
