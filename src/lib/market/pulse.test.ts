import { describe, expect, it } from 'vitest';
import {
  PULSE_SYMBOLS,
  PULSE_NOTES,
  bucketOf,
  buildMarketPulse,
  percentileOfLast,
  rollingPercentile,
  scoreZone,
  wilsonInterval,
  zoneLabel,
  type DailyClose,
  type PulseSeries,
} from './pulse';

function businessDates(n: number, start = '2015-01-05'): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const DATES = businessDates(620);

function bars(fn: (i: number) => number, dates = DATES): DailyClose[] {
  return dates.map((date, i) => ({ date, close: fn(i) }));
}

/** Precio con rango lateral ~560 sesiones y luego un régimen direccional. */
function regime(base: number, amp: number, drift: number, i: number, pivot = 560): number {
  const noise = 1 + amp * Math.sin(i / 9) + amp * 0.6 * Math.sin(i / 23);
  const k = Math.max(0, i - pivot);
  return base * noise * Math.pow(drift, k);
}

function seriesFor(kind: 'up' | 'down', dates = DATES): PulseSeries {
  const up = kind === 'up';
  const d = up ? 1.003 : 0.997;
  const vixFn = (i: number) => (i < 560 ? 18 + 2 * Math.sin(i / 11) : (up ? 12 : 32) + 1.5 * Math.sin(i / 7));
  return {
    [PULSE_SYMBOLS.spy]: bars((i) => regime(100, 0.02, d, i), dates),
    [PULSE_SYMBOLS.qqq]: bars((i) => regime(110, 0.02, up ? 1.0032 : 0.9968, i), dates),
    [PULSE_SYMBOLS.iwm]: bars((i) => regime(90, 0.025, up ? 1.0028 : 0.9972, i), dates),
    [PULSE_SYMBOLS.rsp]: bars((i) => regime(80, 0.02, up ? 1.0029 : 0.9971, i), dates),
    [PULSE_SYMBOLS.tlt]: bars((i) => regime(120, 0.015, up ? 0.999 : 1.0015, i), dates),
    [PULSE_SYMBOLS.hyg]: bars((i) => regime(85, 0.01, up ? 1.001 : 0.998, i), dates),
    [PULSE_SYMBOLS.ief]: bars((i) => regime(105, 0.006, 1.0001, i), dates),
    [PULSE_SYMBOLS.gld]: bars((i) => regime(150, 0.015, up ? 0.9995 : 1.0015, i), dates),
    [PULSE_SYMBOLS.vix]: bars(vixFn, dates),
    [PULSE_SYMBOLS.vix3m]: bars((i) => vixFn(i) * (up ? 1.12 : 0.94), dates),
  };
}

describe('percentiles point-in-time', () => {
  it('percentileOfLast usa la ventana trailing y no el futuro', () => {
    const base = [1, 2, 3, 4, 5];
    const p = percentileOfLast([...base, 6], 5, 3);
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThan(80);
    // El mínimo de la ventana queda en el extremo bajo.
    const low = percentileOfLast([5, 4, 3, 2, 1], 5, 3);
    expect(low!).toBeLessThan(20);
  });

  it('devuelve null sin muestras suficientes o con el último valor nulo', () => {
    expect(percentileOfLast([1, 2], 5, 3)).toBeNull();
    expect(percentileOfLast([1, 2, 3, null], 5, 2)).toBeNull();
    expect(percentileOfLast([], 5, 1)).toBeNull();
  });

  it('rollingPercentile no cambia los valores pasados al añadir futuro', () => {
    const a = rollingPercentile([1, 2, 3, 4], 10, 3);
    const b = rollingPercentile([1, 2, 3, 100], 10, 3);
    expect(a.slice(0, 3)).toEqual(b.slice(0, 3));
  });
});

describe('zonas y buckets', () => {
  it('mapea el score a las 5 zonas', () => {
    expect(scoreZone(0)).toBe('extreme-fear');
    expect(scoreZone(19.9)).toBe('extreme-fear');
    expect(scoreZone(20)).toBe('fear');
    expect(scoreZone(45)).toBe('neutral');
    expect(scoreZone(70)).toBe('greed');
    expect(scoreZone(80)).toBe('extreme-greed');
    expect(scoreZone(null)).toBe('na');
    expect(zoneLabel('greed')).toBe('Codicia');
  });

  it('bucketOf respeta los límites', () => {
    expect(bucketOf(0)).toBe('0-20');
    expect(bucketOf(19.99)).toBe('0-20');
    expect(bucketOf(20)).toBe('20-40');
    expect(bucketOf(60)).toBe('60-80');
    expect(bucketOf(100)).toBe('80-100');
  });
});

