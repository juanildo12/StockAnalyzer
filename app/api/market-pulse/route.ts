// Market Pulse — índice tipo Fear & Greed + probabilidad histórica condicional.
//
// Construido solo con precios diarios de ETFs/índices líquidos (Yahoo). La
// ruta es pública (misma familia que gamma-levels / put-call-ratio): no
// requiere sesión y no expone datos de usuario. Cache 10 min.

import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { cacheGet, cacheSet } from '@/src/lib/cache';
import {
  PULSE_NOTES,
  PULSE_SYMBOLS,
  buildMarketPulse,
  type DailyClose,
  type PulseSeries,
} from '@/src/lib/market/pulse';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_KEY = 'market-pulse:v1';
const CACHE_TTL = 600; // 10 min
const HISTORY_YEARS = 12;

interface PulseResponse {
  source: string;
  updatedAt: string;
  cached?: boolean;
  notes: string[];
}

async function fetchDaily(symbol: string): Promise<DailyClose[]> {
  const from = new Date();
  from.setFullYear(from.getFullYear() - HISTORY_YEARS);
  const result: any = await yf.chart(symbol, {
    period1: from,
    interval: '1d',
  });
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

async function buildPayload() {
  const symbols = Object.values(PULSE_SYMBOLS);
  const fetched = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        return { symbol, bars: await fetchDaily(symbol) };
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

  const result = buildMarketPulse({ series });
  const payload: PulseResponse & ReturnType<typeof buildMarketPulse> = {
    ...result,
    source: 'Yahoo Finance (precios diarios de ETFs/índices)',
    updatedAt: new Date().toISOString(),
    notes: PULSE_NOTES,
  };
  return payload;
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1';

  if (!force) {
    const cached = await cacheGet<PulseResponse>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  try {
    const payload = await buildPayload();
    await cacheSet(CACHE_KEY, payload, CACHE_TTL);
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[market-pulse] error:', err);
    return NextResponse.json(
      { error: 'No se pudo construir el Market Pulse', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 502 }
    );
  }
}
