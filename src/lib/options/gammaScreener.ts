// Gamma Screener engine — pure, unit-testable quantitative layer.
//
// Combines options-market positioning (dealer gamma exposure), volatility skew,
// momentum and liquidity into a normalized Edge Score, and derives the key
// gamma levels (Call Wall / Put Wall / Gamma Flip) plus the distance to each.
//
// DATA HONESTY CONTRACT:
//   • Open interest does NOT reveal dealer positioning. Every GEX number here is
//     an ESTIMATE under an explicitly documented, configurable sign assumption.
//   • Missing / stale data is never replaced with zero. Metrics that cannot be
//     computed from real inputs are returned as null (UNKNOWN).
//   • The Edge Score measures candidate QUALITY, not probability of profit.
//
// GEX convention (standard, SqueezeMetrics-style), per 1% underlying move:
//   GEX = gamma * OI * 100 * spot^2 * 0.01   [dollars]
//   With positioning.signCalls=+1, signPuts=-1 (dealers long calls / short puts):
//     callGex > 0, putGex < 0.
//   The sign assumption is configurable via DealerPositioning.

import { normalCDF } from './bs';
import { bsGamma } from './gamma';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenerContract {
  strike: number;
  type: 'call' | 'put';
  oi: number;
  volume: number;
  iv: number; // annualized decimal (0.25 = 25%)
  delta?: number | null; // optional; computed locally when absent
  expiry: string; // ISO date (YYYY-MM-DD) — required for multi-expiration aggregation
  dte: number; // days to expiry
  /** Quote fields (Yahoo). Used ONLY for the liquid-contract suggestion. */
  bid?: number | null;
  ask?: number | null;
  last?: number | null;
}

export interface DealerPositioning {
  /** +1 = dealers long calls (default), -1 = dealers short calls. */
  signCalls: number;
  /** -1 = dealers short puts (default), +1 = dealers long puts. */
  signPuts: number;
}

export const DEFAULT_POSITIONING: DealerPositioning = { signCalls: +1, signPuts: -1 };

export type ExpiryScope = 'nearest' | 'weekly' | 'monthly' | 'all';

export interface GexByExpiry {
  expiry: string;
  dte: number;
  netGex: number;
  callGex: number;
  putGex: number;
  oi: number;
}

export interface GexRow {
  strike: number;
  callOi: number;
  putOi: number;
  callGex: number;
  putGex: number;
  netGex: number;
  totalOi: number;
  /** Representative IV at this strike (OI-weighted), used for exact flip recompute. */
  iv: number;
}

export type GammaRegime = 'positive' | 'negative' | 'neutral' | 'unknown';

export interface GammaLevelsMultiResult {
  regime: GammaRegime;
  callWall: number | null;
  putWall: number | null;
  netWall: number | null;
  gammaFlip: number | null;
  spotVsFlipPct: number | null;
  distCallWallPct: number | null;
  distPutWallPct: number | null;
  distFlipPct: number | null;
  totalNetGex: number;
  totalCallGex: number;
  totalPutGex: number;
  totalOi: number;
  netGexNorm: number | null; // |netGex| / totalOi proxy (scale-free)
  gex: GexRow[];
  byExpiry: GexByExpiry[];
  scope: ExpiryScope;
  expirationsIncluded: string[];
}

export type SkewRegime = 'bullish' | 'neutral' | 'bearish' | 'unknown';

export interface SkewResult {
  regime: SkewRegime;
  riskReversal25: number | null; // callIV25d - putIV25d (positive = call side bid)
  putCallIvDiff: number | null; // putIV25d - callIV25d
  atmIv: number | null;
  putSkew: number | null; // putIV - atmIV
  callSkew: number | null; // callIV - atmIV
}

export type MomentumClass = 'bullish' | 'lean_bullish' | 'neutral' | 'lean_bearish' | 'bearish';

