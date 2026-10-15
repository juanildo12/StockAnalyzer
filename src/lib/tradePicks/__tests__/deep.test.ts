import { describe, expect, it } from 'vitest';
import {
  breadthAdjust,
  breakevenPrice,
  corpActionAdjustment,
  earningsInWindow,
  ivAdjustment,
  oiLevelsFromChain,
  peerRelativeStrength,
  realizedVol,
  swingLevels,
  tradeability,
} from '../deep';

describe('realizedVol', () => {
  it('retorna null con datos insuficientes', () => {
    expect(realizedVol([100, 101, 102])).toBeNull();
  });

  it('series plana → vol baja', () => {
    const closes = Array.from({ length: 30 }, () => 100);
    const rv = realizedVol(closes);
    expect(rv).not.toBeNull();
    expect(rv as number).toBeLessThan(0.05);
  });

  it('series ruidosa > serie plana', () => {
    const flat = Array.from({ length: 30 }, (_, i) => 100 + (i % 2) * 0.01);
    const wild = Array.from({ length: 30 }, (_, i) => 100 * Math.pow(1.03, i % 2 ? 1 : -1) * (1 + (i % 5) * 0.01));
    expect(realizedVol(wild)!).toBeGreaterThan(realizedVol(flat)!);
  });
});

describe('ivAdjustment', () => {
  it('sin IV → 0', () => {
    expect(ivAdjustment(null, 0.4)).toBe(0);
    expect(ivAdjustment(0, 0.4)).toBe(0);
  });

  it('IV > 200% → penalización fuerte', () => {
    expect(ivAdjustment(2.5, 0.5)).toBeLessThanOrEqual(-18);
  });

  it('IV ≈ RV → bonus', () => {
    expect(ivAdjustment(0.4, 0.38)).toBe(6);
  });

  it('IV muy por encima de RV → penaliza', () => {
    expect(ivAdjustment(0.8, 0.4)).toBe(-10); // ratio 2.0
    expect(ivAdjustment(1.5, 0.4)).toBeLessThanOrEqual(-18); // ratio 3.75
  });

  it('IV > RV pero sin RV conocida → penalización leve', () => {
    expect(ivAdjustment(1.3, null)).toBe(-6);
    expect(ivAdjustment(0.9, null)).toBe(0);
  });
});

describe('breakevenPrice / tradeability', () => {
  it('breakeven CALL = strike + prima', () => {
    expect(breakevenPrice(100, 2.5, true)).toBe(102.5);
  });

  it('breakeven PUT = strike − prima', () => {
    expect(breakevenPrice(100, 2.5, false)).toBe(97.5);
  });

  const base = {
    price: 100,
    target: 112,
    strike: 102,
    premium: 2,
    delta: 0.45,
    dte: 38,
    adr: 3,
    isCall: true,
  };

  it('target cubre breakeven → recibe puntos por breakeven', () => {
    const t = tradeability(base);
    expect(t.breakeven).toBe(104);
    expect(t.breakevenPct).toBeCloseTo(4, 5);
    expect(t.score).toBeGreaterThan(0);
  });

  it('breakeven por encima del target → sin puntos de breakeven ni retorno', () => {
    const t = tradeability({ ...base, target: 103, strike: 110, premium: 3 });
    expect(t.breakeven).toBe(113);
    expect(t.breakeven > 103).toBe(true);
    expect(t.expectedReturn).toBeLessThan(0);
    expect(t.score).toBeLessThan(10);
  });

  it('retorno esperado: delta*mov − prima sobre prima', () => {
    const t = tradeability(base);
    // 0.45 × 12 = 5.4; 5.4 − 2 = 3.4; /2 = 1.7
    expect(t.expectedReturn).toBeCloseTo(1.7, 5);
    expect(t.reachable).toBe(true); // breakeven 4% ≤ ADR 3% × √38 ≈ 18.5%
  });

  it('prima impagable con el target → expectedReturn < 0', () => {
    const t = tradeability({ ...base, premium: 6, strike: 105 });
    expect(t.expectedReturn).toBeLessThan(0);
    expect(t.score).toBeLessThan(24);
  });
});

