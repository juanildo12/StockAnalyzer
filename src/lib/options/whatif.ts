// Options strategy simulator — what-if scenario engine (pure, unit-testable).
//
// Evaluates a multi-leg position under shifts of spot (%), implied vol (pp)
// and elapsed time, plus an explicit "IV crush" analysis (post-event vol
// collapse). All outputs are position P&L in dollars.

import {
  markToMarketPnl,
  aggregateGreeks,
  expiryPnl,
  type SimInput,
  type PositionGreeks,
} from './strategy';

export interface ScenarioCell {
  /** Spot shift as a decimal (e.g. -0.1 = -10%). */
  spotShift: number;
  /** IV shift in vol points (e.g. -0.05 = -5 vol points). */
  ivShift: number;
  /** Remaining days to expiry used for this cell. */
  remainingDte: number;
  pnl: number;
}

export interface ScenarioMatrix {
  spotShifts: number[];
  ivShifts: number[];
  remainingDte: number;
  /** matrix[i][j] → P&L at spotShifts[i], ivShifts[j]. */
  matrix: ScenarioCell[][];
}

export const DEFAULT_SPOT_SHIFTS = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];
export const DEFAULT_IV_SHIFTS = [-0.1, -0.05, 0, 0.05, 0.1];

/**
 * Build a spot x IV P&L matrix at a fixed remaining time to expiry.
 * `elapsedDte` is how many days have passed (0 = today).
 */
export function scenarioMatrix(
  input: SimInput,
  opts: {
    spotShifts?: number[];
    ivShifts?: number[];
    elapsedDte?: number;
  } = {}
): ScenarioMatrix {
  const spotShifts = opts.spotShifts ?? DEFAULT_SPOT_SHIFTS;
  const ivShifts = opts.ivShifts ?? DEFAULT_IV_SHIFTS;
  const elapsed = opts.elapsedDte ?? 0;
  const baseDte = Math.max(...input.legs.map((l) => l.dte), 0);
  const remainingDte = Math.max(baseDte - elapsed, 0);

  const matrix: ScenarioCell[][] = [];
  for (const sShift of spotShifts) {
    const row: ScenarioCell[] = [];
    const curSpot = input.spot * (1 + sShift);
    for (const ivShift of ivShifts) {
      const pnl = remainingDte <= 0
        ? expiryPnl(input.legs, curSpot)
        : markToMarketPnl(input, curSpot, { ivShift, remainingDte });
      row.push({ spotShift: sShift, ivShift, remainingDte, pnl });
    }
    matrix.push(row);
  }
  return { spotShifts, ivShifts, remainingDte, matrix };
}

export interface IvCrushResult {
  /** Pre-event IV (position baseline). */
  preIv: number;
  /** Post-event IV used. */
  postIv: number;
  ivShift: number;
  /** P&L today at current spot with pre-event IV. */
  pnlBefore: number;
  /** P&L today at current spot with crushed IV. */
  pnlAfter: number;
  /** pnlAfter - pnlBefore (negative = IV crush loss for net-long-vol). */
  delta: number;
  /** Greeks recomputed under the crushed IV. */
  greeksAfter: PositionGreeks;
}

/**
 * Explicit IV-crush analysis: what happens to the position if implied vol
 * collapses by `crushPct` (e.g. 0.4 → IV drops 40% of current level) while
 * spot stays flat. Useful around earnings.
 */
export function ivCrush(
  input: SimInput,
  crushPct = 0.4,
  opts: { spotShift?: number; elapsedDte?: number } = {}
): IvCrushResult {
  const baseIv = weightedIv(input);
  const postIv = Math.max(0.0001, baseIv * (1 - crushPct));
  const ivShift = postIv - baseIv;
  const baseDte = Math.max(...input.legs.map((l) => l.dte), 0);
  const remainingDte = Math.max(baseDte - (opts.elapsedDte ?? 0), 0);
  const curSpot = input.spot * (1 + (opts.spotShift ?? 0));

  const pnlBefore = markToMarketPnl(input, curSpot, { ivShift: 0, remainingDte });
  const pnlAfter = markToMarketPnl(input, curSpot, { ivShift, remainingDte });

  return {
    preIv: baseIv,
    postIv,
    ivShift,
    pnlBefore,
    pnlAfter,
    delta: pnlAfter - pnlBefore,
    greeksAfter: aggregateGreeks(input, curSpot, ivShift),
  };
}

/** IV of the position = average leg IV (simple mean; long/short agnostic). */
export function weightedIv(input: SimInput): number {
  if (input.legs.length === 0) return 0;
  const sum = input.legs.reduce((s, l) => s + l.iv, 0);
  return sum / input.legs.length;
}
