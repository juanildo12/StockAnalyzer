import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { STOCK_POOL } from '@/src/lib/stockPool';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
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

function detectSupportResistance(closes: number[], highs: number[], lows: number[], price: number) {
  const lookback = Math.min(closes.length, 60);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);
  const highsAbove = recentHighs.filter(h => h > price * 0.98);
  const resistance = highsAbove.length > 0 ? Math.min(...highsAbove) : price * 1.05;
  const lowsBelow = recentLows.filter(l => l < price * 1.02);
  const support = lowsBelow.length > 0 ? Math.max(...lowsBelow) : price * 0.95;
  return { support, resistance };
}

function approxDelta(strike: number, price: number, isCall: boolean): number {
  if (!price || !strike) return 0;
  const m = price / strike;
  if (isCall) {
    if (m > 1.1) return Math.min(0.95, 0.5 + (m - 1) * 2);
    if (m < 0.9) return Math.max(0.05, 0.5 - (1 - m) * 2);
    return 0.4 + (m - 0.9) * 1.5;
  }
  return -0.4 - (0.9 - m) * 1.5;
}

function bestContract(contracts: any[], price: number, isCall: boolean): any {
  const withVol = contracts.filter((c: any) => (c.openInterest || 0) > 50 || (c.volume || 0) > 10);
  const pool = withVol.length > 0 ? withVol : contracts;
  const scored = pool.map((c: any) => {
    const dist = Math.abs(c.strike - price) / price;
    const oi = c.openInterest || 0;
    const vol = c.volume || 0;
    const moneyness = isCall ? (c.strike - price) / price : (price - c.strike) / price;
    const isITM = isCall ? c.strike < price : c.strike > price;
    const isOTM = !isITM && moneyness > 0;
    const farITMpenalty = isITM && moneyness < -0.1 ? Math.abs(moneyness + 0.1) * 150 : 0;
    const itmPenalty = isITM ? Math.abs(moneyness) * 80 : 0;
    const oiVolScore = Math.min(oi + vol, 20000) / 20000 * 40;
    const otmBonus = isOTM && moneyness < 0.05 ? 30 : isOTM && moneyness < 0.10 ? 15 : 0;
    const score = -dist * 60 + oiVolScore - farITMpenalty - itmPenalty + otmBonus;
    return { ...c, _score: score };
  });
  scored.sort((a: any, b: any) => b._score - a._score);
  return scored[0] || null;
}

interface TradePickCandidate {
  symbol: string;
  company: string;
  price: number;
  score: number;
  direction: 'CALL' | 'PUT';
  reasons: string[];
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  volumeRatio: number;
  rsi: number | null;
  trend: string;
}

