// Shared Black-Scholes helpers (pure, unit-testable).

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation). */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

/** Standard normal PDF (bell curve). */
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ─────────────────────────────────────────────────────────────────────────────
// Black-Scholes-Merton (European) pricing + greeks.
//
// GREEK UNITS (documented contract — do not change without updating tests/UI):
//   delta : dPrice/dSpot                    (dimensionless, ~ -1..1)
//   gamma : dDelta/dSpot                    (per $1 of spot)
//   theta : dPrice/dTime, PER DAY           (÷365; negative = time decay)
//   vega  : dPrice/dSigma, PER 1 VOL POINT   (÷100; i.e. per +1% implied vol)
//   rho   : dPrice/dRate, PER 1 RATE POINT   (÷100; i.e. per +1% risk-free)
// All greeks are quoted PER SINGLE SHARE (not per contract). Multiply by
// 100 * qty * sign for a per-contract position exposure.
// ─────────────────────────────────────────────────────────────────────────────

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number; // per day
  vega: number; // per 1 vol point (1%)
  rho: number; // per 1 rate point (1%)
  price: number;
}

const DEGENERATE: Greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, price: 0 };

/**
 * Black-Scholes-Merton price + greeks for a European call/put.
 * Returns the intrinsic-only degenerate case when T<=0 or sigma<=0.
 */
export function bsGreeks(
  S: number,
  K: number,
  T: number,
  sigma: number,
  isCall: boolean,
  r = 0.045,
  q = 0
): Greeks {
  if (S <= 0 || K <= 0) return { ...DEGENERATE };
  if (T <= 0 || sigma <= 0) {
    const price = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
    const itm = isCall ? S > K : S < K;
    return { ...DEGENERATE, price, delta: itm ? (isCall ? 1 : -1) : 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);
  const qdisc = Math.exp(-q * T);
  const pdf = normalPDF(d1);

  const price = isCall
    ? S * qdisc * normalCDF(d1) - K * disc * normalCDF(d2)
    : K * disc * normalCDF(-d2) - S * qdisc * normalCDF(-d1);

  const delta = isCall
    ? qdisc * normalCDF(d1)
    : qdisc * (normalCDF(d1) - 1);

  const gamma = (qdisc * pdf) / (S * sigma * sqrtT);

  // Theta is the derivative w.r.t. calendar time (÷365 → per-day decay).
  const commonTheta = -(S * qdisc * pdf * sigma) / (2 * sqrtT);
  const thetaYr = isCall
    ? commonTheta - r * K * disc * normalCDF(d2) + q * S * qdisc * normalCDF(d1)
    : commonTheta + r * K * disc * normalCDF(-d2) - q * S * qdisc * normalCDF(-d1);

  const vega = S * qdisc * pdf * sqrtT; // per 1.00 of vol
  const rhoYr = isCall
    ? K * T * disc * normalCDF(d2)
    : -K * T * disc * normalCDF(-d2);

  return {
    price,
    delta,
    gamma,
    theta: thetaYr / 365,
    vega: vega / 100,
    rho: rhoYr / 100,
  };
}

/**
 * Cox-Ross-Rubinstein binomial tree for an option, supporting early exercise
 * (American). Converges to BSM for European options as steps grows.
 * `steps` is clamped to [1, 1000].
 */
export function binomialPrice(
  S: number,
  K: number,
  T: number,
  sigma: number,
  isCall: boolean,
  american = true,
  steps = 100,
  r = 0.045,
  q = 0
): number {
  if (S <= 0 || K <= 0) return 0;
  if (T <= 0 || sigma <= 0) {
    return isCall ? Math.max(0, S - K) : Math.max(0, K - S);
  }
  const n = Math.max(1, Math.min(1000, Math.floor(steps)));
  const dt = T / n;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);
  const intrinsic = (s: number) => (isCall ? Math.max(0, s - K) : Math.max(0, K - s));

  // Terminal payoffs at step n.
  const values = new Array<number>(n + 1);
  for (let i = 0; i <= n; i++) {
    const s = S * Math.pow(u, i) * Math.pow(d, n - i);
    values[i] = intrinsic(s);
  }
  // Backward induction.
  for (let step = n - 1; step >= 0; step--) {
    for (let i = 0; i <= step; i++) {
      const cont = disc * (p * values[i + 1] + (1 - p) * values[i]);
      if (american) {
        const s = S * Math.pow(u, i) * Math.pow(d, step - i);
        values[i] = Math.max(cont, intrinsic(s));
      } else {
        values[i] = cont;
      }
    }
  }
  return values[0];
}
