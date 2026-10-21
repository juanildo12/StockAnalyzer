import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { STOCK_POOL, fetchTradePickUniverse, TRADE_PICK_MIN_MARKET_CAP } from '@/src/lib/stockPool';
import { cacheAside } from '@/src/lib/cache';
import {
  adrPct,
  detectSetup,
  detectShortSetup,
  emaState,
  evalRegime,
  relativeStrength,
  type MarketRegime,
} from '@/src/lib/tradePicks/momentum';
import { calcATR, calcRSI, calcSMA } from '@/src/lib/technical/analysis';
import {
  SECTOR_ETF,
  breadthAdjust,
  corpActionAdjustment,
  earningsInWindow,
  ivAdjustment,
  oiLevelsFromChain,
  peerRelativeStrength,
  realizedVol,
  swingLevels,
  tradeability,
} from '@/src/lib/tradePicks/deep';
import { getMassiveRelatedTickers, getMassiveSplits } from '@/src/services/massiveClient';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
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

/** Retorno % sobre `lookback` sesiones (null si no hay histórico suficiente). */
function pctReturn(closes: number[], lookback = 20): number | null {
  if (closes.length < lookback + 1) return null;
  const a = closes[closes.length - 1 - lookback];
  const b = closes[closes.length - 1];
  if (!(a > 0) || !(b > 0)) return null;
  return (b / a - 1) * 100;
}

interface PickEnrichment {
  relatedTickers: string[];
  peerRs: ReturnType<typeof peerRelativeStrength> | null;
  corpAction: ReturnType<typeof corpActionAdjustment> | null;
}

/**
 * Enriquecimiento free-tier SOLO para el pick titular (budget: 2 llamadas
 * Massive — related-companies + splits — que degradan a vacío si no hay slot).
 * El resto es Yahoo. Nunca lanza: si algo falla, el pick se devuelve sin extra.
 */