describe('swingLevels', () => {
  it('detecta pivot high/low y filtra por dirección respecto al precio', () => {
    const highs = [10, 11, 12, 15, 12, 11, 10, 11, 12, 20, 12, 11, 12, 13, 14];
    const lows = highs.map((h) => h - 1);
    const sw = swingLevels(highs, lows, 12.5);
    expect(sw.resistances.every((r) => r > 12.5)).toBe(true);
    expect(sw.supports.every((s) => s < 12.5)).toBe(true);
    expect(sw.resistances).toContain(20);
  });

  it('agrupa niveles dentro del 2%', () => {
    const highs = Array(20).fill(10);
    // pivot manual: una barra 100 claramente alta entre vecinas bajas
    for (let i = 0; i < 20; i++) highs[i] = 10;
    highs[10] = 100;
    const lows = highs.map((h) => h - 5);
    const sw = swingLevels(highs as number[], lows as number[], 20);
    expect(sw.resistances.length).toBe(1);
    expect(sw.resistances[0]).toBe(100);
  });
});

describe('oiLevelsFromChain', () => {
  it('encuentra el muro de call y el de put', () => {
    const walls = oiLevelsFromChain({
      calls: [{ strike: 100, openInterest: 100 }, { strike: 105, openInterest: 9000 }, { strike: 110, openInterest: 500 }],
      puts: [{ strike: 95, openInterest: 7000 }, { strike: 90, openInterest: 1000 }],
    });
    expect(walls.callWall).toBe(105);
    expect(walls.putWall).toBe(95);
    expect(walls.callWallOi).toBe(9000);
  });

  it('cadena vacía → nulls', () => {
    const walls = oiLevelsFromChain({});
    expect(walls.callWall).toBeNull();
    expect(walls.putWall).toBeNull();
  });
});

describe('earningsInWindow', () => {
  const now = Date.UTC(2026, 9, 8);
  it('earnings dentro de la ventana del DTE → true', () => {
    expect(earningsInWindow(now + 10 * 86400000, 38, now)).toBe(true);
  });
  it('earnings pasados o fuera de la ventana → false', () => {
    expect(earningsInWindow(now - 86400000, 38, now)).toBe(false);
    expect(earningsInWindow(now + 60 * 86400000, 38, now)).toBe(false);
  });
  it('sin fecha → false', () => {
    expect(earningsInWindow(null, 38, now)).toBe(false);
    expect(earningsInWindow(undefined, 38, now)).toBe(false);
  });
});

describe('breadthAdjust', () => {
  it('amplitud sana suma, débil resta', () => {
    expect(breadthAdjust(70)).toBe(3);
    expect(breadthAdjust(55)).toBe(1);
    expect(breadthAdjust(40)).toBe(-3);
    expect(breadthAdjust(20)).toBe(-6);
    expect(breadthAdjust(null)).toBe(0);
  });
});

describe('peerRelativeStrength', () => {
  it('lidera a los pares → premio', () => {
    const r = peerRelativeStrength(12, [2, 4, 6]);
    expect(r.score).toBe(3);
    expect(r.rs).toBe(8);
    expect(r.medianPeerReturn).toBe(4);
  });

  it('rezagada vs pares → penalización', () => {
    const r = peerRelativeStrength(-4, [3, 5, 7]);
    expect(r.score).toBe(-6);
  });

  it('sin pares → neutral', () => {
    expect(peerRelativeStrength(5, []).score).toBe(0);
  });
});

describe('corpActionAdjustment', () => {
  it('ex-dividendo dentro del DTE → −1', () => {
    const r = corpActionAdjustment(38, 10, null);
    expect(r.score).toBe(-1);
    expect(r.reasons.length).toBe(1);
  });

  it('split reciente → −2', () => {
    expect(corpActionAdjustment(38, null, 5).score).toBe(-2);
  });

  it('ambos → tope −3', () => {
    expect(corpActionAdjustment(38, 3, 5).score).toBe(-3);
  });

  it('sin eventos → 0', () => {
    expect(corpActionAdjustment(38, 100, 200).score).toBe(0);
  });
});
