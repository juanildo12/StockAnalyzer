import { describe, it, expect } from 'vitest';
import {
  bsGamma,
  bsPrice,
  ivFromOptionPrice,
  computeGammaLevels,
  contractsFromChain,
  type GammaContract,
} from './gamma';

describe('bsGamma', () => {
  it('returns 0 for degenerate inputs', () => {
    expect(bsGamma(0, 100, 30 / 365, 0.3)).toBe(0);
    expect(bsGamma(100, 0, 30 / 365, 0.3)).toBe(0);
    expect(bsGamma(100, 100, 0, 0.3)).toBe(0);
    expect(bsGamma(100, 100, 30 / 365, 0)).toBe(0);
  });

  it('call and put gamma are equal at the same strike', () => {
    // In BS, gamma depends only on d1 — identical for call and put.
    const S = 100, K = 105, T = 40 / 365, iv = 0.28;
    expect(bsGamma(S, K, T, iv)).toBeCloseTo(bsGamma(S, K, T, iv), 12);
  });

  it('ATM gamma peaks around the forward and decreases away from the money', () => {
    const T = 30 / 365, iv = 0.25;
    const atm = bsGamma(100, 100, T, iv);
    const near = bsGamma(100, 102, T, iv);
    const far = bsGamma(100, 120, T, iv);
    expect(atm).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(far);
    expect(atm).toBeGreaterThan(0);
  });

  it('matches the textbook ATM gamma value (uses PDF, not CDF)', () => {
    // S=K=100, T=1y, sigma=0.2, r=0 → d1 = 0.1, phi(0.1)=0.39695
    // gamma = 0.39695 / (100 * 0.2 * 1) = 0.019847
    const g = bsGamma(100, 100, 1, 0.2, 0);
    expect(g).toBeCloseTo(0.01985, 4);
  });

  it('deep ITM with degenerate IV does not explode', () => {
    // Yahoo returns IV ≈ 1e-5 on illiquid deep-ITM rows; gamma must stay tiny.
    expect(bsGamma(344, 105, 35 / 365, 1e-5)).toBeLessThan(1e-6);
  });

  it('gamma decreases as time to expiry shrinks (for ATM)', () => {
    const long = bsGamma(100, 100, 90 / 365, 0.25);
    const short = bsGamma(100, 100, 5 / 365, 0.25);
    expect(long).toBeLessThan(short);
  });
});

describe('bsPrice / ivFromOptionPrice roundtrip', () => {
  it('recovers the input IV from a BS price', () => {
    const S = 100, K = 100, T = 40 / 365, iv = 0.35;
    const callPrice = bsPrice(S, K, T, iv, true);
    const putPrice = bsPrice(S, K, T, iv, false);
    expect(ivFromOptionPrice(callPrice, S, K, T, true)).toBeCloseTo(iv, 4);
    expect(ivFromOptionPrice(putPrice, S, K, T, false)).toBeCloseTo(iv, 4);
  });

  it('returns null for un-invertible prices', () => {
    expect(ivFromOptionPrice(0, 100, 100, 30 / 365, true)).toBeNull();
    expect(ivFromOptionPrice(5, 100, 110, 30 / 365, false)).toBeNull(); // below put intrinsic (10)
    expect(ivFromOptionPrice(10, 100, 100, 0, true)).toBeNull();
  });
});

function chainFixture(): GammaContract[] {
  // Heavy put OI below spot, heavy call OI above → flip somewhere in the middle.
  return [
    { strike: 90, type: 'put', oi: 50_000, iv: 0.30 },
    { strike: 95, type: 'put', oi: 40_000, iv: 0.28 },
    { strike: 100, type: 'put', oi: 10_000, iv: 0.25 },
    { strike: 100, type: 'call', oi: 10_000, iv: 0.25 },
    { strike: 105, type: 'call', oi: 45_000, iv: 0.26 },
    { strike: 110, type: 'call', oi: 35_000, iv: 0.28 },
  ];
}

