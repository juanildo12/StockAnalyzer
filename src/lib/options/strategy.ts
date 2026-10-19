// Options strategy simulator — pure math, unit-testable.
//
// Model a multi-leg option position (calls/puts, long/short, arbitrary qty),
// compute the expiry payoff, the mark-to-market P&L surface, aggregate greeks,
// and derive a risk profile (max profit/loss, breakevens, debit/credit, margin).
//
// Conventions (documented — keep in sync with UI + tests):
//   - Quantities: `qty` is number of contracts; positive = long, negative =
//     short. Each contract = 100 shares (MULTIPLIER).
//   - Premiums/prices are per-share (as quoted). Cash per leg = price * qty *
//     MULTIPLIER.
//   - Payoff (at expiry) and P&L are DOLLARS for the whole position.
//   - greeks aggregate per-share deltas but are scaled by contracts for
//     position exposure (see aggregateGreeks).
//
// No order execution, ever. This module only models.

import { bsGreeks, binomialPrice, type Greeks } from './bs';

export const MULTIPLIER = 100;

export type OptionType = 'call' | 'put';
/** 'european' = BSM closed form; 'american' = CRR binomial (early exercise). */
export type OptionStyle = 'european' | 'american';

export interface StrategyLeg {
  type: OptionType;
  /** 'long' buys premium, 'short' collects premium. */
  side: 'long' | 'short';
  /** Number of contracts (>= 1). */
  qty: number;
  strike: number;
  /** Per-share premium used for cost basis / cashflow. */
  premium: number;
  /** Annualized implied vol as a decimal (e.g. 0.35 = 35%). */
  iv: number;
  /** Days to expiration. */
  dte: number;
  style?: OptionStyle;
}

export interface SimInput {
  spot: number;
  /** Risk-free annual rate as a decimal. Default 0.045. */
  r?: number;
  /** Continuous dividend yield as a decimal. Default 0. */
  q?: number;
  legs: StrategyLeg[];
}

export interface PositionGreeks {
  delta: number;
  gamma: number;
  theta: number; // per day (whole position, in share-equivalents)
  vega: number; // per 1 vol point
  rho: number; // per 1 rate point
  /** Mark-to-market value of the position at the given spot/IV/time. */
  value: number;
}

export interface RiskProfile {
  /** Net cashflow at open: >0 credit received, <0 debit paid. */
  netCashflow: number;
  kind: 'debit' | 'credit' | 'flat';
  /** Max profit in $ across expiry (null = unlimited / unbounded). */
  maxProfit: number | null;
  /** Max loss in $ across expiry (null = unlimited / unbounded). */
  maxLoss: number | null;
  /** Spot prices where expiry P&L crosses zero (sorted ascending). */
  breakevens: number[];
  /** Estimated initial margin in $ (broker-independent, conservative). */
  estimatedMargin: number;
}

export interface PayoffPoint {
  spot: number;
  /** P&L at expiry, in $. */
  pnl: number;
}

const sign = (leg: StrategyLeg): number => (leg.side === 'long' ? 1 : -1);

/** Intrinsic value per share of a leg at a given underlying price. */
function legIntrinsic(leg: StrategyLeg, spot: number): number {
  return leg.type === 'call'
    ? Math.max(0, spot - leg.strike)
    : Math.max(0, leg.strike - spot);
}

/** Per-contract cashflow at open: negative = debit paid, positive = credit. */
export function legCashflow(leg: StrategyLeg): number {
  return -sign(leg) * leg.premium * Math.abs(leg.qty) * MULTIPLIER;
}

/** Total cashflow at open for the whole position (credit > 0). */
export function netCashflow(legs: StrategyLeg[]): number {
  return legs.reduce((sum, leg) => sum + legCashflow(leg), 0);
}

export type PricingModel = 'bsm' | 'binomial';

/** Price a single leg at an arbitrary spot / vol / time-to-expiry (years). */
export function priceLeg(
  leg: StrategyLeg,
  spot: number,
  vol: number,
  years: number,
  r = 0.045,
  q = 0
): number {
  if (years <= 0) return legIntrinsic(leg, spot);
  const isCall = leg.type === 'call';
  if (leg.style === 'american') {
    return binomialPrice(spot, leg.strike, years, vol, isCall, true, 100, r, q);
  }
  return bsGreeks(spot, leg.strike, years, vol, isCall, r, q).price;
}

