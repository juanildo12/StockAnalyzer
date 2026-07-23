import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getQuote as finnhubQuote } from '@/src/services/finnhubClient';
import { fetchDynamicUniverse } from '@/src/lib/stockPool';
import { cacheGet, cacheSet } from '@/src/lib/cache';

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

// ─── Support / Resistance / Levels ───────────────────────────────────────────

function detectLevels(closes: number[], highs: number[], lows: number[], currentPrice: number) {
  const lookback = Math.min(closes.length, 60);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);
  const recent = closes.slice(-lookback);

  const highsAbove = recentHighs.filter(h => h > currentPrice * 0.98);
  const resistance = highsAbove.length > 0 ? Math.min(...highsAbove) : currentPrice * 1.05;

  const lowsBelow = recentLows.filter(l => l < currentPrice * 1.02);
  const support = lowsBelow.length > 0 ? Math.max(...lowsBelow) : currentPrice * 0.95;

  const consLookback = Math.min(recent.length, 20);
  const consSlice = recent.slice(-consLookback);
  const consHigh = Math.max(...consSlice);
  const consLow = Math.min(...consSlice);

  const atr = calcATR(highs, lows, closes);
  const rangeSize = consHigh - consLow;

  const target1 = resistance + rangeSize * 1.0;
  const target2 = resistance + rangeSize * 2.0;
  const stopLoss = Math.min(support, consLow) * 0.99;

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
    consolidationHigh: Math.round(consHigh * 100) / 100,
    consolidationLow: Math.round(consLow * 100) / 100,
    atr: atr !== null ? Math.round(atr * 100) / 100 : null,
  };
}

// ─── Breakout Score (0-100) ──────────────────────────────────────────────────

function computeBreakoutScore(
  price: number, changePercent: number, rsi: number | null,
  sma50: number | null, sma200: number | null, volRatio: number,
  peRatio: number | null, revenueGrowth: number | null,
  levels: { resistance: number; consolidationHigh: number; consolidationLow: number; riskReward: number },
  marketCap: number,
) {
  const reasons: string[] = [];

  // Trend (0-30) — stricter: require alignment above both MAs
  let trend = 0;
  const aboveSma50 = sma50 !== null && price > sma50;
  const aboveSma200 = sma200 !== null && price > sma200;
  if (aboveSma50) trend += 8;
  if (aboveSma200) trend += 6;
  if (aboveSma50 && aboveSma200) { trend += 10; reasons.push('Price above SMA50+200'); }
  if (sma50 !== null && sma200 !== null && sma50 > sma200 * 1.02) { trend += 6; reasons.push('Golden cross'); }
  if (rsi !== null && rsi > 50 && rsi < 65) { trend += 5; reasons.push(`RSI ${Math.round(rsi)}`); }
  else if (rsi !== null && rsi >= 65 && rsi < 75) trend += 2;
  trend = clamp(trend, 0, 30);

  // Volume (0-30) — stricter: need sustained volume surge
  let vol = 0;
  if (volRatio > 4.0) { vol += 28; reasons.push(`${volRatio.toFixed(1)}x volume`); }
  else if (volRatio > 3.0) { vol += 23; reasons.push(`${volRatio.toFixed(1)}x volume`); }
  else if (volRatio > 2.0) { vol += 15; }
  else if (volRatio > 1.5) { vol += 8; }
  else { vol = 0; }
  if (changePercent > 0 && volRatio > 2.0) vol += 5;
  else if (changePercent > 0 && volRatio > 1.5) vol += 2;
  vol = clamp(vol, 0, 30);

  // Structure (0-20) — stricter: require proximity + tight consolidation + good R/R
  let structure = 0;
  const proximityPct = levels.resistance > 0 ? ((levels.resistance - price) / price) * 100 : 50;
  if (proximityPct < 1) { structure += 8; reasons.push('At resistance'); }
  else if (proximityPct < 2) { structure += 6; reasons.push('Near resistance'); }
  else if (proximityPct < 4) structure += 3;
  const rangePct = levels.consolidationHigh > 0 ? ((levels.consolidationHigh - levels.consolidationLow) / levels.consolidationHigh) * 100 : 50;
  if (rangePct < 4) { structure += 7; reasons.push('Tight consolidation'); }
  else if (rangePct < 8) structure += 4;
  else if (rangePct < 12) structure += 2;
  if (levels.riskReward >= 2.5) { structure += 5; reasons.push(`R/R ${levels.riskReward.toFixed(1)}:1`); }
  else if (levels.riskReward >= 2.0) { structure += 3; reasons.push(`R/R ${levels.riskReward.toFixed(1)}:1`); }
  else if (levels.riskReward >= 1.5) structure += 1;
  structure = clamp(structure, 0, 20);

  // Safety (0-20) — stricter: need real growth + profitability + size
  let safety = 0;
  if (peRatio !== null && peRatio > 0 && peRatio < 30) safety += 8;
  else if (peRatio !== null && peRatio > 0 && peRatio < 45) safety += 5;
  else if (peRatio !== null && peRatio >= 45) safety += 2;
  if (revenueGrowth !== null && revenueGrowth > 30) { safety += 8; reasons.push(`Rev +${Math.round(revenueGrowth)}%`); }
  else if (revenueGrowth !== null && revenueGrowth > 20) { safety += 6; reasons.push(`Rev +${Math.round(revenueGrowth)}%`); }
  else if (revenueGrowth !== null && revenueGrowth > 10) { safety += 4; }
  else if (revenueGrowth !== null && revenueGrowth > 0) safety += 2;
  if (marketCap > 20e9) safety += 4;
  else if (marketCap > 5e9) safety += 3;
  else if (marketCap > 2e9) safety += 1;
  safety = clamp(safety, 0, 20);

  return { score: trend + vol + structure + safety, reasons: reasons.slice(0, 5) };
}

