import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { STOCK_POOL, fetchDynamicUniverse } from '@/src/lib/stockPool';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

function bestContract(contracts: any[], price: number, isCall: boolean): any[] {
  if (!contracts || contracts.length === 0) return [];

  const tight = (c: any) => {
    const bid = c.bid || 0;
    const ask = c.ask || 0;
    if (bid <= 0 || ask <= 0) return false;
    const mid = (bid + ask) / 2;
    if (mid <= 0) return false;
    return (ask - bid) / mid <= 0.10 && ask - bid <= 0.60;
  };
  const semiTight = (c: any) => {
    const bid = c.bid || 0;
    const ask = c.ask || 0;
    if (bid <= 0 || ask <= 0) return false;
    const mid = (bid + ask) / 2;
    if (mid <= 0) return false;
    return (ask - bid) / mid <= 0.15 && ask - bid <= 0.90;
  };

  // Prefer contracts with TIGHT SPREAD + HIGH volume + HIGH open interest
  let pool = contracts.filter((c: any) =>
    (c.openInterest || 0) >= 500 &&
    (c.volume || 0) >= 100 &&
    (c.bid || 0) > 0 &&
    (c.ask || 0) > 0 &&
    Math.abs(c.delta || c.greeks?.delta || 0) < 0.80 && // skip deep ITM
    tight(c)
  );
  if (pool.length === 0) {
    // Relax liquidity a bit, but NEVER relax the spread requirement
    pool = contracts.filter((c: any) =>
      (c.openInterest || 0) >= 100 &&
      (c.volume || 0) >= 20 &&
      (c.bid || 0) > 0 &&
      (c.ask || 0) > 0 &&
      Math.abs(c.delta || c.greeks?.delta || 0) < 0.80 &&
      semiTight(c)
    );
  }
  if (pool.length === 0) return []; // NEVER fall back to wide-spread / illiquid contracts

  const scored = pool.map((c: any) => {
    const oi = c.openInterest || 0;
    const vol = c.volume || 0;
    const delta = c.delta || c.greeks?.delta || 0;
    const bid = c.bid || 0;
    const ask = c.ask || 0;
    const mid = (bid + ask) / 2;
    const absDelta = Math.abs(delta);

    // Tight spread is a MUST — heavy weight, big penalty for slippage
    const dollarSpread = ask - bid;
    const spreadPct = mid > 0 ? dollarSpread / mid : 1;
    let spreadScore = -50;
    if (spreadPct <= 0.03 && dollarSpread <= 0.30) spreadScore = 40;
    else if (spreadPct <= 0.06 && dollarSpread <= 0.50) spreadScore = 30;
    else if (spreadPct <= 0.10 && dollarSpread <= 0.60) spreadScore = 20;
    else if (spreadPct <= 0.15 && dollarSpread <= 0.90) spreadScore = 8;

    // High volume + open interest — liquid contracts only
    let liqScore = 0;
    if (vol >= 1000 && oi >= 5000) liqScore = 40;
    else if (vol >= 500 && oi >= 2000) liqScore = 30;
    else if (vol >= 100 && oi >= 500) liqScore = 18;
    else liqScore = 8;

    // Ideal: delta 0.25-0.50 (slightly OTM to ATM)
    let deltaScore = 0;
    if (absDelta >= 0.25 && absDelta <= 0.50) deltaScore = 10;
    else if (absDelta >= 0.15 && absDelta < 0.25) deltaScore = 6;
    else if (absDelta > 0.50 && absDelta <= 0.65) deltaScore = 3;

    // OTM strikes preferred
    const isOTM = isCall ? c.strike > price : c.strike < price;
    const absDist = Math.abs(c.strike - price) / price;
    let otmScore = 0;
    if (isOTM) {
      if (absDist >= 0.02 && absDist <= 0.08) otmScore = 10;
      else if (absDist < 0.02) otmScore = 6;
      else if (absDist <= 0.15) otmScore = 3;
    }

    return { ...c, _score: spreadScore + liqScore + deltaScore + otmScore };
  });

  scored.sort((a: any, b: any) => b._score - a._score);
  return scored.slice(0, 3); // return top 3
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
  if (price < 5 || !isFinite(price)) return null;

  const marketCap = quote.marketCap || 0;
  if (marketCap > 0 && marketCap < 10_000_000_000) return null; // skip small caps (thin options)

  const avgVol = quote.averageDailyVolume3Month || quote.averageDailyVolume10Day || 0;
  const curVol = quote.regularMarketVolume || volumes[volumes.length - 1] || 0;
  if (avgVol < 500_000) return null; // not enough liquidity for options

  const volRatio = avgVol > 0 && curVol > 0 ? curVol / avgVol : 1;
  // Volume ratio is scored, not used as hard filter

  const rsi = calcRSI(closes);
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  if (rsi === null || sma50 === null || sma200 === null) return null;

  const atr = calcATR(highs, lows, closes) || price * 0.02;
  const { support, resistance } = detectSupportResistance(closes, highs, lows, price);

  // Determine trend and direction
  const uptrend = sma50 > sma200;
  let direction: 'CALL' | 'PUT' = 'CALL';
  if (!uptrend) {
    if (rsi > 60) direction = 'PUT';
    else return null; // downtrend without overbought — skip
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Price quality (0-10)
  if (price >= 50) { score += 10; }
  else if (price >= 20) { score += 7; }
  else if (price >= 10) { score += 4; }

  // 2. Volume surge (0-20)
  if (volRatio >= 3) { score += 20; reasons.push(`Vol ${volRatio.toFixed(1)}x — acumulación fuerte`); }
  else if (volRatio >= 2) { score += 15; reasons.push(`Vol ${volRatio.toFixed(1)}x — por encima normal`); }
  else if (volRatio >= 1.5) { score += 10; reasons.push(`Vol ${volRatio.toFixed(1)}x — mayor a lo normal`); }
  else { score += 5; reasons.push(`Vol ${volRatio.toFixed(1)}x`); }

  // 3. Trend alignment (0-25)
  if (uptrend) {
    const trendStrength = (sma50 - sma200) / sma200;
    if (trendStrength > 0.05) { score += 25; reasons.push('Tendencia alcista fuerte'); }
    else if (trendStrength > 0.02) { score += 20; reasons.push('Tendencia alcista'); }
    else { score += 15; reasons.push('Golden cross reciente'); }
  } else if (direction === 'PUT') {
    score += 15; reasons.push('Tendencia bajista — PUT');
  }

  // 4. RSI optimal zone (0-20)
  if (direction === 'CALL') {
    if (rsi >= 40 && rsi <= 55) { score += 20; reasons.push(`RSI ${rsi.toFixed(0)} — punto óptimo de entrada`); }
    else if (rsi >= 55 && rsi <= 65) { score += 12; reasons.push(`RSI ${rsi.toFixed(0)} — momentum alcista`); }
    else if (rsi >= 35 && rsi < 40) { score += 8; reasons.push(`RSI ${rsi.toFixed(0)} — rebote desde sobreventa`); }
    else { score += 2; }
  } else {
    if (rsi >= 60 && rsi <= 75) { score += 20; reasons.push(`RSI ${rsi.toFixed(0)} — sobrecompra, posible retroceso`); }
    else if (rsi > 75) { score += 10; reasons.push(`RSI ${rsi.toFixed(0)} — extremo, probable reversión`); }
    else { score += 2; }
  }

  // 5. Support/resistance proximity (0-10)
  if (support > 0 && resistance > 0 && resistance > support) {
    if (direction === 'CALL') {
      const distToSupport = (price - support) / price;
      if (distToSupport < 0.03) { score += 10; reasons.push(`Cerca del soporte $${support.toFixed(2)}`); }
      else if (distToSupport < 0.06) { score += 7; reasons.push(`Soporte cercano $${support.toFixed(2)}`); }
      else { score += 3; }
    } else {
      const distToResistance = (resistance - price) / price;
      if (distToResistance < 0.03) { score += 10; reasons.push(`Cerca de resistencia $${resistance.toFixed(2)}`); }
      else if (distToResistance < 0.06) { score += 7; reasons.push(`Resistencia cercana $${resistance.toFixed(2)}`); }
      else { score += 3; }
    }
  }

  // 6. Momentum (0-10) — positive but not extended
  if (closes.length >= 5) {
    const last5Return = (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5];
    if (direction === 'CALL') {
      if (last5Return > 0.01 && last5Return < 0.08) { score += 10; reasons.push(`+${(last5Return * 100).toFixed(1)}% en 5d`); }
      else if (last5Return > 0 && last5Return <= 0.01) { score += 5; }
      else if (last5Return < -0.02) { score -= 5; } // falling
    } else {
      if (last5Return < -0.01 && last5Return > -0.08) { score += 10; reasons.push(`${(last5Return * 100).toFixed(1)}% en 5d`); }
    }
  }

  // 7. Risk / reward (0-5)
  const entry = price;
  const stop = direction === 'CALL'
    ? Math.max(support > 0 ? support * 0.98 : price - atr * 2, price * 0.93)
    : Math.min(resistance > 0 ? resistance * 1.02 : price + atr * 2, price * 1.07);
  const target = direction === 'CALL'
    ? resistance > 0 ? Math.max(resistance, price + atr * 3) : price + atr * 3
    : support > 0 ? Math.min(support, price - atr * 3) : price - atr * 3;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const riskReward = risk > 0 ? reward / risk : 0;
  if (riskReward >= 3) { score += 5; reasons.push(`R:R ${riskReward.toFixed(1)}`); }
  else if (riskReward >= 2) { score += 3; }

  // Minimum score threshold — only show good picks
  if (score < 50) return null;

  return {
    symbol: quote.symbol,
    company: quote.shortName || quote.longName || quote.symbol,
    price,
    score: Math.min(score, 100),
    direction,
    reasons: reasons.slice(0, 5),
    entry,
    stop,
    target,
    riskReward,
    volumeRatio: volRatio,
    rsi,
    trend: uptrend ? 'alcista' : 'bajista',
  };
}

let memoryCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function GET(request: NextRequest) {
  // Return cached result if fresh
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL) {
    return NextResponse.json(memoryCache.data);
  }

  try {
    // Merge static pool with dynamic market movers (gainers, losers, most active, trending)
    const universe = await fetchDynamicUniverse().catch(() => [...STOCK_POOL]);

    const candidates: TradePickCandidate[] = [];
    const batchSize = 20;

    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const [quote, hist] = await Promise.all([
              withTimeout(yf.quote(symbol), 5000),
              withTimeout(
                yf.historical(symbol, {
                  period1: new Date(Date.now() - 440 * 86400000),
                  period2: new Date(),
                  interval: '1d',
                }),
                7000
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

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    let topPick: TradePickCandidate | null = null;
    let contract: any = null;

    // Liquid mega caps with proven options chains — used as fallback candidates
    const LIQUID_UNIVERSE = [
      'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'CRM',
      'AVGO', 'ORCL', 'PLTR', 'ADBE', 'QCOM', 'MU', 'UBER', 'SQ', 'PYPL', 'COIN',
      'SHOP', 'DIS', 'NKE', 'JPM', 'GS', 'V', 'MA', 'LLY', 'UNH', 'BA',
      'CAT', 'XOM', 'MRVL', 'ARM', 'SMCI', 'INTU', 'NOW', 'AMAT', 'TXN',
    ];

    // Build the contract search set: top scored candidates first, then liquid universe
    const searchSet = new Map<string, TradePickCandidate>();
    // Prioritize top 15 scored candidates from the scan
    for (const c of candidates.slice(0, 15)) {
      searchSet.set(c.symbol, c);
    }
    // Add liquid universe stocks not already in the set
    for (const sym of LIQUID_UNIVERSE) {
      if (searchSet.has(sym)) continue;
      const existing = candidates.find((c) => c.symbol === sym);
      if (existing) {
        searchSet.set(sym, existing);
      } else {
        try {
          const [quote, hist] = await Promise.all([
            withTimeout(yf.quote(sym), 5000),
            withTimeout(yf.historical(sym, { period1: new Date(Date.now() - 440 * 86400000), period2: new Date(), interval: '1d' }), 7000),
          ]);
          const p = quote && hist && hist.length >= 200
            ? scoreStock(quote, hist.map(h => h.close), hist.map(h => h.high), hist.map(h => h.low), hist.map(h => h.volume))
            : null;
          if (p) searchSet.set(sym, p);
        } catch { /* skip */ }
      }
    }
    // Sort by stock score descending — best stocks first
    const tryCandidates = Array.from(searchSet.values()).sort((a, b) => b.score - a.score);

    interface BestCombo { stock: TradePickCandidate; contract: any; score: number }
    let bestCombo: BestCombo | null = null;

    for (const pick of tryCandidates) {
      try {
        // chain.options only holds the NEAREST expiration — fetch all expiration dates first
        const datesChain = await withTimeout(yf.options(pick.symbol), 8000);
        if (!datesChain?.expirationDates?.length) continue;

        const daysUntil = (t: number) => Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
        const targetDates = datesChain.expirationDates
          .map((d: any) => new Date(d))
          .filter((d: Date) => {
            const days = daysUntil(d.getTime());
            return days >= 7 && days <= 60;
          })
          .sort((a: Date, b: Date) => Math.abs(daysUntil(a.getTime()) - 38) - Math.abs(daysUntil(b.getTime()) - 38))
          .slice(0, 2);

        let allCombos: any[] = [];
        for (const expDate of targetDates) {
          const expChain = await withTimeout(yf.options(pick.symbol, { date: expDate }), 8000);
          const exp = expChain?.options?.[0];
          if (!exp) continue;
          const expTime = exp.expirationDate instanceof Date
            ? exp.expirationDate.getTime()
            : new Date(exp.expirationDate).getTime();
          const days = daysUntil(expTime);
          if (days < 3) continue; // HARD REJECT: expired or expiring within 2 days
          const dateStr = expDate.toISOString().split('T')[0];
          const contracts = pick.direction === 'CALL' ? (exp.calls || []) : (exp.puts || []);
          const candidates = bestContract(contracts, pick.price, pick.direction === 'CALL');
          for (const c of candidates) {
            const bid = c.bid || 0;
            const ask = c.ask || 0;
            const mid = (bid + ask) / 2;
            if (bid <= 0 || ask <= 0 || mid <= 0) continue;
            const spreadPct = parseFloat(((ask - bid) / mid * 100).toFixed(1));
            const vol = c.volume || 0;
            const oi = c.openInterest || 0;
            // HARD REJECT: wide spread or illiquid — NEVER include
            if (spreadPct > 10 || vol < 100 || oi < 500) continue;
            const delta = c.delta || c.greeks?.delta || approxDelta(c.strike, pick.price, pick.direction === 'CALL');
            const dteScore = days >= 30 && days <= 45 ? 30 : days >= 14 && days <= 60 ? 20 : days >= 7 ? 8 : 2;
            const expScore = dteScore + (30 - Math.abs(days - 38)) * 0.3;
            const contractScore = c._score || 0;
            const liqBonus = vol >= 1000 && oi >= 5000 ? 40 : vol >= 500 && oi >= 2000 ? 30 : vol >= 100 && oi >= 500 ? 18 : 8;
            const spreadScore = spreadPct <= 3 ? 40 : spreadPct <= 6 ? 30 : spreadPct <= 10 ? 20 : -50;
            const combScore = contractScore + expScore + (days >= 14 ? 50 : 0) + spreadScore + liqBonus;
            allCombos.push({ strike: c.strike, expiration: dateStr, daysToExpiration: days, premium: c.lastPrice || mid || 0, bid, ask, spreadPct, delta, volume: c.volume || 0, openInterest: c.openInterest || 0, impliedVolatility: c.impliedVolatility || 0, _score: combScore });
          }
        }

        for (const combo of allCombos) {
          // Weight combo score with stock score (max 100) for better differentiation
          const weightedScore = combo._score + (pick.score || 0) * 0.3;
          if (!bestCombo || weightedScore > bestCombo.score) {
            bestCombo = { stock: pick, contract: combo, score: weightedScore };
          }
        }
        // If we found an excellent combo, stop early to save time
        if (bestCombo && bestCombo.score >= 230) break;
      } catch {
        continue;
      }
    }

    if (bestCombo) {
      topPick = bestCombo.stock;
      contract = bestCombo.contract;
    } else if (candidates.length > 0) {
      // No contract passed the strict filters — return the best pick WITHOUT a contract
      // rather than nothing. Never attach a wide-spread / illiquid contract.
      topPick = candidates[0];
    }

    const result = {
      pick: topPick ? { ...topPick, contract } : null,
      scanned: universe.length,
      candidates: candidates.length,
      searchedForContracts: tryCandidates.length,
      generatedAt: new Date().toISOString(),
    };

    memoryCache = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[TradePicks/Scan] Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Scan failed', pick: null }, { status: 500 });
  }
}
