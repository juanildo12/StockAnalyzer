// Put/Call Ratio — pure math, unit-testable.
//
// A Put/Call Ratio compares put activity to call activity. It can be measured
// two independent ways, which MUST NOT be conflated:
//   - Volume ratio   : put VOLUME / call VOLUME  (same-day contracts traded)
//   - Open interest  : put OI / call OI          (contracts still outstanding)
//
// Interpretation is NOT universal: a high ratio is not automatically bearish
// and a low ratio is not automatically bullish. It depends on context, source
// and methodology. This module only computes; it never labels buy/sell.

export type RatioBasis = 'volume' | 'openInterest';

export interface PcrContract {
  type: 'call' | 'put';
  volume: number;
  openInterest: number;
}

export interface RatioComputation {
  /** The ratio value, or null when it cannot be computed. */
  ratio: number | null;
  /** Numerator total (puts). */
  putTotal: number;
  /** Denominator total (calls). */
  callTotal: number;
  /** Which basis was used. */
  basis: RatioBasis;
  /** True when the denominator is zero (ratio undefined). */
  denominatorZero: boolean;
  /** True when there were no usable contracts at all. */
  empty: boolean;
  /** True when some rows were dropped for missing/invalid data. */
  incomplete: boolean;
}

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Compute a Put/Call ratio on the given basis.
 * Handles the zero-denominator case (returns ratio: null, denominatorZero: true)
 * and incomplete data (rows with no volume/OI are excluded from the total).
 */
export function computeRatio(contracts: PcrContract[], basis: RatioBasis): RatioComputation {
  let putTotal = 0;
  let callTotal = 0;
  let dropped = 0;
  let used = 0;

  for (const c of contracts) {
    const raw = basis === 'volume' ? c.volume : c.openInterest;
    const v = safeNum(raw);
    if (!Number.isFinite(raw as number)) {
      dropped++;
      continue;
    }
    used++;
    if (c.type === 'put') putTotal += v;
    else if (c.type === 'call') callTotal += v;
  }

  const empty = used === 0;
  const denominatorZero = callTotal <= 0;
  const ratio = denominatorZero ? null : putTotal / callTotal;

  return {
    ratio,
    putTotal,
    callTotal,
    basis,
    denominatorZero,
    empty,
    incomplete: dropped > 0,
  };
}

/** Compute both variants at once. */
export function computeBoth(contracts: PcrContract[]): { volume: RatioComputation; openInterest: RatioComputation } {
  return {
    volume: computeRatio(contracts, 'volume'),
    openInterest: computeRatio(contracts, 'openInterest'),
  };
}

/**
 * Aggregate contract rows across multiple symbols (e.g. an index/market group).
 * Preserves the per-symbol split so callers can compute a group ratio by
 * summing numerators and denominators (NOT averaging ratios, which would be
 * statistically wrong).
 */
export function aggregateContracts(bySymbol: PcrContract[][]): PcrContract[] {
  const out: PcrContract[] = [];
  for (const rows of bySymbol) {
    for (const c of rows) out.push(c);
  }
  return out;
}

export interface PcrHistoryPoint {
  date: string; // YYYY-MM-DD
  volumeRatio: number | null;
  oiRatio: number | null;
}

/**
 * Human label for a ratio, deliberately NON-directional. We do not assert a
 * universal overbought/oversold threshold; we only describe where the value
 * sits relative to a neutral 1.0 and to its own recent range.
 */
export function ratioZone(ratio: number | null): 'low' | 'balanced' | 'high' | 'na' {
  if (ratio == null || !Number.isFinite(ratio)) return 'na';
  if (ratio < 0.7) return 'low';
  if (ratio > 1.3) return 'high';
  return 'balanced';
}

/**
 * Percentile rank of the latest value within a historical series (0-100).
 * Returns null when there is not enough history to be meaningful
 * (< 5 points). This describes positioning relative to the symbol's own past,
 * not a universal threshold.
 */
export function percentileRank(series: number[], value: number | null): number | null {
  const clean = series.filter((v) => Number.isFinite(v));
  if (clean.length < 5 || value == null || !Number.isFinite(value)) return null;
  const below = clean.filter((v) => v <= value).length;
  return Math.round((below / clean.length) * 100);
}
