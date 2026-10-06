import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { STOCK_POOL, fetchTradePickUniverse, TRADE_PICK_MIN_MARKET_CAP } from '@/src/lib/stockPool';
import { cacheAside } from '@/src/lib/cache';
import {
  adrPct,
  detectSetup,
  emaState,
  evalRegime,
  relativeStrength,
  type MarketRegime,
} from '@/src/lib/tradePicks/momentum';

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

// ── Sistema de momentum (Sean @SRxTrades) ──────────────────────────────────
// Long-only: líderes alcistas sobre EMA 8/21/50, día verde, ADR > 2%,
// base ajustada cerca de su trigger (o recién rota con volumen).

interface TradePickCandidate {
  symbol: string;
  company: string;
  price: number;
  score: number;
  direction: 'CALL';
  reasons: string[];
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  volumeRatio: number;
  rsi: number | null;
  trend: string;
  setupState: 'near' | 'confirmed';
  trigger: number;
  triggerDist: number;
  adr: number;
  trail8: number | null;
  trail21: number | null;
  trail50: number | null;
}

function scoreStock(
  quote: any,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  regime: MarketRegime,
  spyCloses: number[],
): TradePickCandidate | null {
  const price = quote.regularMarketPrice || 0;
  if (!(price >= 3) || !isFinite(price)) return null; // gates = stockPool.ts

  const marketCap = quote.marketCap || 0;
  if (marketCap > 0 && marketCap < TRADE_PICK_MIN_MARKET_CAP) return null; // skip names too small for options

  const avgVol = quote.averageDailyVolume3Month || quote.averageDailyVolume10Day || 0;
  if (avgVol < 500_000) return null; // not enough liquidity for options
  const curVol = quote.regularMarketVolume || volumes[volumes.length - 1] || 0;
  const volRatio = avgVol > 0 && curVol > 0 ? curVol / avgVol : 1;

  // Gate: día verde (scan de Sean: Change > 0)
  const changePct = typeof quote.regularMarketChangePercent === 'number'
    ? quote.regularMarketChangePercent
    : closes.length >= 2 && closes[closes.length - 2] > 0
      ? (closes[closes.length - 1] / closes[closes.length - 2] - 1) * 100
      : 0;
  if (changePct <= 0) return null;

  // Gate: ADR > 2% (accionaria con movimiento diario real)
  const adr = adrPct(highs, lows, closes);
  if (adr === null || adr < 2) return null;

  // Gate: precio sobre EMA 8/21/50 (tendencia fuerte)
  const emas = emaState(closes, price);
  if (!emas.priceAboveAll) return null;

  // Gate: base ajustada cerca de su trigger (a punto de romper o recién rota)
  const setup = detectSetup(closes, highs, lows, volumes);
  if (!setup || setup.rangePct > 12) return null;

  const rsi = calcRSI(closes);
  const atr = calcATR(highs, lows, closes) || price * 0.02;
  const rs = relativeStrength(closes, spyCloses, 20);

  // Solo largo: los líderes alcistas son las únicas jugadas del sistema
  const direction: 'CALL' = 'CALL';

  // Entrada: el trigger si aún no rompió (buy stop), el precio si ya rompió
  const entry = setup.state === 'confirmed' ? price : setup.trigger;
  // Stop: piso de la base, acotado a 1.5 ATR (low of the day del rompimiento)
  const stop = Math.max(setup.baseLow, entry - 1.5 * atr);
  if (!(entry > stop)) return null;

  // Target: proyección del impulso previo (asta) o la siguiente resistencia
  const lookback = Math.min(closes.length, 60);
  const aboveEntry = highs.slice(-lookback).filter((h) => h > entry * 1.03);
  const nextResistance = aboveEntry.length > 0 ? Math.min(...aboveEntry) : 0;
  const poleTarget = entry + Math.max(setup.poleHeight, atr * 3);
  const target = Math.max(poleTarget, nextResistance);

  const risk = entry - stop;
  const reward = target - entry;
  const riskReward = risk > 0 ? reward / risk : 0;
  if (riskReward < 2) return null;

  let score = 0;
  const reasons: string[] = [];

  // 1. Alineación EMA (0-20): gate sobre 8/21/50 + stack ordenado + no extendido
  score += 10;
  if (emas.stacked) score += 6;
  const ext = emas.extFromEma8;
  if (ext >= 0.3 && ext <= 6) { score += 4; reasons.push('Sobre EMA 8/21/50 — tendencia activa'); }
  else if (ext < 0.3) score += 2;
  else score += 1;

  // 2. Calidad de la base (0-20): tightness + volumen secándose
  if (setup.rangePct <= 8) { score += 12; reasons.push(`Base ajustada: rango ${setup.rangePct.toFixed(1)}% en 15 sesiones`); }
  else { score += 8; reasons.push(`Base de ${setup.rangePct.toFixed(1)}%`); }
  if (setup.volDryUp) { score += 8; reasons.push(`Volumen ${setup.volChangePct.toFixed(0)}% en la consolidación`); }
  else if (setup.volChangePct < 0) score += 5;
  else score += 2;

  // 3. Breakout / trigger (0-25)
  if (setup.state === 'confirmed') {
    const extPast = -setup.distToTriggerPct; // % por encima del trigger
    if (extPast > 3) score -= 12; // ya muy lejos del trigger → chasing
    else if (extPast > 2) score -= 6; // ya algo extendido
    else if (extPast > 1) score -= 3;
    if (setup.volRatio >= 1.5) {
      score += extPast > 2 ? 18 : 23; // menos bonus si ya extendido
      reasons.push(`Breakout del trigger $${setup.trigger.toFixed(2)} con volumen ${setup.volRatio.toFixed(1)}x`);
    } else {
      score += extPast > 2 ? 12 : 16;
      reasons.push(`Sobre el trigger $${setup.trigger.toFixed(2)} — falta volumen`);
    }
  } else {
    const d = setup.distToTriggerPct;
    score += d <= 1 ? 18 : d <= 2 ? 16 : 12; // dar más peso a near
    reasons.push(`Trigger $${setup.trigger.toFixed(2)} a ${d.toFixed(1)}% — a punto de romper`);
  }

  // Bonus: preferir setups "near" (a punto de romper) vs confirmados extendidos
  if (setup.state === 'near') score += 4;
  else if (setup.state === 'confirmed' && (-setup.distToTriggerPct) <= 1.5) score += 2;

  // 4. Fuerza relativa vs SPY (0-15): los líderes le ganan al mercado
  if (rs !== null) {
    if (rs >= 10) { score += 15; reasons.push(`Fuerza relativa +${rs.toFixed(1)}% vs SPY (20d)`); }
    else if (rs >= 5) { score += 12; reasons.push(`Fuerza relativa +${rs.toFixed(1)}% vs SPY (20d)`); }
    else if (rs >= 0) score += 8;
  }

  // 5. Liquidez / ADR (0-10)
  if (volRatio >= 2) { score += 6; reasons.push(`Vol ${volRatio.toFixed(1)}x vs promedio`); }
  else if (volRatio >= 1.3) score += 4;
  else if (volRatio >= 1) score += 2;
  score += adr >= 3 ? 4 : 2;

  // 6. Régimen de mercado (0-10): SPY/QQQ sobre EMA 8/21/50 = convicción completa
  if (regime.level === 'BULL') { score += 10; reasons.push('SPY/QQQ sobre EMA 8/21/50'); }
  else if (regime.level === 'MIXED') score += 5;

  // 7. Risk / reward (0-5)
  if (riskReward >= 3) { score += 5; reasons.push(`R:R ${riskReward.toFixed(1)}`); }
  else if (riskReward >= 2) score += 3;

  // Penalizaciones: extendido de la EMA8, sobrecomprado o staircase tardío
  if (ext > 8) score -= 10;
  if (ext > 12) score -= 8;
  if (rsi !== null && rsi > 75) score -= 8;
  if (closes.length > 61 && (closes[closes.length - 1] / closes[closes.length - 61] - 1) * 100 > 40) score -= 8;

  if (score < 50) return null;

  return {
    symbol: quote.symbol,
    company: quote.shortName || quote.longName || quote.symbol,
    price,
    score: Math.max(0, Math.min(score, 100)),
    direction,
    reasons: reasons.slice(0, 6),
    entry,
    stop,
    target,
    riskReward,
    volumeRatio: volRatio,
    rsi,
    trend: 'alcista',
    setupState: setup.state,
    trigger: setup.trigger,
    triggerDist: setup.distToTriggerPct,
    adr,
    trail8: emas.ema8,
    trail21: emas.ema21,
    trail50: emas.ema50,
  };
}

