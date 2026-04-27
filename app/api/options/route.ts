import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getOptionsAnalysis, evaluateStockForOptions } from '../../../src/services/options';
import { getStockQuote, getTechnicalAnalysis, getHistoricalData } from '../../../src/services/yahooFinance';

const yf = new YahooFinance();

const QUALITY_POOL = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'JPM',
  'BAC', 'WMT', 'HD', 'DIS', 'NFLX', 'PYPL', 'SQ', 'COIN', 'UBER', 'COST',
  'MCD', 'NKE', 'CRM', 'V', 'MA', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK',
  'AVGO', 'QCOM', 'MU', 'TXN', 'NOW', 'ORCL', 'ADBE', 'SNOW', 'DDOG', 'CRWD',
  'ZS', 'WDAY', 'TEAM', 'NET', 'OKTA', 'SNAP', 'ROKU', 'PLTR', 'RBLX', 'U',
  'BKNG', 'SBUX', 'LULU', 'ROST', 'TJX', 'DG', 'DLTR', 'ETSY', 'GM', 'F',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'DVN', 'FANG', 'MPC', 'HAL', 'OXY',
  'CAT', 'DE', 'BA', 'HON', 'GE', 'UPS', 'FDX', 'LMT', 'RTX', 'NOC',
  'LLY', 'BMY', 'AMGN', 'GILD', 'REGN', 'VRTX', 'MRNA', 'CNC', 'HUM',
  'SPOT', 'DASH', 'LYFT', 'HOOD', 'AFRM', 'OPEN', 'SNOW', 'SE', 'PATH',
  'BABA', 'JD', 'PDD', 'BIDU', 'MELI', 'SE', 'AYX', 'DOCU', 'ZM', 'TWLO',
  'RIVN', 'LCID', 'STLA', 'GM', 'F', 'TM', 'RACE', 'PAG',
  'MSTR', 'MARA', 'RIOT', 'GME', 'AMC',
  'AAL', 'DAL', 'UAL', 'LUV', 'RCL', 'CCL', 'MGM', 'WYNN', 'LVS',
  'PARA', 'WBD', 'CMCSA', 'FOX', 'NWSA',
  'GOLD', 'NEM', 'AEM', 'FNV',
  'KLAC', 'LRCX', 'AMAT', 'ASML', 'SMCI', 'MRVL', 'MPWR', 'TER',
  'GS', 'MS', 'C', 'WFC', 'SCHW', 'BLK', 'AXP', 'DFS', 'SYF',
];

function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dateToSeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

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
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dateStr = today.toISOString().split('T')[0];

      const DAILY_STOCKS = QUALITY_POOL;
      const dailySeed = dateToSeed(today);
      const dailyStocks = seededShuffle(DAILY_STOCKS, dailySeed).slice(0, 50);

      const results = await Promise.all(
        dailyStocks.map(async (sym) => {
          try {
            const [quote, analysis] = await Promise.all([
              yf.quote(sym).catch(() => null),
              getOptionsAnalysis(sym).catch(() => null),
            ]);

            if (!analysis) return null;

            const earningsDate = analysis.earningsDate;
            const now = new Date();
            const daysUntilEarnings = earningsDate
              ? Math.ceil((new Date(earningsDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const isNear = daysUntilEarnings !== null && daysUntilEarnings >= 0 && daysUntilEarnings <= 30;

            const volumeRatio = quote?.averageVolume && quote?.regularMarketVolume
              ? quote.regularMarketVolume / quote.averageVolume
              : 1;

            let ivBoost = 0;
            if (analysis.impliedVolatility > 0.6) ivBoost = 15;
            else if (analysis.impliedVolatility > 0.4) ivBoost = 8;
            else if (analysis.impliedVolatility > 0.25) ivBoost = 3;

            let volumeBoost = 0;
            if (volumeRatio > 1.8) volumeBoost = 12;
            else if (volumeRatio > 1.3) volumeBoost = 6;
            else if (volumeRatio > 1.0) volumeBoost = 2;

            let earningsBoost = 0;
            if (isNear && daysUntilEarnings! <= 7) earningsBoost = 20;
            else if (isNear && daysUntilEarnings! <= 14) earningsBoost = 12;
            else if (isNear && daysUntilEarnings! <= 30) earningsBoost = 5;

            const trendBoost = analysis.stockTrend === 'Alcista' ? 5 : analysis.stockTrend === 'Bajista' ? -5 : 0;

            const baseScore = analysis.recommendedStrategies[0]?.suitabilityScore || 50;
            const adjustedScore = Math.min(100, Math.max(0, baseScore + ivBoost + volumeBoost + earningsBoost + trendBoost));

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
              volumeRatio: volumeRatio,
              iv: analysis.impliedVolatility,
              ivRank: analysis.ivRank,
              ivPercentile: analysis.ivPercentile,
              dividendYield: quote?.dividendYield || 0,
              nearEarnings: isNear,
              daysUntilEarnings: daysUntilEarnings,
              earningsDate: earningsDate,
              earningsEstimate: analysis.earningsEstimate,
              stockTrend: analysis.stockTrend,
              suitabilityScore: adjustedScore,
              recommendation: adjustedScore >= 75 ? 'excellent' : adjustedScore >= 55 ? 'buena' : adjustedScore >= 35 ? 'regular' : 'poor',
              reasons: [
                ...(analysis.recommendedStrategies[0]?.rationale ? [analysis.recommendedStrategies[0].rationale] : []),
                ...(ivBoost > 0 ? [`IV: ${(analysis.impliedVolatility * 100).toFixed(0)}% - primas buenas`] : []),
                ...(volumeBoost > 0 ? [`Vol: ${volumeRatio.toFixed(1)}x`] : []),
                ...(earningsBoost > 0 ? [`Earnings: ${daysUntilEarnings}d`] : []),
              ],
              topStrategy: analysis.recommendedStrategies[0]?.strategy?.name || 'Long Call',
              recommendedStrategies: analysis.recommendedStrategies.slice(0, 3).map((r: any) => ({
                name: r.strategy?.name,
                score: r.suitabilityScore,
                rationale: r.rationale,
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
        all: scoredStocks.slice(0, 30),
        totalScanned: scoredStocks.length,
        poolSize: QUALITY_POOL.length,
        filteredCount: scoredStocks.length,
        lastUpdated: new Date().toISOString(),
        screenerDate: dateStr,
        screenerDay: dayNames[dayOfWeek],
        summary: {
          excellent: excellent.length,
          buena: buena.length,
          regular: regular.length,
          notRecommended: scoredStocks.length - excellent.length - buena.length - regular.length,
        },
        topPicks: scoredStocks.slice(0, 5),
        nearEarnings: scoredStocks.filter((r) => r.nearEarnings),
        highIV: scoredStocks.filter((r) => r.iv > 0.4),
        highVolume: scoredStocks.filter((r) => r.volumeRatio > 1.2),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Screener error:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
}
