import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getCandles as finnhubGetCandles } from '@/src/services/finnhubClient';
import { cacheGet, cacheSet } from '@/src/lib/cache';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EMA_TTL = 21600; // 6 hours
const CACHE_PREFIX = 'screener:ema:v1:';

interface EmaResult {
  ema200: number | null;
  distance: number | null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<T | null>((r) => setTimeout(() => r(null), ms))]);
}

function calcEMA200(closes: number[]): number | null {
  if (closes.length < 200) return null;
  const k = 2 / 201;
  let ema = closes.slice(0, 200).reduce((a, b) => a + b, 0) / 200;
  for (let i = 200; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function emaWithPrice(closes: number[]): EmaResult | null {
  const ema200 = calcEMA200(closes);
  if (!ema200) return null;
  const price = closes[closes.length - 1] || 0;
  const distance = price > 0 ? ((price - ema200) / ema200) * 100 : null;
  return { ema200, distance };
}

async function emaFromYahoo(symbol: string): Promise<EmaResult | null> {
  const hist = await withTimeout(
    yf.historical(symbol, {
      period1: new Date(Date.now() - 300 * 86400000),
      period2: new Date(),
      interval: '1d',
    }),
    6000
  );
  if (!hist || hist.length < 200) return null;
  const closes = hist.map(h => h.close).filter((c): c is number => typeof c === 'number' && c > 0);
  return emaWithPrice(closes);
}

async function emaFromFinnhub(symbol: string): Promise<EmaResult | null> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 450 * 86400;
  const data = await withTimeout(
    finnhubGetCandles(symbol, 'D', from, now),
    6000
  );
  if (!data || data.s !== 'ok' || !Array.isArray(data.c) || data.c.length < 200) return null;
  const closes = data.c.filter((c): c is number => typeof c === 'number' && c > 0);
  return emaWithPrice(closes);
}

async function emaForSymbol(symbol: string): Promise<EmaResult | null> {
  const key = CACHE_PREFIX + symbol;
  const cached = await cacheGet<EmaResult>(key);
  if (cached !== null) return cached;

  const fromYahoo = await emaFromYahoo(symbol).catch(() => null);
  const result = fromYahoo || (await emaFromFinnhub(symbol).catch(() => null));

  if (result) cacheSet(key, result, EMA_TTL).catch(() => {});

  return result;
}

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json({ error: 'symbols required' }, { status: 400 });

  const symbols = symbolsParam.split(',').filter(Boolean);
  const batchSize = 6;
  const results: Record<string, EmaResult> = {};

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        const r = await emaForSymbol(symbol).catch(() => null);
        return { symbol, ema200: r?.ema200 ?? null, distance: r?.distance ?? null };
      })
    );
    for (const r of batchResults) {
      results[r.symbol] = { ema200: r.ema200, distance: r.distance };
    }
  }

  return NextResponse.json({ results });
}