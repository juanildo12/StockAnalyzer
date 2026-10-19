import { describe, it, expect } from 'vitest';
import {
  computeRatio,
  computeBoth,
  aggregateContracts,
  ratioZone,
  percentileRank,
  type PcrContract,
} from './pcr';

const c = (type: 'call' | 'put', volume: number, openInterest: number): PcrContract => ({ type, volume, openInterest });

describe('computeRatio — volume basis', () => {
  it('is put volume / call volume', () => {
    const rows = [c('call', 1000, 500), c('put', 800, 400)];
    const r = computeRatio(rows, 'volume');
    expect(r.ratio).toBeCloseTo(0.8, 9);
    expect(r.putTotal).toBe(800);
    expect(r.callTotal).toBe(1000);
    expect(r.basis).toBe('volume');
    expect(r.denominatorZero).toBe(false);
  });

  it('does NOT use open interest for the volume basis', () => {
    const rows = [c('call', 100, 9999), c('put', 50, 1)];
    const r = computeRatio(rows, 'volume');
    expect(r.ratio).toBeCloseTo(0.5, 9);
  });
});

describe('computeRatio — open interest basis', () => {
  it('is put OI / call OI, independent from volume', () => {
    const rows = [c('call', 5, 2000), c('put', 9999, 1000)];
    const r = computeRatio(rows, 'openInterest');
    expect(r.ratio).toBeCloseTo(0.5, 9);
    expect(r.putTotal).toBe(1000);
    expect(r.callTotal).toBe(2000);
    expect(r.basis).toBe('openInterest');
  });

  it('volume and OI ratios are computed independently', () => {
    const rows = [c('call', 100, 1000), c('put', 300, 500)];
    const both = computeBoth(rows);
    expect(both.volume.ratio).toBeCloseTo(3, 9);
    expect(both.openInterest.ratio).toBeCloseTo(0.5, 9);
  });
});

describe('computeRatio — zero denominator', () => {
  it('returns null ratio when there are no calls (volume)', () => {
    const r = computeRatio([c('put', 500, 100)], 'volume');
    expect(r.ratio).toBeNull();
    expect(r.denominatorZero).toBe(true);
    expect(r.putTotal).toBe(500);
    expect(r.callTotal).toBe(0);
  });

  it('returns null ratio when calls have zero OI', () => {
    const r = computeRatio([c('put', 10, 100), c('call', 10, 0)], 'openInterest');
    expect(r.ratio).toBeNull();
    expect(r.denominatorZero).toBe(true);
  });

  it('ratio of 0 is valid when there are puts but no put activity', () => {
    const r = computeRatio([c('call', 500, 0), c('put', 0, 0)], 'volume');
    expect(r.ratio).toBe(0);
    expect(r.denominatorZero).toBe(false);
  });
});

describe('computeRatio — incomplete / empty data', () => {
  it('flags empty when no usable contracts', () => {
    const r = computeRatio([], 'volume');
    expect(r.empty).toBe(true);
    expect(r.ratio).toBeNull();
  });

  it('flags empty when contracts have non-finite volume', () => {
    const rows = [c('call', NaN, 0), c('put', Infinity as unknown as number, 0)];
    const r = computeRatio(rows, 'volume');
    expect(r.empty).toBe(true);
    expect(r.incomplete).toBe(true);
  });

  it('excludes rows with undefined volume and flags incomplete', () => {
    const rows = [
      { type: 'call', volume: 1000, openInterest: 10 } as PcrContract,
      { type: 'put', volume: undefined as unknown as number, openInterest: 10 } as PcrContract,
      { type: 'put', volume: 500, openInterest: 10 } as PcrContract,
    ];
    const r = computeRatio(rows, 'volume');
    expect(r.incomplete).toBe(true);
    expect(r.putTotal).toBe(500); // the undefined put is dropped
    expect(r.ratio).toBeCloseTo(0.5, 9);
  });

  it('treats negative values as zero', () => {
    const r = computeRatio([c('call', -5, 0), c('put', 10, 0)], 'volume');
    expect(r.callTotal).toBe(0);
    expect(r.denominatorZero).toBe(true);
  });
});

describe('aggregateContracts', () => {
  it('flattens multiple symbol rows preserving types', () => {
    const group = aggregateContracts([
      [c('call', 100, 10), c('put', 50, 5)],
      [c('call', 200, 20), c('put', 150, 15)],
    ]);
    expect(group.length).toBe(4);
    const r = computeRatio(group, 'volume');
    expect(r.putTotal).toBe(200);
    expect(r.callTotal).toBe(300);
    expect(r.ratio).toBeCloseTo(200 / 300, 9);
  });

  it('group ratio is sum-of-parts, not average of ratios', () => {
    // Symbol A: 1.0, Symbol B: 3.0. Naive average = 2.0; correct = 400/300.
    const group = aggregateContracts([
      [c('call', 100, 0), c('put', 100, 0)],
      [c('call', 100, 0), c('put', 300, 0)],
    ]);
    const r = computeRatio(group, 'volume');
    expect(r.ratio).toBeCloseTo(400 / 200, 9);
  });
});

describe('ratioZone', () => {
  it('labels by distance from neutral 1.0 without asserting direction', () => {
    expect(ratioZone(0.5)).toBe('low');
    expect(ratioZone(1.0)).toBe('balanced');
    expect(ratioZone(1.5)).toBe('high');
    expect(ratioZone(null)).toBe('na');
  });
});

describe('percentileRank', () => {
  it('returns null with insufficient history (<5 points)', () => {
    expect(percentileRank([1, 2, 3], 2)).toBeNull();
  });

  it('computes rank within the series', () => {
    const series = [0.5, 0.7, 0.9, 1.1, 1.3, 1.5];
    expect(percentileRank(series, 1.5)).toBe(100);
    expect(percentileRank(series, 0.5)).toBe(17);
    expect(percentileRank(series, 0.9)).toBe(50);
  });

  it('is null for a null value', () => {
    expect(percentileRank([1, 2, 3, 4, 5], null)).toBeNull();
  });
});