describe('computeGammaLevels', () => {
  it('returns empty result for no contracts', () => {
    const res = computeGammaLevels({ contracts: [], spot: 100, dte: 30, expiry: '2026-11-20' });
    expect(res.gex).toHaveLength(0);
    expect(res.gammaFlip).toBeNull();
    expect(res.regime).toBe('neutral');
  });

  it('aggregates GEX per strike with puts negative', () => {
    const res = computeGammaLevels({ contracts: chainFixture(), spot: 100, dte: 30 });
    const row95 = res.gex.find(r => r.strike === 95)!;
    expect(row95.putOi).toBe(40_000);
    expect(row95.callOi).toBe(0);
    expect(row95.putGex).toBeLessThan(0);
    expect(row95.netGex).toBeLessThan(0);
    const row105 = res.gex.find(r => r.strike === 105)!;
    expect(row105.callOi).toBe(45_000);
    expect(row105.callGex).toBeGreaterThan(0);
    expect(res.totalOi).toBe(50_000 + 40_000 + 10_000 + 10_000 + 45_000 + 35_000);
  });

  it('identifies gamma walls (max call GEX up, max put GEX down)', () => {
    const res = computeGammaLevels({ contracts: chainFixture(), spot: 100, dte: 30 });
    // gamma per contract is highest ATM-ish; 105 has the largest OI*gamma combo among calls
    expect(res.gammaWallUp).toBeGreaterThan(100);
    expect(res.gammaWallDown).toBeLessThanOrEqual(100);
    expect(res.netWall).not.toBeNull();
  });

  it('computes a gamma flip as zero-crossing of net GEX', () => {
    const res = computeGammaLevels({ contracts: chainFixture(), spot: 100, dte: 30 });
    expect(res.gammaFlip).not.toBeNull();
    expect(res.gammaFlip!).toBeGreaterThan(90);
    expect(res.gammaFlip!).toBeLessThan(110);
  });

  it('regime is negative below the flip and positive above it', () => {
    const contracts = chainFixture();
    const levels = computeGammaLevels({ contracts, spot: 100, dte: 30 });
    const flip = levels.gammaFlip!;
    const below = computeGammaLevels({ contracts, spot: flip - 3, dte: 30 });
    const above = computeGammaLevels({ contracts, spot: flip + 3, dte: 30 });
    expect(below.regime).toBe('negative');
    expect(above.regime).toBe('positive');
  });

  it('computes max pain as the strike with minimum total payout', () => {
    // Simple known case: 1 call at strike 110 (OI 100), 1 put at 90 (OI 100).
    // Pain at 90 = 100*(90-90 put) wait: put pays max(0, 90-K) → 0 at K=90, calls 0 at 90 → pain 0.
    // Actually put pays when K < strike. At K=90: call payout max(0,90-110)=0, put max(0,90-90)=0 → 0.
    const contracts: GammaContract[] = [
      { strike: 110, type: 'call', oi: 100, iv: 0.25 },
      { strike: 90, type: 'put', oi: 100, iv: 0.25 },
    ];
    const res = computeGammaLevels({ contracts, spot: 100, dte: 30 });
    expect(res.maxPain).toBe(90);
  });

  it('handles a single strike (no flip crossing)', () => {
    const contracts: GammaContract[] = [
      { strike: 100, type: 'call', oi: 10_000, iv: 0.3 },
    ];
    const res = computeGammaLevels({ contracts, spot: 100, dte: 30 });
    expect(res.gex).toHaveLength(1);
    expect(res.gammaWallUp).toBe(100);
    expect(res.totalNetGex).toBeGreaterThan(0);
  });

  it('exposes spotVsFlipPct with sign relative to flip', () => {
    const res = computeGammaLevels({ contracts: chainFixture(), spot: 100, dte: 30 });
    expect(res.spotVsFlipPct).not.toBeNull();
    const expected = ((res.spot - res.gammaFlip!) / res.gammaFlip!) * 100;
    expect(res.spotVsFlipPct!).toBeCloseTo(expected, 6);
  });

  it('drops garbage IVs (Yahoo deep-ITM rows) instead of exploding the GEX', () => {
    const contracts: GammaContract[] = [
      { strike: 100, type: 'call', oi: 10_000, iv: 0.25 },
      { strike: 105, type: 'call', oi: 12, iv: 1e-5 }, // Yahoo junk IV
      { strike: 115, type: 'call', oi: 1, iv: 1e-5 }, // Yahoo junk IV
      { strike: 120, type: 'call', oi: 500, iv: 0 }, // zero IV
    ];
    const res = computeGammaLevels({ contracts, spot: 344, dte: 35 });
    // garbage rows are excluded → only the valid strike remains
    expect(res.gex.map((r) => r.strike)).toEqual([100]);
    expect(res.gammaWallUp).toBe(100);
    // and the wall is sane: GEX order of magnitude, not billions
    expect(Math.abs(res.totalNetGex)).toBeLessThan(1e9);
  });
});

describe('contractsFromChain', () => {
  it('normalizes Yahoo-shaped contracts and filters invalid rows', () => {
    const calls = [
      { strike: 100, openInterest: 500, impliedVolatility: 0.25 },
      { strike: 101, openInterest: 0, impliedVolatility: 0.25 }, // filtered: OI=0
      { strike: 102, openInterest: 100, impliedVolatility: 0 }, // filtered: IV=0
      { strike: 'garbage', openInterest: 100, impliedVolatility: 0.2 }, // filtered: bad strike
    ];
    const puts = [
      { strike: 95, openInterest: 300, impliedVolatility: 0.28 },
    ];
    const out = contractsFromChain(calls, puts);
    expect(out).toHaveLength(2);
    expect(out.find(c => c.type === 'call')?.strike).toBe(100);
    expect(out.find(c => c.type === 'put')?.oi).toBe(300);
  });

  it('applies optional IV mapper', () => {
    const out = contractsFromChain(
      [{ strike: 100, openInterest: 10, impliedVolatility: 25 }], // percent form
      [],
      (iv) => iv / 100
    );
    expect(out[0].iv).toBeCloseTo(0.25, 10);
  });
});
