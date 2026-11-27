import YahooFinance from 'yahoo-finance2';
import {
  PULSE_NOTES,
  PULSE_SYMBOLS,
  buildMarketPulse,
  type DailyClose,
  type PulseSeries,
} from '@/src/lib/market/pulse';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
const HISTORY_YEARS = 12;

export async function fetchPulseDaily(symbol: string): Promise<DailyClose[]> {
  const from = new Date();
  from.setFullYear(from.getFullYear() - HISTORY_YEARS);
  const result: any = await yf.chart(symbol, { period1: from, interval: '1d' });
  const out: DailyClose[] = [];
  for (const q of result?.quotes || []) {
    const date = q?.date instanceof Date
      ? q.date.toISOString().slice(0, 10)
      : typeof q?.date === 'string'
        ? q.date.slice(0, 10)
        : null;
    const close = Number(q?.close);
    if (!date || !Number.isFinite(close) || close <= 0) continue;
    out.push({ date, close });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export async function fetchPulseSeries(): Promise<PulseSeries> {
  const symbols = Object.values(PULSE_SYMBOLS);
  const fetched = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        return { symbol, bars: await fetchPulseDaily(symbol) };
      } catch (err) {
        console.warn(`[market-pulse] Yahoo falló para ${symbol}:`, err instanceof Error ? err.message : err);
        return { symbol, bars: [] as DailyClose[] };
      }
    })
  );
  const series: PulseSeries = {};
  for (const { symbol, bars } of fetched) {
    if (bars.length > 0) series[symbol] = bars;
  }
  if (!series[PULSE_SYMBOLS.spy] || series[PULSE_SYMBOLS.spy].length < 300) {
    throw new Error('Yahoo no devolvió historia suficiente de SPY.');
  }
  return series;
}

export async function buildMarketPulsePayload() {
  const series = await fetchPulseSeries();
  const result = buildMarketPulse({ series });
  return {
    ...result,
    source: 'Yahoo Finance (precios diarios de ETFs/índices)',
    updatedAt: new Date().toISOString(),
    notes: PULSE_NOTES,
  };
}