/** SPY y QQQ sobre EMA 8/21/50 → régimen de mercado (y closes de SPY para la fuerza relativa). */
async function fetchRegime(): Promise<{ regime: MarketRegime; spyCloses: number[] }> {
  try {
    const period1 = new Date(Date.now() - 440 * 86400000);
    const [spy, qqq] = await Promise.all([
      withTimeout(yf.chart('SPY', { period1, period2: new Date(), interval: '1d' }), 8000),
      withTimeout(yf.chart('QQQ', { period1, period2: new Date(), interval: '1d' }), 8000),
    ]);
    const closesOf = (h: any): number[] =>
      (h?.quotes || []).map((q: any) => q.close).filter((c: any): c is number => c != null);
    const spyCloses = closesOf(spy);
    const qqqCloses = closesOf(qqq);
    if (spyCloses.length < 60 || qqqCloses.length < 60) throw new Error('regime data short');
    return { regime: evalRegime(spyCloses, qqqCloses), spyCloses };
  } catch {
    return { regime: { level: 'MIXED', spyAbove: false, qqqAbove: false }, spyCloses: [] };
  }
}

interface ScanData {
  universe: string[];
  candidates: TradePickCandidate[];
  regime: MarketRegime;
  spyCloses: number[];
}

let memoryCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const MIN_PICK_SCORE = 80; // pick titular: solo A / A+
const FOCUS_MIN_SCORE = 70; // focus list: B+ o mejor
const FOCUS_SIZE = 5;
const SCAN_CACHE_KEY = 'trade-picks:scan:candidates:v2';
const SCAN_CACHE_TTL = 30 * 60; // 30 min en Redis para la lista de candidatos