// ─── Morning Briefing Entry Type ─────────────────────────────────────────────

interface BriefingPick {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  sector: string;
  marketCap: number;
  breakoutScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'MODERATE';
  entryWindow: string;
  levels: {
    entry: number;
    resistance: number;
    support: number;
    target1: number;
    target2: number;
    stopLoss: number;
    riskReward: number;
  };
  technicals: {
    rsi: number | null;
    sma50: number | null;
    sma200: number | null;
    volRatio: number;
  };
  reasons: string[];
  setup: string;
  riskNote: string;
}

function getConfidence(score: number): 'HIGH' | 'MEDIUM' | 'MODERATE' {
  if (score >= 80) return 'HIGH';
  if (score >= 65) return 'MEDIUM';
  return 'MODERATE';
}

function getSetupLabel(reasons: string[]): string {
  const hasVolume = reasons.some(r => r.includes('volume'));
  const hasResistance = reasons.some(r => r.includes('resistance'));
  const hasConsolidation = reasons.some(r => r.includes('consolidation'));
  const hasGoldenCross = reasons.some(r => r.includes('Golden cross'));

  if (hasResistance && hasVolume) return 'Breakout con Volumen';
  if (hasConsolidation && hasResistance) return 'Consolidación → Ruptura';
  if (hasGoldenCross && hasVolume) return 'Golden Cross + Accumulación';
  if (hasResistance) return 'Test de Resistencia';
  if (hasVolume) return 'Acumulación Institucional';
  return 'Setup Técnico';
}

function getRiskNote(score: number, riskReward: number, rsi: number | null): string {
  if (rsi !== null && rsi > 75) return '⚠️ RSI sobrecomprado — esperar retroceso antes de entrada';
  if (riskReward < 1.5) return '⚠️ R/R bajo — considerar position sizing reducido';
  if (score >= 80) return '✅ Setup de alta convicción — mantener size normal';
  return '✅ Setup válido — entry en breakout confirmado con volumen';
}

// ─── Market Context ──────────────────────────────────────────────────────────