async function enrichTopPick(sym: string, dte: number): Promise<PickEnrichment> {
  const from = new Date(Date.now() - 60 * 86400000);
  const chart = (s: string) =>
    withTimeout(yf.chart(s, { period1: from, period2: new Date(), interval: '1d' }), 6000).catch(() => null);

  const [related, splits, stockHist] = await Promise.all([
    getMassiveRelatedTickers(sym).catch(() => [] as string[]),
    getMassiveSplits(sym, 3).catch(() => []),
    chart(sym),
  ]);

  const closes = (stockHist?.quotes || [])
    .map((q: any) => q.close)
    .filter((x: any): x is number => x != null);
  const stockRet = pctReturn(closes);

  const peers = Array.from(new Set(related.filter((p) => p && p !== sym))).slice(0, 4);
  const peerHist = await Promise.all(peers.map((p) => chart(p)));
  const peerReturns = peerHist
    .map((h) => pctReturn((h?.quotes || []).map((q: any) => q.close).filter((x: any): x is number => x != null)))
    .filter((r): r is number => r != null);

  const peerRs = stockRet != null && peerReturns.length > 0 ? peerRelativeStrength(stockRet, peerReturns) : null;

  // Riesgo por acciones corporativas: split reciente (Massive) + ex-dividendo (Yahoo)
  let daysSinceSplit: number | null = null;
  const lastSplit = splits[0]?.executionDate;
  if (lastSplit) {
    const d = (Date.now() - new Date(`${lastSplit}T00:00:00Z`).getTime()) / 86400000;
    if (d >= 0) daysSinceSplit = Math.round(d);
  }
  let daysToExDiv: number | null = null;
  try {
    const qs: any = await withTimeout(yf.quoteSummary(sym, { modules: ['calendarEvents'] }), 5000);
    const ex = qs?.calendarEvents?.exDividendDate;
    if (ex) {
      const d = (new Date(ex).getTime() - Date.now()) / 86400000;
      if (d >= 0) daysToExDiv = Math.round(d);
    }
  } catch { /* sin ex-div */ }

  return {
    relatedTickers: related,
    peerRs,
    corpAction: corpActionAdjustment(dte, daysToExDiv, daysSinceSplit),
  };
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

  // Only LIQUID contracts: tight spread + high volume + high open interest.
  // No relaxed fallback — if nothing qualifies, there is no contract.
  const effDelta = (c: any) => c.delta || c.greeks?.delta || approxDelta(c.strike, price, isCall);
  const pool = contracts.filter((c: any) =>
    (c.openInterest || 0) >= 500 &&
    (c.volume || 0) >= 100 &&
    (c.bid || 0) > 0 &&
    (c.ask || 0) > 0 &&
    Math.abs(effDelta(c)) < 0.80 && // skip deep ITM
    tight(c)
  );
  if (pool.length === 0) return []; // NEVER fall back to wide-spread / illiquid contracts

  const scored = pool.map((c: any) => {
    const oi = c.openInterest || 0;
    const vol = c.volume || 0;
    const delta = effDelta(c);
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
// Long (CALL): líderes alcistas sobre EMA 8/21/50, día verde, ADR > 2%,
// base ajustada cerca de su trigger (o recién rota con volumen).
// Short (PUT): el espejo —debacles bajo EMA 8/21/50, día rojo, base cuyo
// soporte está a punto de romperse— y se favorece con el mercado débil.

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
  setupState: 'near' | 'confirmed';
  trigger: number;
  triggerDist: number;
  adr: number;
  trail8: number | null;
  trail21: number | null;
  trail50: number | null;
  rv20: number | null; // vol anualizada 20d (para comparar con la IV)
  earningsTs: Date | number | null;
  sectorEtf: string | null;
  support: number;
  resistance: number;
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

  // Gate: base cerca de su trigger (a punto de romper o recién rota).
  // ≤12% = base ajustada (Sean); 12-18% = base amplia, se permite con
  // penalización (breakouts legítimos de bases grandes no se descartan).
  const setup = detectSetup(closes, highs, lows, volumes);
  if (!setup || setup.rangePct > 18) return null;
  const wideBase = setup.rangePct > 12;

  const rsi = calcRSI(closes);
  const atr = calcATR(highs, lows, closes) || price * 0.02;
  const rs = relativeStrength(closes, spyCloses, 20);
  const rv20 = realizedVol(closes);
  const vix = typeof regime.vix === 'number' ? regime.vix : null;

  // Solo largo: los líderes alcistas son las únicas jugadas del sistema
  const direction: 'CALL' = 'CALL';

  // Entrada: el trigger si aún no rompió (buy stop), el precio si ya rompió
  const entry = setup.state === 'confirmed' ? price : setup.trigger;

  // Niveles reales por swing pivots (no cada mero high de la barra)
  const sw = swingLevels(highs, lows, price);
  const support = sw.supports[0] ?? setup.baseLow;
  const resistance = sw.resistances[0] ?? 0;

  // Stop: piso de la base / soporte estructural (si está ≥1 ATR debajo) / 1.5 ATR
  const structural = sw.supports.find((s) => s <= entry - atr);
  const stop = Math.max(setup.baseLow, entry - 1.5 * atr, structural ?? 0);
  if (!(entry > stop)) return null;

  // Target: proyección del impulso previo (medida del asta). El muro real de
  // resistencia NO anula el setup: se usa como tope realista para el contrato
  // (tradeability) y como penalización si está en el camino.
  const wall = sw.resistances.find((r) => r > entry * 1.03);
  const poleTarget = entry + Math.max(setup.poleHeight, atr * 3);
  const target = poleTarget;
  const wallInPath = wall !== undefined && wall < poleTarget;

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
  else if (setup.rangePct <= 12) { score += 8; reasons.push(`Base de ${setup.rangePct.toFixed(1)}%`); }
  else { score += 0; reasons.push(`Base amplia: ${setup.rangePct.toFixed(1)}% — más riesgo en la entrada`); }
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

  // 6b. Volatilidad de fondo: VIX alto castiga (eventos, squeezes), VIX bajo ayuda
  if (vix !== null) {
    if (vix > 30) { score -= 10; reasons.push(`VIX ${vix.toFixed(1)} — volatilidad extrema`); }
    else if (vix > 25) { score -= 6; reasons.push(`VIX ${vix.toFixed(1)} — volatilidad alta`); }
    else if (vix <= 16) { score += 2; reasons.push(`VIX ${vix.toFixed(1)} — entorno calmado`); }
  }

  // 7. Risk / reward (0-5)
  if (riskReward >= 3) { score += 5; reasons.push(`R:R ${riskReward.toFixed(1)}`); }
  else if (riskReward >= 2) score += 3;

  if (resistance > 0) reasons.push(`Estructura: soporte $${support.toFixed(2)} / resistencia $${resistance.toFixed(2)}`);
  // Muro de resistencia dentro del camino proyectado → el movimiento realista
  // está acotado: penaliza y avisa (el contrato usa el target realista).
  if (wallInPath && wall !== undefined) {
    score -= 3;
    reasons.push(`Resistencia real $${wall.toFixed(2)} en el camino — tope realista del target`);
  }

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
    reasons: reasons.slice(0, 8),
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
    rv20,
    earningsTs: quote.earningsTimestamp ?? null,
    sectorEtf: null,
    support,
    resistance,
  };
}

/**
 * Espejo bajista de scoreStock: debacles bajo EMA 8/21/50, día rojo, base cuyo
 * soporte está a punto de romperse. Genera candidatos PUT. El régimen de
 * mercado y el VIX se invierten: mercado débil / volatilidad alta favorecen.
 */
function scoreShort(
  quote: any,
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  regime: MarketRegime,
  spyCloses: number[],
): TradePickCandidate | null {
  const price = quote.regularMarketPrice || 0;
  if (!(price >= 3) || !isFinite(price)) return null;

  const marketCap = quote.marketCap || 0;
  if (marketCap > 0 && marketCap < TRADE_PICK_MIN_MARKET_CAP) return null;

  const avgVol = quote.averageDailyVolume3Month || quote.averageDailyVolume10Day || 0;
  if (avgVol < 500_000) return null;
  const curVol = quote.regularMarketVolume || volumes[volumes.length - 1] || 0;
  const volRatio = avgVol > 0 && curVol > 0 ? curVol / avgVol : 1;

  // Gate: día rojo (espejo de Change > 0)
  const changePct = typeof quote.regularMarketChangePercent === 'number'
    ? quote.regularMarketChangePercent
    : closes.length >= 2 && closes[closes.length - 2] > 0
      ? (closes[closes.length - 1] / closes[closes.length - 2] - 1) * 100
      : 0;
  if (changePct >= 0) return null;

  // Gate: ADR > 2%
  const adr = adrPct(highs, lows, closes);
  if (adr === null || adr < 2) return null;

  // Gate: precio bajo EMA 8/21/50 (tendencia bajista)
  const emas = emaState(closes, price);
  if (!emas.priceBelowAll) return null;

  // Gate: base cuyo soporte está a punto de romperse (o recién roto)
  const setup = detectShortSetup(closes, highs, lows, volumes);
  if (!setup || setup.rangePct > 18) return null;

  const rsi = calcRSI(closes);
  const atr = calcATR(highs, lows, closes) || price * 0.02;
  const rs = relativeStrength(closes, spyCloses, 20);
  const rv20 = realizedVol(closes);
  const vix = typeof regime.vix === 'number' ? regime.vix : null;

  const direction: 'PUT' = 'PUT';

  // Entrada: el soporte si aún no rompió (sell stop), el precio si ya rompió
  const entry = setup.state === 'confirmed' ? price : setup.trigger;

  const sw = swingLevels(highs, lows, price);
  const support = sw.supports[0] ?? 0; // soporte más cercano por debajo
  const resistance = sw.resistances[0] ?? setup.baseHigh; // techo de la base → stop

  // Stop: techo de la base / resistencia estructural (≥1 ATR arriba) / 1.5 ATR
  const structural = sw.resistances.find((r) => r >= entry + atr);
  const stop = Math.min(setup.baseHigh, entry + 1.5 * atr, structural ?? Infinity);
  if (!(stop > entry)) return null;

  // Target: proyección del asta a la baja; un soporte real en el camino acota
  const floor = sw.supports.find((s) => s < entry * 0.97);
  const poleTarget = entry - Math.max(setup.poleHeight, atr * 3);
  const target = poleTarget;
  const floorInPath = floor !== undefined && floor > poleTarget;

  const risk = stop - entry;
  const reward = entry - target;
  const riskReward = risk > 0 ? reward / risk : 0;
  if (riskReward < 2) return null;

  let score = 0;
  const reasons: string[] = [];

  // 1. Alineación EMA bajista (0-20)
  score += 10;
  if (emas.stackedDown) score += 6;
  const ext = emas.extFromEma8; // negativo (bajo EMA8)
  if (ext <= -0.3 && ext >= -6) { score += 4; reasons.push('Bajo EMA 8/21/50 — tendencia bajista activa'); }
  else if (ext > -0.3) score += 2;
  else score += 1;

  // 2. Calidad de la base (0-20)
  if (setup.rangePct <= 8) { score += 12; reasons.push(`Base ajustada: rango ${setup.rangePct.toFixed(1)}% en 15 sesiones`); }
  else if (setup.rangePct <= 12) { score += 8; reasons.push(`Base de ${setup.rangePct.toFixed(1)}%`); }
  else { reasons.push(`Base amplia: ${setup.rangePct.toFixed(1)}% — más riesgo en la entrada`); }
  if (setup.volDryUp) { score += 8; reasons.push(`Volumen ${setup.volChangePct.toFixed(0)}% en la consolidación`); }
  else if (setup.volChangePct < 0) score += 5;
  else score += 2;

  // 3. Breakdown / trigger (0-25)
  if (setup.state === 'confirmed') {
    const extPast = -setup.distToTriggerPct; // % por debajo del soporte
    if (extPast > 3) score -= 12;
    else if (extPast > 2) score -= 6;
    else if (extPast > 1) score -= 3;
    if (setup.volRatio >= 1.5) {
      score += extPast > 2 ? 18 : 23;
      reasons.push(`Ruptura del soporte $${setup.trigger.toFixed(2)} con volumen ${setup.volRatio.toFixed(1)}x`);
    } else {
      score += extPast > 2 ? 12 : 16;
      reasons.push(`Bajo el soporte $${setup.trigger.toFixed(2)} — falta volumen`);
    }
  } else {
    const d = setup.distToTriggerPct;
    score += d <= 1 ? 18 : d <= 2 ? 16 : 12;
    reasons.push(`Soporte $${setup.trigger.toFixed(2)} a ${d.toFixed(1)}% — a punto de romper abajo`);
  }
  if (setup.state === 'near') score += 4;
  else if (setup.state === 'confirmed' && (-setup.distToTriggerPct) <= 1.5) score += 2;

  // 4. Debilidad relativa vs SPY (0-15)
  if (rs !== null) {
    if (rs <= -10) { score += 15; reasons.push(`Debilidad relativa ${rs.toFixed(1)}% vs SPY (20d)`); }
    else if (rs <= -5) { score += 12; reasons.push(`Debilidad relativa ${rs.toFixed(1)}% vs SPY (20d)`); }
    else if (rs <= 0) score += 8;
  }

  // 5. Liquidez / ADR (0-10)
  if (volRatio >= 2) { score += 6; reasons.push(`Vol ${volRatio.toFixed(1)}x vs promedio`); }
  else if (volRatio >= 1.3) score += 4;
  else if (volRatio >= 1) score += 2;
  score += adr >= 3 ? 4 : 2;

  // 6. Régimen: mercado débil favorece puts (espejo del long)
  if (regime.level === 'CHOP') { score += 10; reasons.push('Mercado débil (SPY/QQQ bajo EMA) — favorece puts'); }
  else if (regime.level === 'MIXED') score += 5;
  else { score -= 10; reasons.push('Mercado fuerte (SPY/QQQ sobre EMA) — puts contra la tendencia'); }

  // 6b. VIX: volatilidad alta ayuda a los puts
  if (vix !== null) {
    if (vix > 30) { score += 6; reasons.push(`VIX ${vix.toFixed(1)} — volatilidad extrema, favorece puts`); }
    else if (vix > 25) { score += 4; reasons.push(`VIX ${vix.toFixed(1)} — volatilidad alta`); }
    else if (vix <= 16) { score -= 4; reasons.push(`VIX ${vix.toFixed(1)} — entorno calmado, puts caros`); }
  }

  // 7. Risk / reward (0-5)
  if (riskReward >= 3) { score += 5; reasons.push(`R:R ${riskReward.toFixed(1)}`); }
  else if (riskReward >= 2) score += 3;

  reasons.push(`Estructura: soporte $${support.toFixed(2)} / resistencia $${resistance.toFixed(2)}`);
  if (floorInPath && floor !== undefined) {
    score -= 3;
    reasons.push(`Soporte real $${floor.toFixed(2)} en el camino — tope realista del target`);
  }

  // Penalizaciones: muy extendido a la baja, sobrevendido o staircase tardío
  if (ext < -8) score -= 10;
  if (ext < -12) score -= 8;
  if (rsi !== null && rsi < 25) score -= 8;
  if (closes.length > 61 && (closes[closes.length - 1] / closes[closes.length - 61] - 1) * 100 < -40) score -= 8;

  if (score < 50) return null;

  return {
    symbol: quote.symbol,
    company: quote.shortName || quote.longName || quote.symbol,
    price,
    score: Math.max(0, Math.min(score, 100)),
    direction,
    reasons: reasons.slice(0, 8),
    entry,
    stop,
    target,
    riskReward,
    volumeRatio: volRatio,
    rsi,
    trend: 'bajista',
    setupState: setup.state,
    trigger: setup.trigger,
    triggerDist: setup.distToTriggerPct,
    adr,
    trail8: emas.ema8,
    trail21: emas.ema21,
    trail50: emas.ema50,
    rv20,
    earningsTs: quote.earningsTimestamp ?? null,
    sectorEtf: null,
    support,
    resistance,
  };
}

/** SPY y QQQ sobre EMA 8/21/50 → régimen de mercado, más VIX (riesgo de fondo). */
async function fetchRegime(): Promise<{ regime: MarketRegime; spyCloses: number[] }> {
  try {
    const period1 = new Date(Date.now() - 440 * 86400000);
    const [spy, qqq, vixQ] = await Promise.all([
      withTimeout(yf.chart('SPY', { period1, period2: new Date(), interval: '1d' }), 8000),
      withTimeout(yf.chart('QQQ', { period1, period2: new Date(), interval: '1d' }), 8000),
      withTimeout(yf.quote('^VIX'), 5000),
    ]);
    const closesOf = (h: any): number[] =>
      (h?.quotes || []).map((q: any) => q.close).filter((c: any): c is number => c != null);
    const spyCloses = closesOf(spy);
    const qqqCloses = closesOf(qqq);
    if (spyCloses.length < 60 || qqqCloses.length < 60) throw new Error('regime data short');
    const vix = typeof vixQ?.regularMarketPrice === 'number' ? vixQ.regularMarketPrice : null;
    return { regime: { ...evalRegime(spyCloses, qqqCloses), vix }, spyCloses };
  } catch {
    return { regime: { level: 'MIXED', spyAbove: false, qqqAbove: false, vix: null }, spyCloses: [] };
  }
}

interface ScanData {
  universe: string[];
  candidates: TradePickCandidate[];
  shorts: TradePickCandidate[];
  regime: MarketRegime;
  spyCloses: number[];
}

let memoryCache: { data: any; ts: number; bias: string } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 min (solo si el cliente no manda ?exclude)
const MIN_PICK_SCORE = 80; // pick titular: solo A / A+
const FOCUS_MIN_SCORE = 70; // focus list: B+ o mejor
const FOCUS_SIZE = 5;
const SCAN_CACHE_KEY = 'trade-picks:scan:candidates:v4'; // v4: candidatos CALL + PUT (bias)
const SCAN_CACHE_TTL = 15 * 60; // 15 min en Redis: picks intradía frescos

// ── Filtro USA-only ─────────────────────────────────────────────────────────
// El universo de screeners incluye ADR/dual-listing (ej. CMBT — Bélgica —
// cotiza en NYSE en USD). quote() no trae país: se consulta assetProfile vía
// quoteSummary con caché por símbolo. Si la consulta falla, se conserva el
// símbolo (mejor un falso positivo que perder un pick válido por timeout).
const countryCache = new Map<string, string | null>();
async function isUSCompany(symbol: string): Promise<boolean> {
  if (countryCache.has(symbol)) return countryCache.get(symbol) === 'United States';
  try {
    const qs = await withTimeout(yf.quoteSummary(symbol, { modules: ['assetProfile'] }), 5000);
    const country = (qs as any)?.assetProfile?.country ?? null;
    countryCache.set(symbol, country);
    if (!country) {
      console.warn(`[US-only] sin país para ${symbol} — se conserva`);
      return true;
    }
    return country === 'United States';
  } catch (e: any) {
    console.warn(`[US-only] país no disponible para ${symbol}: ${e?.message} — se conserva`);
    return true;
  }
}

async function filterUSOnly(cands: TradePickCandidate[]): Promise<TradePickCandidate[]> {
  const keep = await Promise.all(
    cands.map(async (c) => ((await isUSCompany(c.symbol)) ? c : null))
  );
  return keep.filter((c): c is TradePickCandidate => c !== null);
}

/** Scores the whole universe. Expensive: ~2 Yahoo calls per symbol. */
async function scoreUniverse(): Promise<ScanData> {
  const universe = await fetchTradePickUniverse().catch(() => [...STOCK_POOL]);
  const { regime, spyCloses } = await fetchRegime();

  const candidates: TradePickCandidate[] = [];
  const shorts: TradePickCandidate[] = [];
  const batchSize = 40;
  let above50 = 0;
  let withData = 0;

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

          // Amplitud: ¿el precio está sobre MA50? (se cuenta aunque falle el scoring)
          let over50 = false;
          if (closes.length >= 50) {
            const sma50 = calcSMA(closes, 50);
            const p = quote.regularMarketPrice || closes[closes.length - 1];
            over50 = sma50 !== null && p > sma50;
          }

          return {
            cand: scoreStock(quote, closes, highs, lows, volumes, regime, spyCloses),
            short: scoreShort(quote, closes, highs, lows, volumes, regime, spyCloses),
            over50,
          };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (!r) continue;
      withData++;
      if (r.over50) above50++;
      if (r.cand) candidates.push(r.cand);
      if (r.short) shorts.push(r.short);
    }
  }

  // Amplitud del mercado: más del 65% del universo sobre MA50 = monto sanamente
  // direccional; <35% = solo unas pocas name funcionando (riesgo de promedio).
  // Para los PUTs el ajuste se invierte: debilidad de amplitud favorece al bajista.
  const breadth = withData > 0 ? (above50 / withData) * 100 : null;
  const bAdj = breadthAdjust(breadth);
  if (bAdj !== 0) {
    for (const c of candidates) {
      c.score = Math.max(0, Math.min(c.score + bAdj, 100));
      c.reasons.push(bAdj > 0 ? `Amplitud: ${(breadth as number).toFixed(0)}% del universo sobre MA50` : `Amplitud débil: ${(breadth as number).toFixed(0)}% sobre MA50`);
    }
    for (const s of shorts) {
      s.score = Math.max(0, Math.min(s.score - bAdj, 100));
      s.reasons.push(bAdj < 0 ? `Amplitud débil: ${(breadth as number).toFixed(0)}% sobre MA50 — favorece puts` : `Amplitud: ${(breadth as number).toFixed(0)}% del universo sobre MA50 — contra puts`);
    }
    if (breadth !== null) regime.breadth = Math.round(breadth);
  }

  candidates.sort((a, b) => b.score - a.score);
  shorts.sort((a, b) => b.score - a.score);
  return { universe, candidates, shorts, regime, spyCloses };
}

