import { describe, it, expect } from 'vitest';
import {
  priceOptionAt,
  assessTradeQuality,
  computePremiumRiskBenefit,
  contractsForRisk,
  breakevenPrice,
  expectedMovePct,
  type PremiumRiskInput,
} from './tradeRisk';

const base = (over: Partial<PremiumRiskInput> = {}): PremiumRiskInput => ({
  entry: 100,
  stop: 98,
  target: 104,
  strike: 100,
  premium: 2.5,
  iv: 0,
  dte: 30,
  isCall: true,
  delta: 0.5,
  ...over,
});

describe('priceOptionAt', () => {
  it('uses delta linearity when IV is missing', () => {
    // 2.5 + 0.5 * (104 - 100) = 4.5
    expect(priceOptionAt(base(), 104, 100)).toBeCloseTo(4.5, 6);
  });

  it('never returns less than intrinsic for a deep ITM call', () => {
    const p = priceOptionAt(base({ iv: 0, delta: 0.1 }), 150, 100);
    expect(p).toBeGreaterThanOrEqual(50);
  });

  it('handles puts symmetrically', () => {
    // 2.5 + 0.5 * (102 - 100) = 3.5
    const p = priceOptionAt(base({ isCall: false, iv: 0, delta: 0.5 }), 102, 100);
    expect(p).toBeCloseTo(3.5, 6);
  });

  it('returns intrinsic only at expiry (dte 0)', () => {
    const p = priceOptionAt(base({ dte: 0, iv: 0, delta: 0.5 }), 110, 100);
    expect(p).toBeCloseTo(10, 6);
  });

  it('scales the Black-Scholes curve to the premium actually paid', () => {
    // En el stop (98) el intrínseco es 0 -> el escalado es limpio y proporcional.
    const a = priceOptionAt(base({ iv: 0.4, premium: 4.75 }), 98, 100);
    const b = priceOptionAt(base({ iv: 0.4, premium: 2.375 }), 98, 100);
    expect(a).toBeCloseTo(b * 2, 6);
  });

  it('keeps the premium R/R invariant to the price level (scale invariance)', () => {
    // Ambas primas están por encima del valor intrínseco del target -> sin floor.
    const r1 = computePremiumRiskBenefit(base({ iv: 0.4, premium: 4.75 }), { score: 90 });
    const r2 = computePremiumRiskBenefit(base({ iv: 0.4, premium: 6 }), { score: 90 });
    expect(r2.rrBase).toBeCloseTo(r1.rrBase!, 4);
  });

  it('never lets a scaled price fall below intrinsic', () => {
    // Prima de mercado baja: el precio escalado no puede bajar del intrínseco.
    const p = priceOptionAt(base({ iv: 0.4, premium: 2.375 }), 104, 100);
    expect(p).toBeGreaterThanOrEqual(4);
  });
});

describe('breakevenPrice', () => {
  it('is strike + premium for calls and strike - premium for puts', () => {
    expect(breakevenPrice(100, 2.5, true)).toBeCloseTo(102.5, 6);
    expect(breakevenPrice(100, 2.5, false)).toBeCloseTo(97.5, 6);
  });
});

describe('assessTradeQuality', () => {
  it('uses the score as the base factor', () => {
    const q = assessTradeQuality({ score: 80 });
    expect(q.factor).toBeCloseTo(0.8, 6);
    expect(q.label).toBe('alta');
    expect(q.reasons.length).toBe(1);
  });

  it('does NOT re-penalize frictions already included in the score', () => {
    // earnings / muro de OI / target inalcanzable / setup "near" ya están en el
    // score compuesto: aplicarlos otra vez sería doble conteo.
    const plain = assessTradeQuality({ score: 80 });
    const withFrictions = assessTradeQuality({
      score: 80,
      targetReachable: false,
      targetBlockedByOi: true,
      earningsSoon: true,
      setupState: 'near',
    });
    expect(withFrictions.factor).toBeCloseTo(plain.factor, 6);
    expect(withFrictions.reasons.length).toBe(1);
  });

  it('applies explicit extra adjustments when provided', () => {
    const q = assessTradeQuality({
      score: 80,
      adjustments: [{ label: 'Slippage de salida alto', factor: 0.9 }],
    });
    expect(q.factor).toBeCloseTo(0.72, 6);
    expect(q.reasons.length).toBe(2);
  });

  it('labels low quality as baja', () => {
    expect(assessTradeQuality({ score: 30 }).label).toBe('baja');
  });

  it('clamps the factor to 0..1', () => {
    expect(assessTradeQuality({ score: 150 }).factor).toBe(1);
    expect(assessTradeQuality({ score: -10 }).factor).toBe(0);
  });
});

describe('expectedMovePct', () => {
  it('is ADR x sqrt(dte)', () => {
    expect(expectedMovePct(2, 30)).toBeCloseTo(2 * Math.sqrt(30), 6);
  });

  it('returns null for invalid inputs', () => {
    expect(expectedMovePct(0, 30)).toBeNull();
    expect(expectedMovePct(2, 0)).toBeNull();
    expect(expectedMovePct(NaN, 30)).toBeNull();
  });
});

