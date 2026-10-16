// Gamma exposure analytics (GEX) — pure math, unit-testable.
//
// Computes per-strike dealer gamma exposure, the gamma wall (strike with the
// most call/put gamma), the gamma flip (zero-crossing of net GEX where the
// dealer positioning switches from dampening to amplifying) and max pain.
//
// GEX convention (standard, SqueezeMetrics-style):
//   GEX per strike = gamma * OI * 100 * spot^2 * 0.01   (dollar $ per 1% move)
//   Calls contribute positive gamma (dealers assumed long calls),
//   puts contribute negative gamma (dealers assumed short puts).

import { normalCDF, normalPDF } from './bs';

export interface GammaContract {
  strike: number;
  type: 'call' | 'put';
  oi: number;
  iv: number; // annualized decimal, e.g. 0.25
  price?: number; // optional mid/last for IV sanity
}

export interface GexRow {
  strike: number;
  callOi: number;
  putOi: number;
  callGex: number; // positive $
  putGex: number; // negative $
  netGex: number; // callGex + putGex
  totalOi: number;
}

export interface GammaLevelsInput {
  contracts: GammaContract[];
  spot: number;
  dte: number;
  expiry?: string;
  r?: number;
}

export interface GammaLevelsResult {
  spot: number;
  dte: number;
  expiry: string | null;
  regime: 'positive' | 'negative' | 'neutral';
  gammaFlip: number | null;
  spotVsFlipPct: number | null;
  gammaWallUp: number | null; // strike with max call GEX
  gammaWallDown: number | null; // strike with max put GEX (most negative)
  netWall: number | null; // strike with max |net GEX|
  maxPain: number | null;
  totalNetGex: number;
  totalCallGex: number;
  totalPutGex: number;
  totalOi: number;
  gex: GexRow[];
}

/**
 * Black-Scholes gamma for a single option.
 * gamma = phi(d1) / (S * sigma * sqrt(T))   [phi = normal PDF]
 */
export function bsGamma(S: number, K: number, T: number, sigma: number, r = 0.045): number {
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return normalPDF(d1) / (S * sigma * Math.sqrt(T));
}

/**
 * Black-Scholes call/put price (used for IV inversion).
 */
export function bsPrice(S: number, K: number, T: number, sigma: number, isCall: boolean, r = 0.045): number {
  if (T <= 0 || sigma <= 0) return isCall ? Math.max(0, S - K) : Math.max(0, K - S);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const call = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  const put = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  return isCall ? call : put;
}

/**
 * Invert implied volatility from an option market price (bisection).
 * Returns null when the price is not invertible (<= 0, intrinsic >= price, etc.)
 */
