import { describe, it, expect } from 'vitest';
import { runEngine, buildSignalMap, tradingCalendar } from './engine';
import {
  sma,
  rsi,
  maxDrawdown,
  sortino,
  sharpe,
  cagr,
  dailyReturns,
  downsideDeviation,
} from './indicators';
import { evaluateStrategy, momentum12_1 } from './strategy';
import type { BacktestConfig, Bar } from './types';

function bar(date: string, close: number, open = close, high = close, low = close): Bar {
  return { date, open, high, low, close, volume: 1000 };
}

/** Serie determinista de N sesiones con cierre creciente/decreciente. */
function series(startDate: string, days: number, fn: (i: number) => number): Bar[] {
  const out: Bar[] = [];
  const d = new Date(`${startDate}T00:00:00.000Z`);
  for (let i = 0; i < days; i++) {
    const c = fn(i);
    out.push(bar(d.toISOString().slice(0, 10), c, c, c * 1.01, c * 0.99));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const baseConfig: BacktestConfig = {
  symbols: ['AAA'],
  startDate: '2024-01-10',
  endDate: '2024-01-20',
  initialCash: 10000,
  strategy: 'buy-and-hold',
  commissionBps: 0,
  slippageBps: 0,
  benchmark: 'AAA',
};

describe('indicadores', () => {
  it('sma devuelve null si no hay suficientes datos', () => {
    expect(sma([1, 2, 3], 5)).toBeNull();
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5);
  });

  it('rsi de una serie plana vale 50 y de una serie creciente se acerca a 100', () => {
    const flat = series('2024-01-01', 30, () => 100);
    expect(rsi(flat.map((b) => b.close), 14)).toBe(50);
    const up = series('2024-01-01', 40, (i) => 100 + i);
    const value = rsi(up.map((b) => b.close), 14);
    expect(value).not.toBeNull();
    expect(value as number).toBeGreaterThan(90);
  });

  it('maxDrawdown usa el máximo pico contra el valle posterior', () => {
    expect(maxDrawdown([100, 120, 90, 150])).toBeCloseTo((120 - 90) / 120, 6);
    expect(maxDrawdown([100, 110, 120])).toBe(0);
  });

  it('sortino penaliza solo los rendimientos negativos', () => {
    const ret = [0.02, -0.01, 0.03, -0.02];
    const dd = downsideDeviation(ret);
    expect(dd).toBeCloseTo(Math.sqrt((0.0001 + 0.0004) / 2), 6);
    const s = sortino(ret);
    const mean = ret.reduce((a, b) => a + b, 0) / ret.length;
    expect(s).toBeCloseTo((mean / dd) * Math.sqrt(252), 6);
  });

  it('sharpe es 0 cuando no hay volatilidad', () => {
    expect(sharpe([0.01, 0.01, 0.01])).toBe(0);
  });

  it('cagr anualiza el retorno', () => {
    expect(cagr(100, 121, 1)).toBeCloseTo(0.21, 6);
    expect(cagr(100, 100, 2)).toBe(0);
  });

  it('dailyReturns ignora valores previos a cero', () => {
    expect(dailyReturns([0, 50, 100])).toEqual([1]);
  });
});

describe('estrategias', () => {
  it('trend no señaliza sin 200 sesiones de histórico', () => {
    const bars = series('2024-01-01', 50, (i) => 100 + i);
    const signal = evaluateStrategy('trend', { symbol: 'AAA', bars });
    expect(signal.target).toBe(0);
    expect(signal.reason).toContain('SMA200');
  });

  it('trend señala largo con precio sobre SMA200 y SMA50 sobre SMA200', () => {
    const bars = series('2023-01-01', 300, (i) => 100 + i * 0.5);
    const signal = evaluateStrategy('trend', { symbol: 'AAA', bars });
    expect(signal.target).toBe(1);
    expect(signal.reason).toContain('alcista');
  });

  it('mean-reversion compra con RSI bajo y cierre bajo la EMA21', () => {
    const bars = series('2023-01-01', 60, (i) => 100 - i);
    const signal = evaluateStrategy('mean-reversion', { symbol: 'AAA', bars });
    expect(signal.target).toBe(1);
  });

  it('buy-and-hold siempre mantiene posición', () => {
    const bars = series('2023-01-01', 30, () => 100);
    expect(evaluateStrategy('buy-and-hold', { symbol: 'AAA', bars }).target).toBe(1);
  });

  it('momentum 12-1 necesita historial suficiente', () => {
    const short = series('2023-01-01', 30, (i) => 100 + i);
    expect(momentum12_1(short)).toBeNull();
  });
});

describe('motor (sin look-ahead)', () => {
  it('la orden se ejecuta a la apertura del día siguiente, no el día de la señal', () => {
    // Sesiones 10-01..12-01. El día 10 la señal es larga (compra) y la
    // ejecución debe fecharse el 11-01.
    const bars = [
      bar('2024-01-10', 100, 100),
      bar('2024-01-11', 110, 108),
      bar('2024-01-12', 120, 118),
    ];
    const signalMap = {
      '2024-01-10': { AAA: { target: 1 as const, score: 1, reason: 'señal' } },
      '2024-01-11': { AAA: { target: 1 as const, score: 1, reason: 'señal' } },
    };
    const result = runEngine({
      config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-12' },
      barsBySymbol: { AAA: bars },
      benchmarkBars: bars,
      signalMap,
    });

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade.side).toBe('buy');
    expect(trade.signalDate).toBe('2024-01-10');
    expect(trade.date).toBe('2024-01-11');
    expect(trade.price).toBe(108); // apertura del día siguiente
  });

  it('la señal de la primera sesión no se ejecuta en esa misma sesión', () => {
    const bars = [bar('2024-01-10', 100, 100), bar('2024-01-11', 105, 104)];
    const result = runEngine({
      config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-11' },
      barsBySymbol: { AAA: bars },
      benchmarkBars: bars,
      signalMap: {
        '2024-01-10': { AAA: { target: 1 as const, score: 1, reason: 'señal' } },
      },
    });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].date).toBe('2024-01-11');
    expect(result.trades[0].price).toBe(104);
  });

  it('aplica comisión y slippage al comprar', () => {
    const bars = [bar('2024-01-10', 100, 100), bar('2024-01-11', 100, 100), bar('2024-01-12', 100, 100)];
    const result = runEngine({
      config: {
        ...baseConfig,
        startDate: '2024-01-10',
        endDate: '2024-01-12',
        commissionBps: 100,
        slippageBps: 0,
      },
      barsBySymbol: { AAA: bars },
      benchmarkBars: bars,
      signalMap: {
        '2024-01-10': { AAA: { target: 1 as const, score: 1, reason: 'señal' } },
      },
    });
    expect(result.trades.length).toBe(1);
    expect(result.totalCosts).toBeGreaterThan(0);
    // Con 1% de comisión el cash gastado supera el valor nominal de la posición.
    const cashAfter = result.nav[result.nav.length - 1].cash;
    expect(cashAfter).toBeLessThan(10000);
  });

  it('vende la posición cuando la señal pasa a 0', () => {
    const bars = [
      bar('2024-01-10', 100, 100),
      bar('2024-01-11', 110, 110),
      bar('2024-01-12', 120, 120),
    ];
    const result = runEngine({
      config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-12' },
      barsBySymbol: { AAA: bars },
      benchmarkBars: bars,
      signalMap: {
        '2024-01-10': { AAA: { target: 1 as const, score: 1, reason: 'compra' } },
        '2024-01-11': { AAA: { target: 0 as const, score: 0, reason: 'vende' } },
      },
    });
    const sells = result.trades.filter((t) => t.side === 'sell');
    expect(sells.length).toBe(1);
    expect(sells[0].date).toBe('2024-01-12');
  });

  it('el NAV se valora al cierre de cada sesión', () => {
    const bars = [
      bar('2024-01-10', 100, 100),
      bar('2024-01-11', 110, 105),
      bar('2024-01-12', 120, 115),
    ];
    const result = runEngine({
      config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-12' },
      barsBySymbol: { AAA: bars },
      benchmarkBars: bars,
      signalMap: {
        '2024-01-10': { AAA: { target: 1 as const, score: 1, reason: 'compra' } },
      },
    });
    // 95 acciones a 105 (apertura del 11) + 25 USD de efectivo restante,
    // valoradas a 110 el día 11.
    expect(result.nav[1].value).toBeCloseTo(95 * 110 + 25, 6);
  });

  it('el benchmark es buy & hold del propio benchmark', () => {
    const bench = [bar('2024-01-10', 100, 100), bar('2024-01-11', 110, 110), bar('2024-01-12', 121, 121)];
    const result = runEngine({
      config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-12' },
      barsBySymbol: { AAA: [bar('2024-01-10', 100, 100), bar('2024-01-11', 100, 100), bar('2024-01-12', 100, 100)] },
      benchmarkBars: bench,
      signalMap: {},
    });
    expect(result.benchmarkReturn).toBeCloseTo(0.21, 6);
    expect(result.nav[result.nav.length - 1].benchmark).toBeCloseTo(12100, 6);
  });

  it('divide el capital entre los símbolos con señal larga', () => {
    const bars = [bar('2024-01-10', 100, 100), bar('2024-01-11', 100, 100), bar('2024-01-12', 100, 100)];
    const result = runEngine({
      config: { ...baseConfig, symbols: ['AAA', 'BBB'], startDate: '2024-01-10', endDate: '2024-01-12' },
      barsBySymbol: { AAA: bars, BBB: bars },
      benchmarkBars: bars,
      signalMap: {
        '2024-01-10': {
          AAA: { target: 1 as const, score: 1, reason: 'compra' },
          BBB: { target: 1 as const, score: 1, reason: 'compra' },
        },
      },
    });
    expect(result.trades.length).toBe(2);
    for (const t of result.trades) {
      expect(t.value).toBeCloseTo(5000, 6); // 50% del capital cada uno
    }
  });

  it('cierra la posición completa aunque el precio haya subido', () => {
    const bars = [
      bar('2024-01-10', 100, 100),
      bar('2024-01-11', 110, 110),
      bar('2024-01-12', 200, 200),
    ];
    const result = runEngine({
      config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-12' },
      barsBySymbol: { AAA: bars },
      benchmarkBars: bars,
      signalMap: {
        '2024-01-10': { AAA: { target: 1 as const, score: 1, reason: 'compra' } },
        '2024-01-11': { AAA: { target: 0 as const, score: 0, reason: 'cierre' } },
      },
    });
    const sell = result.trades.find((t) => t.side === 'sell');
    expect(sell).toBeDefined();
    // 90 acciones compradas a 110 (floor(10000/110)) → se venden las 90.
    expect(sell!.shares).toBe(90);
  });

  it('lanza error si el periodo no tiene sesiones suficientes', () => {
    const bars = [bar('2024-01-10', 100, 100)];
    expect(() =>
      runEngine({
        config: { ...baseConfig, startDate: '2024-01-10', endDate: '2024-01-10' },
        barsBySymbol: { AAA: bars },
        benchmarkBars: bars,
        signalMap: {},
      }),
    ).toThrow(/sesiones/);
  });
});

describe('señales y calendario', () => {
  it('buildSignalMap genera una entrada por fecha del calendario', () => {
    const bars = series('2024-01-01', 40, (i) => 100 + i);
    const dates = tradingCalendar(bars, '2024-01-05', '2024-01-10');
    const map = buildSignalMap(baseConfig, { AAA: bars }, dates);
    expect(Object.keys(map).length).toBe(dates.length);
    expect(map[dates[0]].AAA).toBeDefined();
  });

  it('el calendario solo incluye fechas dentro del periodo', () => {
    const bars = series('2024-01-01', 30, (i) => 100 + i);
    const dates = tradingCalendar(bars, '2024-01-05', '2024-01-10');
    expect(dates[0]).toBe('2024-01-05');
    expect(dates[dates.length - 1]).toBe('2024-01-10');
  });
});
