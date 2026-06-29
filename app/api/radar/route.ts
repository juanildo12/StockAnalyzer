import { NextRequest, NextResponse } from 'next/server';
import { getBars, getShortInterest, getMarketStatus } from '@/src/services/polygonClient';
import { getCompanyProfile, getStockIndicators } from '@/src/services/finnhubClient';

export const dynamic = 'force-dynamic';

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result.push(sum / period);
  for (let i = period; i < values.length; i++) {
    result.push((values[i] - result[result.length - 1]) * multiplier + result[result.length - 1]);
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j];
    result.push(sum / period);
  }
  return result;
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const sym = symbol.toUpperCase();
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 2);

  try {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const [bars, spyBars, shortInterest, profile, marketStatus, indicators] = await Promise.all([
      getBars(sym, fmt(from), to, 1, 'day').catch(() => []),
      getBars('SPY', fmt(from), to, 1, 'day').catch(() => []),
      getShortInterest(sym).catch(() => []),
      getCompanyProfile(sym).catch(() => null),
      getMarketStatus().catch(() => null),
      getStockIndicators(sym, 'D', 120).catch(() => null),
    ]);

    const closes = bars.map((b: any) => b.c).filter((c: number) => c > 0);
    const highs = bars.map((b: any) => b.h).filter((h: number) => h > 0);
    const lows = bars.map((b: any) => b.l).filter((l: number) => l > 0);
    const volumes = bars.map((b: any) => b.v).filter((v: number) => v > 0);
    const opens = bars.map((b: any) => b.o).filter((o: number) => o > 0);
    const spyCloses = spyBars.map((b: any) => b.c).filter((c: number) => c > 0);

    const current = closes[closes.length - 1] || 0;
    const prevClose = closes[closes.length - 2] || current;
    const change = current - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // ---- LONG-TERM METRICS ----

    // 1. Trend Quality
    let trendQuality = 50;
    if (closes.length >= 200) {
      const sma50Arr = sma(closes, 50);
      const sma200Arr = sma(closes, 200);
      const sma50 = sma50Arr[sma50Arr.length - 1] || 0;
      const sma200 = sma200Arr[sma200Arr.length - 1] || 0;
      const above50 = current > sma50;
      const above200 = current > sma200;
      const sma50above200 = sma50 > sma200;

      if (above50 && sma50above200) trendQuality = 85;
      else if (above50 && !sma50above200) trendQuality = 60;
      else if (!above50 && above200) trendQuality = 40;
      else trendQuality = 20;

      // ADX boost from Finnhub
      const adx = indicators?.adx?.[0];
      if (adx && adx > 25) trendQuality = Math.min(100, trendQuality + 10);
      if (adx && adx > 40) trendQuality = Math.min(100, trendQuality + 10);
    }

    // 2. EMA Alignment
    let emaAlignment = 50;
    if (closes.length >= 200) {
      const ema9 = ema(closes, 9);
      const ema21 = ema(closes, 21);
      const ema50 = ema(closes, 50);
      const ema200 = ema(closes, 200);
      const e9 = ema9[ema9.length - 1] || 0;
      const e21 = ema21[ema21.length - 1] || 0;
      const e50 = ema50[ema50.length - 1] || 0;
      const e200 = ema200[ema200.length - 1] || 0;

      let aligned = 0;
      if (e9 > e21) aligned++;
      if (e21 > e50) aligned++;
      if (e50 > e200) aligned++;
      if (current > e9) aligned++;
      emaAlignment = aligned * 25;
    }

    // 3. ADR Potential
    let adrPotential = 50;
    if (closes.length >= 50) {
      const recentADR: number[] = [];
      for (let i = Math.max(0, closes.length - 20); i < closes.length; i++) {
        if (highs[i] && lows[i] && closes[i]) recentADR.push(((highs[i] - lows[i]) / closes[i]) * 100);
      }
      const histADR: number[] = [];
      const histStart = Math.max(0, closes.length - 50);
      const histEnd = Math.max(0, closes.length - 20);
      for (let i = histStart; i < histEnd; i++) {
        if (highs[i] && lows[i] && closes[i]) histADR.push(((highs[i] - lows[i]) / closes[i]) * 100);
      }

      const avgRecent = recentADR.length > 0 ? recentADR.reduce((a, b) => a + b, 0) / recentADR.length : 0;
      const avgHist = histADR.length > 0 ? histADR.reduce((a, b) => a + b, 0) / histADR.length : 0;

      const expansion = avgRecent - avgHist;
      adrPotential = clamp(50 + expansion * 5 + avgRecent * 2);
    }

    // 4. Relative Strength vs SPY
    let relativeStrength = 50;
    if (closes.length >= 126 && spyCloses.length >= 126) {
      const sym1m = closes[closes.length - 1] / closes[closes.length - 22];
      const sym3m = closes[closes.length - 1] / closes[closes.length - 63];
      const sym6m = closes[closes.length - 1] / closes[closes.length - 126];

      const spy1m = spyCloses[spyCloses.length - 1] / spyCloses[spyCloses.length - 22];
      const spy3m = spyCloses[spyCloses.length - 1] / spyCloses[spyCloses.length - 63];
      const spy6m = spyCloses[spyCloses.length - 1] / spyCloses[spyCloses.length - 126];

      const rel1m = ((sym1m / spy1m) - 1) * 100;
      const rel3m = ((sym3m / spy3m) - 1) * 100;
      const rel6m = ((sym6m / spy6m) - 1) * 100;

      relativeStrength = clamp(50 + rel1m * 3 + rel3m * 2 + rel6m * 1);
    }

    // 5. Market Context
    let marketContext = 50;
    const isMarketOpen = marketStatus?.market === 'open';
    if (isMarketOpen) marketContext = 65;
    else marketContext = 45;

    if (profile?.finnhubIndustry) {
      // Boost if in a generally strong sector
      const strongSectors = ['Technology', 'Semiconductors', 'Software'];
      if (strongSectors.some(s => profile.finnhubIndustry?.includes(s))) {
        marketContext += 15;
      }
    }

    if (spyCloses.length >= 22) {
      const spyTrend = spyCloses[spyCloses.length - 1] / spyCloses[spyCloses.length - 22];
      if (spyTrend > 1.05) marketContext += 10;
      else if (spyTrend < 0.95) marketContext -= 10;
    }

    marketContext = clamp(marketContext);

    // ---- SHORT-TERM METRICS ----

    const volSMA = volumes.length >= 20
      ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
      : 1;
    const lastVol = volumes[volumes.length - 1] || 1;
    const volRatio = lastVol / volSMA;

    const high20 = Math.max(...highs.slice(-20));
    const low20 = Math.min(...lows.slice(-20));
    const range20 = high20 - low20 || 1;

    // 1. Breakout Strength
    let breakoutStrength = 50;
    if (closes.length >= 20) {
      const pricePosition = ((current - low20) / range20) * 100;
      breakoutStrength = clamp(pricePosition * 0.6 + (volRatio > 1.5 ? 30 : volRatio > 1 ? 15 : 0) + (pricePosition > 80 ? 10 : 0));
    }

    // 2. Volume Spike
    let volumeSpike = 50;
    volumeSpike = clamp(volRatio > 2.5 ? 95 : volRatio > 2.0 ? 85 : volRatio > 1.5 ? 70 : volRatio > 1.2 ? 55 : volRatio > 1.0 ? 45 : volRatio > 0.7 ? 30 : 15);

    // 3. Candle Quality
    let candleQuality = 50;
    if (opens.length >= 5 && closes.length >= 5) {
      const ratios: number[] = [];
      for (let i = closes.length - 5; i < closes.length; i++) {
        if (i >= 0 && i < opens.length && i < highs.length && i < lows.length) {
          const body = Math.abs(closes[i] - opens[i]);
          const range = highs[i] - lows[i] || 1;
          ratios.push(body / range);
        }
      }
      const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0.5;
      candleQuality = clamp(avgRatio * 100);
    }

    // 4. Entry Confidence
    let entryConfidence = 50;
    if (closes.length >= 20) {
      const rsi = indicators?.rsi?.[0] || 50;
      const nearSupport = ((current - low20) / range20) * 100;
      const rsiScore = rsi >= 40 && rsi <= 60 ? 30 : ((rsi > 60 ? 70 - rsi : rsi) / 70) * 30;
      const volScore = volRatio > 1.2 ? 25 : 10;
      const supportScore = nearSupport < 30 ? 30 : nearSupport < 50 ? 20 : 10;
      entryConfidence = clamp(rsiScore + volScore + supportScore + 10);
    }

    // 5. Risk / Reward
    let riskReward = 50;
    if (range20 > 0 && current > low20) {
      const upside = high20 - current;
      const downside = current - low20;
      const rr = downside > 0 ? upside / downside : 3;
      riskReward = clamp(rr >= 3 ? 90 : rr >= 2 ? 75 : rr >= 1.5 ? 60 : rr >= 1 ? 45 : rr >= 0.5 ? 30 : 15);
    }

    return NextResponse.json({
      symbol: sym,
      price: current,
      change,
      changePercent,
      updated: new Date().toISOString(),
      longTerm: {
        trendQuality: clamp(trendQuality),
        emaAlignment: clamp(emaAlignment),
        adrPotential: clamp(adrPotential),
        relativeStrength: clamp(relativeStrength),
        marketContext: clamp(marketContext),
      },
      shortTerm: {
        breakoutStrength: clamp(breakoutStrength),
        volumeSpike: clamp(volumeSpike),
        candleQuality: clamp(candleQuality),
        entryConfidence: clamp(entryConfidence),
        riskReward: clamp(riskReward),
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      symbol: sym,
      price: 0,
      change: 0,
      changePercent: 0,
      updated: new Date().toISOString(),
      error: err.message,
      longTerm: { trendQuality: 50, emaAlignment: 50, adrPotential: 50, relativeStrength: 50, marketContext: 50 },
      shortTerm: { breakoutStrength: 50, volumeSpike: 50, candleQuality: 50, entryConfidence: 50, riskReward: 50 },
    });
  }
}