async function getMarketContext() {
  try {
    const [spy, vix] = await Promise.all([
      yf.quote('SPY').catch(() => null),
      yf.quote('^VIX').catch(() => null),
    ]);

    return {
      spy: spy ? {
        price: spy.regularMarketPrice,
        change: spy.regularMarketChangePercent || 0,
      } : null,
      vix: vix ? {
        level: vix.regularMarketPrice,
        label: vix.regularMarketPrice > 25 ? 'ALTA' : vix.regularMarketPrice > 15 ? 'MEDIA' : 'BAJA',
      } : null,
    };
  } catch {
    return { spy: null, vix: null };
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Check cache first (5 min TTL for morning briefing)
    const cached = await cacheGet<any>('briefing:live:current');
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    // ── Get dynamic universe + cooldown symbols ──
    const universeCacheKey = 'briefing:universe:current';
    const [universe, cooldownSymbols] = await Promise.all([
      (async () => {
        let u = await cacheGet<string[]>(universeCacheKey);
        if (!u || u.length === 0) {
          u = await fetchDynamicUniverse().catch(() => []);
          await cacheSet(universeCacheKey, u, 1800);
        }
        return u;
      })(),
      Promise.all([
        cacheGet<string[]>('briefing:picks:day0'),
        cacheGet<string[]>('briefing:picks:day1'),
      ]),
    ]);

    const cooldownSet = new Set([
      ...(cooldownSymbols[0] || []),
      ...(cooldownSymbols[1] || []),
    ]);

    // ── Fetch fundamental data ──
    const rows: Array<{
      symbol: string; name: string; price: number; changePercent: number;
      marketCap: number; sector: string; peRatio: number | null;
      revenueGrowth: number | null; volume: number; avgVolume: number;
    }> = [];

    // Process all batches in parallel (max 5 concurrent batches to avoid rate limiting)
    const BATCHConcurrency = 5;
    const fundamentalBatches: Array<Promise<typeof rows>> = [];
    for (let i = 0; i < universe.length; i += 10) {
      const batch = universe.slice(i, i + 10);
      fundamentalBatches.push(
        Promise.all(batch.map(async (sym) => {
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
              name: q.shortName || sym,
              price: q.regularMarketPrice,
              changePercent: q.regularMarketChangePercent || 0,
              marketCap: getRaw(sd.marketCap) || 0,
              sector: (qs as any)?.assetProfile?.sector || '',
              peRatio: getRaw(sd.trailingPE) || null,
              revenueGrowth: getRaw(fd.revenueGrowth) != null ? getRaw(fd.revenueGrowth) * 100 : null,
              volume: q.regularMarketVolume || 0,
              avgVolume: getRaw(sd.averageVolume) || 1,
            };
          } catch { return null; }
        })).then(results => results.filter(Boolean) as typeof rows)
      );
    }

    // Process in chunks of BATCHConcurrency
    const allFundamentals: typeof rows = [];
    for (let i = 0; i < fundamentalBatches.length; i += BATCHConcurrency) {
      const chunk = fundamentalBatches.slice(i, i + BATCHConcurrency);
      const chunkResults = await Promise.all(chunk);
      for (const result of chunkResults) {
        allFundamentals.push(...result);
      }
    }
    rows.push(...allFundamentals);

    // ── Fetch historical data and compute breakout scores ──
    const enriched: BriefingPick[] = [];
    const BATCH_SIZE = 5;

    // Process all batches in parallel (max 5 concurrent batches to avoid rate limiting)
    const HISTConcurrency = 5;
    const historicalBatches: Array<Promise<BriefingPick[]>> = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      historicalBatches.push(
        Promise.all(batch.map(async (row) => {
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

            // Require RSI between 35-75 for quality setups (no oversold/overbought traps)
            if (rsi !== null && (rsi < 35 || rsi > 75)) return null;

            const levels = detectLevels(closes, highs, lows, row.price);
            const { score: rawScore, reasons } = computeBreakoutScore(
              row.price, row.changePercent, rsi, sma50, sma200,
              volRatio, row.peRatio, row.revenueGrowth, levels, row.marketCap,
            );

            // Cooldown penalty: -20 if stock appeared in last 2 briefings
            const score = cooldownSet.has(row.symbol) ? Math.max(0, rawScore - 20) : rawScore;

            // Require minimum quality: score >= 65, volume > 1M, market cap > 2B
            if (score < 65) return null;
            if (row.volume < 1_000_000) return null;
            if (row.marketCap < 2_000_000_000) return null;

            const proximityPct = levels.resistance > 0 ? ((levels.resistance - row.price) / row.price) * 100 : 50;

            return {
              symbol: row.symbol,
              name: row.name,
              price: row.price,
              changePercent: row.changePercent,
              sector: row.sector,
              marketCap: row.marketCap,
              breakoutScore: score,
              confidence: getConfidence(score),
              entryWindow: proximityPct < 1 ? 'Inmediato' : proximityPct < 3 ? 'Hoy' : 'Esta semana',
              levels: {
                entry: levels.resistance,
                resistance: levels.resistance,
                support: levels.support,
                target1: levels.target1,
                target2: levels.target2,
                stopLoss: levels.stopLoss,
                riskReward: levels.riskReward,
              },
              technicals: {
                rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
                sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
                sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
                volRatio: Math.round(volRatio * 100) / 100,
              },
              reasons: reasons,
              setup: getSetupLabel(reasons),
              riskNote: getRiskNote(score, levels.riskReward, rsi),
            };
          } catch { return null; }
        })).then(results => results.filter(Boolean) as BriefingPick[])
      );
    }

    // Process in chunks of HISTConcurrency
    for (let i = 0; i < historicalBatches.length; i += HISTConcurrency) {
      const chunk = historicalBatches.slice(i, i + HISTConcurrency);
      const chunkResults = await Promise.all(chunk);
      for (const result of chunkResults) {
        enriched.push(...result);
      }
    }

    // Sort and take top picks
    const topPicks = enriched
      .sort((a, b) => b.breakoutScore - a.breakoutScore)
      .slice(0, 5);

    // Save picks to Redis for cooldown (rotate: day0 → day1, day1 expires)
    const topSymbols = topPicks.map(p => p.symbol);
    await Promise.all([
      cacheSet('briefing:picks:day1', cooldownSymbols[0] || [], 172800), // 48h
      cacheSet('briefing:picks:day0', topSymbols, 172800),               // 48h
    ]);

    // Enrich top 5 with real-time Finnhub prices
    const finalPicks = await Promise.all(
      topPicks.map(async (pick) => {
        try {
          const fh = await finnhubQuote(pick.symbol);
          if (fh && fh.c > 0) {
            return { ...pick, price: fh.c, changePercent: fh.dp || pick.changePercent };
          }
        } catch {}
        return pick;
      })
    );

    // Market context
    const market = await getMarketContext();

    // Summary stats
    const highConf = finalPicks.filter(p => p.confidence === 'HIGH').length;
    const avgRR = finalPicks.length > 0
      ? Math.round(finalPicks.reduce((a, p) => a + p.levels.riskReward, 0) / finalPicks.length * 100) / 100
      : 0;
    const sectors = Array.from(new Set(finalPicks.map(p => p.sector).filter(Boolean)));

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const responseData = {
      date: dateStr,
      time: timeStr,
      market,
      summary: {
        totalScanned: rows.length,
        totalBreakouts: enriched.length,
        highConfidence: highConf,
        avgRiskReward: avgRR,
        topSectors: sectors.slice(0, 3),
      },
      picks: finalPicks,
    };
    await cacheSet('briefing:live:current', responseData, 300);
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Morning briefing error:', error);
    return NextResponse.json({
      date: '', time: '', market: { spy: null, vix: null },
      summary: { totalScanned: 0, totalBreakouts: 0, highConfidence: 0, avgRiskReward: 0, topSectors: [] },
      picks: [],
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