/**
 * P&L at expiry for the whole position at a terminal underlying price.
 * P&L = netCashflow(open) + Σ sign * intrinsic * qty * MULTIPLIER.
 */
export function expiryPnl(legs: StrategyLeg[], spot: number): number {
  let pnl = netCashflow(legs);
  for (const leg of legs) {
    pnl += sign(leg) * legIntrinsic(leg, spot) * Math.abs(leg.qty) * MULTIPLIER;
  }
  return pnl;
}

/**
 * Mark-to-market P&L before expiry: value each leg now vs. its open cashflow.
 * `dte` is the remaining calendar days; `ivShift` (decimal) shifts every leg's
 * IV by that amount (used for IV crush). `yearsElapsed` reduces time-to-expiry.
 */
export function markToMarketPnl(
  input: SimInput,
  currentSpot: number,
  opts: { ivShift?: number; remainingDte?: number } = {}
): number {
  const { r = 0.045, q = 0, legs } = input;
  const ivShift = opts.ivShift ?? 0;
  let value = 0;
  for (const leg of legs) {
    const remaining = opts.remainingDte != null ? opts.remainingDte : leg.dte;
    const years = Math.max(remaining, 0) / 365;
    const vol = Math.max(0.0001, leg.iv + ivShift);
    const px = priceLeg(leg, currentSpot, vol, years, r, q);
    value += sign(leg) * px * Math.abs(leg.qty) * MULTIPLIER;
  }
  return value + netCashflow(legs);
}

/**
 * Aggregate position greeks. Deltas/gammas are per-share and scaled by
 * contracts * MULTIPLIER for dollar exposure. Theta/vega/rho use the
 * documented per-day / per-vol-point / per-rate-point units.
 */
export function aggregateGreeks(input: SimInput, spot?: number, volShift = 0): PositionGreeks {
  const { r = 0.045, q = 0, legs } = input;
  const S = spot ?? input.spot;
  const out: PositionGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, value: 0 };
  for (const leg of legs) {
    const years = Math.max(leg.dte, 0) / 365;
    const vol = Math.max(0.0001, leg.iv + volShift);
    const g: Greeks = bsGreeks(S, leg.strike, years, vol, leg.type === 'call', r, q);
    const scale = sign(leg) * Math.abs(leg.qty) * MULTIPLIER;
    out.delta += g.delta * scale;
    out.gamma += g.gamma * scale;
    out.theta += g.theta * scale;
    out.vega += g.vega * scale;
    out.rho += g.rho * scale;
    const mark = leg.style === 'american'
      ? binomialPrice(S, leg.strike, years, vol, leg.type === 'call', true, 100, r, q)
      : g.price;
    out.value += sign(leg) * mark * Math.abs(leg.qty) * MULTIPLIER;
  }
  return out;
}

/** Build a payoff curve across a spot range (default ±50% around spot). */
export function payoffCurve(
  legs: StrategyLeg[],
  spot: number,
  points = 161,
  rangePct = 0.5
): PayoffPoint[] {
  const lo = spot * (1 - rangePct);
  const hi = spot * (1 + rangePct);
  const out: PayoffPoint[] = [];
  const n = Math.max(2, points);
  for (let i = 0; i < n; i++) {
    const s = lo + ((hi - lo) * i) / (n - 1);
    out.push({ spot: s, pnl: expiryPnl(legs, s) });
  }
  return out;
}

/** Build a mark-to-market P&L curve (before expiry) across a spot range. */
export function mtmCurve(
  input: SimInput,
  opts: { ivShift?: number; remainingDte?: number; points?: number; rangePct?: number } = {}
): PayoffPoint[] {
  const { spot, legs } = input;
  const points = opts.points ?? 161;
  const rangePct = opts.rangePct ?? 0.5;
  const lo = spot * (1 - rangePct);
  const hi = spot * (1 + rangePct);
  const out: PayoffPoint[] = [];
  const n = Math.max(2, points);
  for (let i = 0; i < n; i++) {
    const s = lo + ((hi - lo) * i) / (n - 1);
    out.push({ spot: s, pnl: markToMarketPnl(input, s, { ivShift: opts.ivShift, remainingDte: opts.remainingDte }) });
  }
  return out;
}

/**
 * Find expiry breakevens by scanning the payoff curve for sign changes and
 * linearly interpolating the crossings. Returns sorted, de-duplicated spots.
 */
