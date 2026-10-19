import { describe, it, expect } from 'vitest';
import {
  MULTIPLIER,
  netCashflow,
  legCashflow,
  expiryPnl,
  markToMarketPnl,
  aggregateGreeks,
  payoffCurve,
  findBreakevens,
  estimateMargin,
  riskProfile,
  priceLeg,
  type StrategyLeg,
  type SimInput,
} from './strategy';
import { scenarioMatrix, ivCrush, weightedIv } from './whatif';
import { bsGreeks, binomialPrice } from './bs';

// ─────────────────────────────────────────────────────────────────────────────
// Reference fixture: S=100, K=100, T=1y, sigma=0.2, r=0.05.
// Textbook (Hull) values: call 10.4506, put 5.5735, delta 0.6368, gamma 0.018762,
// vega 0.3752 (per vol pt), theta -0.017573/day, rho 0.5323.
// ─────────────────────────────────────────────────────────────────────────────
describe('bsGreeks — reference values (Hull)', () => {
  const S = 100, K = 100, T = 1, sig = 0.2, r = 0.05;
  const call = bsGreeks(S, K, T, sig, true, r);
  const put = bsGreeks(S, K, T, sig, false, r);

  it('call price matches 10.4506', () => {
    expect(call.price).toBeCloseTo(10.4506, 3);
  });
  it('put price matches 5.5735', () => {
    expect(put.price).toBeCloseTo(5.5735, 3);
  });
  it('delta call 0.6368 / put -0.3632', () => {
    expect(call.delta).toBeCloseTo(0.6368, 3);
    expect(put.delta).toBeCloseTo(-0.3632, 3);
  });
  it('gamma is identical for call and put and equals 0.018762', () => {
    expect(call.gamma).toBeCloseTo(0.018762, 5);
    expect(put.gamma).toBeCloseTo(call.gamma, 12);
  });
  it('vega is 0.3752 per 1 vol point', () => {
    expect(call.vega).toBeCloseTo(0.3752, 3);
  });
  it('theta is -0.017573 per day for the call', () => {
    expect(call.theta).toBeCloseTo(-0.017573, 5);
  });
  it('rho call 0.5323 per 1 rate point', () => {
    expect(call.rho).toBeCloseTo(0.5323, 3);
  });
  it('agrees with bsPrice-style output at the same params', () => {
    // No-arbitrage: put-call parity C - P = S - K e^{-rT}
    const parity = call.price - put.price;
    expect(parity).toBeCloseTo(S - K * Math.exp(-r * T), 6);
  });
  it('degenerate at T<=0 returns intrinsic with binary delta', () => {
    const g = bsGreeks(110, 100, 0, 0.2, true);
    expect(g.price).toBeCloseTo(10, 9);
    expect(g.delta).toBe(1);
    const g2 = bsGreeks(90, 100, 0, 0.2, false);
    expect(g2.price).toBeCloseTo(10, 9);
    expect(g2.delta).toBe(-1);
  });
});

