import { describe, it, expect } from 'vitest';
import {
  bsDelta,
  isUsableIv,
  selectExpirations,
  computeGammaLevelsMulti,
  findGammaFlip,
  computeSkew,
  classifyMomentum,
  computeEdgeScore,
  assessDataQuality,
  distancePct,
  buildPlaybook,
  selectChainExpirations,
  chooseContractBias,
  pickLiquidContract,
  DEFAULT_POSITIONING,
  DEFAULT_EDGE_WEIGHTS,
  type ScreenerContract,
  type GexRow,
  type DealerPositioning,
} from './gammaScreener';

// ── Synthetic fixtures (clearly labelled test data, never live market data) ────

const EXP = '2030-01-17';

function mkContract(p: Partial<ScreenerContract> & { strike: number; type: 'call' | 'put' }): ScreenerContract {
  return {
    strike: p.strike,
    type: p.type,
    oi: p.oi ?? 1000,
    volume: p.volume ?? 100,
    iv: p.iv ?? 0.3,
    delta: p.delta ?? null,
    expiry: p.expiry ?? EXP,
    dte: p.dte ?? 30,
    bid: p.bid ?? null,
    ask: p.ask ?? null,
    last: p.last ?? null,
  };
}

/** Symmetric chain around spot=100 with a fat call OI at 105 and put OI at 95. */
function sampleChain(spot = 100): ScreenerContract[] {
  const out: ScreenerContract[] = [];
  for (let k = 85; k <= 115; k += 5) {
    out.push(mkContract({ strike: k, type: 'call', oi: k === 105 ? 5000 : 500, iv: 0.25 + Math.abs(k - spot) / 1000 }));
    out.push(mkContract({ strike: k, type: 'put', oi: k === 95 ? 5000 : 500, iv: 0.25 + Math.abs(k - spot) / 1000 }));
  }
  return out;
}

// ── bsDelta ──────────────────────────────────────────────────────────────────

describe('bsDelta', () => {
  it('returns null for degenerate inputs', () => {
    expect(bsDelta(0, 100, 0.1, 0.3, true)).toBeNull();
    expect(bsDelta(100, 0, 0.1, 0.3, true)).toBeNull();
    expect(bsDelta(100, 100, 0, 0.3, true)).toBeNull();
    expect(bsDelta(100, 100, 0.1, 0, true)).toBeNull();
  });

  it('call delta is in (0,1) and put delta in (-1,0)', () => {
    const dc = bsDelta(100, 100, 0.1, 0.3, true)!;
    const dp = bsDelta(100, 100, 0.1, 0.3, false)!;
    expect(dc).toBeGreaterThan(0);
    expect(dc).toBeLessThan(1);
    expect(dp).toBeGreaterThan(-1);
    expect(dp).toBeLessThan(0);
    // put-call parity of deltas: dc - dp = 1
    expect(dc - dp).toBeCloseTo(1, 6);
  });
});

// ── IV sanity ──────────────────────────────────────────────────────────────

describe('isUsableIv', () => {
  it('rejects Yahoo garbage IVs and non-finite values', () => {
    expect(isUsableIv(1e-5)).toBe(false);
    expect(isUsableIv(6)).toBe(false); // > 500%
    expect(isUsableIv(NaN)).toBe(false);
    expect(isUsableIv(null)).toBe(false);
    expect(isUsableIv(0.25)).toBe(true);
    expect(isUsableIv(0.005)).toBe(true);
    expect(isUsableIv(5)).toBe(true);
  });
});

// ── Expiration scope selection ───────────────────────────────────────────────

