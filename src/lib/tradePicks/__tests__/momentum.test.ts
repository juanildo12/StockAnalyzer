import { describe, expect, it } from 'vitest';
import { detectSetup, detectShortSetup, emaState } from '../momentum';

function build(
  upTo: number,
  pole: (i: number) => number,
  base: (i: number) => [number, number, number],
  tail: (i: number) => [number, number, number, number]
) {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < 60; i++) {
    if (i < upTo) {
      const c = pole(i);
      closes.push(c);
      highs.push(c + 1);
      lows.push(c - 1);
      volumes.push(100);
    } else if (i < 55) {
      const [c, h, l] = base(i);
      closes.push(c);
      highs.push(h);
      lows.push(l);
      volumes.push(60);
    } else {
      const [c, h, l, v] = tail(i);
      closes.push(c);
      highs.push(h);
      lows.push(l);
      volumes.push(v);
    }
  }
  return { closes, highs, lows, volumes };
}

describe('emaState', () => {
  it('serie alcista → priceAboveAll + stacked', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const e = emaState(closes);
    expect(e.priceAboveAll).toBe(true);
    expect(e.stacked).toBe(true);
    expect(e.priceBelowAll).toBe(false);
    expect(e.stackedDown).toBe(false);
  });

  it('serie bajista → priceBelowAll + stackedDown', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i);
    const e = emaState(closes);
    expect(e.priceBelowAll).toBe(true);
    expect(e.stackedDown).toBe(true);
    expect(e.priceAboveAll).toBe(false);
    expect(e.stacked).toBe(false);
    expect(e.extFromEma8).toBeLessThan(0);
  });
});

describe('detectShortSetup', () => {
  it('ruptura confirmada del soporte de la base', () => {
    // pole descendente 160→103, base 98..102, cierra en 96 (rompe)
    const { closes, highs, lows, volumes } = build(
      40,
      (i) => 160 - (57 / 39) * i,
      () => [100, 102, 98],
      (i) => (i === 55 ? [96, 97, 95, 300] : [95, 96, 94, 150])
    );
    const s = detectShortSetup(closes, highs, lows, volumes);
    expect(s).not.toBeNull();
    expect(s!.state).toBe('confirmed');
    expect(s!.trigger).toBeCloseTo(98, 1);
    expect(s!.baseHigh).toBeCloseTo(102, 1);
    expect(s!.distToTriggerPct).toBeLessThan(0);
    expect(s!.poleHeight).toBeGreaterThan(0);
  });

  it('cerca del soporte (near, ≤3%)', () => {
    // base plana cerca del mínimo, sin romper
    const { closes, highs, lows, volumes } = build(
      40,
      (i) => 160 - (57 / 39) * i,
      (i) => [i % 2 === 0 ? 99 : 98, 101, 97],
      () => [98, 100, 97, 60]
    );
    const s = detectShortSetup(closes, highs, lows, volumes);
    expect(s).not.toBeNull();
    expect(s!.state).toBe('near');
    expect(s!.distToTriggerPct).toBeGreaterThan(0);
    expect(s!.distToTriggerPct).toBeLessThanOrEqual(3);
  });

  it('sin contexto suficiente → null', () => {
    const closes = Array.from({ length: 30 }, () => 100);
    expect(detectShortSetup(closes, closes, closes, closes)).toBeNull();
  });
});

describe('detectSetup (largo, no regresión)', () => {
  it('ruptura confirmada al alza', () => {
    // pole ascendente 40→97, base 98..102, cierra en 104 (rompe arriba)
    const { closes, highs, lows, volumes } = build(
      40,
      (i) => 40 + (57 / 39) * i,
      () => [100, 102, 98],
      (i) => (i === 55 ? [104, 105, 103, 300] : [105, 106, 104, 150])
    );
    const s = detectSetup(closes, highs, lows, volumes);
    expect(s).not.toBeNull();
    expect(s!.state).toBe('confirmed');
    expect(s!.trigger).toBeCloseTo(102, 1);
    expect(s!.baseLow).toBeCloseTo(98, 1);
  });
});