export interface MomentumResult {
  classification: MomentumClass;
  ema8: number | null;
  ema21: number | null;
  ema50: number | null;
  ret5d: number | null;
  ret20d: number | null;
  relVolume: number | null;
  aboveAll: boolean;
  belowAll: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// IV / delta helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Black-Scholes delta for a single option (call or put), r default 0.045. */
export function bsDelta(S: number, K: number, T: number, sigma: number, isCall: boolean, r = 0.045): number | null {
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return null;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return isCall ? normalCDF(d1) : normalCDF(d1) - 1;
}

/** Filter out Yahoo's garbage IVs (deep-ITM 1e-5 or >500%) before any math. */
export function isUsableIv(iv: number | null | undefined): iv is number {
  return typeof iv === 'number' && Number.isFinite(iv) && iv >= 0.005 && iv <= 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// GEX / gamma levels (multi-expiration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Choose which expirations to fetch: keep the true nearest expiry, then the ones
 * closest to a 14/30/45d ladder (so the GEX map and the contract suggestion get
 * a usable term structure without extra provider calls).
 */
export function selectChainExpirations<T extends { date: string; dte: number }>(all: T[], maxCount: number): T[] {
  if (all.length <= maxCount) return all;
  const chosen: T[] = [all[0]];
  const targets = [30, 45, 14, 60, 21];
  for (const t of targets) {
    if (chosen.length >= maxCount) break;
    let best: T | null = null;
    for (const e of all) {
      if (chosen.some((c) => c.date === e.date)) continue;
      if (best == null || Math.abs(e.dte - t) < Math.abs(best.dte - t)) best = e;
    }
    if (best) chosen.push(best);
  }
  for (const e of all) {
    if (chosen.length >= maxCount) break;
    if (!chosen.some((c) => c.date === e.date)) chosen.push(e);
  }
  return chosen.sort((a, b) => a.dte - b.dte);
}

/** Eligible expirations for the requested scope, given per-contract DTE. */
export function selectExpirations(
  expirations: { expiry: string; dte: number }[],
  scope: ExpiryScope
): { expiry: string; dte: number }[] {
  const usable = expirations.filter((e) => e.dte >= 0).sort((a, b) => a.dte - b.dte);
  if (usable.length === 0) return [];
  if (scope === 'nearest') return [usable[0]];
  if (scope === 'weekly') return usable.filter((e) => e.dte <= 45);
  if (scope === 'monthly') {
    // 3rd Friday of the month ≈ standard monthly expiry
    const isMonthly = (iso: string) => {
      const d = new Date(iso + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getDay() === 5 && d.getDate() >= 15 && d.getDate() <= 21;
    };
    const monthly = usable.filter((e) => isMonthly(e.expiry));
    return monthly.length > 0 ? monthly : usable.filter((e) => e.dte <= 60);
  }
  return usable; // 'all'
}

/**
 * Aggregate GEX per strike across the selected expirations, using per-contract
 * DTE for gamma. Wall/flip selection is documented and never mixes scopes.
 */
export function computeGammaLevelsMulti(
  contracts: ScreenerContract[],
  spot: number,
  scope: ExpiryScope = 'all',
  positioning: DealerPositioning = DEFAULT_POSITIONING,
  r = 0.045
): GammaLevelsMultiResult {
  const empty: GammaLevelsMultiResult = {
    regime: 'unknown', callWall: null, putWall: null, netWall: null,
    gammaFlip: null, spotVsFlipPct: null,
    distCallWallPct: null, distPutWallPct: null, distFlipPct: null,
    totalNetGex: 0, totalCallGex: 0, totalPutGex: 0, totalOi: 0, netGexNorm: null,
    gex: [], byExpiry: [], scope, expirationsIncluded: [],
  };
  if (!Number.isFinite(spot) || spot <= 0) return empty;

  const present = Array.from(
    new Map(contracts.map((c) => [c.expiry, { expiry: c.expiry, dte: c.dte }])).values()
  );
  const includedSet = new Set(selectExpirations(present, scope).map((e) => e.expiry));
  if (includedSet.size === 0) return empty;

  const byStrike = new Map<number, { callOi: number; putOi: number; callGex: number; putGex: number; ivW: number }>();
  const byExpiryMap = new Map<string, GexByExpiry>();
  let totalOi = 0;

  for (const c of contracts) {
    if (!includedSet.has(c.expiry)) continue;
    if (!Number.isFinite(c.strike) || !Number.isFinite(c.oi) || c.oi <= 0) continue;
    if (!isUsableIv(c.iv)) continue;
    const T = Math.max(c.dte, 0.5) / 365;
    const g = bsGamma(spot, c.strike, T, c.iv, r);
    const gex = g * c.oi * 100 * spot * spot * 0.01;
    const sign = c.type === 'call' ? positioning.signCalls : positioning.signPuts;
    const signed = gex * sign;

    const row = byStrike.get(c.strike) || { callOi: 0, putOi: 0, callGex: 0, putGex: 0, ivW: 0 };
    if (c.type === 'call') { row.callOi += c.oi; row.callGex += signed; }
    else { row.putOi += c.oi; row.putGex += signed; }
    row.ivW += c.iv * c.oi; // OI-weighted IV for the strike
    byStrike.set(c.strike, row);

    const ex = byExpiryMap.get(c.expiry) || { expiry: c.expiry, dte: c.dte, netGex: 0, callGex: 0, putGex: 0, oi: 0 };
    if (c.type === 'call') ex.callGex += signed; else ex.putGex += signed;
    ex.netGex += signed;
    ex.oi += c.oi;
    byExpiryMap.set(c.expiry, ex);

    totalOi += c.oi;
  }

  const strikes = Array.from(byStrike.keys()).sort((a, b) => a - b);
  const gex: GexRow[] = strikes.map((strike) => {
    const row = byStrike.get(strike)!;
    const totalRowOi = row.callOi + row.putOi;
    return {
      strike, callOi: row.callOi, putOi: row.putOi,
      callGex: row.callGex, putGex: row.putGex,
      netGex: row.callGex + row.putGex, totalOi: totalRowOi,
      iv: totalRowOi > 0 ? row.ivW / totalRowOi : NaN,
    };
  });
  if (gex.length === 0) return { ...empty, scope, expirationsIncluded: Array.from(includedSet) };

  // Walls over the selected scope only.
  const callWallRow = gex.reduce((b, r2) => (r2.callGex > b.callGex ? r2 : b), gex[0]);
  const putWallRow = gex.reduce((b, r2) => (r2.putGex < b.putGex ? r2 : b), gex[0]);
  const netWallRow = gex.reduce((b, r2) => (Math.abs(r2.netGex) > Math.abs(b.netGex) ? r2 : b), gex[0]);

  const totalCallGex = gex.reduce((s, row) => s + row.callGex, 0);
  const totalPutGex = gex.reduce((s, row) => s + row.putGex, 0);
  const totalNetGex = totalCallGex + totalPutGex;

  const gammaFlip = findGammaFlip(gex, spot);
  let regime: GammaRegime = 'unknown';
  if (gammaFlip != null) regime = spot >= gammaFlip ? 'positive' : 'negative';
  else if (totalNetGex > 0) regime = 'positive';
  else if (totalNetGex < 0) regime = 'negative';

  const pct = (level: number | null) => (level != null && spot > 0 ? ((level - spot) / spot) * 100 : null);

  return {
    regime,
    callWall: callWallRow.strike,
    putWall: putWallRow.strike,
    netWall: netWallRow.strike,
    gammaFlip,
    spotVsFlipPct: gammaFlip != null && gammaFlip > 0 ? ((spot - gammaFlip) / gammaFlip) * 100 : null,
    distCallWallPct: pct(callWallRow.strike),
    distPutWallPct: pct(putWallRow.strike),
    distFlipPct: pct(gammaFlip),
    totalNetGex, totalCallGex, totalPutGex, totalOi,
    netGexNorm: totalOi > 0 ? totalNetGex / totalOi : null,
    gex, byExpiry: Array.from(byExpiryMap.values()).sort((a, b) => a.dte - b.dte),
    scope, expirationsIncluded: Array.from(includedSet).sort(),
  };
}

/**
 * Gamma flip via a proper spot grid: recompute modeled net GEX at hypothetical
 * spot prices using each strike's stored IV, detect zero crossings, interpolate,
 * and pick the crossing closest to spot. Returns null when there is no valid
 * crossing (never invent a level). DTE is taken per-row is not available here,
 * so a representative 30d T is used consistently — documented and stable.
 */
export function findGammaFlip(gex: GexRow[], spot: number, gridSteps = 61, rangePct = 0.15): number | null {
  if (!Number.isFinite(spot) || spot <= 0 || gex.length < 2) return null;
  const rows = gex.filter((r) => isUsableIv(r.iv));
  if (rows.length < 2) return null;
  const lo = spot * (1 - rangePct);
  const hi = spot * (1 + rangePct);
  const step = (hi - lo) / (gridSteps - 1);
  const T = 30 / 365;

  const netAt = (S: number): number => {
    let net = 0;
    for (const row of rows) {
      const g = bsGamma(S, row.strike, T, row.iv);
      const scale = g * S * S * 0.01 * 100;
      // Preserve the sign embedded in the stored rows (calls +, puts -).
      net += row.callOi * scale * (row.callGex >= 0 ? 1 : -1);
      net += row.putOi * scale * (row.putGex >= 0 ? 1 : -1);
    }
    return net;
  };

  let best: number | null = null;
  let prevS = lo;
  let prevNet = netAt(lo);
  for (let i = 1; i < gridSteps; i++) {
    const S = lo + i * step;
    const net = netAt(S);
    if ((prevNet < 0 && net > 0) || (prevNet > 0 && net < 0)) {
      const t = Math.abs(prevNet) / (Math.abs(prevNet) + Math.abs(net));
      const cross = prevS + t * (S - prevS);
      if (best === null || Math.abs(cross - spot) < Math.abs(best - spot)) best = cross;
    } else if (net === 0) {
      if (best === null || Math.abs(S - spot) < Math.abs(best - spot)) best = S;
    }
    prevS = S;
    prevNet = net;
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skew
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Volatility skew from the nearest-expiration chain: 25-delta risk reversal,
 * put/call IV differential, ATM IV, put & call skew. All values are decimal IV
 * (0.25 = 25%). Sign convention: positive riskReversal = call side bid (bullish).
 */
export function computeSkew(
  contracts: ScreenerContract[],
  spot: number,
  targetDte: number,
  r = 0.045
): SkewResult {
  const unknown: SkewResult = { regime: 'unknown', riskReversal25: null, putCallIvDiff: null, atmIv: null, putSkew: null, callSkew: null };
  if (!Number.isFinite(spot) || spot <= 0) return unknown;

  // Nearest expiration bundle.
  const usable = contracts.filter((c) => isUsableIv(c.iv) && Number.isFinite(c.strike));
  if (usable.length < 2) return unknown;
  const nearest = usable.reduce((b, c) => (Math.abs(c.dte - targetDte) < Math.abs(b.dte - targetDte) ? c : b));
  const chain = usable.filter((c) => c.expiry === nearest.expiry);
  if (chain.length < 2) return unknown;

  const T = Math.max(nearest.dte, 0.5) / 365;
  const withDelta = chain.map((c) => {
    const d = c.delta != null && Number.isFinite(c.delta) ? c.delta : bsDelta(spot, c.strike, T, c.iv, c.type === 'call', r);
    return { ...c, delta: d };
  }).filter((c) => c.delta != null);

  if (withDelta.length < 2) return unknown;

  // ATM: strike closest to spot.
  const atm = withDelta.reduce((b, c) => (Math.abs(c.strike - spot) < Math.abs(b.strike - spot) ? c : b));
  const atmIv = atm.iv;

  // 25-delta call = call delta closest to +0.25; 25-delta put = put delta closest to -0.25.
  const calls = withDelta.filter((c) => c.type === 'call');
  const puts = withDelta.filter((c) => c.type === 'put');
  const c25 = calls.length ? calls.reduce((b, c) => (Math.abs(Math.abs(c.delta as number) - 0.25) < Math.abs(Math.abs(b.delta as number) - 0.25) ? c : b)) : null;
  const p25 = puts.length ? puts.reduce((b, c) => (Math.abs(Math.abs(c.delta as number) - 0.25) < Math.abs(Math.abs(b.delta as number) - 0.25) ? c : b)) : null;

  const callIv25 = c25 ? c25.iv : null;
  const putIv25 = p25 ? p25.iv : null;

  const riskReversal25 = callIv25 != null && putIv25 != null ? callIv25 - putIv25 : null;
  const putCallIvDiff = riskReversal25 != null ? -riskReversal25 : null;

  // Regime from the 25-delta risk reversal, with a small neutral band.
  let regime: SkewRegime = 'unknown';
  if (riskReversal25 != null) {
    if (riskReversal25 > 0.01) regime = 'bullish'; // call side richer → call-side relative strength
    else if (riskReversal25 < -0.01) regime = 'bearish'; // put side richer → put-side protection
    else regime = 'neutral';
  }

  return {
    regime,
    riskReversal25,
    putCallIvDiff,
    atmIv,
    putSkew: putIv25 != null ? putIv25 - atmIv : null,
    callSkew: callIv25 != null ? callIv25 - atmIv : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Momentum
// ─────────────────────────────────────────────────────────────────────────────

export interface MomentumInput {
  closes: number[]; // ascending, most recent last
  price: number;
  volumes?: number[];
}

/**
 * Momentum classification from EMA8/21/50 stack, 5d/20d returns and relative
 * volume. Every input must be known at the calculation timestamp (no look-ahead).
 */
export function classifyMomentum(input: MomentumInput): MomentumResult {
  const { closes, price } = input;
  const n = closes.length;
  const ema = (period: number): number | null => {
    if (n < period) return null;
    const k = 2 / (period + 1);
    let e = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < n; i++) e = closes[i] * k + e * (1 - k);
    return e;
  };
  const ema8 = ema(8);
  const ema21 = ema(21);
  const ema50 = ema(50);
  const ret = (days: number): number | null => {
    if (n < days + 1) return null;
    const past = closes[n - 1 - days];
    return past > 0 ? ((closes[n - 1] - past) / past) * 100 : null;
  };
  const ret5d = ret(5);
  const ret20d = ret(20);

  let relVolume: number | null = null;
  if (input.volumes && input.volumes.length >= 21) {
    const recent = input.volumes[input.volumes.length - 1];
    const avg = input.volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
    if (avg > 0) relVolume = recent / avg;
  }

  const ready = ema8 != null && ema21 != null && ema50 != null;
  const aboveAll = !!(ready && price > (ema8 as number) && price > (ema21 as number) && price > (ema50 as number));
  const belowAll = !!(ready && price < (ema8 as number) && price < (ema21 as number) && price < (ema50 as number));
  const stackedUp = !!(ready && (ema8 as number) > (ema21 as number) && (ema21 as number) > (ema50 as number));
  const stackedDown = !!(ready && (ema8 as number) < (ema21 as number) && (ema21 as number) < (ema50 as number));

  let classification: MomentumClass = 'neutral';
  if (ready) {
    if (aboveAll && stackedUp && (ret20d ?? 0) > 0) classification = 'bullish';
    else if (belowAll && stackedDown && (ret20d ?? 0) < 0) classification = 'bearish';
    else if (aboveAll && (ret5d ?? 0) >= 0) classification = 'lean_bullish';
    else if (belowAll && (ret5d ?? 0) <= 0) classification = 'lean_bearish';
    else if ((ret5d ?? 0) > 1 && (ret20d ?? 0) > 0) classification = 'lean_bullish';
    else if ((ret5d ?? 0) < -1 && (ret20d ?? 0) < 0) classification = 'lean_bearish';
  }

  return { classification, ema8, ema21, ema50, ret5d, ret20d, relVolume, aboveAll, belowAll };
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Score
// ─────────────────────────────────────────────────────────────────────────────

export interface EdgeWeights {
  gamma: number;
  momentum: number;
  skew: number;
  proximity: number;
  liquidity: number;
}

export const DEFAULT_EDGE_WEIGHTS: EdgeWeights = {
  gamma: 0.25, momentum: 0.2, skew: 0.2, proximity: 0.15, liquidity: 0.2,
};

export interface EdgeInputs {
  gamma: GammaLevelsMultiResult;
  skew: SkewResult;
  momentum: MomentumResult;
  spot: number;
  totalOptionVolume: number;
  totalOi: number;
  dataCompleteness: number; // 0..1 (fraction of expected fields present)
}

export interface EdgeBreakdown {
  score: number | null; // 0..100, or null when data is insufficient
  components: {
    gamma: number;
    momentum: number;
    skew: number;
    proximity: number;
    liquidity: number;
  };
  penalty: number; // data-quality penalty applied (0..1 multiplicative)
  available: boolean;
  reason?: string;
}

function skewScore(skew: SkewResult): number {
  if (skew.regime === 'unknown') return 50;
  switch (skew.regime) {
    case 'bullish': return 85;
    case 'bearish': return 65;
    default: return 60;
  }
}

function momentumScore(m: MomentumResult): number {
  switch (m.classification) {
    case 'bullish': return 95;
    case 'lean_bullish': return 75;
    case 'neutral': return 50;
    case 'lean_bearish': return 35;
    case 'bearish': return 20;
  }
}

/** Gamma positioning quality: reward a clear regime and meaningful net GEX. */
function gammaScore(g: GammaLevelsMultiResult): number {
  if (g.regime === 'unknown') return 40;
  const norm = Math.abs(g.netGexNorm ?? 0);
  const strength = Math.min(1, norm / 500); // saturates; netGexNorm/OI has wide scale
  const base = g.regime === 'positive' ? 70 : g.regime === 'negative' ? 60 : 45;
  return Math.round(base + strength * 25);
}

/** Proximity: closer to flip/walls (a decision-relevant location) scores higher. */
function proximityScore(g: GammaLevelsMultiResult): number {
  const dists = [g.distFlipPct, g.distCallWallPct, g.distPutWallPct]
    .filter((d): d is number => d != null)
    .map((d) => Math.abs(d));
  if (dists.length === 0) return 50;
  const nearest = Math.min(...dists);
  // <=0.5% → 100, >=8% → 30, linear in between.
  const score = 100 - Math.min(70, Math.max(0, (nearest - 0.5) / 7.5) * 70);
  return Math.round(score);
}

/** Liquidity quality from option volume and OI breadth. */
function liquidityScore(totalVolume: number, totalOi: number): number {
  if (totalOi <= 0) return 20;
  const oiScore = Math.min(1, Math.log10(totalOi + 1) / 6); // 1e6 OI ≈ full
  const volScore = Math.min(1, Math.log10(totalVolume + 1) / 5);
  return Math.round((oiScore * 0.6 + volScore * 0.4) * 100);
}

/**
 * Normalized Edge Score 0..100 combining the weighted components, then applying
 * a data-quality penalty. Returns available:false (score null) when there is
 * not enough real data — never fabricates a score for empty input.
 */
export function computeEdgeScore(
  inputs: EdgeInputs,
  weights: EdgeWeights = DEFAULT_EDGE_WEIGHTS
): EdgeBreakdown {
  const { gamma, skew, momentum, totalOptionVolume, totalOi, dataCompleteness } = inputs;

  const hasGamma = gamma.gex.length > 0;
  const zero: EdgeBreakdown['components'] = { gamma: 0, momentum: 0, skew: 0, proximity: 0, liquidity: 0 };
  if (!hasGamma && totalOi <= 0) {
    return { score: null, components: zero, penalty: 1, available: false, reason: 'Sin datos de opciones utilizables' };
  }

  const components: EdgeBreakdown['components'] = {
    gamma: gammaScore(gamma),
    momentum: momentumScore(momentum),
    skew: skewScore(skew),
    proximity: proximityScore(gamma),
    liquidity: liquidityScore(totalOptionVolume, totalOi),
  };

  const wSum = weights.gamma + weights.momentum + weights.skew + weights.proximity + weights.liquidity;
  const raw =
    (components.gamma * weights.gamma +
      components.momentum * weights.momentum +
      components.skew * weights.skew +
      components.proximity * weights.proximity +
      components.liquidity * weights.liquidity) /
    (wSum || 1);

  // Data-quality penalty: multiply down as completeness drops (floor 0.5).
  const clampedCompleteness = Math.max(0, Math.min(1, dataCompleteness));
  const penalty = 0.5 + 0.5 * clampedCompleteness;
  const score = Math.max(0, Math.min(100, Math.round(raw * penalty)));

  return { score, components, penalty, available: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data quality
// ─────────────────────────────────────────────────────────────────────────────

export interface DataQualityInput {
  asOf: number; // ms timestamp of the underlying quote
  now?: number;
  hasChain: boolean;
  strikes: number;
  expirations: number;
  usableContracts: number;
  expectedContracts: number; // heuristic target for full coverage
}

export interface DataQuality {
  completeness: number; // 0..1
  stale: boolean;
  ageMinutes: number;
  warnings: string[];
}

export function assessDataQuality(input: DataQualityInput): DataQuality {
  const now = input.now ?? Date.now();
  const ageMinutes = Math.max(0, (now - input.asOf) / 60_000);
  const warnings: string[] = [];

  let completeness = 0;
  if (input.hasChain) completeness += 0.4;
  else warnings.push('Sin cadena de opciones');

  if (input.strikes >= 10) completeness += 0.2;
  else warnings.push('Cobertura de strikes insuficiente');

  if (input.expirations >= 4) completeness += 0.15;
  else warnings.push('Cobertura de expiraciones insuficiente');

  const contractRatio = input.expectedContracts > 0 ? Math.min(1, input.usableContracts / input.expectedContracts) : 0;
  completeness += 0.25 * contractRatio;
  if (contractRatio < 0.5) warnings.push('Muchos contratos con datos incompletos');

  const stale = ageMinutes > 30; // intra-day freshness threshold
  if (stale) warnings.push(`Precio con retraso (${Math.round(ageMinutes)} min)`);

  return { completeness: Math.min(1, completeness), stale, ageMinutes, warnings };
}

/** Percentage distance from spot to a level. Positive = level above spot. */
export function distancePct(level: number | null, spot: number): number | null {
  if (level == null || !Number.isFinite(level) || !Number.isFinite(spot) || spot <= 0) return null;
  return ((level - spot) / spot) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Playbook levels (directional labels derived from the gamma levels)
// ─────────────────────────────────────────────────────────────────────────────

export type PlaybookRole =
  | 'upside_target'
  | 'upside_resistance'
  | 'downside_target'
  | 'downside_support'
  | 'bearish_trigger'
  | 'bullish_trigger'
  | 'chop_area';

export interface PlaybookLevel {
  /** Playbook label, e.g. "Upside target" / "Bearish trigger" / "Chop area". */
  label: string;
  role: PlaybookRole;
  /** Primary price (single level) — null for ranges. */
  level: number | null;
  /** For ranges (chop area): low/high bounds. */
  levelLow?: number;
  levelHigh?: number;
  /** Directional bias of the label relative to spot, for coloring. */
  dir: 'up' | 'down' | 'neutral';
  /** Which real metric produced it — exposed for transparency. */
  source: 'callWall' | 'putWall' | 'gammaFlip' | 'flip+wall';
}

/** Minimal gamma-level input `buildPlaybook` needs (works for both screeners and gamma-levels). */
export interface PlaybookGammaInput {
  callWall: number | null;
  putWall: number | null;
  gammaFlip: number | null;
}

/**
 * Derive directional "playbook" labels from the SAME real gamma levels, with the
 * label orientation depending on where each level sits relative to spot:
 *   • Call Wall above spot → "Upside target"; below spot → "Upside resistance".
 *   • Put Wall below spot  → "Downside target"; above spot → "Downside support".
 *   • Gamma Flip: spot above flip → "Bearish trigger"; spot below → "Bullish trigger".
 *   • Chop area = the real range between the flip and the nearest wall to spot.
 * Labels are cosmetic; every `level` is a real calculated value (nothing invented).
 */
export function buildPlaybook(gamma: PlaybookGammaInput, spot: number): PlaybookLevel[] {
  if (!Number.isFinite(spot) || spot <= 0) return [];
  const out: PlaybookLevel[] = [];

  if (gamma.callWall != null) {
    const above = gamma.callWall >= spot;
    out.push({
      label: above ? 'Upside target' : 'Upside resistance',
      role: above ? 'upside_target' : 'upside_resistance',
      level: gamma.callWall,
      dir: 'up',
      source: 'callWall',
    });
  }

  if (gamma.putWall != null) {
    const below = gamma.putWall <= spot;
    out.push({
      label: below ? 'Downside target' : 'Downside support',
      role: below ? 'downside_target' : 'downside_support',
      level: gamma.putWall,
      dir: 'down',
      source: 'putWall',
    });
  }

  if (gamma.gammaFlip != null) {
    const spotAboveFlip = spot >= gamma.gammaFlip;
    out.push({
      label: spotAboveFlip ? 'Bearish trigger' : 'Bullish trigger',
      role: spotAboveFlip ? 'bearish_trigger' : 'bullish_trigger',
      level: gamma.gammaFlip,
      dir: spotAboveFlip ? 'down' : 'up',
      source: 'gammaFlip',
    });

    // Chop area: real range between the flip and the nearest wall to spot.
    const candidates = [gamma.callWall, gamma.putWall].filter((v): v is number => v != null && v !== gamma.gammaFlip);
    if (candidates.length > 0) {
      const nearestWall = candidates.reduce((b, v) => (Math.abs(v - spot) < Math.abs(b - spot) ? v : b));
      const low = Math.min(gamma.gammaFlip, nearestWall);
      const high = Math.max(gamma.gammaFlip, nearestWall);
      if (high - low > 0) {
        out.push({
          label: 'Chop area',
          role: 'chop_area',
          level: null,
          levelLow: low,
          levelHigh: high,
          dir: 'neutral',
          source: 'flip+wall',
        });
      }
    }
  }

  return out;
}


// ─────────────────────────────────────────────────────────────────────────────
// Liquid contract suggestion (click on the SKEW column)
// ─────────────────────────────────────────────────────────────────────────────
//
// Goal: given the real chain, suggest ONE listed contract a user could actually
// trade, with strict liquidity gates (tight spread, real OI/volume, sane DTE and
// delta). The directional bias comes from the 25Δ risk reversal (skew) first,
// then momentum; gamma regime only downgrades confidence, it never invents a
// direction. Nothing is fabricated: without a contract that passes every gate
// the result is `pick: null` plus a human-readable reason.

export type ContractBias = 'call' | 'put';
export type BiasSource = 'skew' | 'momentum' | 'trend';
export type PickConfidence = 'high' | 'medium' | 'low';

export interface ContractPick {
  type: ContractBias;
  strike: number;
  expiry: string;
  dte: number;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  /** (ask - bid) / mid * 100. */
  spreadPct: number | null;
  volume: number;
  oi: number;
  iv: number;
  delta: number | null;
  breakeven: number | null;
  /** 0..100 contract-quality score (liquidity, spread, delta, DTE, wall room). */
  score: number;
  /** Gamma level the trade targets (call wall for calls, put wall for puts). */
  target: number | null;
  /** Invalidation reference (gamma flip on the wrong side), when available. */
  stopLevel: number | null;
  targetMovePct: number | null;
  /** Return at expiry at the target (intrinsic − premium), % of premium. */
  estReturnPct: number | null;
  /** True when intrinsic at the target at least covers the premium paid. */
  viable: boolean;
  why: string[];
  warnings: string[];
}

export interface ContractPickResult {
  bias: ContractBias;
  biasSource: BiasSource;
  biasWhy: string;
  confidence: PickConfidence;
  pick: ContractPick | null;
  alternates: ContractPick[];
  reason?: string;
}

export interface ContractBiasInput {
  skewRegime: SkewRegime;
  riskReversal25?: number | null;
  momentum: MomentumClass;
  ret20d?: number | null;
  gammaRegime?: GammaRegime;
  /** Where the spot sits relative to the gamma flip (regime confirmation). */
  spotAboveFlip?: boolean | null;
}

/**
 * Direction for the contract suggestion.
 *
 * IMPORTANT: in equities the 25Δ risk reversal is structurally negative (puts
 * carry a volatility premium), so "put skew" alone is NOT a bearish signal. We
 * only let skew vote when |RR| ≥ 3 vol points; otherwise momentum defines the
 * bias, with the gamma flip confirming. Confidence reflects how many signals
 * agree. Nothing is invented: with no signal the bias is a documented weak
 * default (20d trend sign, else long call) and confidence is "low".
 */
export function chooseContractBias(input: ContractBiasInput): {
  bias: ContractBias;
  source: BiasSource;
  why: string;
  confidence: PickConfidence;
} {
  const momBull = input.momentum === 'bullish' || input.momentum === 'lean_bullish';
  const momBear = input.momentum === 'bearish' || input.momentum === 'lean_bearish';
  const rr = input.riskReversal25;
  const reasons: string[] = [];

  let score = 0;
  const pts = { skew: 0, momentum: 0, trend: 0 };

  // Skew vote only outside the structural equity put-skew band.
  if (rr != null && Number.isFinite(rr) && Math.abs(rr) >= 0.03) {
    pts.skew = rr > 0 ? 2 : -2;
    score += pts.skew;
    reasons.push(
      rr > 0
        ? `Skew alcista real (RR 25Δ ${(rr * 100).toFixed(1)} pp): las calls cotizan claramente más caras.`
        : `Skew bajista real (RR 25Δ ${(rr * 100).toFixed(1)} pp): las puts cotizan claramente más caras.`
    );
  } else if (rr != null && Number.isFinite(rr) && input.skewRegime !== 'neutral' && input.skewRegime !== 'unknown') {
    reasons.push(`Skew ${input.skewRegime === 'bullish' ? 'alcista' : 'bajista'} dentro del rango estructural normal (${(rr * 100).toFixed(1)} pp): no se usa como señal direccional.`);
  }

  if (momBull) { pts.momentum = 2; score += 2; reasons.push('Momentum alcista (precio sobre EMA8/21/50).'); }
  else if (momBear) { pts.momentum = -2; score += -2; reasons.push('Momentum bajista (precio bajo EMA8/21/50).'); }

  // Gamma regime confirms only when momentum already picked a side.
  if (input.gammaRegime && input.spotAboveFlip != null && score !== 0) {
    const bullishRegime = input.gammaRegime === 'positive' && input.spotAboveFlip;
    const bearishRegime = input.gammaRegime === 'negative' && !input.spotAboveFlip;
    if ((score > 0 && bullishRegime) || (score < 0 && bearishRegime)) {
      score += score > 0 ? 1 : -1;
      reasons.push('Régimen gamma alineado con el sesgo (spot y flip).');
    }
  }

  if (score === 0 && input.ret20d != null && Number.isFinite(input.ret20d)) {
    pts.trend = input.ret20d > 0 ? 1 : -1;
    score += pts.trend;
    const contradictory = pts.skew !== 0 && pts.momentum !== 0 && Math.sign(pts.skew) !== Math.sign(pts.momentum);
    reasons.push(
      contradictory
        ? `Skew y momentum se contradicen; retorno 20d ${input.ret20d >= 0 ? '+' : ''}${input.ret20d.toFixed(1)}% como desempate débil.`
        : `Sin sesgo claro; retorno 20d ${input.ret20d >= 0 ? '+' : ''}${input.ret20d.toFixed(1)}% como desempate débil.`
    );
  }

  const bias: ContractBias = score >= 0 ? 'call' : 'put';
  const abs = Math.abs(score);
  const sign = score >= 0 ? 1 : -1;
  // Source = the signal that actually supports the chosen side (largest aligned
  // contribution). Signals that voted the other way never claim the bias.
  const aligned = { skew: pts.skew * sign, momentum: pts.momentum * sign, trend: pts.trend * sign };
  let source: BiasSource = 'trend';
  if (aligned.skew > 0 && aligned.skew >= aligned.momentum) source = 'skew';
  else if (aligned.momentum > 0) source = 'momentum';
  else if (aligned.trend > 0) source = 'trend';
  const confidence: PickConfidence = abs >= 3 ? 'high' : abs >= 2 ? 'medium' : 'low';

  if (reasons.length === 0) reasons.push('Sin señales de skew/momentum/régimen: sesgo por defecto, confianza baja.');

  return { bias, source, why: reasons.join(' '), confidence };
}

export interface ContractPickOptions {
  minOi?: number;
  minVolume?: number;
  minDte?: number;
  maxDte?: number;
  /** Hard cap; anything wider is rejected (never relaxed). */
  maxSpreadPct?: number;
  /** Ideal days to expiry for the quality score. */
  targetDte?: number;
  atmIv?: number | null;
}

const DEFAULT_PICK_OPTIONS: Required<Omit<ContractPickOptions, 'atmIv'>> = {
  minOi: 500,
  minVolume: 50,
  minDte: 7,
  maxDte: 90,
  maxSpreadPct: 15,
  targetDte: 32,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function quoteOf(c: ScreenerContract): { bid: number | null; ask: number | null; mid: number | null; spreadPct: number | null } {
  const bid = typeof c.bid === 'number' && Number.isFinite(c.bid) && c.bid > 0 ? c.bid : null;
  const ask = typeof c.ask === 'number' && Number.isFinite(c.ask) && c.ask > 0 ? c.ask : null;
  if (bid == null || ask == null || ask <= bid) return { bid, ask, mid: null, spreadPct: null };
  const mid = (bid + ask) / 2;
  return { bid, ask, mid, spreadPct: mid > 0 ? ((ask - bid) / mid) * 100 : null };
}

/**
 * Pick the best liquid contract for a directional bias.
 * Gates are strict and NEVER relaxed (tight spread + real OI/volume). When no
 * contract qualifies the pick is null with the reason, never a placeholder.
 */
export function pickLiquidContract(
  contracts: ScreenerContract[],
  spot: number,
  bias: ContractBias,
  levels: PlaybookGammaInput = { callWall: null, putWall: null, gammaFlip: null },
  opts: ContractPickOptions = {}
): { pick: ContractPick | null; alternates: ContractPick[]; reason?: string } {
  if (!Number.isFinite(spot) || spot <= 0) {
    return { pick: null, alternates: [], reason: 'Spot no válido.' };
  }
  const o = {
    ...DEFAULT_PICK_OPTIONS,
    ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null)),
  } as Required<Omit<ContractPickOptions, 'atmIv'>> & { atmIv?: number | null };

  const isCall = bias === 'call';
  const wall = isCall ? levels.callWall : levels.putWall;
  const target = wall != null && (isCall ? wall > spot : wall < spot) ? wall : null;
  const flip = levels.gammaFlip;
  const stopLevel = flip != null && (isCall ? flip < spot : flip > spot) ? flip : null;

  const candidates: Array<{ pick: ContractPick; raw: number }> = [];

  for (const c of contracts) {
    if (c.type !== bias) continue;
    if (!Number.isFinite(c.strike) || c.strike <= 0) continue;
    if (!Number.isFinite(c.oi) || c.oi < o.minOi) continue;
    if (!Number.isFinite(c.volume) || c.volume < o.minVolume) continue;
    if (!isUsableIv(c.iv)) continue;
    if (c.dte < o.minDte || c.dte > o.maxDte) continue;
    if (isCall ? c.strike > spot * 1.25 || c.strike < spot * 0.85 : c.strike < spot * 0.75 || c.strike > spot * 1.15) continue;

    const q = quoteOf(c);
    // No verifiable quote → cannot confirm execution quality → reject.
    if (q.mid == null || q.spreadPct == null || q.mid < 0.05) continue;
    if (q.spreadPct > o.maxSpreadPct) continue;

    const T = Math.max(c.dte, 0.5) / 365;
    const delta = c.delta != null && Number.isFinite(c.delta) ? c.delta : bsDelta(spot, c.strike, T, c.iv, isCall);
    if (delta == null || !Number.isFinite(delta)) continue;
    const absDelta = Math.abs(delta);
    if (absDelta < 0.30 || absDelta > 0.70) continue;

    const liq = 0.5 * clamp01(Math.log10(c.oi + 1) / 4) + 0.5 * clamp01(Math.log10(c.volume + 1) / 3.5);
    const spreadScore = 1 - clamp01(q.spreadPct / 12);
    const deltaScore = 1 - clamp01(Math.abs(absDelta - 0.5) / 0.2);
    const dteScore = 1 - clamp01(Math.abs(c.dte - o.targetDte) / 28);
    const wallScore = target == null ? 0.6 : (isCall ? c.strike < target : c.strike > target) ? 1 : 0.4;
    const atm = opts.atmIv != null && Number.isFinite(opts.atmIv) && opts.atmIv > 0 ? opts.atmIv : null;
    const ivScore = atm != null ? 1 - clamp01((c.iv / atm - 1) / 0.5) : 0.7;

    const breakeven = isCall ? c.strike + q.mid : c.strike - q.mid;
    const targetMovePct = target != null ? ((target - spot) / spot) * 100 : null;
    // Exact P&L at expiry at the target (intrinsic minus premium), in % of premium.
    const estReturnPct = target != null
      ? (((isCall ? target - c.strike : c.strike - target) - q.mid) / q.mid) * 100
      : null;
    const roomInPremiums = estReturnPct != null ? 1 + estReturnPct / 100 : null;
    const targetPaysOff = roomInPremiums != null && roomInPremiums >= 1;
    const payoffScore = estReturnPct != null ? clamp01((estReturnPct + 100) / 200) : 0.5;

    let score = Math.round(
      100 * (
        0.26 * liq + 0.20 * spreadScore + 0.18 * deltaScore +
        0.12 * dteScore + 0.08 * wallScore + 0.04 * ivScore + 0.12 * payoffScore
      )
    );
    const raw = score;
    // Liquid but unprofitable at the technical target → never present it as a
    // high-quality entry. The score is capped and `viable` flags it for the UI.
    if (!targetPaysOff) score = Math.min(score, 55);

    const warnings: string[] = [];
    if (c.dte < 14) warnings.push('Vencimiento próximo: theta alto, el tiempo juega en contra.');
    if (q.spreadPct > 10) warnings.push(`Spread algo ancho (${q.spreadPct.toFixed(1)}% del mid).`);
    if (atm != null && c.iv > atm * 1.4) warnings.push(`IV ${(c.iv * 100).toFixed(0)}% vs ATM ${(atm * 100).toFixed(0)}%: pagas prima elevada.`);
    if (target == null) warnings.push(isCall ? 'Sin call wall por encima del spot: no hay objetivo técnico claro.' : 'Sin put wall por debajo del spot: no hay objetivo técnico claro.');
    if (levels.gammaFlip == null) warnings.push('Sin gamma flip válido para fijar la invalidación.');
    if (roomInPremiums != null && !targetPaysOff) {
      warnings.push(`El objetivo $${target!.toFixed(2)} no cubre la prima: a vencimiento el breakeven está en $${breakeven.toFixed(2)}. Necesitas un movimiento mayor o vender antes.`);
    }

    const why: string[] = [];
    why.push(`Spread ${q.spreadPct.toFixed(1)}% · OI ${Math.round(c.oi).toLocaleString('en-US')} · Vol ${Math.round(c.volume).toLocaleString('en-US')}.`);
    why.push(`Δ ${absDelta.toFixed(2)} · ${c.dte} DTE · IV ${(c.iv * 100).toFixed(0)}%.`);
    if (target != null) {
      why.push(`${isCall ? 'Call' : 'Put'} wall $${target.toFixed(2)} como objetivo (${targetMovePct!.toFixed(1)}% desde el spot).`);
      if (roomInPremiums != null) {
        why.push(targetPaysOff
          ? `Al objetivo, el intrínseco cubre ${roomInPremiums.toFixed(1)}× la prima pagada.`
          : `Al objetivo, el intrínseco solo cubre ${(roomInPremiums! * 100).toFixed(0)}% de la prima: el trade depende de vender con IV/tiempo a favor.`);
      }
    }

    candidates.push({
      raw,
      pick: {
      type: bias,
      strike: c.strike,
      expiry: c.expiry,
      dte: c.dte,
      bid: q.bid,
      ask: q.ask,
      mid: q.mid,
      spreadPct: q.spreadPct,
      volume: c.volume,
      oi: c.oi,
      iv: c.iv,
      delta: absDelta,
      breakeven,
      score,
      target,
      stopLevel,
      targetMovePct,
      estReturnPct,
      viable: targetPaysOff,
      why,
      warnings,
      },
    });
  }

  candidates.sort((a, b) =>
    (Number(b.pick.viable) - Number(a.pick.viable)) ||
    (b.raw - a.raw) ||
    (Math.abs(a.pick.dte - o.targetDte) - Math.abs(b.pick.dte - o.targetDte))
  );
  if (candidates.length === 0) {
    return {
      pick: null,
      alternates: [],
      reason: `Ningún contrato ${isCall ? 'call' : 'put'} pasa los filtros de liquidez (spread ≤${o.maxSpreadPct}%, OI ≥${o.minOi}, volumen ≥${o.minVolume}, ${o.minDte}-${o.maxDte} DTE).`,
    };
  }
  return { pick: candidates[0].pick, alternates: candidates.slice(1, 3).map((c) => c.pick) };
}

export type DeltaBias = 'bullish' | 'bearish' | 'neutral';

export type DeltaExposure = {
  callDeltaNotional: number;
  putDeltaNotional: number;
  netDelta: number;
  totalDeltaNotional: number;
  ratio: number;
  bias: DeltaBias;
  deltaWallUp: number | null;
  deltaWallDown: number | null;
  topCallDeltaStrike: number | null;
  topPutDeltaStrike: number | null;
};

export function computeDeltaExposure(params: {
  spot: number;
  calls: Array<{ strike: number; openInterest?: number | null; delta?: number | null; iv?: number | null; dte?: number | null; volume?: number | null }>;
  puts: Array<{ strike: number; openInterest?: number | null; delta?: number | null; iv?: number | null; dte?: number | null; volume?: number | null }>;
  r?: number;
}): DeltaExposure {
  const spot = params.spot;
  const r = params.r ?? 0.045;
  let callDeltaNotional = 0;
  let putDeltaNotional = 0;
  let topCallDeltaStrike: number | null = null;
  let topCallDelta = -Infinity;
  let topPutDeltaStrike: number | null = null;
  let topPutDelta = -Infinity;

  const normIv = (iv: any) => {
    let v = Number(iv);
    if (!isFinite(v) || v <= 0) return 0.25;
    if (v > 10) v = v / 10000;
    else if (v > 5) v = v / 1000;
    else if (v > 2) v = v / 100;
    else if (v > 1) v = v / 100;
    if (v < 0.01) v = 0.25;
    if (v > 3) v = Math.min(v, 1.5);
    return v;
  };

  for (const c of params.calls || []) {
    const oi = Number(c.openInterest) || 0;
    if (oi <= 0) continue;
    const dte = c.dte != null ? c.dte : 30;
    const T = Math.max(1 / 365, Number(dte) / 365);
    const iv = 0.25;
    let delta: number = Number(bsDelta(spot, Number(c.strike), T, iv, true, r));
    if (!isFinite(delta) || delta < 0.0001) {
      const m = spot / Number(c.strike);
      if (m >= 1.01) delta = 0.6;
      else if (m >= 1.0) delta = 0.5;
      else if (m >= 0.99) delta = 0.4;
      else if (m >= 0.97) delta = 0.25;
      else if (m >= 0.93) delta = 0.15;
      else delta = 0.08;
    }
    delta = Math.abs(delta);
    if (delta > 1) delta = 1;
    if (delta < 0.01) delta = 0.01;
    const notional = delta * oi * 100 * spot;
    callDeltaNotional += notional;
    if (notional > topCallDelta) {
      topCallDelta = notional;
      topCallDeltaStrike = Number(c.strike);
    }
  }

  for (const p of params.puts || []) {
    const oi = Number(p.openInterest) || 0;
    if (oi <= 0) continue;
    const dte = p.dte != null ? p.dte : 30;
    const T = Math.max(1 / 365, Number(dte) / 365);
    const iv = normIv(p.iv) || 0.3;
    let delta: number | null = bsDelta(spot, Number(p.strike), T, Math.min(iv, 1.5), false, r);
    if (delta == null || !isFinite(delta) || Math.abs(delta) < 0.0001) {
      const m = Number(p.strike) / spot;
      if (m >= 1.02) delta = -0.68;
      else if (m >= 1.0) delta = -0.52;
      else if (m >= 0.98) delta = -0.4;
      else if (m >= 0.95) delta = -0.25;
      else if (m >= 0.9) delta = -0.12;
      else delta = -0.05;
    }
    if (delta > 0) delta = -Math.abs(delta);
    if (delta < -1) delta = -1;
    if (delta > -0.01) delta = -0.01;
    const notional = delta * oi * 100 * spot;
    putDeltaNotional += notional;
    if (Math.abs(notional) > topPutDelta) {
      topPutDelta = Math.abs(notional);
      topPutDeltaStrike = Number(p.strike);
    }
  }

  const netDelta = callDeltaNotional + putDeltaNotional;
  const totalDeltaNotional = Math.abs(callDeltaNotional) + Math.abs(putDeltaNotional);
  const ratio = totalDeltaNotional > 0 ? netDelta / totalDeltaNotional : 0;
  let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ratio >= 0.15) bias = 'bullish';
  else if (ratio <= -0.15) bias = 'bearish';

  return {
    callDeltaNotional: Math.round(callDeltaNotional),
    putDeltaNotional: Math.round(putDeltaNotional),
    netDelta: Math.round(netDelta),
    totalDeltaNotional: Math.round(totalDeltaNotional),
    ratio,
    bias,
    deltaWallUp: topCallDeltaStrike,
    deltaWallDown: topPutDeltaStrike,
    topCallDeltaStrike,
    topPutDeltaStrike,
  };
}
