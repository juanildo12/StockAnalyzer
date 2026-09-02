import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json({ error: 'symbols required' }, { status: 400 });

  const symbols = symbolsParam.split(',').filter(Boolean);
  const batchSize = 6;
  const results: Record<string, { ema200: number | null; distance: number | null }> = {};

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const hist = await withTimeout(
            yf.historical(symbol, {
              period1: new Date(Date.now() - 300 * 86400000),
              period2: new Date(),
              interval: '1d',
            }),
            6000
          );
          if (!hist || hist.length < 200) return { symbol, ema200: null, distance: null };
          const closes = hist.map(h => h.close);
          const ema200 = calcEMA200(closes);
          if (!ema200) return { symbol, ema200: null, distance: null };
          const price = hist[hist.length - 1].close || 0;
          const distance = price > 0 ? ((price - ema200) / ema200) * 100 : null;
          return { symbol, ema200, distance };
        } catch {
          return { symbol, ema200: null, distance: null };
        }
      })
    );
    for (const r of batchResults) {
      results[r.symbol] = { ema200: r.ema200, distance: r.distance };
    }
  }

  return NextResponse.json({ results });
}