describe('computePremiumRiskBenefit', () => {
  it('computes risk and reward in premium terms', () => {
    const r = computePremiumRiskBenefit(base(), { score: 100 });
    // stop 98 -> prima 1.5 -> riesgo 1.0 por acción = $100 por contrato
    expect(r.stopPremium).toBeCloseTo(1.5, 6);
    expect(r.riskPerShare).toBeCloseTo(1.0, 6);
    expect(r.riskPerContract).toBeCloseTo(100, 6);
    // target 104 -> prima 4.5 -> beneficio 2.0 por acción = $200 por contrato
    expect(r.targetPremium).toBeCloseTo(4.5, 6);
    expect(r.rewardPerContract).toBeCloseTo(200, 6);
    expect(r.riskPct).toBeCloseTo(40, 6);
    expect(r.rewardPct).toBeCloseTo(80, 6);
    expect(r.rrBase).toBeCloseTo(2, 6);
  });

  it('weights the expected reward by the quality factor', () => {
    const r = computePremiumRiskBenefit(base(), { score: 50 });
    expect(r.rewardExpectedPerContract).toBeCloseTo(200 * 0.5, 6);
    expect(r.rrQuality).toBeCloseTo(1, 6);
  });

  it('flags when the target does not pay the premium', () => {
    const r = computePremiumRiskBenefit(base({ target: 99 }), { score: 90 });
    expect(r.targetDoesNotPay).toBe(true);
    expect(r.notes.some((n) => n.includes('no paga la prima'))).toBe(true);
  });

  it('flags when the target does not clear the breakeven', () => {
    // breakeven call = 100 + 2.5 = 102.5 -> target 101 no lo supera
    const r = computePremiumRiskBenefit(base({ target: 101 }), { score: 90 });
    expect(r.breakeven).toBeCloseTo(102.5, 6);
    expect(r.targetClearsBreakeven).toBe(false);
    expect(r.notes.some((n) => n.includes('breakeven'))).toBe(true);
  });

  it('flags a risk-free stop', () => {
    const r = computePremiumRiskBenefit(
      base({ stop: 130, target: 140 }),
      { score: 90 }
    );
    expect(r.riskFree).toBe(true);
    expect(r.rrBase).toBeNull();
    expect(r.rrQuality).toBeNull();
  });

  it('warns when the premium R/R is below 1', () => {
    const r = computePremiumRiskBenefit(base({ target: 103, stop: 96 }), { score: 90 });
    expect(r.rrBase).toBeLessThan(1);
    expect(r.notes.some((n) => n.includes('menor de 1'))).toBe(true);
  });

  it('warns when the trade quality is baja', () => {
    const r = computePremiumRiskBenefit(base(), { score: 20 });
    expect(r.quality.label).toBe('baja');
    expect(r.notes.some((n) => n.includes('Calidad baja'))).toBe(true);
  });

  it('uses Black-Scholes when IV is available (non linear pricing)', () => {
    const withIv = computePremiumRiskBenefit(base({ iv: 0.4 }), { score: 90 });
    const linear = computePremiumRiskBenefit(base({ iv: 0 }), { score: 90 });
    expect(withIv.stopPremium).not.toBeCloseTo(linear.stopPremium, 3);
  });

  it('agrees with the contract breakeven when the premium is paid', () => {
    const r = computePremiumRiskBenefit(base(), { score: 90 });
    expect(r.breakeven).toBeCloseTo(102.5, 6);
    expect(r.targetClearsBreakeven).toBe(true);
  });

  it('compares the breakeven move with the expected move (ADR x sqrt(dte))', () => {
    // breakeven 102.5 desde 100 -> +2.5%; ADR 3% en 30 dias -> ~16% esperado
    const r = computePremiumRiskBenefit(base(), { score: 90 }, { adrPct: 3 });
    expect(r.breakevenMovePct).toBeCloseTo(2.5, 6);
    expect(r.expectedMovePct).toBeCloseTo(3 * Math.sqrt(30), 6);
    expect(r.breakevenWithinExpectedMove).toBe(true);
  });

  it('warns when the breakeven is outside the expected move', () => {
    // breakeven 102.5 (+2.5%) vs ADR 0.2% en 30 dias -> ~1.1% esperado
    const r = computePremiumRiskBenefit(base(), { score: 90 }, { adrPct: 0.2 });
    expect(r.breakevenWithinExpectedMove).toBe(false);
    expect(r.notes.some((n) => n.includes('fuera del rango habitual'))).toBe(true);
  });

  it('leaves the expected move unknown when there is no ADR', () => {
    const r = computePremiumRiskBenefit(base(), { score: 90 });
    expect(r.expectedMovePct).toBeNull();
    expect(r.breakevenWithinExpectedMove).toBeNull();
  });
});

describe('contractsForRisk', () => {
  it('computes how many contracts fit in a risk budget', () => {
    expect(contractsForRisk(250, 500)).toBe(2);
    expect(contractsForRisk(250, 100)).toBe(0);
  });

  it('returns 0 for zero or invalid risk', () => {
    expect(contractsForRisk(0, 500)).toBe(0);
    expect(contractsForRisk(-10, 500)).toBe(0);
    expect(contractsForRisk(NaN, 500)).toBe(0);
  });

  it('returns 0 for a non-positive budget', () => {
    expect(contractsForRisk(250, 0)).toBe(0);
    expect(contractsForRisk(250, -5)).toBe(0);
  });
});
