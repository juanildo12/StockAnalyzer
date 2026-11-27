import { describe, expect, it } from 'vitest';
import {
  aggregateNewsSentiment,
  buildWeeklySummary,
  computeWeeklyCloses,
  getWeekContext,
  isoWeekKey,
  parseWeeklyAi,
  type WeeklyEvent,
} from './weeklySummary';
import type { DailyClose } from './pulse';

function series(rows: Array<[string, number]>): DailyClose[] {
  return rows.map(([date, close]) => ({ date, close }));
}

describe('weeklySummary', () => {
  it('detecta viernes/fin de semana en hora ET y calcula la semana siguiente', () => {
    const friday = getWeekContext(new Date('2026-11-27T16:00:00Z'));
    expect(friday.weekday).toBe('viernes');
    expect(friday.reviewWindow).toBe(true);
    expect(friday.etDate).toBe('2026-11-27');
    expect(friday.nextWeek).toEqual({ start: '2026-11-30', end: '2026-12-04', label: '30 nov – 4 dic' });

    const fridayNightUtcSaturday = getWeekContext(new Date('2026-11-28T02:00:00Z'));
    expect(fridayNightUtcSaturday.etDate).toBe('2026-11-27');
    expect(fridayNightUtcSaturday.reviewWindow).toBe(true);

    const monday = getWeekContext(new Date('2026-11-23T16:00:00Z'));
    expect(monday.reviewWindow).toBe(false);
  });

  it('calcula weekKey ISO', () => {
    expect(isoWeekKey('2026-11-27')).toBe('2026-W48');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
  });

  it('computeWeeklyCloses usa el cierre de la semana actual contra la anterior', () => {
    const spy = series([
      ['2026-11-20', 100],
      ['2026-11-23', 102],
      ['2026-11-25', 105],
      ['2026-11-27', 110],
    ]);
    const out = computeWeeklyCloses({ SPY: spy, QQQ: [] }, '2026-11-27', ['SPY', 'QQQ']);
    expect(out[0]).toMatchObject({ symbol: 'SPY', close: 110, prevClose: 100, weeklyReturnPct: 10, sessions: 3 });
    expect(out[1].weeklyReturnPct).toBeNull();
  });

  it('agrega sentimiento solo de noticias clasificadas', () => {
    expect(aggregateNewsSentiment([
      { sentiment: 'positive' }, { sentiment: 'positive' }, { sentiment: 'negative' }, { sentiment: undefined },
    ])).toEqual({ positive: 2, negative: 1, neutral: 0, total: 3, net: 0.33 });
    expect(aggregateNewsSentiment([{ sentiment: null }])).toBeNull();
  });

  it('filtra eventos a la semana siguiente y ordena por importancia', () => {
    const events: WeeklyEvent[] = [
      { iso: '2026-11-26', title: 'Pasado', type: 'earnings', importance: 99 },
      { iso: '2026-12-02', title: 'CPI', type: 'economic', importance: 90 },
      { iso: '2026-12-01', title: 'Resultados AAA', type: 'earnings', importance: 82, symbol: 'AAA' },
    ];
    const out = buildWeeklySummary({ asOf: new Date('2026-11-27T16:00:00Z'), events });
    expect(out.events.map(e => e.title)).toEqual(['CPI', 'Resultados AAA']);
    expect(out.outlook.watchlist).toEqual(['AAA']);
  });

  it('genera sesgo alcista/bajista con datos reales y confianza', () => {
    const base = {
      asOf: new Date('2026-11-27T16:00:00Z'),
      series: {
        SPY: series([['2026-11-20', 100], ['2026-11-27', 110]]),
        QQQ: series([['2026-11-20', 100], ['2026-11-27', 108]]),
      },
      events: [
        { iso: '2026-12-01', title: 'Resultados AAA', type: 'earnings', importance: 82, symbol: 'AAA' },
        { iso: '2026-12-02', title: 'CPI', type: 'economic', importance: 90 },
        { iso: '2026-12-03', title: 'NFP', type: 'economic', importance: 90 },
      ],
      newsSentiment: { positive: 8, negative: 2, neutral: 0, total: 10, net: 0.6 },
      pulse: { score: 70, zone: 'Greed', delta5d: 1, pUp5d: 58, ciLow: 50, ciHigh: 66, baselinePUp: 52, edgePp: 6 },
    };
    const up = buildWeeklySummary(base);
    expect(up.outlook.bias).toBe('bullish');
    expect(up.outlook.confidence).toBe('high');
    expect(up.available).toBe(true);

    const down = buildWeeklySummary({
      ...base,
      series: {
        SPY: series([['2026-11-20', 100], ['2026-11-27', 90]]),
        QQQ: series([['2026-11-20', 100], ['2026-11-27', 91]]),
      },
      newsSentiment: { positive: 1, negative: 9, neutral: 0, total: 10, net: -0.8 },
    });
    expect(down.outlook.bias).toBe('bearish');
  });

  it('no inventa datos cuando no hay series, pulse ni eventos', () => {
    const out = buildWeeklySummary({ asOf: new Date('2026-11-27T16:00:00Z') });
    expect(out.available).toBe(false);
    expect(out.indices.every(i => i.weeklyReturnPct === null)).toBe(true);
    expect(out.warnings.some(w => w.includes('No hay datos suficientes'))).toBe(true);
  });

  it('parsea JSON de IA con markdown, comas finales y campos parciales', () => {
    const text = '```json\n{"headline":"Semana mixta","bias":"neutral","scenarios":[{"label":"Base","text":"Sin cambios"},],"risks":["CPI"],}\n```';
    const parsed = parseWeeklyAi(text);
    expect(parsed?.headline).toBe('Semana mixta');
    expect(parsed?.bias).toBe('neutral');
    expect(parsed?.scenarios).toHaveLength(1);
    expect(parsed?.risks).toEqual(['CPI']);
    expect(parseWeeklyAi('no json')).toBeNull();
  });

  it('la IA reemplaza el titular y conserva los datos cuantitativos', () => {
    const out = buildWeeklySummary({
      asOf: new Date('2026-11-27T16:00:00Z'),
      series: { SPY: series([['2026-11-20', 100], ['2026-11-27', 110]]) },
      ai: {
        headline: 'Lectura IA de la semana',
        bias: 'bearish',
        scenarios: [{ label: 'Base', text: 'IA base' }],
        risks: ['IA risk'],
        watchlist: ['SPY'],
      },
    });
    expect(out.aiUsed).toBe(true);
    expect(out.outlook.headline).toBe('Lectura IA de la semana');
    expect(out.outlook.bias).toBe('bearish');
    expect(out.indices[0].weeklyReturnPct).toBe(10);
  });
});