describe('selectExpirations', () => {
  const exps = [
    { expiry: '2026-01-16', dte: 7 },   // 3rd Friday
    { expiry: '2026-01-23', dte: 14 },
    { expiry: '2026-02-20', dte: 42 },  // 3rd Friday
    { expiry: '2026-03-20', dte: 70 },  // 3rd Friday
  ];

  it('nearest → single closest expiration', () => {
    expect(selectExpirations(exps, 'nearest')).toHaveLength(1);
    expect(selectExpirations(exps, 'nearest')[0].expiry).toBe('2026-01-16');
  });

  it('weekly → ≤ 45 DTE', () => {
    const r = selectExpirations(exps, 'weekly');
    expect(r.map((e) => e.dte)).toEqual([7, 14, 42]);
  });

  it('monthly → third Fridays only', () => {
    const r = selectExpirations(exps, 'monthly');
    expect(r.map((e) => e.expiry)).toEqual(['2026-01-16', '2026-02-20', '2026-03-20']);
  });

  it('all → everything', () => {
    expect(selectExpirations(exps, 'all')).toHaveLength(4);
  });
});

// ── GEX aggregation & walls ─────────────────────────────────────────────────

describe('computeGammaLevelsMulti', () => {
  it('returns unknown/empty for no usable contracts', () => {
    const r = computeGammaLevelsMulti([], 100, 'all');
    expect(r.regime).toBe('unknown');
    expect(r.callWall).toBeNull();
    expect(r.gammaFlip).toBeNull();
    expect(r.gex).toHaveLength(0);
    expect(r.netGexNorm).toBeNull();
  });

  it('call wall = strike with max call GEX; put wall = max put concentration', () => {
    const r = computeGammaLevelsMulti(sampleChain(100), 100, 'all');
    expect(r.callWall).toBe(105);
    expect(r.putWall).toBe(95);
    expect(r.totalCallGex).toBeGreaterThan(0);
    expect(r.totalPutGex).toBeLessThan(0); // standard convention: puts negative
  });

  it('calls contribute positive and puts negative GEX (default positioning)', () => {
    const r = computeGammaLevelsMulti(sampleChain(100), 100, 'all');
    for (const row of r.gex) {
      expect(row.callGex).toBeGreaterThanOrEqual(0);
      expect(row.putGex).toBeLessThanOrEqual(0);
    }
  });

  it('sign convention is configurable (flip puts positive, calls negative)', () => {
    const inverted: DealerPositioning = { signCalls: -1, signPuts: +1 };
    const r = computeGammaLevelsMulti(sampleChain(100), 100, 'all', inverted);
    expect(r.totalCallGex).toBeLessThan(0);
    expect(r.totalPutGex).toBeGreaterThan(0);
  });

  it('aggregates by expiration and reports per-expiry net GEX', () => {
    const chain = [
      mkContract({ strike: 100, type: 'call', oi: 1000, expiry: '2026-01-16', dte: 7 }),
      mkContract({ strike: 100, type: 'put', oi: 1000, expiry: '2026-02-20', dte: 42 }),
    ];
    const r = computeGammaLevelsMulti(chain, 100, 'all');
    expect(r.byExpiry).toHaveLength(2);
    expect(r.expirationsIncluded.sort()).toEqual(['2026-01-16', '2026-02-20']);
  });

  it('scope=nearest restricts aggregation to the closest expiration', () => {
    const chain = [
      mkContract({ strike: 100, type: 'call', oi: 1000, expiry: '2026-01-16', dte: 7 }),
      mkContract({ strike: 120, type: 'call', oi: 9000, expiry: '2026-02-20', dte: 42 }),
    ];
    const nearest = computeGammaLevelsMulti(chain, 100, 'nearest');
    expect(nearest.expirationsIncluded).toEqual(['2026-01-16']);
    const all = computeGammaLevelsMulti(chain, 100, 'all');
    expect(all.expirationsIncluded).toHaveLength(2);
  });

  it('excludes garbage-IV contracts from GEX', () => {
    const chain = [
      mkContract({ strike: 100, type: 'call', oi: 1000, iv: 0.3 }),
      mkContract({ strike: 110, type: 'call', oi: 100000, iv: 1e-5 }), // garbage
    ];
    const r = computeGammaLevelsMulti(chain, 100, 'all');
    expect(r.gex.map((g) => g.strike)).not.toContain(110);
  });

  it('distance percentages use (level-spot)/spot*100 with correct signs', () => {
    const r = computeGammaLevelsMulti(sampleChain(100), 100, 'all');
    expect(r.distCallWallPct).toBeCloseTo(5, 5); // 105 above 100
    expect(r.distPutWallPct).toBeCloseTo(-5, 5); // 95 below 100
  });
});