export function ivFromOptionPrice(
  price: number,
  S: number,
  K: number,
  T: number,
  isCall: boolean,
  r = 0.045
): number | null {
  if (price <= 0 || S <= 0 || K <= 0 || T <= 0) return null;
  const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
  if (price <= intrinsic) return null;
  let lo = 0.001;
  let hi = 5.0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = bsPrice(S, K, T, mid, isCall, r);
    if (Math.abs(p - price) < 1e-6) return mid;
    if (p > price) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Aggregate contracts into per-strike GEX rows and derive the key levels:
 * gamma flip (net GEX zero-cross), call/put gamma walls, net wall and max pain.
 */
export function computeGammaLevels(input: GammaLevelsInput): GammaLevelsResult {
  const { contracts, spot, dte, expiry, r = 0.045 } = input;
  const T = Math.max(dte, 0.5) / 365;

  const byStrike = new Map<number, { callOi: number; putOi: number; callGex: number; putGex: number }>();
  for (const c of contracts) {
    if (!Number.isFinite(c.strike) || !Number.isFinite(c.oi) || c.oi <= 0) continue;
    // IVs basura de Yahoo en deep-ITM (ej. 1e-5 o >500%) → distorsionan el GEX
    if (!Number.isFinite(c.iv) || c.iv < 0.005 || c.iv > 5) continue;
    const g = bsGamma(spot, c.strike, T, c.iv, r);
    const dollarGex = g * c.oi * 100 * spot * spot * 0.01;
    const row = byStrike.get(c.strike) || { callOi: 0, putOi: 0, callGex: 0, putGex: 0 };
    if (c.type === 'call') {
      row.callOi += c.oi;
      row.callGex += dollarGex;
    } else {
      row.putOi += c.oi;
      row.putGex -= dollarGex; // puts are negative gamma exposure
    }
    byStrike.set(c.strike, row);
  }

  const strikes = Array.from(byStrike.keys()).sort((a, b) => a - b);
  const gex: GexRow[] = strikes.map((strike) => {
    const row = byStrike.get(strike)!;
    return {
      strike,
      callOi: row.callOi,
      putOi: row.putOi,
      callGex: row.callGex,
      putGex: row.putGex,
      netGex: row.callGex + row.putGex,
      totalOi: row.callOi + row.putOi,
    };
  });

  const empty: GammaLevelsResult = {
    spot, dte, expiry: expiry || null, regime: 'neutral',
    gammaFlip: null, spotVsFlipPct: null,
    gammaWallUp: null, gammaWallDown: null, netWall: null, maxPain: null,
    totalNetGex: 0, totalCallGex: 0, totalPutGex: 0, totalOi: 0, gex: [],
  };
  if (gex.length === 0) return empty;

  // Walls
  const gammaWallUp = gex.reduce((best, row) => (row.callGex > (best?.callGex ?? -Infinity) ? row : best), gex[0]).strike;
  const gammaWallDown = gex.reduce((best, row) => (row.putGex < (best?.putGex ?? Infinity) ? row : best), gex[0]).strike;
  const netWall = gex.reduce((best, row) => (Math.abs(row.netGex) > Math.abs(best?.netGex ?? -Infinity) ? row : best), gex[0]).strike;

  // Gamma flip: interpolated zero-crossing of net GEX nearest to spot
  let gammaFlip: number | null = null;
  for (let i = 0; i < gex.length - 1; i++) {
    const a = gex[i];
    const b = gex[i + 1];
    if (a.netGex === 0) { gammaFlip = a.strike; break; }
    if ((a.netGex < 0 && b.netGex > 0) || (a.netGex > 0 && b.netGex < 0)) {
      const t = Math.abs(a.netGex) / (Math.abs(a.netGex) + Math.abs(b.netGex));
      const cross = a.strike + t * (b.strike - a.strike);
      // keep the crossing closest to spot (prefer the one bracketing spot)
      if (gammaFlip === null || Math.abs(cross - spot) < Math.abs(gammaFlip - spot)) gammaFlip = cross;
    }
  }

  // Regime relative to flip: above flip = positive gamma (dampening), below = negative
  let regime: GammaLevelsResult['regime'] = 'neutral';
  if (gammaFlip != null) {
    regime = spot >= gammaFlip ? 'positive' : 'negative';
  } else {
    const total = gex.reduce((s, row) => s + row.netGex, 0);
    regime = total > 0 ? 'positive' : total < 0 ? 'negative' : 'neutral';
  }

  // Max pain: strike minimizing total payout to option holders at expiry
  let maxPain: number | null = null;
  let minPain = Infinity;
  for (const K of strikes) {
    let pain = 0;
    for (const row of gex) {
      if (row.callOi > 0) pain += row.callOi * Math.max(0, K - row.strike);
      if (row.putOi > 0) pain += row.putOi * Math.max(0, row.strike - K);
    }
    if (pain < minPain) { minPain = pain; maxPain = K; }
  }

  const totalCallGex = gex.reduce((s, row) => s + row.callGex, 0);
  const totalPutGex = gex.reduce((s, row) => s + row.putGex, 0);
  const totalOi = gex.reduce((s, row) => s + row.totalOi, 0);

  return {
    spot, dte, expiry: expiry || null, regime,
    gammaFlip,
    spotVsFlipPct: gammaFlip != null && gammaFlip !== 0 ? ((spot - gammaFlip) / gammaFlip) * 100 : null,
    gammaWallUp, gammaWallDown, netWall, maxPain,
    totalNetGex: totalCallGex + totalPutGex,
    totalCallGex, totalPutGex, totalOi, gex,
  };
}

/**
 * Convenience helper to build GammaContract[] from a generic option chain shape
 * (e.g. Yahoo `yf.options()` results). Filters out zero-IV / zero-OI rows.
 */
export function contractsFromChain(
  calls: any[],
  puts: any[],
  mapIv?: (iv: number) => number
): GammaContract[] {
  const norm = (c: any, type: 'call' | 'put'): GammaContract | null => {
    const strike = Number(c.strike);
    const oi = Number(c.openInterest ?? c.oi ?? 0);
    let iv = Number(c.impliedVolatility ?? c.iv ?? 0);
    if (mapIv) iv = mapIv(iv);
    if (!Number.isFinite(strike) || !Number.isFinite(oi) || oi <= 0 || !Number.isFinite(iv) || iv <= 0) return null;
    return { strike, type, oi, iv };
  };
  const out: GammaContract[] = [];
  for (const c of calls || []) { const n = norm(c, 'call'); if (n) out.push(n); }
  for (const p of puts || []) { const n = norm(p, 'put'); if (n) out.push(n); }
  return out;
}