describe('wilsonInterval', () => {
  it('acota la proporción y se estrecha con más muestras', () => {
    const small = wilsonInterval(5, 10)!;
    const big = wilsonInterval(500, 1000)!;
    expect(small[0]).toBeLessThanOrEqual(50);
    expect(small[1]).toBeGreaterThanOrEqual(50);
    expect(big[1] - big[0]).toBeLessThan(small[1] - small[0]);
    expect(wilsonInterval(0, 0)).toBeNull();
  });
});

describe('buildMarketPulse', () => {
  it('marca codicia en una tendencia alcista con VIX bajando', () => {
    const out = buildMarketPulse({ series: seriesFor('up') });
    expect(out.score).not.toBeNull();
    expect(out.score!).toBeGreaterThan(60);
    expect(['greed', 'extreme-greed']).toContain(out.zone);
    expect(out.components.filter((c) => c.available).length).toBeGreaterThanOrEqual(5);
    expect(out.history.length).toBeGreaterThan(100);
    expect(out.meta.dataQuality).toBeGreaterThan(80);
  });

  it('marca miedo en una tendencia bajista con VIX subiendo y bonos/oro liderando', () => {
    const out = buildMarketPulse({ series: seriesFor('down') });
    expect(out.score).not.toBeNull();
    expect(out.score!).toBeLessThan(40);
    expect(['fear', 'extreme-fear']).toContain(out.zone);
  });

  it('las probabilidades forward son coherentes y con muestra', () => {
    const out = buildMarketPulse({ series: seriesFor('up'), horizons: [5, 21] });
    expect(out.probabilities).toHaveLength(2);
    for (const p of out.probabilities) {
      expect(p.samples).toBeGreaterThan(0);
      expect(p.pUp).not.toBeNull();
      expect(p.pUp!).toBeGreaterThanOrEqual(0);
      expect(p.pUp!).toBeLessThanOrEqual(100);
      expect(p.ci95).not.toBeNull();
      expect(p.ci95![0]).toBeLessThanOrEqual(p.pUp!);
      expect(p.ci95![1]).toBeGreaterThanOrEqual(p.pUp! - 1e-9);
      expect(p.pUp! + (p.pDown ?? 0)).toBeLessThanOrEqual(100.01);
      expect(p.baselinePUp).not.toBeNull();
      expect(p.edgePp).not.toBeNull();
    }
    expect(out.buckets).toHaveLength(5);
    expect(out.baseline).not.toBeNull();
  });

  it('el corte por asOf no usa información futura (mismo score que la serie completa)', () => {
    const series = seriesFor('up');
    const cut = DATES[400];
    const full = buildMarketPulse({ series });
    const sliced = buildMarketPulse({
      series: Object.fromEntries(
        Object.entries(series).map(([k, bars]) => [k, bars.filter((b) => b.date <= cut)])
      ),
    });
    expect(sliced.asOf).toBe(cut);
    const fullAtCut = full.history.find((p) => p.date === cut);
    expect(fullAtCut).toBeDefined();
    expect(Math.abs(sliced.score! - fullAtCut!.score)).toBeLessThan(1e-9);
  });

  it('degrada a índice parcial si faltan símbolos y lo avisa', () => {
    const series = seriesFor('up');
    delete series[PULSE_SYMBOLS.tlt];
    delete series[PULSE_SYMBOLS.hyg];
    const out = buildMarketPulse({ series });
    expect(out.score).not.toBeNull();
    expect(out.meta.missingSymbols).toEqual(expect.arrayContaining([PULSE_SYMBOLS.tlt, PULSE_SYMBOLS.hyg]));
    expect(out.meta.dataQuality).toBeLessThan(100);
    expect(out.meta.warnings.length).toBeGreaterThan(0);
    expect(out.components.find((c) => c.key === 'safeHaven')!.available).toBe(false);
  });

  it('sin SPY lanza error y sin historia suficiente devuelve score null', () => {
    expect(() => buildMarketPulse({ series: {} })).toThrow(/SPY/);
    const short = buildMarketPulse({
      series: seriesFor('up', businessDates(120)),
    });
    expect(short.score).toBeNull();
    expect(short.zone).toBe('na');
    expect(short.meta.warnings.join(' ')).toMatch(/suficientes datos/i);
  });

  it('publica notas de transparencia', () => {
    expect(PULSE_NOTES.length).toBeGreaterThanOrEqual(3);
    expect(PULSE_NOTES.join(' ')).toMatch(/no es una recomendación/i);
  });
});