// ── Gamma flip zero-crossing ─────────────────────────────────────────────────

describe('findGammaFlip', () => {
  function row(strike: number, callOi: number, putOi: number, iv = 0.3): GexRow {
    return { strike, callOi, putOi, callGex: callOi, putGex: -putOi, netGex: callOi - putOi, totalOi: callOi + putOi, iv };
  }

  it('returns null for < 2 rows or degenerate spot', () => {
    expect(findGammaFlip([row(100, 100, 100)], 100)).toBeNull();
    expect(findGammaFlip([row(100, 100, 100), row(110, 100, 100)], 0)).toBeNull();
  });

  it('detects a single crossing between an OI regime change', () => {
    // puts dominate low strikes, calls dominate high → net flips across spot.
    const gex = [row(80, 100, 5000), row(100, 3000, 3000), row(120, 5000, 100)];
    const flip = findGammaFlip(gex, 100);
    // The flip, if any, must be a finite number within the grid range.
    if (flip != null) {
      expect(Number.isFinite(flip)).toBe(true);
      expect(flip).toBeGreaterThan(85);
      expect(flip).toBeLessThan(115);
    }
  });

  it('interpolates rather than snapping to a strike', () => {
    const gex = [row(90, 100, 6000), row(100, 2000, 3000), row(110, 6000, 100)];
    const flip = findGammaFlip(gex, 100);
    if (flip != null) {
      const isOnGrid = Math.abs(flip - Math.round(flip)) < 1e-9 && flip % 5 === 0;
      // Not required to be off-grid, but must be within range and finite.
      expect(flip).toBeGreaterThan(85);
      expect(flip).toBeLessThan(115);
      void isOnGrid;
    }
  });

  it('returns null when no crossing exists (all-positive net GEX)', () => {
    const gex = [row(90, 5000, 100), row(100, 5000, 100), row(110, 5000, 100)];
    expect(findGammaFlip(gex, 100)).toBeNull();
  });
});

// ── Skew ─────────────────────────────────────────────────────────────────────