export async function GET(request: NextRequest) {
  const excludeRaw = request.nextUrl.searchParams.get('exclude');
  const excludeSet = new Set<string>((excludeRaw || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
  // El cliente siempre envía ?exclude= → recalcular siempre (evita repetir picks del día)
  const hasExclude = excludeRaw !== null;

  // Direccionalidad: 'bull' (CALL, por defecto) o 'bear' (PUT)
  const biasRaw = (request.nextUrl.searchParams.get('bias') || '').toLowerCase();
  const isBear = biasRaw === 'bear' || biasRaw === 'put';
  const bias = isBear ? 'bear' : 'bull';

  // Return cached result if fresh (bypassed when the client requests exclusion-aware scan)
  if (memoryCache && !hasExclude && memoryCache.bias === bias && Date.now() - memoryCache.ts < CACHE_TTL) {
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
    // Pool según el sesgo: bulls (CALL) o debacles (PUT)
    const pool = isBear ? (scanned.shorts || []) : scanned.candidates;

    // Solo candidatos con score de focus list (≥ FOCUS_MIN_SCORE = B+) y
    // empresas de USA (excluye ADR/dual-listing como CMBT)
    const candidates = await filterUSOnly(
      pool.filter((c) => c.score >= FOCUS_MIN_SCORE)
    );

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

    // Scoring de una megacap líquida (fallback con los mismos gates que el universo)
    const scoreLiquidCandidate = async (sym: string): Promise<TradePickCandidate | null> => {
      try {
        const [quote, hist] = await Promise.all([
          withTimeout(yf.quote(sym), 5000),
          withTimeout(yf.chart(sym, { period1: new Date(Date.now() - 440 * 86400000), period2: new Date(), interval: '1d' }), 7000),
        ]);
        const q = hist?.quotes || [];
        if (!quote || q.length < 60) return null;
        const closes = q.map((h) => h.close).filter((c): c is number => c != null);
        const highs = q.map((h) => h.high).filter((h): h is number => h != null);
        const lows = q.map((h) => h.low).filter((l): l is number => l != null);
        const volumes = q.map((h) => h.volume).filter((v): v is number => v != null);
        const p = isBear
          ? scoreShort(quote, closes, highs, lows, volumes, regime, spyCloses)
          : scoreStock(quote, closes, highs, lows, volumes, regime, spyCloses);
        if (!p || p.score < FOCUS_MIN_SCORE) return null;
        return (await isUSCompany(sym)) ? p : null;
      } catch {
        return null;
      }
    };

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
        const p = await scoreLiquidCandidate(sym);
        if (p) searchSet.set(sym, p);
      }
    }
    // Sort by stock score descending — best stocks first
    let tryCandidates = Array.from(searchSet.values()).sort((a, b) => b.score - a.score);

    // ── Fase de profundidad: fuerza relativa vs SECTOR ──────────────────────
    // El líder real supera a su sector, no solo al SPY. Se resuelve el sector
    // vía quoteSummary y se compara contra el ETF del sector (XLK, XLF, ...).
    try {
      const finalists = tryCandidates.slice(0, 8);
      const enriched = await Promise.all(
        finalists.map(async (c) => {
          const [qs, hist] = await Promise.all([
            withTimeout(yf.quoteSummary(c.symbol, { modules: ['assetProfile'] }), 5000),
            withTimeout(
              yf.chart(c.symbol, { period1: new Date(Date.now() - 120 * 86400000), period2: new Date(), interval: '1d' }),
              7000
            ),
          ]);
          const closes = (hist?.quotes || [])
            .map((h: any) => h.close)
            .filter((x: any): x is number => x != null);
          return { cand: c, sector: (qs as any)?.assetProfile?.sector ?? null, closes };
        })
      );

      const etfNeeded = Array.from(
        new Set(
          enriched
            .map((e) => (e.sector ? SECTOR_ETF[e.sector] : null))
            .filter((t): t is string => !!t)
        )
      );
      const etfCloses = new Map<string, number[]>();
      await Promise.all(
        etfNeeded.map(async (etf) => {
          try {
            const h = await withTimeout(
              yf.chart(etf, { period1: new Date(Date.now() - 120 * 86400000), period2: new Date(), interval: '1d' }),
              7000
            );
            const closes = (h?.quotes || [])
              .map((q: any) => q.close)
              .filter((x: any): x is number => x != null);
            if (closes.length >= 21) etfCloses.set(etf, closes);
          } catch { /* sin ETF → sin ajuste */ }
        })
      );

      const adjusted = new Map<string, TradePickCandidate>();
      for (const { cand, sector, closes } of enriched) {
        const etf = sector ? SECTOR_ETF[sector] : null;
        const bench = etf ? etfCloses.get(etf) : null;
        const copy: TradePickCandidate = { ...cand, sectorEtf: etf ?? null };
        if (bench && closes.length >= 21) {
          const rsSec = relativeStrength(closes, bench, 20);
          if (rsSec !== null) {
            if (isBear) {
              // Para puts, rezagarse al sector es a favor; liderarlo, en contra
              if (rsSec <= -5) {
                copy.score = Math.min(100, copy.score + 3);
                copy.reasons = [`Rezaga a su sector ${etf} (${rsSec.toFixed(1)}% 20d) — favorece puts`, ...copy.reasons];
              } else if (rsSec >= 5) {
                copy.score = Math.max(0, copy.score - 6);
                copy.reasons = [`Lidera su sector ${etf} (+${rsSec.toFixed(1)}% 20d) — contra puts`, ...copy.reasons];
              }
            } else if (rsSec < -5) {
              copy.score = Math.max(0, copy.score - 6);
              copy.reasons = [`Rezaga a su sector ${etf} (${rsSec.toFixed(1)}% 20d)`, ...copy.reasons];
            } else if (rsSec >= 5) {
              copy.score = Math.min(100, copy.score + 3);
              copy.reasons = [`Lidera su sector ${etf} (+${rsSec.toFixed(1)}% 20d)`, ...copy.reasons];
            }
          }
        }
        adjusted.set(cand.symbol, copy);
      }
      // Reordena con los scores ya ajustados por sector
      tryCandidates = Array.from(
        new Map(tryCandidates.map((c) => [c.symbol, adjusted.get(c.symbol) ?? c] as [string, TradePickCandidate])).values()
      ).sort((a, b) => b.score - a.score);
    } catch { /* sin datos de sector → sigue sin ajustar */ }

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

          // Muros de OI de esta cadena: callWall frena el target, putWall respalda el stop
          const walls = oiLevelsFromChain(exp);
          const isCall = pick.direction === 'CALL';
          // Target realista para el contrato: si hay un nivel real entre la
          // entrada y la proyección, el movimiento esperado está acotado
          // (resistencia para calls, soporte para puts).
          const realisticTarget = isCall
            ? pick.resistance > 0 && pick.resistance > pick.entry && pick.resistance < pick.target
              ? pick.resistance
              : pick.target
            : pick.support > 0 && pick.support < pick.entry && pick.support > pick.target
              ? pick.support
              : pick.target;

          for (const c of contractCandidates) {
            const bid = c.bid || 0;
            const ask = c.ask || 0;
            const mid = (bid + ask) / 2;
            if (bid <= 0 || ask <= 0 || mid <= 0) continue;
            const spreadPct = parseFloat(((ask - bid) / mid * 100).toFixed(1));
            const vol = c.volume || 0;
            const oi = c.openInterest || 0;
            if (spreadPct > 10 || vol < 100 || oi < 500) continue;
            const delta = c.delta || c.greeks?.delta || approxDelta(c.strike, pick.price, isCall);
            const iv = c.impliedVolatility || c.greeks?.impliedVolatility || null;
            const premium = c.lastPrice || mid;

            // Componentes del lado de la opción (0-100)
            const contractScore = c._score || 0; // spread + liquidez + delta + OTM (sin duplicar)
            const dteScore = days >= 30 && days <= 45 ? 30 : days >= 14 && days <= 60 ? 20 : days >= 7 ? 8 : 2;
            const expScore = dteScore + (30 - Math.abs(days - 38)) * 0.3; // ~0-39
            const trade = tradeability({
              price: pick.price,
              target: realisticTarget,
              strike: c.strike,
              premium,
              delta,
              dte: days,
              adr: pick.adr,
              isCall,
            });
            const ivAdj = ivAdjustment(iv, pick.rv20);
            const earningsSoon = earningsInWindow(pick.earningsTs, days);
            const earningsAdj = earningsSoon ? -30 : 0;
            const wallBlocked = isCall
              ? walls.callWall !== null && walls.callWall > pick.price && pick.target > walls.callWall
              : walls.putWall !== null && walls.putWall < pick.price && pick.target < walls.putWall;
            const oiAdj = wallBlocked ? -10 : 0;

            const optionScore = Math.max(
              0,
              Math.min(
                contractScore * 0.55 + expScore * 0.55 + trade.score + ivAdj + earningsAdj + oiAdj,
                100
              )
            );
            // La acción manda (60%): el contrato no puede rescatar una acción mediocre
            const weightedScore = (pick.score || 0) * 0.6 + optionScore * 0.4;

            const combo = {
              strike: c.strike,
              expiration: dateStr,
              daysToExpiration: days,
              premium,
              bid,
              ask,
              spreadPct,
              delta,
              volume: vol,
              openInterest: oi,
              impliedVolatility: iv || 0,
              breakeven: trade.breakeven,
              breakevenPct: parseFloat(trade.breakevenPct.toFixed(1)),
              expectedReturn: parseFloat(trade.expectedReturn.toFixed(2)),
              targetReachable: trade.reachable,
              earningsSoon,
              callWall: walls.callWall,
              putWall: walls.putWall,
              targetBlockedByOi: wallBlocked,
              ivAdj,
              optionScore: Math.round(optionScore),
              _score: contractScore,
            };
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
    const OPT_BATCH = 5;
    const combos: BestCombo[] = [];
    for (let i = 0; i < tryCandidates.length && combos.length < FOCUS_SIZE; i += OPT_BATCH) {
      const batch = tryCandidates.slice(i, i + OPT_BATCH);
      const results = await Promise.all(batch.map(searchContracts));
      for (const r of results) {
        if (r) combos.push(r);
      }
    }

    // Los líderes momentum suelen tener cadenas finas (spread ancho / OI bajo).
    // Si faltan contratos, busca en megacaps líquidas con cadena probada —
    // los filtros de spread/volumen/OI NUNCA se relajan.
    let liquidFallbackScored = 0;
    if (combos.length < FOCUS_SIZE) {
      const already = new Set(tryCandidates.map((c) => c.symbol));
      const pool = LIQUID_UNIVERSE.filter(
        (s) => !already.has(s) && !excludeSet.has(s)
      ).slice(0, 10);
      const extra: TradePickCandidate[] = [];
      for (let i = 0; i < pool.length; i += 5) {
        const rs = await Promise.all(pool.slice(i, i + 5).map(scoreLiquidCandidate));
        for (const r of rs) if (r) extra.push(r);
      }
      liquidFallbackScored = extra.length;
      if (extra.length > 0) {
        extra.sort((a, b) => b.score - a.score);
        tryCandidates = [...tryCandidates, ...extra].sort((a, b) => b.score - a.score);
        for (let i = 0; i < extra.length && combos.length < FOCUS_SIZE; i += OPT_BATCH) {
          const batch = extra.slice(i, i + OPT_BATCH);
          const results = await Promise.all(batch.map(searchContracts));
          for (const r of results) {
            if (r && !combos.some((x) => x.stock.symbol === r.stock.symbol)) combos.push(r);
          }
        }
      }
      console.log(
        `[TradePicks/Scan] combos=${combos.length}/${FOCUS_SIZE} liquidPool=${pool.length} liquidScored=${liquidFallbackScored}`
      );
    }

    // Focus list: SOLO candidatos con contrato líquido (los combos), ordenados
    // por score de acción. Un setup sin contrato líquido no es ejecutable → fuera.
    const combosSorted = [...combos].sort((a, b) => b.stock.score - a.stock.score);
    const seenFocus = new Set<string>();
    const focusList: any[] = [];
    for (const c of combosSorted) {
      if (seenFocus.has(c.stock.symbol)) continue;
      seenFocus.add(c.stock.symbol);
      focusList.push({ ...c.stock, contract: c.contract });
      if (focusList.length >= FOCUS_SIZE) break;
    }

    // Pick titular: mejor combo con score de acción A/A+ (≥ MIN_PICK_SCORE).
    // SOLO se devuelve si tiene contrato líquido; si ninguna A/A+ consiguió
    // contrato líquido, no hay pick (nunca se adjunta uno ilíquido ni se
    // devuelve una acción sin contrato).
    let topPick: TradePickCandidate | null = null;
    let contract: any = null;
    const bestCombo =
      combos.filter((c) => c.stock.score >= MIN_PICK_SCORE).sort((a, b) => b.score - a.score)[0] || null;
    if (bestCombo) {
      topPick = bestCombo.stock;
      contract = bestCombo.contract;
    }
    if (topPick && !contract) topPick = null;

    // Seguridad final: nunca devolver una acción con score bajo
    if (topPick && topPick.score < MIN_PICK_SCORE) {
      topPick = null;
      contract = null;
    }

    // Enriquecimiento free-tier (Massive) solo del pick titular: fuerza relativa
    // vs pares + riesgo por acciones corporativas. Advisory: no re-gatea.
    let enrichment: PickEnrichment | null = null;
    if (topPick) {
      try {
        enrichment = await enrichTopPick(topPick.symbol, contract?.daysToExpiration ?? 38);
      } catch {
        enrichment = null;
      }
    }

    const result = {
      pick: topPick
        ? {
            ...topPick,
            contract,
            relatedTickers: enrichment?.relatedTickers ?? [],
            peerRs: enrichment?.peerRs ?? null,
            corpAction: enrichment?.corpAction ?? null,
            reasons: [
              ...(enrichment?.peerRs?.reason && !isBear ? [enrichment.peerRs.reason] : []),
              ...(enrichment?.corpAction?.reasons ?? []),
              ...topPick.reasons,
            ],
          }
        : null,
      focusList,
      regime,
      bias,
      minScore: MIN_PICK_SCORE,
      scanned: universe.length,
      candidates: candidates.length,
      searchedForContracts: tryCandidates.length,
      liquidFallbackScored,
      generatedAt: new Date().toISOString(),
    };

    memoryCache = { data: result, ts: Date.now(), bias };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[TradePicks/Scan] Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Scan failed', pick: null }, { status: 500 });
  }
}
