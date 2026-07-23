import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getQuote as finnhubQuote } from '@/src/services/finnhubClient';

const yf = new YahooFinance();

export const dynamic = 'force-dynamic';

interface EnrichedStock {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  closes: number[];
  rsi: number | null;
  trend: string;
}

function calcRSI(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - 14, n = closes.length; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) {
    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const results: EnrichedStock[] = [];

  const BATCH_SIZE = 5;
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (sym) => {
      try {
        const [quote, hist, fh] = await Promise.all([
          yf.quote(sym).catch(() => null),
          yf.historical(sym, {
            period1: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '1d',
          }).catch(() => []),
          finnhubQuote(sym).catch(() => null),
        ]);

        if (!quote) return null;

        const closes = (hist as any[] || []).map((h: any) => h.close).filter((c: number) => c > 0);
        const rsi = calcRSI(closes);
        const lastCloses = closes.slice(-8);
        const trend = rsi !== null
          ? (rsi > 60 ? 'alcista' : rsi < 40 ? 'bajista' : 'neutral')
          : 'neutral';

        const realPrice = fh && fh.c > 0 ? fh.c : (quote.regularMarketPrice || 0);
        const realChange = fh && fh.c > 0 ? fh.d : (quote.regularMarketChange || 0);
        const realChangePct = fh && fh.c > 0 ? fh.dp : (quote.regularMarketChangePercent || 0);

        return {
          symbol: sym,
          price: realPrice,
          change: realChange,
          changePercent: realChangePct,
          volume: quote.regularMarketVolume || 0,
          high: fh && fh.h > 0 ? fh.h : (quote.regularMarketDayHigh || 0),
          low: fh && fh.l > 0 ? fh.l : (quote.regularMarketDayLow || 0),
          open: fh && fh.o > 0 ? fh.o : (quote.regularMarketOpen || 0),
          closes: lastCloses,
          rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
          trend,
        };
      } catch (e) {
        console.error('Screener detail error:', e);
        return null;
      }
    }));
    results.push(...batchResults.filter(Boolean) as EnrichedStock[]);
  }

  return NextResponse.json({ stocks: results });
}
