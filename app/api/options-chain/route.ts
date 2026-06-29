import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  try {
    const sym = symbol.toUpperCase();
    const [quote, chain] = await Promise.all([
      yf.quote(sym).catch(() => null),
      yf.options(sym).catch(() => null),
    ]);

    if (!quote || !quote.regularMarketPrice) {
      return NextResponse.json({ error: 'No quote data' }, { status: 404 });
    }
    if (!chain || !chain.options || chain.options.length === 0) {
      return NextResponse.json({ error: 'No options chain' }, { status: 404 });
    }

    const price = quote.regularMarketPrice;
    const result = [];

    for (const exp of chain.options.slice(0, 3)) {
      const rawDate = exp.expirationDate;
      if (!rawDate) continue;
      const dateStr = typeof rawDate === 'string' ? rawDate : rawDate.toISOString().split('T')[0];
      const days = Math.max(1, Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      const process = (contracts: any[], type: 'call' | 'put') =>
        contracts
          .map((c: any) => ({ ...c, _dist: Math.abs(c.strike - price) }))
          .sort((a: any, b: any) => a._dist - b._dist)
          .slice(0, 15)
          .map(({ _dist, ...c }: any) => ({
          strike: c.strike,
          lastPrice: c.lastPrice || 0,
          bid: c.bid || 0,
          ask: c.ask || 0,
          volume: c.volume || 0,
          openInterest: c.openInterest || 0,
          impliedVolatility: c.impliedVolatility || 0,
          delta: c.greeks?.delta || null,
          inTheMoney: c.inTheMoney || false,
          type,
        }));

      result.push({
        date: dateStr,
        daysToExpiration: days,
        calls: process(exp.calls || [], 'call'),
        puts: process(exp.puts || [], 'put'),
      });
    }

    return NextResponse.json({
      symbol: sym,
      currentPrice: price,
      nextExpirations: result,
    });
  } catch (error: any) {
    console.error('Options chain error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
