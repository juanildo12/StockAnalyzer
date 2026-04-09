import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getOptionsAnalysis, evaluateStockForOptions } from '../../../src/services/options';
import { getStockQuote, getTechnicalAnalysis, getHistoricalData } from '../../../src/services/yahooFinance';

const yf = new YahooFinance();

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
    try {
      const TOP_STOCKS = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'JPM',
        'BAC', 'WMT', 'HD', 'DIS', 'NFLX', 'PYPL', 'SQ', 'COIN', 'UBER', 'COST',
        'MCD', 'NKE', 'CRM', 'V', 'MA', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK'
      ];

      const results = await Promise.all(
        TOP_STOCKS.map(async (sym) => {
          try {
            const [quote, analysis] = await Promise.all([
              yf.quote(sym).catch(() => null),
              getOptionsAnalysis(sym),
            ]);

            if (!analysis) return null;

            const earningsDate = analysis.earningsDate;
            const now = new Date();
            const isNear = earningsDate && (new Date(earningsDate).getTime() - now.getTime()) < 30 * 24 * 60 * 60 * 1000;

            return {
              symbol: sym,
              name: quote?.shortName || sym,
              price: analysis.currentPrice,
              change: quote?.regularMarketChange || 0,
              changePercent: quote?.regularMarketChangePercent || 0,
              sector: quote?.sector || 'Unknown',
              marketCap: quote?.marketCap || 0,
              volume: quote?.regularMarketVolume || 0,
              avgVolume: quote?.averageVolume || 0,
              iv: analysis.impliedVolatility,
              ivRank: analysis.ivRank,
              dividendYield: quote?.dividendYield || 0,
              nearEarnings: isNear,
              earningsDate: earningsDate,
              earningsEstimate: analysis.earningsEstimate,
              suitabilityScore: analysis.recommendedStrategies[0]?.suitabilityScore || 50,
              recommendation: 'regular',
              reasons: [analysis.recommendedStrategies[0]?.rationale || ''],
              topStrategy: analysis.recommendedStrategies[0]?.strategy?.name || 'Long Call',
              recommendedStrategies: analysis.recommendedStrategies.slice(0, 3).map((r: any) => ({
                name: r.strategy?.name,
                score: r.suitabilityScore,
              })),
            };
          } catch {
            return null;
          }
        })
      );

      const scoredStocks = results.filter((r): r is NonNullable<typeof r> => r !== null);
      scoredStocks.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

      const excellent = scoredStocks.filter((r) => r.suitabilityScore >= 75);
      const buena = scoredStocks.filter((r) => r.suitabilityScore >= 55 && r.suitabilityScore < 75);
      const regular = scoredStocks.filter((r) => r.suitabilityScore >= 35 && r.suitabilityScore < 55);

      return NextResponse.json({
        all: scoredStocks,
        totalScanned: TOP_STOCKS.length,
        filteredCount: scoredStocks.length,
        summary: {
          excellent: excellent.length,
          buena: buena.length,
          regular: regular.length,
          notRecommended: scoredStocks.length - excellent.length - buena.length - regular.length,
        },
        topPicks: scoredStocks.slice(0, 5),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Screener error:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
}