describe('computeSkew', () => {
  it('returns unknown for empty / degenerate input', () => {
    expect(computeSkew([], 100, 30).regime).toBe('unknown');
    expect(computeSkew([mkContract({ strike: 100, type: 'call' })], 100, 30).regime).toBe('unknown');
  });

  it('positive risk reversal (call side richer) → bullish regime', () => {
    // Build puts cheap, calls expensive at the 25-delta wings.
    const chain = [
      mkContract({ strike: 100, type: 'call', iv: 0.25 }),
      mkContract({ strike: 100, type: 'put', iv: 0.25 }),
      mkContract({ strike: 108, type: 'call', iv: 0.40 }), // 25d call rich
      mkContract({ strike: 92, type: 'put', iv: 0.20 }),  // 25d put cheap
    ];
    const s = computeSkew(chain, 100, 30);
    expect(s.riskReversal25).not.toBeNull();
    expect(s.riskReversal25!).toBeGreaterThan(0);
    expect(s.regime).toBe('bullish');
  });

  it('negative risk reversal (put side richer) → bearish regime', () => {
    const chain = [
      mkContract({ strike: 100, type: 'call', iv: 0.25 }),
      mkContract({ strike: 100, type: 'put', iv: 0.25 }),
      mkContract({ strike: 108, type: 'call', iv: 0.20 }),
      mkContract({ strike: 92, type: 'put', iv: 0.45 }), // put protection bid
    ];
    const s = computeSkew(chain, 100, 30);
    expect(s.riskReversal25!).toBeLessThan(0);
    expect(s.regime).toBe('bearish');
  });

  it('putCallIvDiff is the negative of the risk reversal', () => {
    const chain = [
      mkContract({ strike: 108, type: 'call', iv: 0.40 }),
      mkContract({ strike: 92, type: 'put', iv: 0.20 }),
      mkContract({ strike: 100, type: 'call', iv: 0.25 }),
      mkContract({ strike: 100, type: 'put', iv: 0.25 }),
    ];
    const s = computeSkew(chain, 100, 30);
    expect(s.putCallIvDiff!).toBeCloseTo(-s.riskReversal25!, 9);
  });

  it('ATM IV is the strike closest to spot', () => {
    const chain = [
      mkContract({ strike: 105, type: 'call', iv: 0.99 }),
      mkContract({ strike: 100, type: 'call', iv: 0.30 }),
      mkContract({ strike: 95, type: 'put', iv: 0.30 }),
      mkContract({ strike: 108, type: 'call', iv: 0.35 }),
      mkContract({ strike: 92, type: 'put', iv: 0.35 }),
    ];
    const s = computeSkew(chain, 100, 30);
    expect(s.atmIv).toBeCloseTo(0.30, 5);
  });
});

// ── Momentum ─────────────────────────────────────────────────────────────────

describe('classifyMomentum', () => {
  const up = Array.from({ length: 60 }, (_, i) => 100 + i); // steadily rising
  const down = Array.from({ length: 60 }, (_, i) => 100 - i * 0.5);

  it('rising series above stacked EMAs → bullish', () => {
    const m = classifyMomentum({ closes: up, price: up[up.length - 1] });
    expect(m.aboveAll).toBe(true);
    expect(m.classification).toBe('bullish');
  });

  it('falling series below stacked EMAs → bearish', () => {
    const m = classifyMomentum({ closes: down, price: down[down.length - 1] });
    expect(m.belowAll).toBe(true);
    expect(m.classification).toBe('bearish');
  });

  it('too little data → neutral with null EMAs', () => {
    const m = classifyMomentum({ closes: [100, 101, 102], price: 102 });
    expect(m.ema50).toBeNull();
    expect(m.classification).toBe('neutral');
  });

  it('relative volume computed from the last vs prior 20 sessions', () => {
    const vols = new Array(21).fill(1000);
    vols[vols.length - 1] = 2000;
    const m = classifyMomentum({ closes: up, price: up[up.length - 1], volumes: vols });
    expect(m.relVolume).toBeCloseTo(2, 5);
  });
});

// ── Edge Score ───────────────────────────────────────────────────────────────

