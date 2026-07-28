import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { STOCK_POOL } from '@/src/lib/stockPool';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export const dynamic = 'force-dynamic';

let memoryCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 180_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}

function calcRSI(closes: number[]): number | null {
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

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
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

function detectLevels(closes: number[], highs: number[], lows: number[], currentPrice: number) {
  const lookback = Math.min(closes.length, 60);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);

  const highsAbove = recentHighs.filter(h => h > currentPrice * 0.98);
  const resistance = highsAbove.length > 0 ? Math.min(...highsAbove) : currentPrice * 1.05;

  const lowsBelow = recentLows.filter(l => l < currentPrice * 1.02);
  const support = lowsBelow.length > 0 ? Math.max(...lowsBelow) : currentPrice * 0.95;

  const consLookback = Math.min(closes.length, 20);
  const consSlice = closes.slice(-consLookback);
  const consHigh = Math.max(...consSlice);
  const consLow = Math.min(...consSlice);
  const rangeSize = consHigh - consLow;

  const target1 = resistance + rangeSize * 1.0;
  const target2 = resistance + rangeSize * 2.0;
  const stopLoss = Math.min(support, consLow) * 0.99;

  const risk = currentPrice - stopLoss;
  const reward = target1 - currentPrice;
  const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

  return { resistance, support, target1, target2, stopLoss, riskReward };
}

interface AlgoAlert {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  pattern: 'volume_spike' | 'breakout' | 'momentum_reversal' | 'accumulation' | 'squeeze';
  patternLabel: string;
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'MODERATE';
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  reasons: string[];
  volumeRatio: number;
  rsi: number | null;
  sector: string;
  marketCap: number;
  detectedAt: string;
}