describe('binomialPrice — American early exercise', () => {
  it('converges to BSM for a European option', () => {
    const euro = binomialPrice(100, 100, 1, 0.2, true, false, 400, 0.05);
    expect(euro).toBeCloseTo(10.4506, 1);
  });
  it('American put is worth at least its European counterpart', () => {
    // Deep ITM put: early exercise premium is meaningful.
    const american = binomialPrice(100, 120, 1, 0.2, false, true, 300, 0.05);
    const european = binomialPrice(100, 120, 1, 0.2, false, false, 300, 0.05);
    expect(american).toBeGreaterThan(european);
  });
  it('is never below intrinsic (early-exercise floor)', () => {
    const p = binomialPrice(50, 100, 0.5, 0.3, false, true, 200, 0.05);
    expect(p).toBeGreaterThanOrEqual(50);
  });
  it('American call on a non-dividend stock equals the European call', () => {
    const american = binomialPrice(100, 100, 1, 0.2, true, true, 300, 0.05);
    const european = binomialPrice(100, 100, 1, 0.2, true, false, 300, 0.05);
    expect(american).toBeCloseTo(european, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy aggregation — use clean ATM legs so values are deterministic.
// ─────────────────────────────────────────────────────────────────────────────
function atmCall(overrides: Partial<StrategyLeg> = {}): StrategyLeg {
  return { type: 'call', side: 'long', qty: 1, strike: 100, premium: 10.45, iv: 0.2, dte: 365, ...overrides };
}

describe('legCashflow / netCashflow', () => {
  it('long option is a debit (negative cashflow)', () => {
    expect(legCashflow(atmCall())).toBeCloseTo(-10.45 * MULTIPLIER, 9);
  });
  it('short option is a credit (positive cashflow)', () => {
    expect(legCashflow(atmCall({ side: 'short' }))).toBeCloseTo(10.45 * MULTIPLIER, 9);
  });
  it('sums legs correctly', () => {
    const legs = [
      atmCall({ side: 'long', strike: 100, premium: 10 }),
      atmCall({ side: 'short', strike: 105, premium: 5 }),
    ];
    // -1000 + 500 = -500 debit
    expect(netCashflow(legs)).toBeCloseTo(-500, 9);
  });
});

describe('expiryPnl — known structures', () => {
  it('long call: max loss = premium paid, unbounded upside', () => {
    const legs = [atmCall({ strike: 100, premium: 10 })];
    expect(expiryPnl(legs, 100)).toBeCloseTo(-1000, 9); // worthless at strike
    expect(expiryPnl(legs, 110)).toBeCloseTo(0, 9); // breakeven = strike+premium
    expect(expiryPnl(legs, 120)).toBeCloseTo(1000, 9); // +10 intrinsic - 10 premium
  });
  it('long put: max loss = premium paid', () => {
    const legs = [atmCall({ type: 'put', strike: 100, premium: 10 })];
    expect(expiryPnl(legs, 100)).toBeCloseTo(-1000, 9);
    expect(expiryPnl(legs, 90)).toBeCloseTo(0, 9);
    expect(expiryPnl(legs, 80)).toBeCloseTo(1000, 9);
  });
  it('bull call spread caps both sides', () => {
    const legs = [
      atmCall({ side: 'long', strike: 100, premium: 10 }),
      atmCall({ side: 'short', strike: 110, premium: 4 }),
    ];
    // debit = 6 -> max loss 600; width 10 -> max profit 400
    expect(expiryPnl(legs, 90)).toBeCloseTo(-600, 9);
    expect(expiryPnl(legs, 105)).toBeCloseTo(-100, 9); // +5 - 6
    expect(expiryPnl(legs, 110)).toBeCloseTo(400, 9);
    expect(expiryPnl(legs, 130)).toBeCloseTo(400, 9); // capped
  });
  it('short strangle is a credit with unbounded tail risk', () => {
    const legs = [
      atmCall({ type: 'put', side: 'short', strike: 95, premium: 3 }),
      atmCall({ type: 'call', side: 'short', strike: 105, premium: 3 }),
    ];
    expect(expiryPnl(legs, 100)).toBeCloseTo(600, 9); // keep full credit
    expect(expiryPnl(legs, 110)).toBeCloseTo(100, 9); // 6 - 5
    expect(expiryPnl(legs, 90)).toBeCloseTo(100, 9); // 6 - 5
    expect(expiryPnl(legs, 120)).toBeLessThan(0); // losing in the tail
  });
  it('iron condor has defined risk on both sides', () => {
    const legs = [
      atmCall({ type: 'put', side: 'long', strike: 90, premium: 1 }),
      atmCall({ type: 'put', side: 'short', strike: 95, premium: 3 }),
      atmCall({ type: 'call', side: 'short', strike: 105, premium: 3 }),
      atmCall({ type: 'call', side: 'long', strike: 110, premium: 1 }),
    ];
    const credit = netCashflow(legs); // -1 +3 +3 -1 = +4
    expect(credit).toBeCloseTo(400, 9);
    expect(expiryPnl(legs, 100)).toBeCloseTo(400, 9);
    // max loss per side = width(5) - credit(4) = 1 -> -100
    expect(expiryPnl(legs, 85)).toBeCloseTo(-100, 9);
    expect(expiryPnl(legs, 115)).toBeCloseTo(-100, 9);
  });
});

describe('aggregateGreeks', () => {
  it('long 2 calls scales delta/gamma/vega by 2 x 100', () => {
    const input: SimInput = { spot: 100, legs: [atmCall({ qty: 2 })] };
    const g = aggregateGreeks(input);
    const ref = bsGreeks(100, 100, 1, 0.2, true, 0.045);
    expect(g.delta).toBeCloseTo(ref.delta * 2 * MULTIPLIER, 6);
    expect(g.vega).toBeCloseTo(ref.vega * 2 * MULTIPLIER, 6);
  });
  it('long call + short call offsets delta', () => {
    const input: SimInput = {
      spot: 100,
      legs: [
        atmCall({ side: 'long', strike: 100, qty: 1 }),
        atmCall({ side: 'short', strike: 100, qty: 1 }),
      ],
    };
    const g = aggregateGreeks(input);
    expect(g.delta).toBeCloseTo(0, 6);
    expect(g.gamma).toBeCloseTo(0, 9);
    expect(g.theta).toBeCloseTo(0, 9);
  });
  it('short call has negative delta and positive theta', () => {
    const input: SimInput = { spot: 100, legs: [atmCall({ side: 'short' })] };
    const g = aggregateGreeks(input);
    expect(g.delta).toBeLessThan(0);
    expect(g.theta).toBeGreaterThan(0);
  });
});

describe('markToMarketPnl & priceLeg', () => {
  it('long call at open (no move, no decay) is ~flat vs premium', () => {
    // At exactly the open with BS price == premium, P&L ~ 0.
    const input: SimInput = { spot: 100, r: 0.05, legs: [atmCall({ premium: 10.4506, dte: 365 })] };
    expect(markToMarketPnl(input, 100)).toBeCloseTo(0, 0);
  });
  it('long call gains as spot rises before expiry', () => {
    const input: SimInput = { spot: 100, legs: [atmCall({ dte: 365 })] };
    expect(markToMarketPnl(input, 110)).toBeGreaterThan(markToMarketPnl(input, 100));
  });
  it('American leg prices at least intrinsic', () => {
    const leg = atmCall({ type: 'put', strike: 120, style: 'american' });
    expect(priceLeg(leg, 100, 0.2, 1)).toBeGreaterThanOrEqual(20);
  });
});

describe('payoffCurve & findBreakevens', () => {
  it('curve is monotonic in spots and has requested length', () => {
    const curve = payoffCurve([atmCall({ strike: 100, premium: 10 })], 100, 51, 0.5);
    expect(curve.length).toBe(51);
    expect(curve[0].spot).toBeCloseTo(50, 6);
    expect(curve[50].spot).toBeCloseTo(150, 6);
  });
  it('long call has one breakeven at strike+premium', () => {
    const be = findBreakevens([atmCall({ strike: 100, premium: 10 })], 100);
    expect(be.length).toBe(1);
    expect(be[0]).toBeCloseTo(110, 2);
  });
  it('iron condor has two breakevens', () => {
    const legs = [
      atmCall({ type: 'put', side: 'long', strike: 90, premium: 1 }),
      atmCall({ type: 'put', side: 'short', strike: 95, premium: 3 }),
      atmCall({ type: 'call', side: 'short', strike: 105, premium: 3 }),
      atmCall({ type: 'call', side: 'long', strike: 110, premium: 1 }),
    ];
    const be = findBreakevens(legs, 100);
    expect(be.length).toBe(2);
    expect(be[0]).toBeCloseTo(91, 1);
    expect(be[1]).toBeCloseTo(109, 1);
  });
  it('straddle has two breakevens bracketing the strike', () => {
    const legs = [
      atmCall({ type: 'call', side: 'long', strike: 100, premium: 8 }),
      atmCall({ type: 'put', side: 'long', strike: 100, premium: 8 }),
    ];
    const be = findBreakevens(legs, 100);
    expect(be.length).toBe(2);
    expect(be[0]).toBeCloseTo(84, 1);
    expect(be[1]).toBeCloseTo(116, 1);
  });
});

describe('riskProfile', () => {
  it('long call: max loss = premium, unlimited profit', () => {
    const r = riskProfile({ spot: 100, legs: [atmCall({ strike: 100, premium: 10 })] });
    expect(r.kind).toBe('debit');
    expect(r.maxLoss).toBeCloseTo(-1000, 6);
    expect(r.maxProfit).toBeNull();
  });
  it('bull call spread: max profit = width - debit', () => {
    const r = riskProfile({
      spot: 100,
      legs: [
        atmCall({ side: 'long', strike: 100, premium: 10 }),
        atmCall({ side: 'short', strike: 110, premium: 4 }),
      ],
    });
    expect(r.maxProfit).toBeCloseTo(400, 6);
    expect(r.maxLoss).toBeCloseTo(-600, 6);
  });
  it('covered call: credit with defined downside', () => {
    const r = riskProfile({
      spot: 100,
      legs: [atmCall({ side: 'short', strike: 105, premium: 5 })],
    });
    expect(r.kind).toBe('credit');
    expect(r.netCashflow).toBeCloseTo(500, 6);
  });
});

describe('estimateMargin', () => {
  it('long-only position requires the debit', () => {
    const m = estimateMargin([atmCall({ premium: 10 })], 100);
    expect(m).toBeCloseTo(1000, 6);
  });
  it('defined-risk spread margin is capped at the width', () => {
    const m = estimateMargin(
      [
        atmCall({ side: 'short', strike: 105, premium: 3 }),
        atmCall({ side: 'long', strike: 110, premium: 1 }),
      ],
      100
    );
    // width 5 * 100 = 500 (naked rec would be much higher)
    expect(m).toBeCloseTo(500, 6);
  });
  it('naked short call margin is large', () => {
    const m = estimateMargin([atmCall({ side: 'short', strike: 105, premium: 3 })], 100);
    expect(m).toBeGreaterThan(1500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// What-if / IV crush
// ─────────────────────────────────────────────────────────────────────────────
describe('scenarioMatrix', () => {
  it('builds a spots x ivs grid', () => {
    const input: SimInput = { spot: 100, legs: [atmCall({ dte: 30 })] };
    const m = scenarioMatrix(input);
    expect(m.matrix.length).toBe(m.spotShifts.length);
    expect(m.matrix[0].length).toBe(m.ivShifts.length);
  });
  it('long call P&L rises with spot and with IV', () => {
    const input: SimInput = { spot: 100, legs: [atmCall({ dte: 30 })] };
    const m = scenarioMatrix(input, { spotShifts: [-0.1, 0, 0.1], ivShifts: [-0.05, 0, 0.05], elapsedDte: 10 });
    const low = m.matrix[0][1].pnl;
    const high = m.matrix[2][1].pnl;
    expect(high).toBeGreaterThan(low);
    const lowIv = m.matrix[1][0].pnl;
    const highIv = m.matrix[1][2].pnl;
    expect(highIv).toBeGreaterThan(lowIv);
  });
  it('at expiry (elapsed = dte) matches the payoff', () => {
    const legs = [atmCall({ strike: 100, premium: 10, dte: 30 })];
    const m = scenarioMatrix({ spot: 100, legs }, { spotShifts: [0.1], ivShifts: [0], elapsedDte: 30 });
    expect(m.remainingDte).toBe(0);
    expect(m.matrix[0][0].pnl).toBeCloseTo(expiryPnl(legs, 110), 6);
  });
});

describe('ivCrush', () => {
  it('long straddle loses value on IV crush', () => {
    const input: SimInput = {
      spot: 100,
      legs: [
        atmCall({ type: 'call', strike: 100, premium: 8, iv: 0.5, dte: 20 }),
        atmCall({ type: 'put', strike: 100, premium: 8, iv: 0.5, dte: 20 }),
      ],
    };
    const res = ivCrush(input, 0.4);
    expect(res.postIv).toBeCloseTo(0.3, 6);
    expect(res.delta).toBeLessThan(0); // long vol -> loses
  });
  it('short straddle gains on IV crush', () => {
    const input: SimInput = {
      spot: 100,
      legs: [
        atmCall({ type: 'call', side: 'short', strike: 100, premium: 8, iv: 0.5, dte: 20 }),
        atmCall({ type: 'put', side: 'short', strike: 100, premium: 8, iv: 0.5, dte: 20 }),
      ],
    };
    const res = ivCrush(input, 0.4);
    expect(res.delta).toBeGreaterThan(0);
  });
  it('a zero-crush is a no-op', () => {
    const input: SimInput = { spot: 100, legs: [atmCall({ iv: 0.4, dte: 20 })] };
    const res = ivCrush(input, 0);
    expect(res.delta).toBeCloseTo(0, 6);
  });
  it('weightedIv is the mean leg IV', () => {
    const input: SimInput = {
      spot: 100,
      legs: [atmCall({ iv: 0.2 }), atmCall({ type: 'put', iv: 0.4 })],
    };
    expect(weightedIv(input)).toBeCloseTo(0.3, 9);
  });
});