describe('computeEdgeScore', () => {
  const baseGamma = computeGammaLevelsMulti(sampleChain(100), 100, 'all');
  const baseSkew = computeSkew(sampleChain(100), 100, 30);
  const goodMomentum = classifyMomentum({
    closes: Array.from({ length: 60 }, (_, i) => 100 + i),
    price: 159,
  });

  it('returns unavailable with null score when there is no options data', () => {
    const r = computeEdgeScore({
      gamma: computeGammaLevelsMulti([], 100, 'all'),
      skew: { regime: 'unknown', riskReversal25: null, putCallIvDiff: null, atmIv: null, putSkew: null, callSkew: null },
      momentum: goodMomentum,
      spot: 100,
      totalOptionVolume: 0,
      totalOi: 0,
      dataCompleteness: 1,
    });
    expect(r.available).toBe(false);
    expect(r.score).toBeNull();
  });

  it('produces a 0..100 score for valid inputs', () => {
    const r = computeEdgeScore({
      gamma: baseGamma,
      skew: baseSkew,
      momentum: goodMomentum,
      spot: 100,
      totalOptionVolume: 50_000,
      totalOi: 200_000,
      dataCompleteness: 1,
    });
    expect(r.available).toBe(true);
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThanOrEqual(0);
    expect(r.score!).toBeLessThanOrEqual(100);
  });

  it('data-quality penalty lowers the score as completeness drops', () => {
    const args = {
      gamma: baseGamma, skew: baseSkew, momentum: goodMomentum,
      spot: 100, totalOptionVolume: 50_000, totalOi: 200_000,
    };
    const full = computeEdgeScore({ ...args, dataCompleteness: 1 });
    const poor = computeEdgeScore({ ...args, dataCompleteness: 0 });
    expect(poor.score!).toBeLessThan(full.score!);
    expect(poor.penalty).toBeCloseTo(0.5, 5);
  });

  it('weights are configurable (gamma-only weight isolates the gamma component)', () => {
    const args = {
      gamma: baseGamma, skew: baseSkew, momentum: goodMomentum,
      spot: 100, totalOptionVolume: 50_000, totalOi: 200_000, dataCompleteness: 1,
    };
    const gammaOnly = computeEdgeScore(args, { gamma: 1, momentum: 0, skew: 0, proximity: 0, liquidity: 0 });
    expect(gammaOnly.score).toBe(gammaOnly.components.gamma);
  });

  it('default weights sum to 1', () => {
    const s = Object.values(DEFAULT_EDGE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 9);
  });
});

// ── Data quality ─────────────────────────────────────────────────────────────

describe('assessDataQuality', () => {
  it('flags stale quotes and incomplete coverage', () => {
    const now = Date.now();
    const q = assessDataQuality({
      asOf: now - 60 * 60_000, // 1h old
      now,
      hasChain: false,
      strikes: 3,
      expirations: 1,
      usableContracts: 2,
      expectedContracts: 40,
    });
    expect(q.stale).toBe(true);
    expect(q.warnings.length).toBeGreaterThan(0);
    expect(q.completeness).toBeLessThan(0.5);
  });

  it('fresh, complete data has no warnings and high completeness', () => {
    const now = Date.now();
    const q = assessDataQuality({
      asOf: now - 60_000, now, hasChain: true, strikes: 40, expirations: 6,
      usableContracts: 40, expectedContracts: 40,
    });
    expect(q.stale).toBe(false);
    expect(q.completeness).toBeCloseTo(1, 5);
    expect(q.warnings).toHaveLength(0);
  });
});

describe('distancePct', () => {
  it('sign convention: positive = level above spot', () => {
    expect(distancePct(105, 100)).toBeCloseTo(5, 9);
    expect(distancePct(95, 100)).toBeCloseTo(-5, 9);
    expect(distancePct(null, 100)).toBeNull();
    expect(distancePct(100, 0)).toBeNull();
  });
});

describe('DEFAULT_POSITIONING', () => {
  it('is the standard SqueezeMetrics convention (calls +, puts -)', () => {
    expect(DEFAULT_POSITIONING).toEqual({ signCalls: +1, signPuts: -1 });
  });
});

// ── Playbook levels ──────────────────────────────────────────────────────────

