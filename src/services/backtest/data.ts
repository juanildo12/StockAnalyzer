// Carga de datos para el backtest.
//
// Histórico diario completo vía Yahoo (gratis, sin límite de rango). Massive
// (ex-Polygon) se usa como fallback: su plan gratis NO cubre histórico
// antiguo ("Your plan doesn't include this data timeframe") y está limitado a
// 5 req/min, por lo que no sirve para un backtest.

import YahooFinance from 'yahoo-finance2';
import { getBars as getMassiveBars } from '../polygonClient';
import type { Bar } from './types';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const cache = new Map<string, { bars: Bar[]; at: number }>();
const CACHE_TTL = 15 * 60 * 1000;

export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function normalizeYahoo(quotes: any[]): Bar[] {
  const out: Bar[] = [];
  for (const q of quotes || []) {
    const date = q?.date instanceof Date ? toDateStr(q.date) : typeof q?.date === 'string' ? q.date.slice(0, 10) : null;
    if (!date) continue;
    const open = Number(q.open);
    const close = Number(q.close);
    if (!isFinite(open) || !isFinite(close) || open <= 0 || close <= 0) continue;
    out.push({
      date,
      open,
      high: Number(q.high) || close,
      low: Number(q.low) || close,
      close,
      volume: Number(q.volume) || 0,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

async function fetchYahooBars(symbol: string, from: Date, to: Date): Promise<Bar[]> {
  const result: any = await yf.chart(symbol, {
    period1: from,
    period2: to,
    interval: '1d',
  });
  return normalizeYahoo(result?.quotes || []);
}

async function fetchMassiveBars(symbol: string, from: Date, to: Date): Promise<Bar[]> {
  const rows: any[] = await getMassiveBars(symbol, toDateStr(from), toDateStr(to));
  const out: Bar[] = [];
  for (const r of rows || []) {
    const ts = Number(r.t);
    if (!ts) continue;
    const date = toDateStr(new Date(ts));
    out.push({
      date,
      open: Number(r.o),
      high: Number(r.h),
      low: Number(r.l),
      close: Number(r.c),
      volume: Number(r.v) || 0,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/**
 * Barras diarias de un símbolo entre dos fechas (inclusive), ascendente.
 * Lanza error si no hay datos utilizables.
 */
export async function loadBars(symbol: string, from: Date, to: Date): Promise<{ bars: Bar[]; source: string }> {
  const key = `${symbol}:${toDateStr(from)}:${toDateStr(to)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return { bars: cached.bars, source: 'cache' };
  }

  let bars: Bar[] = [];
  let source = 'Yahoo';
  try {
    bars = await fetchYahooBars(symbol, from, to);
  } catch (e) {
    console.warn(`[backtest] Yahoo falló para ${symbol}:`, e instanceof Error ? e.message : e);
  }

  if (bars.length === 0) {
    try {
      bars = await fetchMassiveBars(symbol, from, to);
      source = 'Massive';
    } catch (e) {
      console.warn(`[backtest] Massive falló para ${symbol}:`, e instanceof Error ? e.message : e);
    }
  }

  if (bars.length === 0) {
    throw new Error(`Sin datos históricos para ${symbol}`);
  }

  cache.set(key, { bars, at: Date.now() });
  return { bars, source };
}