function scoreStock(
  quote: any,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
): TradePickCandidate | null {
  const price = quote.regularMarketPrice || 0;
  if (price < 1 || !isFinite(price)) return null;

  const avgVol = quote.averageDailyVolume3Month || quote.averageDailyVolume10Day || 0;
  const curVol = quote.regularMarketVolume || volumes[volumes.length - 1] || 0;
  const volRatio = avgVol > 0 && curVol > 0 ? curVol / avgVol : 1;

  const rsi = calcRSI(closes);
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  const atr = calcATR(highs, lows, closes) || price * 0.02;
  const { support, resistance } = detectSupportResistance(closes, highs, lows, price);

  // Determine trend
  let trend = 'neutral';
  if (sma50 && sma200) {
    if (sma50 > sma200) trend = 'alcista';
    else trend = 'bajista';
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Volume surge (0-20)
  if (volRatio >= 3) { score += 20; reasons.push(`Vol ${volRatio.toFixed(1)}x — acumulación fuerte`); }
  else if (volRatio >= 2) { score += 15; reasons.push(`Vol ${volRatio.toFixed(1)}x — por encima normal`); }
  else if (volRatio >= 1.5) { score += 10; reasons.push(`Vol ${volRatio.toFixed(1)}x`); }

  // 2. Trend (0-20)
  if (trend === 'alcista') {
    score += 15; reasons.push('Tendencia alcista');
    if (sma50 && sma200 && sma50 > sma200) { score += 5; reasons.push('Golden cross'); }
  } else if (trend === 'bajista') {
    if (rsi !== null && rsi < 35) { score += 12; reasons.push('Sobreventa — posible rebote'); }
    else { score += 3; reasons.push('Tendencia bajista'); }
  } else {
    if (rsi !== null && rsi > 40 && rsi < 65) { score += 8; reasons.push('Consolidación neutral-alcista'); }
    else { score += 3; }
  }

  // 3. RSI (0-15)
  if (rsi !== null) {
    if (rsi >= 40 && rsi <= 65) { score += 15; reasons.push(`RSI ${rsi.toFixed(0)} — zona óptima`); }
    else if (rsi >= 30 && rsi < 40) { score += 10; reasons.push(`RSI ${rsi.toFixed(0)} — sobreventa parcial`); }
    else if (rsi > 65 && rsi <= 75) { score += 5; reasons.push(`RSI ${rsi.toFixed(0)} — momentum fuerte`); }
    else { score += 2; reasons.push(`RSI ${rsi.toFixed(0)}`); }
  }

  // 4. Support/resistance (0-10)
  if (support > 0 && resistance > 0 && resistance > support) {
    const distToSupport = (price - support) / price;
    if (distToSupport < 0.05) { score += 10; reasons.push(`Cerca del soporte $${support.toFixed(2)}`); }
    else if (distToSupport < 0.10) { score += 7; reasons.push(`Soporte cercano $${support.toFixed(2)}`); }
    else { score += 3; }
  }

  // 5. Price action momentum (0-10)
  if (closes.length >= 5) {
    const last5Return = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];
    if (last5Return > 0.02 && last5Return < 0.10) { score += 10; reasons.push(`+${(last5Return * 100).toFixed(1)}% en 5 días`); }
    else if (last5Return > 0 && last5Return <= 0.02) { score += 5; }
  }

  // 6. 52-week position (0-5)
  const high52w = quote.fiftyTwoWeekHigh || 0;
  const low52w = quote.fiftyTwoWeekLow || 0;
  if (high52w > low52w) {
    const pctFromLow = ((price - low52w) / (high52w - low52w)) * 100;
    if (pctFromLow > 70 && pctFromLow < 90) { score += 5; reasons.push('Zana alta 52W — momentum'); }
  }

  // Always return the stock — even low scores get shown (score determines grade, not filter)
  // Only skip if we have literally nothing useful
  if (score <= 0 && reasons.length === 0) return null;

  // Entry / stop / target
  const entry = price;
  const stop = Math.max(support > 0 ? support * 0.98 : price - atr * 1.5, price * 0.93);
  const target = resistance > 0 ? Math.max(resistance, price + atr * 3) : price + atr * 3;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const riskReward = risk > 0 ? reward / risk : 0;

  return {
    symbol: quote.symbol,
    company: quote.shortName || quote.longName || quote.symbol,
    price,
    score: Math.min(score, 100),
    direction: 'CALL',
    reasons: reasons.slice(0, 5),
    entry,
    stop,
    target,
    riskReward,
    volumeRatio: volRatio,
    rsi,
    trend,
  };
}

let memoryCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 300_000; // 5 minutes

