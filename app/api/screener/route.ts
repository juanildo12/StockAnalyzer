import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

interface StockSummary {
  symbol: string;
  shortName: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  peRatio?: number;
  pegRatio?: number;
  priceToBook?: number;
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
  'F', 'GM', 'UBER', 'SQ', 'IBM', 'CSCO', 'TMO'
];

async function fetchRealStockData(symbol: string): Promise<StockSummary | null> {
  try {
    const [quoteSummaryRaw, quote] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile']
      }),
      yf.quote(symbol)
    ]);

    if (!quote) return null;

    const quoteSummary = quoteSummaryRaw as any;
    const summaryDetail = quoteSummary?.summaryDetail || {};
    const defaultKeyStatistics = quoteSummary?.defaultKeyStatistics || {};
    const financialData = quoteSummary?.financialData || {};
    const assetProfile = quoteSummary?.assetProfile || {};

    const marketCap = summaryDetail.marketCap || defaultKeyStatistics.marketCap;
    const priceValue = quote.regularMarketPrice || quote.previousClose || 0;
    const bookValue = defaultKeyStatistics.bookValue;
    const epsTrailing = defaultKeyStatistics.trailingEps;
    const epsForward = defaultKeyStatistics.forwardEps;

    const getRaw = (val: any) => (typeof val === 'object' && val !== null && 'raw' in val) ? val.raw : val;

    return {
      symbol,
      shortName: quote.shortName || quote.longName || symbol,
      sector: assetProfile.sector,
      industry: assetProfile.industry,
      marketCap: getRaw(marketCap),
      peRatio: getRaw(summaryDetail.trailingPE) || (priceValue && epsTrailing ? priceValue / getRaw(epsTrailing) : undefined),
      pegRatio: getRaw(defaultKeyStatistics.pegRatio),
      priceToBook: priceValue && bookValue ? priceValue / getRaw(bookValue) : undefined,
      dividendYield: getRaw(summaryDetail.dividendYield),
      epsTrailingTwelveMonths: getRaw(epsTrailing),
      epsForward: getRaw(epsForward),
      price: priceValue,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekChange: quote.fiftyTwoWeekHighChange,
      debtToEquity: getRaw(financialData.debtToEquity),
      returnOnEquity: getRaw(financialData.returnOnEquity),
      profitMargin: getRaw(financialData.profitMargins),
      operatingMargin: getRaw(financialData.operatingMargins),
      grossMargin: getRaw(financialData.grossMargins),
      revenueGrowth: getRaw(financialData.revenueGrowth),
      earningsGrowth: getRaw(financialData.earningsGrowth),
      bookValue: getRaw(bookValue),
      totalRevenue: getRaw(financialData.totalRevenue),
      regularMarketPrice: quote.regularMarketPrice,
      regularMarketChange: quote.regularMarketChange,
      regularMarketChangePercent: quote.regularMarketChangePercent,
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
      const results: StockSummary[] = [];
      
      const batchSize = 5;
      for (let i = 0; i < SAMPLE_STOCKS.length; i += batchSize) {
        const batch = SAMPLE_STOCKS.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(s => fetchRealStockData(s)));
        results.push(...batchResults.filter((r): r is StockSummary => r !== null));
      }

      return NextResponse.json({
        stocks: results,
        total: results.length,
        screenerStocks: results
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in screener API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
