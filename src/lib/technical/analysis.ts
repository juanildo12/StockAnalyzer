export function getRaw(value: any): any {
  if (value && typeof value === 'object' && 'raw' in value) return value.raw;
  return value;
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function calcRSI(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

export function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = highs.length - period; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / period;
}

export function calcVolumeMA(volumes: number[], period: number): number | null {
  if (volumes.length < period) return null;
  const slice = volumes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export interface Levels {
  resistance: number;
  support: number;
  target1: number;
  target2: number;
  stopLoss: number;
  riskReward: number;
  consolidationHigh: number;
  consolidationLow: number;
  atr: number | null;
}

export function detectLevels(
  closes: number[],
  highs: number[],
  lows: number[],
  currentPrice: number,
): Levels {
  const lookback = Math.min(closes.length, 60);
  const recent = closes.slice(-lookback);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);

  const highsAbove = recentHighs.filter(h => h > currentPrice * 0.98);
  const resistance = highsAbove.length > 0
    ? Math.min(...highsAbove)
    : currentPrice * 1.05;

  const lowsBelow = recentLows.filter(l => l < currentPrice * 1.02);
  const support = lowsBelow.length > 0
    ? Math.max(...lowsBelow)
    : currentPrice * 0.95;

  const consolidationLookback = Math.min(recent.length, 20);
  const consolidationSlice = recent.slice(-consolidationLookback);
  const consolidationHigh = Math.max(...consolidationSlice);
  const consolidationLow = Math.min(...consolidationSlice);

  const atr = calcATR(highs, lows, closes);

  const breakoutLevel = resistance;
  const rangeSize = consolidationHigh - consolidationLow;
  const target1 = breakoutLevel + rangeSize * 1.0;
  const target2 = breakoutLevel + rangeSize * 2.0;

  const stopLoss = Math.min(support, consolidationLow) * 0.99;

  const risk = currentPrice - stopLoss;
  const reward = target1 - currentPrice;
  const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

  return {
    resistance: Math.round(resistance * 100) / 100,
    support: Math.round(support * 100) / 100,
    target1: Math.round(target1 * 100) / 100,
    target2: Math.round(target2 * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    riskReward,
    consolidationHigh: Math.round(consolidationHigh * 100) / 100,
    consolidationLow: Math.round(consolidationLow * 100) / 100,
    atr: atr !== null ? Math.round(atr * 100) / 100 : null,
  };
}

export interface BreakoutComponents {
  trend: number;
  volume: number;
  structure: number;
  safety: number;
}

export function computeBreakoutScore(
  price: number,
  changePercent: number,
  rsi: number | null,
  sma50: number | null,
  sma200: number | null,
  volRatio: number,
  peRatio: number | null,
  revenueGrowth: number | null,
  levels: Levels,
  marketCap: number,
): { score: number; components: BreakoutComponents; reasons: string[] } {
  const reasons: string[] = [];

  let trend = 0;
  if (sma50 !== null && price > sma50) { trend += 10; reasons.push('Above SMA50'); }
  if (sma200 !== null && price > sma200) { trend += 8; reasons.push('Above SMA200'); }
  if (sma50 !== null && sma200 !== null && sma50 > sma200) { trend += 7; reasons.push('Golden cross'); }
  if (rsi !== null && rsi > 50 && rsi < 70) { trend += 5; reasons.push(`RSI bullish (${Math.round(rsi)})`); }
  else if (rsi !== null && rsi >= 70) { trend += 2; }
  trend = clamp(trend, 0, 30);

  let volume = 0;
  if (volRatio > 3.0) { volume += 25; reasons.push(`Volume surge ${volRatio.toFixed(1)}x`); }
  else if (volRatio > 2.0) { volume += 20; reasons.push(`High volume ${volRatio.toFixed(1)}x`); }
  else if (volRatio > 1.5) { volume += 15; reasons.push(`Volume above avg ${volRatio.toFixed(1)}x`); }
  else if (volRatio > 1.2) { volume += 10; }
  if (changePercent > 0 && volRatio > 1.3) { volume += 5; }
  volume = clamp(volume, 0, 30);

  let structure = 0;
  const proximityPct = levels.resistance > 0
    ? ((levels.resistance - price) / price) * 100
    : 50;
  if (proximityPct < 1) { structure += 10; reasons.push('At resistance'); }
  else if (proximityPct < 3) { structure += 8; reasons.push('Near resistance'); }
  else if (proximityPct < 5) { structure += 5; }
  const rangePct = levels.consolidationHigh > 0
    ? ((levels.consolidationHigh - levels.consolidationLow) / levels.consolidationHigh) * 100
    : 50;
  if (rangePct < 5) { structure += 6; reasons.push('Tight consolidation'); }
  else if (rangePct < 10) { structure += 4; }
  if (levels.riskReward >= 2) { structure += 4; reasons.push(`R/R ${levels.riskReward.toFixed(1)}:1`); }
  else if (levels.riskReward >= 1.5) { structure += 2; }
  structure = clamp(structure, 0, 20);

  let safety = 0;
  if (peRatio !== null && peRatio > 0 && peRatio < 50) { safety += 8; }
  else if (peRatio !== null && peRatio >= 50) { safety += 3; }
  if (revenueGrowth !== null && revenueGrowth > 15) { safety += 8; reasons.push(`Revenue +${Math.round(revenueGrowth)}%`); }
  else if (revenueGrowth !== null && revenueGrowth > 5) { safety += 5; }
  if (marketCap > 10e9) { safety += 4; }
  else if (marketCap > 2e9) { safety += 2; }
  safety = clamp(safety, 0, 20);

  const score = trend + volume + structure + safety;

  return { score, components: { trend, volume, structure, safety }, reasons };
}