/** Scores the whole universe. Expensive: ~2 Yahoo calls per symbol. */
async function scoreUniverse(): Promise<ScanData> {
  const universe = await fetchTradePickUniverse().catch(() => [...STOCK_POOL]);
  const { regime, spyCloses } = await fetchRegime();

  const candidates: TradePickCandidate[] = [];
  const batchSize = 40;

  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const [quote, hist] = await Promise.all([
            withTimeout(yf.quote(symbol), 5000),
            withTimeout(
              yf.chart(symbol, {
                period1: new Date(Date.now() - 440 * 86400000),
                period2: new Date(),
                interval: '1d',
              }),
              7000
            ),
          ]);

          if (!quote || !hist?.quotes || hist.quotes.length < 10) return null;

          const closes = hist.quotes.map((h) => h.close).filter((c): c is number => c != null);
          const highs = hist.quotes.map((h) => h.high).filter((h): h is number => h != null);
          const lows = hist.quotes.map((h) => h.low).filter((l): l is number => l != null);
          const volumes = hist.quotes.map((h) => h.volume).filter((v): v is number => v != null);

          return scoreStock(quote, closes, highs, lows, volumes, regime, spyCloses);
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) candidates.push(r);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return { universe, candidates, regime, spyCloses };
}

export async function GET(request: NextRequest) {
  const excludeRaw = request.nextUrl.searchParams.get('exclude');
  const excludeSet = new Set<string>((excludeRaw || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  // El cliente siempre envía ?exclude= → recalcular siempre (evita repetir picks del día)
  const hasExclude = excludeRaw !== null;

  // Return cached result if fresh (bypassed when the client requests exclusion-aware scan)
  if (memoryCache && !hasExclude && Date.now() - memoryCache.ts < CACHE_TTL) {
    return NextResponse.json(memoryCache.data);
  }

  try {
    // El universo se puntúa una vez y se cachea: escanear ~1.000 símbolos cuesta
    // ~80 s contra Yahoo. El ?exclude= del cliente se aplica encima de la lista
    // cacheada, así que sigue sin repetir picks sin pagar el escaneo cada vez.
    const scanned = await cacheAside(SCAN_CACHE_KEY, SCAN_CACHE_TTL, scoreUniverse);
    const universe = scanned.universe;
    const regime = scanned.regime;
    const spyCloses = scanned.spyCloses || [];

    // Solo candidatos con score de focus list (≥ FOCUS_MIN_SCORE = B+)
    const candidates = scanned.candidates.filter((c) => c.score >= FOCUS_MIN_SCORE);

    // Exclude symbols already picked in the last day (client sends ?exclude=)
    if (excludeSet.size > 0) {
      for (let i = candidates.length - 1; i >= 0; i--) {
        if (excludeSet.has(candidates[i].symbol)) candidates.splice(i, 1);
      }
    }

    // Liquid mega caps with proven options chains — used as fallback candidates
    const LIQUID_UNIVERSE = [
      'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'CRM',
      'AVGO', 'ORCL', 'PLTR', 'ADBE', 'QCOM', 'MU', 'UBER', 'SQ', 'PYPL', 'COIN',
      'SHOP', 'DIS', 'NKE', 'JPM', 'GS', 'V', 'MA', 'LLY', 'UNH', 'BA',
      'CAT', 'XOM', 'MRVL', 'ARM', 'SMCI', 'INTU', 'NOW', 'AMAT', 'TXN',
    ];

    // Build the contract search set: top scored candidates first, then liquid universe
    const searchSet = new Map<string, TradePickCandidate>();
    // Prioritize top 10 scored candidates from the scan
    for (const c of candidates.slice(0, 10)) {
      if (excludeSet.has(c.symbol)) continue;
      searchSet.set(c.symbol, c);
    }
    // Si hay muy pocos candidatos (chop / mercado sin setups), reescanea mega caps líquidas
    if (searchSet.size < FOCUS_SIZE) {
      for (const sym of LIQUID_UNIVERSE) {
        if (excludeSet.has(sym)) continue;
        if (searchSet.has(sym)) continue;
        try {
          const [quote, hist] = await Promise.all([
            withTimeout(yf.quote(sym), 5000),
            withTimeout(yf.chart(sym, { period1: new Date(Date.now() - 440 * 86400000), period2: new Date(), interval: '1d' }), 7000),
          ]);
          const q = hist?.quotes || [];
          const p = quote && q.length >= 60
            ? scoreStock(
                quote,
                q.map((h) => h.close).filter((c): c is number => c != null),
                q.map((h) => h.high).filter((h): h is number => h != null),
                q.map((h) => h.low).filter((l): l is number => l != null),
                q.map((h) => h.volume).filter((v): v is number => v != null),
                regime,
                spyCloses,
              )
            : null;
          if (p && p.score >= FOCUS_MIN_SCORE) searchSet.set(sym, p);
        } catch { /* skip */ }
      }
    }
    // Sort by stock score descending — best stocks first
    const tryCandidates = Array.from(searchSet.values()).sort((a, b) => b.score - a.score);

    interface BestCombo { stock: TradePickCandidate; contract: any; score: number }

    const searchContracts = async (pick: TradePickCandidate): Promise<BestCombo | null> => {
      try {
        const datesChain = await withTimeout(yf.options(pick.symbol), 8000);
        if (!datesChain?.expirationDates?.length) return null;

        const daysUntil = (t: number) => Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
        const targetDates = datesChain.expirationDates
          .map((d: any) => new Date(d))
          .filter((d: Date) => {
            const days = daysUntil(d.getTime());
            return days >= 7 && days <= 60;
          })
          .sort((a: Date, b: Date) => Math.abs(daysUntil(a.getTime()) - 38) - Math.abs(daysUntil(b.getTime()) - 38))
          .slice(0, 2);

        let bestForPick: BestCombo | null = null;
        for (const expDate of targetDates) {
          const expChain = await withTimeout(yf.options(pick.symbol, { date: expDate }), 8000);
          const exp = expChain?.options?.[0];
          if (!exp) continue;
          const expTime = exp.expirationDate instanceof Date
            ? exp.expirationDate.getTime()
            : new Date(exp.expirationDate).getTime();
          const days = daysUntil(expTime);
          if (days < 3) continue;
          const dateStr = expDate.toISOString().split('T')[0];
          const contracts = pick.direction === 'CALL' ? (exp.calls || []) : (exp.puts || []);
          const contractCandidates = bestContract(contracts, pick.price, pick.direction === 'CALL');
          for (const c of contractCandidates) {
            const bid = c.bid || 0;
            const ask = c.ask || 0;
            const mid = (bid + ask) / 2;
            if (bid <= 0 || ask <= 0 || mid <= 0) continue;
            const spreadPct = parseFloat(((ask - bid) / mid * 100).toFixed(1));
            const vol = c.volume || 0;
            const oi = c.openInterest || 0;
            if (spreadPct > 10 || vol < 100 || oi < 500) continue;
            const delta = c.delta || c.greeks?.delta || approxDelta(c.strike, pick.price, pick.direction === 'CALL');
            const dteScore = days >= 30 && days <= 45 ? 30 : days >= 14 && days <= 60 ? 20 : days >= 7 ? 8 : 2;
            const expScore = dteScore + (30 - Math.abs(days - 38)) * 0.3;
            const contractScore = c._score || 0;
            const liqBonus = vol >= 1000 && oi >= 5000 ? 40 : vol >= 500 && oi >= 2000 ? 30 : vol >= 100 && oi >= 500 ? 18 : 8;
            const spreadScore = spreadPct <= 3 ? 40 : spreadPct <= 6 ? 30 : spreadPct <= 10 ? 20 : -50;
            const combScore = contractScore + expScore + (days >= 14 ? 50 : 0) + spreadScore + liqBonus;
            const weightedScore = combScore + (pick.score || 0) * 0.3;
            const combo = { strike: c.strike, expiration: dateStr, daysToExpiration: days, premium: c.lastPrice || mid || 0, bid, ask, spreadPct, delta, volume: c.volume || 0, openInterest: c.openInterest || 0, impliedVolatility: c.impliedVolatility || 0, _score: combScore };
            if (!bestForPick || weightedScore > bestForPick.score) {
              bestForPick = { stock: pick, contract: combo, score: weightedScore };
            }
          }
        }
        return bestForPick;
      } catch {
        return null;
      }
    }

    // Busca contratos en lotes de 5 hasta tener la focus list completa
    const combos: BestCombo[] = [];
    const OPT_BATCH = 5;
    for (let i = 0; i < tryCandidates.length && combos.length < FOCUS_SIZE; i += OPT_BATCH) {
      const batch = tryCandidates.slice(i, i + OPT_BATCH);
      const results = await Promise.all(batch.map(searchContracts));
      for (const r of results) {
        if (r) combos.push(r);
      }
    }

    // Focus list: top 5 candidatos (con contrato si se encontró uno líquido)
    const contractBySymbol = new Map<string, any>();
    for (const c of combos) contractBySymbol.set(c.stock.symbol, c.contract);
    const focusList = tryCandidates.slice(0, FOCUS_SIZE).map((c) => ({
      ...c,
      contract: contractBySymbol.get(c.symbol) ?? null,
    }));

    // Pick titular: mejor combo con score de acción A/A+ (≥ MIN_PICK_SCORE).
    // Si ninguna A/A+ consiguió contrato, se devuelve la mejor A/A+ sin contrato
    // (nunca se adjunta un contrato de spread ancho / ilíquido).
    let topPick: TradePickCandidate | null = null;
    let contract: any = null;
    const bestCombo =
      combos.filter((c) => c.stock.score >= MIN_PICK_SCORE).sort((a, b) => b.score - a.score)[0] || null;
    if (bestCombo) {
      topPick = bestCombo.stock;
      contract = bestCombo.contract;
    } else {
      const withoutContract = focusList.find((f) => f.score >= MIN_PICK_SCORE);
      if (withoutContract) topPick = withoutContract;
    }

    // Seguridad final: nunca devolver una acción con score bajo
    if (topPick && topPick.score < MIN_PICK_SCORE) {
      topPick = null;
      contract = null;
    }

    const result = {
      pick: topPick ? { ...topPick, contract } : null,
      focusList,
      regime,
      minScore: MIN_PICK_SCORE,
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
