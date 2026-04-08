import { NextRequest, NextResponse } from 'next/server';
import { getOptionsAnalysis, evaluateStockForOptions } from '../../../src/services/options';
import { getStockQuote, getTechnicalAnalysis, getHistoricalData } from '../../../src/services/yahooFinance';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const screen = request.nextUrl.searchParams.get('screen');

  if (!symbol && !screen) {
    return NextResponse.json({ error: 'Symbol or screen parameter required' }, { status: 400 });
  }

  if (symbol) {
    const sym = symbol.toUpperCase();

    try {
      const [quote, historical, technical, optionsAnalysis]: [any, any, any, any] = await Promise.all([
        getStockQuote(sym).catch(() => null),
        getHistoricalData(sym).catch(() => []),
        getTechnicalAnalysis(sym).catch(() => null),
        getOptionsAnalysis(sym).catch(() => null),
      ]);

      if (!quote) {
        return NextResponse.json({ error: `Ticker "${sym}" no encontrado` }, { status: 404 });
      }

      const stockEvaluation = evaluateStockForOptions(sym, quote, technical, historical);

      return NextResponse.json({
        optionsAnalysis,
        stockEvaluation,
        quote: {
          symbol: quote.symbol,
          shortName: quote.shortName,
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          marketCap: quote.marketCap,
          volume: quote.regularMarketVolume,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          sector: quote.sector,
        },
        technical,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (screen === 'screener') {
    const popularStocks = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'JPM',
      'BAC', 'WMT', 'HD', 'DIS', 'NFLX', 'PYPL', 'SQ', 'COIN', 'SQ', 'UBER'
    ];

    try {
      const results = await Promise.all(
        popularStocks.map(async (sym) => {
          try {
            const [quote, historical, technical] = await Promise.all([
              getStockQuote(sym).catch(() => null),
              getHistoricalData(sym).catch(() => []),
              getTechnicalAnalysis(sym).catch(() => null),
            ]);

            if (!quote || !quote.regularMarketPrice) return null;

            const evaluation = evaluateStockForOptions(sym, quote, technical, historical);

            return {
              symbol: sym,
              name: quote.shortName,
              price: quote.regularMarketPrice,
              change: quote.regularMarketChange,
              changePercent: quote.regularMarketChangePercent,
              sector: quote.sector || 'Unknown',
              ...evaluation,
              keyMetrics: {
                ivRank: technical ? (quote.regularMarketPrice > 0 ? 50 : 0) : 0,
                trend: technical?.trend || 'lateral',
                volume: quote.regularMarketVolume || 0,
                dividendYield: quote.dividendYield || 0,
              },
            };
          } catch (e) {
            return null;
          }
        })
      );

      const validResults = results.filter((r) => r !== null);

      const sortedByScore = [...validResults].sort(
        (a, b) => (b?.suitabilityScore || 0) - (a?.suitabilityScore || 0)
      );

      const excellent = sortedByScore.filter((r) => r?.recommendation === 'excelente');
      const buena = sortedByScore.filter((r) => r?.recommendation === 'buena');
      const regular = sortedByScore.filter((r) => r?.recommendation === 'regular');

      return NextResponse.json({
        all: sortedByScore,
        summary: {
          excellent: excellent.length,
          buena: buena.length,
          regular: regular.length,
          notRecommended: validResults.length - excellent.length - buena.length - regular.length,
        },
        topPicks: sortedByScore.slice(0, 10),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
}