export async function GET(request: NextRequest) {
  // Return cached result if fresh
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL) {
    return NextResponse.json(memoryCache.data);
  }

  try {
    // Use a random subset of the pool for variety
    const shuffled = [...STOCK_POOL].sort(() => Math.random() - 0.5);
    const universe = shuffled.slice(0, 40);

    const candidates: TradePickCandidate[] = [];
    const batchSize = 5;

    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const [quote, hist] = await Promise.all([
              withTimeout(yf.quote(symbol), 5000),
              withTimeout(
                yf.historical(symbol, {
                  period1: new Date(Date.now() - 120 * 86400000),
                  period2: new Date(),
                  interval: '1d',
                }),
                5000
              ),
            ]);

            if (!quote || !hist || hist.length < 10) return null;

            const closes = hist.map((h) => h.close);
            const highs = hist.map((h) => h.high);
            const lows = hist.map((h) => h.low);
            const volumes = hist.map((h) => h.volume);

            return scoreStock(quote, closes, highs, lows, volumes);
          } catch {
            return null;
          }
        })
      );

      for (const r of results) {
        if (r) candidates.push(r);
      }
    }

    // Sort by score, take top pick
    candidates.sort((a, b) => b.score - a.score);
    let topPick = candidates[0] || null;

    // Fallback: if no scored candidates, scan top mega-caps directly
    if (!topPick) {
      const megaCaps = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'NFLX', 'CRM'];
      for (const sym of megaCaps) {
        try {
          const [quote, hist] = await Promise.all([
            withTimeout(yf.quote(sym), 5000),
            withTimeout(
              yf.historical(sym, {
                period1: new Date(Date.now() - 120 * 86400000),
                period2: new Date(),
                interval: '1d',
              }),
              5000
            ),
          ]);
          if (!quote || !hist || hist.length < 10) continue;
          const closes = hist.map((h) => h.close);
          const highs = hist.map((h) => h.high);
          const lows = hist.map((h) => h.low);
          const volumes = hist.map((h) => h.volume);
          const pick = scoreStock(quote, closes, highs, lows, volumes);
          if (pick && (!topPick || pick.score > topPick.score)) {
            topPick = pick;
          }
        } catch { continue; }
      }
    }

    let contract = null;
    if (topPick) {
      try {
        const [quote, chain] = await Promise.all([
          yf.quote(topPick.symbol).catch(() => null),
          yf.options(topPick.symbol).catch(() => null),
        ]);

        if (chain?.options && chain.options.length > 0) {
          const now = Date.now();
          const expirations = chain.options.slice(0, 4);
          const scored = expirations.map((exp: any) => {
            const expDate = typeof exp.expirationDate === 'string'
              ? new Date(exp.expirationDate)
              : new Date(exp.expirationDate);
            const days = Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24));
            const dateStr = expDate.toISOString().split('T')[0];
            const contracts = topPick.direction === 'CALL' ? (exp.calls || []) : (exp.puts || []);
            const best = bestContract(contracts, topPick.price, topPick.direction === 'CALL');
            const dteScore = days >= 7 && days <= 30 ? 10 : days >= 3 && days <= 45 ? 5 : 0;
            return { best, days, dateStr, dteScore };
          });

          scored.sort((a: any, b: any) => {
            if (a.best && !b.best) return -1;
            if (!a.best && b.best) return 1;
            const aScore = a.dteScore + (14 - Math.abs(a.days - 14)) * 0.5;
            const bScore = b.dteScore + (14 - Math.abs(b.days - 14)) * 0.5;
            return bScore - aScore;
          });

          const winner = scored[0];
          if (winner?.best) {
            const c = winner.best;
            const delta = c.delta || c.greeks?.delta || approxDelta(c.strike, topPick.price, topPick.direction === 'CALL');
            contract = {
              strike: c.strike,
              expiration: winner.dateStr,
              daysToExpiration: winner.days,
              premium: c.lastPrice || ((c.bid || 0) + (c.ask || 0)) / 2 || 0,
              delta,
              volume: c.volume || 0,
              openInterest: c.openInterest || 0,
              impliedVolatility: c.impliedVolatility || 0,
            };
          }
        }
      } catch {
        // Options fetch failed — return pick without contract
      }
    }

    const result = {
      pick: topPick ? { ...topPick, contract } : null,
      scanned: universe.length,
      candidates: candidates.length,
      generatedAt: new Date().toISOString(),
    };

    memoryCache = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[TradePicks/Scan] Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Scan failed', pick: null }, { status: 500 });
  }
}
