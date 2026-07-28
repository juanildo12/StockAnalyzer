import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';

function approxDelta(strike: number, price: number, isCall: boolean): number {
  if (!price || !strike) return 0;
  const m = price / strike;
  if (isCall) {
    if (m > 1.1) return Math.min(0.95, 0.5 + (m - 1) * 2);
    if (m < 0.9) return Math.max(0.05, 0.5 - (1 - m) * 2);
    return 0.4 + (m - 0.9) * 1.5;
  } else {
    if (m < 0.9) return Math.max(-0.95, -0.5 + (1 - m) * 2);
    if (m > 1.1) return Math.min(-0.05, -0.5 - (m - 1) * 2);
    return -0.4 - (0.9 - m) * 1.5;
  }
}

function bestContract(contracts: any[], price: number, isCall: boolean): any {
  const withVol = contracts.filter((c: any) => (c.openInterest || 0) > 50 || (c.volume || 0) > 10);
  const pool = withVol.length > 0 ? withVol : contracts;
  const scored = pool.map((c: any) => {
    const dist = Math.abs(c.strike - price) / price;
    const oi = c.openInterest || 0;
    const vol = c.volume || 0;
    const moneyness = isCall
      ? (c.strike - price) / price
      : (price - c.strike) / price;
    const isITM = isCall ? c.strike < price : c.strike > price;
    const isOTM = !isITM && moneyness > 0;
    const farITMpenalty = isITM && moneyness < -0.1 ? Math.abs(moneyness + 0.1) * 150 : 0;
    const itmPenalty = isITM ? Math.abs(moneyness) * 80 : 0;
    const oiVolScore = Math.min(oi + vol, 20000) / 20000 * 40;
    // Strongly prefer slightly OTM (0-5% above price for calls)
    const otmBonus = isOTM && moneyness < 0.05 ? 30 : isOTM && moneyness < 0.10 ? 15 : 0;
    const score = -dist * 60 + oiVolScore - farITMpenalty - itmPenalty + otmBonus;
    return { ...c, _score: score };
  });
  scored.sort((a: any, b: any) => b._score - a._score);
  return scored[0] || null;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const direction = (request.nextUrl.searchParams.get('direction') || 'CALL').toUpperCase();

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
      return NextResponse.json({ error: 'No quote data', symbol: sym }, { status: 404 });
    }

    const price = quote.regularMarketPrice;
    const isCall = direction === 'CALL';
    let bestMatch = null;
    let expirationInfo = null;

    if (chain && chain.options && chain.options.length > 0) {
      const expirations = chain.options.slice(0, 4);

      // Prefer 1-3 weeks out for swing trades
      const now = Date.now();
      const scored = expirations.map((exp: any) => {
        const expDate = typeof exp.expirationDate === 'string'
          ? new Date(exp.expirationDate)
          : new Date(exp.expirationDate);
        const days = Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24));
        const dateStr = expDate.toISOString().split('T')[0];

        const contracts = isCall ? (exp.calls || []) : (exp.puts || []);
        const best = bestContract(contracts, price, isCall);

        // Prefer 7-30 DTE
        const dteScore = days >= 7 && days <= 30 ? 10 : days >= 3 && days <= 45 ? 5 : 0;

        return { exp, best, days, dateStr, dteScore };
      });

      // Sort by: has contract + DTE preference + closer to 14 days ideal
      scored.sort((a: any, b: any) => {
        if (a.best && !b.best) return -1;
        if (!a.best && b.best) return 1;
        const aDteScore = a.dteScore + (14 - Math.abs(a.days - 14)) * 0.5;
        const bDteScore = b.dteScore + (14 - Math.abs(b.days - 14)) * 0.5;
        return bDteScore - aDteScore;
      });

      const winner = scored[0];
      if (winner && winner.best) {
        const c = winner.best;
        const delta = c.delta || c.greeks?.delta || approxDelta(c.strike, price, isCall);

        bestMatch = {
          strike: c.strike,
          expiration: winner.dateStr,
          daysToExpiration: winner.days,
          premium: c.lastPrice || ((c.bid || 0) + (c.ask || 0)) / 2 || 0,
          delta,
          volume: c.volume || 0,
          openInterest: c.openInterest || 0,
          impliedVolatility: c.impliedVolatility || 0,
          bid: c.bid || 0,
          ask: c.ask || 0,
          inTheMoney: c.inTheMoney || false,
        };
        expirationInfo = {
          date: winner.dateStr,
          daysToExpiration: winner.days,
          totalExpirations: chain.options.length,
        };
      }
    }

    return NextResponse.json({
      symbol: sym,
      company: quote.shortName || quote.longName || sym,
      currentPrice: price,
      direction: isCall ? 'CALL' : 'PUT',
      contract: bestMatch,
      expirationInfo,
      quote: {
        price,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        marketCap: quote.marketCap || 0,
        pe: quote.peRatio || null,
        high52w: quote.fiftyTwoWeekHigh || null,
        low52w: quote.fiftyTwoWeekLow || null,
      },
    });
  } catch (error: any) {
    console.error('[ProspectPick] Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
