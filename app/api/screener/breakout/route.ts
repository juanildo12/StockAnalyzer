import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getQuote as finnhubQuote } from '@/src/services/finnhubClient';
import { STOCK_POOL } from '@/src/lib/stockPool';

const yf = new YahooFinance();

export const dynamic = 'force-dynamic';

function getRaw(value: any): any {
  if (value && typeof value === 'object' && 'raw' in value) return value.raw;
  return value;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}

// ─── Technical Calculations ──────────────────────────────────────────────────

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
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
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

function calcVolumeMA(volumes: number[], period: number): number | null {
  if (volumes.length < period) return null;
  const slice = volumes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── Support / Resistance Detection ──────────────────────────────────────────

interface Levels {
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

function detectLevels(
  closes: number[],
  highs: number[],
  lows: number[],
  currentPrice: number,
): Levels {
  const lookback = Math.min(closes.length, 60);
  const recent = closes.slice(-lookback);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);

  // Find resistance: highest high in the lookback period above current price
  const highsAbove = recentHighs.filter(h => h > currentPrice * 0.98);
  const resistance = highsAbove.length > 0
    ? Math.min(...highsAbove) // Nearest resistance above
    : currentPrice * 1.05;

  // Find support: strongest support level below current price
  const lowsBelow = recentLows.filter(l => l < currentPrice * 1.02);
  const support = lowsBelow.length > 0
    ? Math.max(...lowsBelow) // Nearest support below
    : currentPrice * 0.95;

  // Consolidation range (recent 20-bar range)
  const consolidationLookback = Math.min(recent.length, 20);
  const consolidationSlice = recent.slice(-consolidationLookback);
  const consolidationHigh = Math.max(...consolidationSlice);
  const consolidationLow = Math.min(...consolidationSlice);

  // ATR for volatility-based targets
  const atr = calcATR(highs, lows, closes);

  // Breakout level = resistance (the level that needs to break)
  const breakoutLevel = resistance;

  // Targets based on ATR and consolidation range
  const rangeSize = consolidationHigh - consolidationLow;
  const target1 = breakoutLevel + rangeSize * 1.0; // Measured move
  const target2 = breakoutLevel + rangeSize * 2.0; // Extended target

  // Stop loss: below recent support or consolidation low
  const stopLoss = Math.min(support, consolidationLow) * 0.99;

  // Risk / Reward
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

// ─── Breakout Score ──────────────────────────────────────────────────────────

interface BreakoutComponents {
  trend: number;     // 0-30
  volume: number;    // 0-30
  structure: number; // 0-20
  safety: number;    // 0-20
}

interface BreakoutStock {
  symbol: string;
  price: number;
  changePercent: number;
  sector: string;
  marketCap: number;
  volume: number;
  avgVolume: number;
  peRatio: number | null;
  revenueGrowth: number | null;
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  volRatio: number;
  breakoutScore: number;
  components: BreakoutComponents;
  levels: Levels;
  reasons: string[];
  proximityPct: number; // % from resistance
  direction: 'LONG' | 'SHORT';
}

function computeBreakoutScore(
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

  // ── Trend Score (0-30) ──
  let trend = 0;
  // Price above SMAs
  if (sma50 !== null && price > sma50) { trend += 10; reasons.push('Above SMA50'); }
  if (sma200 !== null && price > sma200) { trend += 8; reasons.push('Above SMA200'); }
  // Golden cross
  if (sma50 !== null && sma200 !== null && sma50 > sma200) { trend += 7; reasons.push('Golden cross'); }
  // RSI in bullish zone
  if (rsi !== null && rsi > 50 && rsi < 70) { trend += 5; reasons.push(`RSI bullish (${Math.round(rsi)})`); }
  else if (rsi !== null && rsi >= 70) { trend += 2; /* Overbought penalty */ }
  trend = clamp(trend, 0, 30);

  // ── Volume Score (0-30) ──
  let volume = 0;
  if (volRatio > 3.0) { volume += 25; reasons.push(`Volume surge ${volRatio.toFixed(1)}x`); }
  else if (volRatio > 2.0) { volume += 20; reasons.push(`High volume ${volRatio.toFixed(1)}x`); }
  else if (volRatio > 1.5) { volume += 15; reasons.push(`Volume above avg ${volRatio.toFixed(1)}x`); }
  else if (volRatio > 1.2) { volume += 10; }
  // Positive day + volume = accumulation
  if (changePercent > 0 && volRatio > 1.3) { volume += 5; }
  volume = clamp(volume, 0, 30);

  // ── Structure Score (0-20) ──
  let structure = 0;
  // Proximity to resistance (closer = more likely to break)
  const proximityPct = levels.resistance > 0
    ? ((levels.resistance - price) / price) * 100
    : 50;
  if (proximityPct < 1) { structure += 10; reasons.push('At resistance'); }
  else if (proximityPct < 3) { structure += 8; reasons.push('Near resistance'); }
  else if (proximityPct < 5) { structure += 5; }
  // Consolidation tightness (tight range = energy building)
  const rangePct = levels.consolidationHigh > 0
    ? ((levels.consolidationHigh - levels.consolidationLow) / levels.consolidationHigh) * 100
    : 50;
  if (rangePct < 5) { structure += 6; reasons.push('Tight consolidation'); }
  else if (rangePct < 10) { structure += 4; }
  // Good R/R ratio
  if (levels.riskReward >= 2) { structure += 4; reasons.push(`R/R ${levels.riskReward.toFixed(1)}:1`); }
  else if (levels.riskReward >= 1.5) { structure += 2; }
  structure = clamp(structure, 0, 20);

  // ── Fundamental Safety (0-20) ──
  let safety = 0;
  // Not near earnings (we assume safe if reasonable PE)
  if (peRatio !== null && peRatio > 0 && peRatio < 50) { safety += 8; }
  else if (peRatio !== null && peRatio >= 50) { safety += 3; }
  // Growth
  if (revenueGrowth !== null && revenueGrowth > 15) { safety += 8; reasons.push(`Revenue +${Math.round(revenueGrowth)}%`); }
  else if (revenueGrowth !== null && revenueGrowth > 5) { safety += 5; }
  // Market cap filter (avoid micro caps)
  if (marketCap > 10e9) { safety += 4; }
  else if (marketCap > 2e9) { safety += 2; }
  safety = clamp(safety, 0, 20);

  const score = trend + volume + structure + safety;

  return { score, components: { trend, volume, structure, safety }, reasons };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minScore = parseInt(searchParams.get('minScore') || '60', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    // Fetch fundamental data
    const rows: Array<{
      symbol: string; price: number; changePercent: number; marketCap: number;
      sector: string; peRatio: number | null; revenueGrowth: number | null;
      volume: number; avgVolume: number;
    }> = [];

    for (let i = 0; i < STOCK_POOL.length; i += 10) {
      const batch = STOCK_POOL.slice(i, i + 10);
      const results = await Promise.all(batch.map(async (sym) => {
        try {
          const [qs, q] = await Promise.all([
            yf.quoteSummary(sym, { modules: ['summaryDetail', 'financialData', 'assetProfile'] }),
            yf.quote(sym),
          ]).catch(() => [null, null]);
          if (!q || !q.regularMarketPrice) return null;
          const sd = (qs as any)?.summaryDetail || {};
          const fd = (qs as any)?.financialData || {};
          return {
            symbol: sym,
            price: q.regularMarketPrice,
            changePercent: q.regularMarketChangePercent || 0,
            marketCap: getRaw(sd.marketCap) || 0,
            sector: (qs as any)?.assetProfile?.sector || '',
            peRatio: getRaw(sd.trailingPE) || null,
            revenueGrowth: getRaw(fd.revenueGrowth) != null ? getRaw(fd.revenueGrowth) * 100 : null,
            volume: q.regularMarketVolume || 0,
            avgVolume: getRaw(sd.averageVolume) || 1,
          };
        } catch (e) { console.error(`Breakout fetch error for ${sym}:`, e); return null; }
      }));
      rows.push(...(results.filter(Boolean) as typeof rows));
    }

    // Fetch 90-day historical data for technical analysis
    const enriched: BreakoutStock[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (row) => {
        try {
          const hist: any = await yf.historical(row.symbol, {
            period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '1d',
          }).catch(() => []);

          const bars = (hist || []) as any[];
          const closes = bars.map((b: any) => b.close).filter((c: number) => c > 0);
          const highs = bars.map((b: any) => b.high).filter((h: number) => h > 0);
          const lows = bars.map((b: any) => b.low).filter((l: number) => l > 0);

          if (closes.length < 20) return null;

          const rsi = calcRSI(closes);
          const sma50 = calcSMA(closes, 50);
          const sma200 = calcSMA(closes, 200);
          const volRatio = row.volume / Math.max(row.avgVolume, 1);

          const levels = detectLevels(closes, highs, lows, row.price);

          const { score, components, reasons } = computeBreakoutScore(
            row.price, row.changePercent, rsi, sma50, sma200,
            volRatio, row.peRatio, row.revenueGrowth, levels, row.marketCap,
          );

          const proximityPct = levels.resistance > 0
            ? Math.round(((levels.resistance - row.price) / row.price) * 100 * 10) / 10
            : 50;

          // Direction: LONG if near resistance from below, SHORT if near support from above
          const direction: 'LONG' | 'SHORT' = proximityPct < 5 ? 'LONG' : 'LONG';

          return {
            symbol: row.symbol,
            price: row.price,
            changePercent: row.changePercent,
            sector: row.sector,
            marketCap: row.marketCap,
            volume: row.volume,
            avgVolume: row.avgVolume,
            peRatio: row.peRatio,
            revenueGrowth: row.revenueGrowth,
            rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
            sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
            sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
            volRatio: Math.round(volRatio * 100) / 100,
            breakoutScore: score,
            components,
            levels,
            reasons: reasons.slice(0, 4),
            proximityPct,
            direction,
          };
        } catch (e) { console.error(`Breakout enrichment error for ${row.symbol}:`, e); return null; }
      }));
      enriched.push(...results.filter(Boolean) as BreakoutStock[]);
    }

    // Filter by minimum score and sort
    const qualified = enriched
      .filter(s => s.breakoutScore >= minScore)
      .sort((a, b) => b.breakoutScore - a.breakoutScore)
      .slice(0, limit);

    // Enrich top picks with Finnhub real-time
    const enrichedPicks = await Promise.all(
      qualified.map(async (pick) => {
        try {
          const fh = await finnhubQuote(pick.symbol);
          if (fh && fh.c > 0) {
            return { ...pick, price: fh.c, changePercent: fh.dp || pick.changePercent };
          }
        } catch (e) { console.error('Breakout finnhub enrichment error:', e); }
        return pick;
      })
    );

    const now = new Date();
    const fmt = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return NextResponse.json({
      updatedAt: fmt,
      totalScanned: rows.length,
      totalQualified: enriched.filter(s => s.breakoutScore >= minScore).length,
      picks: enrichedPicks,
    });
  } catch (error) {
    console.error('Breakout screener error:', error);
    return NextResponse.json({ updatedAt: '', totalScanned: 0, totalQualified: 0, picks: [] });
  }
}