export function findBreakevens(legs: StrategyLeg[], spot: number, rangePct = 2): number[] {
  const curve = payoffCurve(legs, spot, 2001, rangePct);
  const xs: number[] = [];
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (a.pnl === 0) { xs.push(a.spot); continue; }
    if ((a.pnl < 0 && b.pnl > 0) || (a.pnl > 0 && b.pnl < 0)) {
      const t = Math.abs(a.pnl) / (Math.abs(a.pnl) + Math.abs(b.pnl));
      xs.push(a.spot + t * (b.spot - a.spot));
    }
  }
  const uniq: number[] = [];
  for (const x of xs) {
    if (!uniq.some((u) => Math.abs(u - x) < Math.max(1e-6, spot * 1e-6))) uniq.push(x);
  }
  return uniq.sort((a, b) => a - b);
}

/**
 * Estimate the initial margin required to hold the position (conservative,
 * broker-independent). Long options cost premium (debit). Short options get a
 * Reg-T-style requirement; defined-risk spreads are capped by the width.
 * This is an ESTIMATE and is reported separately from any broker's margin.
 */
export function estimateMargin(legs: StrategyLeg[], spot: number): number {
  const shortLegs = legs.filter((l) => l.side === 'short');
  const longLegs = legs.filter((l) => l.side === 'long');
  const longCost = longLegs.reduce((s, l) => s + l.premium * Math.abs(l.qty) * MULTIPLIER, 0);
  if (shortLegs.length === 0) return longCost;

  // Per-short-leg Reg-T naked requirement baseline is computed inline below.

  // Defined-risk reduction: match each short to a protecting long of the same
  // type; when protected, cap risk at the strike width to that long. Unmatched
  // shorts keep their (larger) naked requirement.
  let defined = 0;
  for (const sl of shortLegs) {
    const protector = longLegs
      .filter((ll) => ll.type === sl.type)
      .map((ll) => ({ ll, width: Math.abs(ll.strike - sl.strike) }))
      .sort((a, b) => a.width - b.width)[0];
    const otm = sl.type === 'call' ? Math.max(0, sl.strike - spot) : Math.max(0, spot - sl.strike);
    const nakedPer = Math.max(0.2 * spot - otm + sl.premium, 0.1 * spot, sl.premium);
    if (protector) {
      defined += Math.min(protector.width, nakedPer) * Math.abs(sl.qty) * MULTIPLIER;
    } else {
      defined += nakedPer * Math.abs(sl.qty) * MULTIPLIER;
    }
  }
  return Math.max(longCost, defined);
}

/**
 * Full risk profile: cashflow, max profit/loss, breakevens, estimated margin.
 * Max profit/loss are computed from the expiry payoff at the range edges and
 * the strikes (the extremes of a piecewise-linear payoff live at kinks).
 */
export function riskProfile(input: SimInput, rangePct = 3): RiskProfile {
  const { legs, spot } = input;
  const cash = netCashflow(legs);
  // Evaluate payoff at range edges and at every strike (the kinks).
  const candidates = [spot * (1 - rangePct), spot * (1 + rangePct), ...legs.map((l) => l.strike), 0];
  let maxPnl = -Infinity;
  let minPnl = Infinity;
  for (const s of candidates) {
    const p = expiryPnl(legs, s);
    if (p > maxPnl) maxPnl = p;
    if (p < minPnl) minPnl = p;
  }
  // Bounded/unbounded detection: check slope far out (above/below).
  const farUp = expiryPnl(legs, spot * 100);
  const farDown = expiryPnl(legs, spot / 100);

  let maxProfit: number | null = maxPnl;
  let maxLoss: number | null = minPnl;
  if (farUp > maxPnl * 1.5 + 1 || farUp > maxPnl + spot * MULTIPLIER) {
    // Payoff keeps rising without bound above the top strike → unlimited.
    const slopeUp = farUp - expiryPnl(legs, spot * 50);
    if (slopeUp > 0.5 * MULTIPLIER) maxProfit = null;
  }
  if (farDown < 0 && spot / 100 < Math.min(...legs.map((l) => l.strike))) {
    const slopeDown = expiryPnl(legs, spot / 50) - farDown;
    if (slopeDown > 0.5 * MULTIPLIER) maxLoss = null;
  }

  return {
    netCashflow: cash,
    kind: cash > 1e-9 ? 'credit' : cash < -1e-9 ? 'debit' : 'flat',
    maxProfit,
    maxLoss,
    breakevens: findBreakevens(legs, spot),
    estimatedMargin: estimateMargin(legs, spot),
  };
}