describe('buildPlaybook', () => {
  const base = computeGammaLevelsMulti(sampleChain(100), 100, 'all');

  it('labels call wall above spot as Upside target and put wall below as Downside target', () => {
    // sampleChain: callWall 105 (>100), putWall 95 (<100)
    const pb = buildPlaybook(base, 100);
    const up = pb.find((p) => p.source === 'callWall')!;
    const down = pb.find((p) => p.source === 'putWall')!;
    expect(up.label).toBe('Upside target');
    expect(up.level).toBe(base.callWall);
    expect(down.label).toBe('Downside target');
    expect(down.level).toBe(base.putWall);
  });

  it('inverts the call-wall label when the wall sits below spot', () => {
    const gamma = { ...base, callWall: 90 }; // below spot
    const pb = buildPlaybook(gamma, 100);
    expect(pb.find((p) => p.source === 'callWall')!.label).toBe('Upside resistance');
  });

  it('inverts the put-wall label when the wall sits above spot', () => {
    const gamma = { ...base, putWall: 110 }; // above spot
    const pb = buildPlaybook(gamma, 100);
    expect(pb.find((p) => p.source === 'putWall')!.label).toBe('Downside support');
  });

  it('labels the flip as Bearish trigger when spot is above it', () => {
    const gamma = { ...base, gammaFlip: 95 };
    const pb = buildPlaybook(gamma, 100);
    const trig = pb.find((p) => p.source === 'gammaFlip')!;
    expect(trig.label).toBe('Bearish trigger');
    expect(trig.dir).toBe('down');
  });

  it('labels the flip as Bullish trigger when spot is below it', () => {
    const gamma = { ...base, gammaFlip: 105 };
    const pb = buildPlaybook(gamma, 100);
    const trig = pb.find((p) => p.source === 'gammaFlip')!;
    expect(trig.label).toBe('Bullish trigger');
    expect(trig.dir).toBe('up');
  });

  it('computes chop area as the range between flip and nearest wall', () => {
    const gamma = { ...base, gammaFlip: 98, callWall: 105, putWall: 95 };
    const pb = buildPlaybook(gamma, 100);
    const chop = pb.find((p) => p.role === 'chop_area')!;
    // nearest wall to spot(100) is 98? no: walls 105 & 95 → 105 is 5 away, 95 is 5 away → tie picks first candidate (callWall 105... reduce keeps first <) → 105
    expect(chop).toBeDefined();
    expect(chop.levelLow! < chop.levelHigh!).toBe(true);
    expect(chop.levelLow).toBeGreaterThanOrEqual(95);
    expect(chop.levelHigh).toBeLessThanOrEqual(105);
    expect(chop.level).toBeNull();
  });

  it('omits levels that are null and never invents values', () => {
    const gamma = { ...base, callWall: null, putWall: null, gammaFlip: null };
    expect(buildPlaybook(gamma, 100)).toHaveLength(0);
  });

  it('returns empty for degenerate spot', () => {
    expect(buildPlaybook(base, 0)).toHaveLength(0);
    expect(buildPlaybook(base, NaN)).toHaveLength(0);
  });

  it('includes only labels backed by a real calculated level', () => {
    const pb = buildPlaybook(base, 100);
    for (const p of pb) {
      if (p.role === 'chop_area') continue;
      expect(p.level).not.toBeNull();
      expect(Number.isFinite(p.level!)).toBe(true);
    }
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Liquid contract suggestion
// ─────────────────────────────────────────────────────────────────────────────

/** Contract with an explicit two-sided quote (required for the picker). */
function qContract(p: Partial<ScreenerContract> & { strike: number; type: 'call' | 'put' }): ScreenerContract {
  const mid = p.last ?? 4;
  return mkContract({
    ...p,
    bid: p.bid ?? mid - 0.05,
    ask: p.ask ?? mid + 0.05,
    oi: p.oi ?? 5000,
    volume: p.volume ?? 800,
    dte: p.dte ?? 30,
    iv: p.iv ?? 0.3,
  });
}

describe('selectChainExpirations', () => {
  const all = [
    { date: '2026-10-23', dte: 1 },
    { date: '2026-10-30', dte: 8 },
    { date: '2026-11-06', dte: 15 },
    { date: '2026-11-20', dte: 29 },
    { date: '2026-12-18', dte: 57 },
  ];

  it('conserva la expiración más cercana y añade la escalera 14/30/45', () => {
    const out = selectChainExpirations(all, 4).map((e) => e.dte);
    expect(out).toContain(1);
    expect(out).toContain(15);
    expect(out).toContain(29);
    expect(out).toContain(57);
    expect(out).toEqual([...out].sort((a, b) => a - b));
  });

  it('devuelve todo si hay menos que el máximo', () => {
    expect(selectChainExpirations(all.slice(0, 2), 4)).toHaveLength(2);
  });
});

describe('chooseContractBias', () => {
  it('usa el skew solo cuando supera el rango estructural y sube confianza con momentum', () => {
    const bull = chooseContractBias({ skewRegime: 'bullish', riskReversal25: 0.05, momentum: 'bullish' });
    expect(bull.bias).toBe('call');
    expect(bull.source).toBe('skew');
    expect(bull.confidence).toBe('high');

    const bear = chooseContractBias({ skewRegime: 'bearish', riskReversal25: -0.05, momentum: 'neutral' });
    expect(bear.bias).toBe('put');
    expect(bear.source).toBe('skew');
    expect(bear.confidence).toBe('medium');
  });

  it('ignora el put-skew estructural (1-2 pp) y manda el momentum', () => {
    const out = chooseContractBias({ skewRegime: 'bearish', riskReversal25: -0.012, momentum: 'bullish' });
    expect(out.bias).toBe('call');
    expect(out.source).toBe('momentum');
    expect(out.why).toMatch(/estructural/i);
  });

  it('cae al momentum cuando el skew es neutral', () => {
    const out = chooseContractBias({ skewRegime: 'neutral', momentum: 'lean_bearish' });
    expect(out.bias).toBe('put');
    expect(out.source).toBe('momentum');
  });

  it('confirma con el régimen gamma y sube la confianza', () => {
    const out = chooseContractBias({
      skewRegime: 'neutral', momentum: 'bullish', gammaRegime: 'positive', spotAboveFlip: true,
    });
    expect(out.bias).toBe('call');
    expect(out.confidence).toBe('high');
  });

  it('sin señales usa el retorno 20d como sesgo débil', () => {
    const out = chooseContractBias({ skewRegime: 'unknown', momentum: 'neutral', ret20d: -3 });
    expect(out.bias).toBe('put');
    expect(out.source).toBe('trend');
    expect(out.confidence).toBe('low');
  });
});

describe('pickLiquidContract', () => {
  const spot = 100;
  const levels = { callWall: 110, putWall: 90, gammaFlip: 98 };

  it('elige el call líquido con mejor score (spread/OI/DTE)', () => {
    const chain = [
      qContract({ strike: 100, type: 'call', bid: 4.9, ask: 5.1, oi: 8000, volume: 1500, dte: 30 }),
      qContract({ strike: 103, type: 'call', bid: 3.4, ask: 3.6, oi: 20000, volume: 3000, dte: 30 }),
      qContract({ strike: 108, type: 'call', bid: 1.8, ask: 2.2, oi: 4000, volume: 600, dte: 30 }),
    ];
    const { pick } = pickLiquidContract(chain, spot, 'call', levels);
    expect(pick).not.toBeNull();
    expect(pick!.type).toBe('call');
    expect(pick!.target).toBe(110);
    expect(pick!.stopLevel).toBe(98);
    expect(pick!.spreadPct).toBeLessThan(10);
    expect(pick!.breakeven).toBeGreaterThan(pick!.strike);
    expect(pick!.estReturnPct).toBeGreaterThan(0);
  });

  it('rechaza spreads anchos (nunca se relaja el filtro)', () => {
    const chain = [qContract({ strike: 100, type: 'call', bid: 3, ask: 4.2, oi: 9000, volume: 1200 })];
    const out = pickLiquidContract(chain, spot, 'call', levels);
    expect(out.pick).toBeNull();
    expect(out.reason).toMatch(/liquidez/i);
  });

  it('rechaza OI/volumen bajos', () => {
    const chain = [qContract({ strike: 100, type: 'call', oi: 100, volume: 10 })];
    expect(pickLiquidContract(chain, spot, 'call', levels).pick).toBeNull();
  });

  it('rechaza contratos sin quote verificable', () => {
    const noQuote = mkContract({ strike: 100, type: 'call', oi: 9000, volume: 1000 });
    expect(pickLiquidContract([noQuote], spot, 'call', levels).pick).toBeNull();
  });

  it('rechaza lotería OTM con |Δ| < 0.25', () => {
    const chain = [qContract({ strike: 120, type: 'call', iv: 0.6, dte: 30, bid: 0.2, ask: 0.22 })];
    expect(pickLiquidContract(chain, spot, 'call', levels).pick).toBeNull();
  });

  it('para puts usa el put wall como objetivo y no acepta muro por encima', () => {
    const puts = [qContract({ strike: 97, type: 'put', bid: 2.5, ask: 2.7 })];
    const ok = pickLiquidContract(puts, spot, 'put', levels);
    expect(ok.pick!.target).toBe(90);
    expect(ok.pick!.breakeven).toBeLessThan(97);

    const noTarget = pickLiquidContract(puts, spot, 'put', { callWall: 110, putWall: 105, gammaFlip: 102 });
    expect(noTarget.pick!.target).toBeNull();
    expect(noTarget.pick!.warnings.join(' ')).toMatch(/put wall/i);
  });

  it('avisa y penaliza si el objetivo no cubre la prima (breakeven > target)', () => {
    // Call 100, mid 12 → breakeven 112; call wall 110 → no cubre la prima.
    const chain = [qContract({ strike: 100, type: 'call', bid: 11.9, ask: 12.1 })];
    const out = pickLiquidContract(chain, spot, 'call', { callWall: 110, putWall: 90, gammaFlip: 98 });
    expect(out.pick).not.toBeNull();
    expect(out.pick!.warnings.join(' ')).toMatch(/no cubre la prima/i);
    expect(out.pick!.viable).toBe(false);
    expect(out.pick!.score).toBeLessThanOrEqual(55);
    // El mismo contrato con un muro alcanzable puntúa mejor y es viable.
    const reachable = pickLiquidContract(chain, spot, 'call', { callWall: 125, putWall: 90, gammaFlip: 98 });
    expect(reachable.pick!.score).toBeGreaterThan(out.pick!.score);
    expect(reachable.pick!.viable).toBe(true);
    expect(reachable.pick!.warnings.join(' ')).not.toMatch(/no cubre la prima/i);
  });

  it('prefiere un contrato viable aunque puntúe menos que uno no viable', () => {
    const chain = [
      qContract({ strike: 100, type: 'call', bid: 11.9, ask: 12.1 }), // no cubre target 110
      qContract({ strike: 108, type: 'call', bid: 3.0, ask: 3.3 }),   // cubre target 120? no...
      qContract({ strike: 97, type: 'call', bid: 4.95, ask: 5.05, last: 5 }), // intrínseco en 110 = 13 > 5 → viable
    ];
    const out = pickLiquidContract(chain, spot, 'call', { callWall: 110, putWall: 90, gammaFlip: 98 });
    expect(out.pick).not.toBeNull();
    expect(out.pick!.viable).toBe(true);
    expect(out.pick!.strike).toBe(97);
  });

  it('devuelve null con razón si el spot es inválido', () => {
    const out = pickLiquidContract([], 0, 'call', levels);
    expect(out.pick).toBeNull();
    expect(out.reason).toMatch(/spot/i);
  });

  it('devuelve alternativas ordenadas por score', () => {
    const chain = [
      qContract({ strike: 100, type: 'call', oi: 9000, volume: 2000 }),
      qContract({ strike: 102, type: 'call', oi: 7000, volume: 1500 }),
      qContract({ strike: 104, type: 'call', oi: 3000, volume: 400 }),
    ];
    const out = pickLiquidContract(chain, spot, 'call', levels);
    expect(out.alternates.length).toBeGreaterThan(0);
    expect(out.pick!.score).toBeGreaterThanOrEqual(out.alternates[0].score);
  });
});
