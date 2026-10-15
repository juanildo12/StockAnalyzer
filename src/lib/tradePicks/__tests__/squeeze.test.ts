import { describe, expect, it } from 'vitest';
import { avgVolume, computeSqueeze, daysToCover, shortPctFloat } from '../squeeze';

describe('daysToCover / shortPctFloat', () => {
  it('sin volumen/float → 0', () => {
    expect(daysToCover(1000, 0)).toBe(0);
    expect(shortPctFloat(1000, 0)).toBe(0);
  });

  it('calcula ratios', () => {
    expect(daysToCover(10e6, 2e6)).toBe(5);
    expect(shortPctFloat(10e6, 100e6)).toBe(10);
  });
});

describe('avgVolume', () => {
  it('ignora ceros y promedia las últimas N', () => {
    expect(avgVolume([0, 0, 100, 200, 300], 2)).toBe(250);
  });

  it('vacío → 0', () => {
    expect(avgVolume([])).toBe(0);
  });
});

describe('computeSqueeze', () => {
  it('setup extremo: DTC alto, float muy corto, float chico, volumen fuerte', () => {
    const r = computeSqueeze({
      shortInterest: 30e6,
      avgDailyVolume: 2e6, // DTC 15
      freeFloat: 40e6, // 75% del float
      price: 10,
      recentVolume: 6e6, // 3x
    });
    expect(r.signal).toBe('extreme');
    expect(r.score).toBe(100);
    expect(r.daysToCover).toBe(15);
    expect(r.shortPctFloat).toBe(75);
    expect(r.volumeSurge).toBe(3);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('sin señal: float enorme, poco corto, volumen normal', () => {
    const r = computeSqueeze({
      shortInterest: 1e6,
      avgDailyVolume: 10e6, // DTC 0.1
      freeFloat: 5e9, // 0.02%
      price: 100,
      recentVolume: 9e6, // <1x
    });
    expect(r.signal).toBe('low');
    expect(r.score).toBeLessThan(10);
  });

  it('sin float ni volumen: solo puntúa DTC', () => {
    const r = computeSqueeze({ shortInterest: 8e6, avgDailyVolume: 1e6, freeFloat: 0, price: 20 });
    expect(r.daysToCover).toBe(8);
    expect(r.score).toBe(32);
    expect(r.volumeSurge).toBe(0);
  });

  it('tolera entradas basura', () => {
    const r = computeSqueeze({ shortInterest: NaN, avgDailyVolume: -1, freeFloat: 0, price: 0 });
    expect(r.score).toBe(0);
    expect(r.signal).toBe('low');
  });
});