function detectPattern(closes: number[], highs: number[], lows: number[], volumes: number[], price: number, changePercent: number, volume: number, rsi: number | null, sma50: number | null, sma200: number | null): { pattern: AlgoAlert['pattern']; label: string; score: number; reasons: string[] } {
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = avgVol20 > 0 ? volume / avgVol20 : 1;

  const levels = detectLevels(closes, highs, lows, price);
  const pctFromHigh52 = Math.max(...highs.slice(-252).length > 0 ? highs.slice(-252) : highs);
  const pctFromLow52 = Math.min(...lows.slice(-252).length > 0 ? lows.slice(-252) : lows);
  const weekRange = pctFromHigh52 - pctFromLow52;
  const positionIn52wk = weekRange > 0 ? ((price - pctFromLow52) / weekRange) * 100 : 50;

  const sma10 = calcSMA(closes, 10);
  const sma20 = calcSMA(closes, 20);
  const sma5 = calcSMA(closes, 5);
  const prevRsi = closes.length > 15 ? calcRSI(closes.slice(0, -1)) : null;

  const reasons: string[] = [];
  let score = 0;
  let pattern: AlgoAlert['pattern'] = 'volume_spike';
  let label = 'Volumen Inusual';

  // Volume Spike detection — lowered from 2.5x to 1.5x
  if (volRatio >= 1.5) {
    pattern = 'volume_spike';
    label = 'Volumen Explosivo';
    score = clamp(volRatio * 15 + (changePercent > 0 ? 12 : 5));
    reasons.push(`Vol ${volRatio.toFixed(1)}x promedio 20d`);
    if (changePercent > 0.5) { reasons.push('Precio sube con volumen'); score += 8; }
    if (changePercent < -0.5 && volRatio > 2) { reasons.push('Distribución masiva'); score += 5; }
    if (rsi !== null && rsi > 40 && rsi < 75) { reasons.push(`RSI ${Math.round(rsi)} saludable`); score += 5; }
    if (sma50 !== null && price > sma50) { reasons.push('Sobre SMA50'); score += 5; }
    if (sma5 !== null && sma10 !== null && sma5 > sma10) { reasons.push('SMA5 > SMA10'); score += 5; }
  }

  // Breakout detection — relaxed resistance proximity from 3% to 5%, R/R from 1.5 to 1.2
  const nearResistance = levels.riskReward > 1.2 && (levels.resistance - price) / price < 0.05;
  const aboveConsolidation = closes.length > 20 && price > Math.max(...closes.slice(-20));
  if (nearResistance && volRatio > 1.1) {
    if (!reasons.length || score < 65) {
      pattern = 'breakout';
      label = 'Breakout Potencial';
      score = 0;
      reasons.length = 0;
    }
    score = clamp(score + levels.riskReward * 12 + volRatio * 10 + (aboveConsolidation ? 15 : 5));
    reasons.push(`Cerca de resistencia $${levels.resistance.toFixed(2)}`);
    reasons.push(`R/R ${levels.riskReward.toFixed(1)}:1`);
    if (aboveConsolidation) reasons.push('Rompe consolidación 20d');
    if (rsi !== null && rsi > 45 && rsi < 75) { reasons.push('Momentum alcista'); score += 8; }
  }

  // Momentum Reversal detection — widened RSI range from 35 to 45
  if (rsi !== null && prevRsi !== null) {
    const rsiReversingUp = prevRsi < 45 && rsi > 45 && rsi > prevRsi;
    if (rsiReversingUp && changePercent > 0) {
      pattern = 'momentum_reversal';
      label = 'Reversal Alcista';
      score = clamp(65 + (45 - prevRsi) * 1.5 + volRatio * 6);
      reasons.push(`RSI reversa ${Math.round(prevRsi)} → ${Math.round(rsi)}`);
      if (volRatio > 1.0) reasons.push(`Vol ${volRatio.toFixed(1)}x confirma`);
      if (sma20 !== null && sma10 !== null && sma10 > sma20) { reasons.push('SMA10 > SMA20'); score += 8; }
      if (price > (sma50 || 0)) { reasons.push('Sobre SMA50'); score += 5; }
    }
  }

  // Accumulation detection — widened return range from 0.3%-2% to 0.1%-3%, volCV from 0.5 to 0.8
  if (closes.length >= 10 && volumes.length >= 10) {
    const last5Returns = [];
    for (let i = closes.length - 5; i < closes.length; i++) {
      if (i > 0) last5Returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgReturn = last5Returns.reduce((a, b) => a + b, 0) / last5Returns.length;
    const volStd = Math.sqrt(volumes.slice(-10).reduce((a, v) => {
      const mean = volumes.slice(-10).reduce((x, y) => x + y, 0) / 10;
      return a + (v - mean) ** 2;
    }, 0) / 10);
    const volCV = volStd / (avgVol20 || 1);
    if (avgReturn > 0.001 && avgReturn < 0.03 && volCV < 0.8 && volRatio > 0.7) {
      if (score < 60) {
        pattern = 'accumulation';
        label = 'Acumulación Institucional';
        score = clamp(55 + avgReturn * 400 + (1 - volCV) * 10);
        reasons.push(`Retroalimentación positiva constante ${(avgReturn * 100).toFixed(2)}%/día`);
        reasons.push('Volumen estable sin picos');
        if (rsi !== null && rsi > 40 && rsi < 70) { reasons.push(`RSI ${Math.round(rsi)} neutro-alcista`); score += 5; }
        if (sma50 !== null && price > sma50) { reasons.push('Sobre SMA50'); score += 5; }
      }
    }
  }

  // Short Squeeze detection — lowered positionIn52wk from 85 to 70, volRatio from 1.5 to 1.3, change from 2% to 1.5%
  if (positionIn52wk > 70 && volRatio > 1.3 && changePercent > 1.5) {
    if (score < 55) {
      pattern = 'squeeze';
      label = 'Posible Short Squeeze';
      score = clamp(60 + changePercent * 4 + volRatio * 5);
      reasons.push(`+${changePercent.toFixed(1)}% con vol ${volRatio.toFixed(1)}x`);
      reasons.push(`En zona alta 52wk (${Math.round(positionIn52wk)}%)`);
      if (rsi !== null && rsi > 65) { reasons.push(`RSI ${Math.round(rsi)} — impulso fuerte`); score += 5; }
    }
  }

  // Catch-all: if nothing triggered but there IS unusual volume (>=1.2x), generate a mild alert
  if (score === 0 && volRatio >= 1.2) {
    pattern = 'volume_spike';
    label = 'Actividad Inusual';
    score = clamp(volRatio * 10 + Math.abs(changePercent) * 3);
    reasons.push(`Vol ${volRatio.toFixed(1)}x sobre promedio`);
    if (Math.abs(changePercent) > 0.5) {
      reasons.push(`Movimiento ${changePercent > 0 ? 'alcista' : 'bajista'} del ${Math.abs(changePercent).toFixed(1)}%`);
    }
    if (rsi !== null) reasons.push(`RSI ${Math.round(rsi)}`);
  }

  return { pattern, label, score: clamp(score), reasons };
}

async function scanStocks(universe: string[]): Promise<AlgoAlert[]> {
  const alerts: AlgoAlert[] = [];
  const batchSize = 5;

  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const [quote, hist] = await Promise.all([
            withTimeout(yf.quote(symbol), 5000),
            withTimeout(yf.historical(symbol, { period1: new Date(Date.now() - 120 * 86400000), period2: new Date(), interval: '1d' }), 5000),
          ]);

          if (!quote || !hist || hist.length < 20) return null;

          const price = quote.regularMarketPrice || 0;
          if (price < 1 || !isFinite(price)) return null;

          const closes = hist.map(h => h.close);
          const highs = hist.map(h => h.high);
          const lows = hist.map(h => h.low);
          const volumes = hist.map(h => h.volume);
          const changePercent = quote.regularMarketChangePercent || 0;
          const volume = quote.regularMarketVolume || volumes[volumes.length - 1] || 0;
          const marketCap = quote.marketCap || 0;

          const rsi = calcRSI(closes);
          const sma50 = calcSMA(closes, 50);

          const result = detectPattern(closes, highs, lows, volumes, price, changePercent, volume, rsi, sma50, null);

          if (result.score < 30) return null;

          const levels = detectLevels(closes, highs, lows, price);
          const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

          const confidence: AlgoAlert['confidence'] =
            result.score >= 75 ? 'HIGH' : result.score >= 55 ? 'MEDIUM' : 'MODERATE';

          return {
            symbol,
            name: quote.shortName || quote.longName || symbol,
            price,
            changePercent,
            pattern: result.pattern,
            patternLabel: result.label,
            score: result.score,
            confidence,
            entry: levels.resistance,
            stopLoss: levels.stopLoss,
            target1: levels.target1,
            target2: levels.target2,
            riskReward: levels.riskReward,
            reasons: result.reasons.slice(0, 4),
            volumeRatio: avgVol20 > 0 ? Math.round((volume / avgVol20) * 100) / 100 : 0,
            rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
            sector: quote.sector || 'N/A',
            marketCap,
            detectedAt: new Date().toISOString(),
          } as AlgoAlert;
        } catch (e: any) {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) alerts.push(r);
    }
  }

  console.log(`[AlgoAlerts] scanStocks: ${alerts.length} alerts from ${universe.length} stocks`);
  return alerts.sort((a, b) => b.score - a.score).slice(0, 20);
}

export async function GET() {
  if (memoryCache && (Date.now() - memoryCache.ts) < CACHE_TTL) {
    return NextResponse.json(memoryCache.data);
  }

  try {
    const universe = STOCK_POOL.slice(0, 30);
    const alerts = await scanStocks(universe);

    const response = {
      alerts,
      scanned: universe.length,
      generatedAt: new Date().toISOString(),
    };

    memoryCache = { data: response, ts: Date.now() };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[AlgoAlerts] Error:', error);
    return NextResponse.json(
      { error: 'Error scanning stocks', alerts: [], scanned: 0, generatedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
