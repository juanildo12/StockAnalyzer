import { describe, expect, it } from 'vitest';
import {
  isRelevantEconomicEvent,
  normalizeEconomicEvent,
  normalizeEconomicEvents,
} from './tradingViewCalendar';

describe('normalizeEconomicEvent', () => {
  it('mapea un evento del feed de TradingView', () => {
    const e = normalizeEconomicEvent({
      id: 'abc',
      title: 'Fed Interest Rate Decision',
      country: 'US',
      indicator: 'Interest Rate',
      date: '2026-10-28T18:00:00.000Z',
      importance: 1,
      forecast: null,
      previous: '4',
      actual: '',
      period: '',
      category: 'Interest Rate',
    });
    expect(e).not.toBeNull();
    expect(e!.title).toBe('Fed Interest Rate Decision');
    expect(e!.importanceLabel).toBe('high');
    expect(e!.previous).toBe('4');
    expect(e!.forecast).toBeNull();
    expect(e!.actual).toBeNull();
  });

  it('etiqueta importancia medium (0) y low (-1)', () => {
    expect(normalizeEconomicEvent({ title: 'X', date: '2026-01-01T00:00:00Z', importance: 0 })!.importanceLabel).toBe('medium');
    expect(normalizeEconomicEvent({ title: 'X', date: '2026-01-01T00:00:00Z', importance: -1 })!.importanceLabel).toBe('low');
  });

  it('descarta filas sin fecha o sin título', () => {
    expect(normalizeEconomicEvent({ title: 'X' })).toBeNull();
    expect(normalizeEconomicEvent({ date: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(normalizeEconomicEvent(null as any)).toBeNull();
  });
});

describe('isRelevantEconomicEvent', () => {
  const base = { indicator: '', title: 'CPI', importance: 1 } as any;

  it('descarta ruido semanal (crudo, gasolina, hipotecas)', () => {
    expect(isRelevantEconomicEvent({ ...base, indicator: 'Crude Oil Stocks Change' })).toBe(false);
    expect(isRelevantEconomicEvent({ ...base, indicator: 'API Crude Oil Stock Change' })).toBe(false);
    expect(isRelevantEconomicEvent({ ...base, title: 'MBA 30-Year Mortgage Rate' })).toBe(false);
    expect(isRelevantEconomicEvent({ ...base, title: 'Atlanta Fed GDPNow' })).toBe(false);
    expect(isRelevantEconomicEvent({ ...base, title: 'ADP Employment Change Weekly' })).toBe(false);
  });

  it('descarta discursos de la Fed de baja importancia pero mantiene los de alto impacto', () => {
    expect(isRelevantEconomicEvent({ ...base, title: 'Fed Goolsbee Speech', importance: 0 })).toBe(false);
    const chair = normalizeEconomicEvent({ title: 'Fed Chair Warsh Speech', date: '2026-10-16T03:30:00Z', importance: 1 })!;
    expect(isRelevantEconomicEvent(chair)).toBe(true);
  });

  it('mantiene eventos macro relevantes', () => {
    expect(isRelevantEconomicEvent({ ...base, title: 'Non Farm Payrolls', indicator: 'Non Farm Payrolls' })).toBe(true);
  });
});

describe('normalizeEconomicEvents', () => {
  it('normaliza y filtra el payload {result:[]}', () => {
    const out = normalizeEconomicEvents({
      status: 'ok',
      result: [
        { title: 'Fed Interest Rate Decision', date: '2026-10-28T18:00:00Z', importance: 1 },
        { title: 'EIA Crude Oil Stocks Change', indicator: 'Crude Oil Stocks Change', date: '2026-10-21T14:30:00Z', importance: 0 },
        { title: 'Non Farm Payrolls', date: '2026-11-06T13:30:00Z', importance: 1 },
      ],
    });
    expect(out.map((e) => e.title)).toEqual(['Fed Interest Rate Decision', 'Non Farm Payrolls']);
  });

  it('payload vacío o inválido → []', () => {
    expect(normalizeEconomicEvents(null)).toEqual([]);
    expect(normalizeEconomicEvents({ result: 'nope' })).toEqual([]);
  });
});
