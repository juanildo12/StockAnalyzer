import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<T | null>((r) => setTimeout(() => r(null), ms))]);
}

const priceCache: Record<string, { p: number | null; ts: number }> = {};
const TTL = 60 * 1000; // 1 minute

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json({ error: 'symbols required' }, { status: 400 });

  const symbols = Array.from(new Set(symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)));
  const now = Date.now();
  const prices: Record<string, number | null> = {};
  const toFetch: string[] = [];

  for (const s of symbols) {
    const cached = priceCache[s];
    if (cached && now - cached.ts < TTL) {
      prices[s] = cached.p;
    } else {
      toFetch.push(s);
    }
  }

  const batchSize = 10;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const res = await Promise.all(batch.map(async (s) => {
      const q = await withTimeout(yf.quote(s), 5000);
      return { s, price: q?.regularMarketPrice || null };
    }));
    for (const r of res) {
      priceCache[r.s] = { p: r.price, ts: Date.now() };
      prices[r.s] = r.price;
    }
  }

  return NextResponse.json({ prices });
}