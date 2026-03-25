import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

interface ScreenerStock {
  symbol: string;
  shortName: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  peRatio?: number;
  pegRatio?: number;
  priceToBook?: number;
  priceToSales?: number;
  priceToFreeCashFlow?: number;
  dividendYield?: number;
  epsTrailingTwelveMonths?: number;
  epsForward?: number;
  price?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekChange?: number;
  debtToEquity?: number;
  returnOnEquity?: number;
  profitMargin?: number;
  operatingMargin?: number;
  grossMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  bookValue?: number;
  totalRevenue?: number;
  operatingCashFlow?: number;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

const SAMPLE_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'JNJ',
  'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'NFLX', 'INTC', 'AMD', 'CRM',
  'ORCL', 'ADBE', 'XOM', 'CVX', 'KO', 'PEP', 'WMT', 'COST', 'ABBV',
  'MRK', 'PFE', 'ABT', 'ACN', 'MCD', 'NKE', 'BA', 'CAT', 'GE', 'MMM',
  'HON', 'UPS', 'GS', 'MS', 'BAC', 'WFC', 'AXP', 'C', 'T', 'VZ',
  'CMCSA', 'PM', 'MDT', 'BMY', 'LLY', 'GILD', 'AMGN', 'ISRG', 'TXN',
  'QCOM', 'AVGO', 'NOW', 'INTU', 'MU', 'LRCX', 'AMAT', 'ADI', 'MCHP',
  'F', 'GM', 'UBER', 'IBM', 'CSCO', 'TMO'
];

function getRaw(value: any): any {
  if (value && typeof value === 'object' && 'raw' in value) {
    return value.raw;
  }
  return value;
}

async function fetchStockData(symbol: string): Promise<ScreenerStock | null> {
  try {
    const [quoteSummaryResult, quoteResult] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile']
      }),
      yf.quote(symbol)
    ]).catch(() => [null, null]);

    if (!quoteResult) return null;

    const qs = quoteSummaryResult as any;
    const summaryDetail = qs?.summaryDetail || {};
    const defaultKeyStatistics = qs?.defaultKeyStatistics || {};
    const financialData = qs?.financialData || {};
    const assetProfile = qs?.assetProfile || {};

    const marketCap = getRaw(summaryDetail.marketCap) || getRaw(defaultKeyStatistics.marketCap);
    const priceValue = quoteResult.regularMarketPrice || quoteResult.previousClose || 0;
    const bookValue = getRaw(defaultKeyStatistics.bookValue);
    const epsTrailing = getRaw(defaultKeyStatistics.trailingEps);
    const epsForward = getRaw(defaultKeyStatistics.forwardEps);
    const totalRevenue = getRaw(financialData.totalRevenue);
    const operatingCashFlow = getRaw(financialData.operatingCashflow);

    const priceToBook = getRaw(defaultKeyStatistics.priceToBook) || (priceValue && bookValue ? priceValue / bookValue : undefined);
    const priceToSales = totalRevenue && marketCap ? marketCap / totalRevenue : undefined;
    const priceToFreeCashFlow = operatingCashFlow && operatingCashFlow > 0 && marketCap ? marketCap / operatingCashFlow : undefined;

    return {
      symbol,
      shortName: quoteResult.shortName || quoteResult.longName || symbol,
      sector: assetProfile.sector,
      industry: assetProfile.industry,
      marketCap,
      peRatio: getRaw(summaryDetail.trailingPE) || (priceValue && epsTrailing ? priceValue / epsTrailing : undefined),
      pegRatio: getRaw(defaultKeyStatistics.pegRatio),
      priceToBook,
      priceToSales,
      priceToFreeCashFlow,
      dividendYield: (getRaw(summaryDetail.dividendYield) || 0) * 100,
      epsTrailingTwelveMonths: epsTrailing,
      epsForward,
      price: priceValue,
      fiftyTwoWeekHigh: quoteResult.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quoteResult.fiftyTwoWeekLow,
      fiftyTwoWeekChange: (quoteResult as any).fiftyTwoWeekHighChange,
      debtToEquity: getRaw(financialData.debtToEquity),
      returnOnEquity: getRaw(financialData.returnOnEquity) ? getRaw(financialData.returnOnEquity) * 100 : undefined,
      profitMargin: getRaw(financialData.profitMargins) ? getRaw(financialData.profitMargins) * 100 : undefined,
      operatingMargin: getRaw(financialData.operatingMargins) ? getRaw(financialData.operatingMargins) * 100 : undefined,
      grossMargin: getRaw(financialData.grossMargins) ? getRaw(financialData.grossMargins) * 100 : undefined,
      revenueGrowth: getRaw(financialData.revenueGrowth) ? getRaw(financialData.revenueGrowth) * 100 : undefined,
      earningsGrowth: getRaw(financialData.earningsGrowth) ? getRaw(financialData.earningsGrowth) * 100 : undefined,
      bookValue,
      totalRevenue,
      operatingCashFlow,
      regularMarketPrice: quoteResult.regularMarketPrice,
      regularMarketChange: quoteResult.regularMarketChange,
      regularMarketChangePercent: quoteResult.regularMarketChangePercent,
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, (error as Error).message);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'screener';

  try {
    if (action === 'screener') {
      const results: ScreenerStock[] = [];
      
      const batchSize = 5;
      for (let i = 0; i < SAMPLE_STOCKS.length; i += batchSize) {
        const batch = SAMPLE_STOCKS.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(s => fetchStockData(s)));
        results.push(...batchResults.filter((r): r is ScreenerStock => r !== null));
      }

      return NextResponse.json(
        {
          stocks: results,
          total: results.length,
          screenerStocks: results,
          timestamp: Date.now()
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in screener API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
