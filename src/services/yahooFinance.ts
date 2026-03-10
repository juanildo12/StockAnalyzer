import YahooFinance from 'yahoo-finance2';
import type {
  StockQuote,
  StockSummary,
  HistoricalData,
  AnalystPriceTarget,
} from '../types';

const yf = new YahooFinance();

const SYMBOL_MAP: Record<string, string> = {
  AAPL: 'Apple Inc',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc Class A',
  AMZN: 'Amazon.com Inc',
  NVDA: 'NVIDIA Corporation',
  META: 'Meta Platforms Inc',
  TSLA: 'Tesla Inc',
  JPM: 'JPMorgan Chase',
  V: 'Visa Inc',
  JNJ: 'Johnson & Johnson',
  WMT: 'Walmart Inc',
  PG: 'Procter & Gamble',
};

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const sym = symbol.toUpperCase();

  try {
    const quote: any = await yf.quote(sym);

    return {
      symbol: quote.symbol,
      shortName: quote.shortName || SYMBOL_MAP[sym] || sym,
      longName: quote.longName || quote.shortName || SYMBOL_MAP[sym] || sym,
      currency: quote.currency || 'USD',
      regularMarketPrice: quote.regularMarketPrice || 0,
      regularMarketChange: quote.regularMarketChange || 0,
      regularMarketChangePercent: quote.regularMarketChangePercent || 0,
      regularMarketDayHigh: quote.regularMarketDayHigh || 0,
      regularMarketDayLow: quote.regularMarketDayLow || 0,
      regularMarketVolume: quote.regularMarketVolume || 0,
      regularMarketOpen: quote.regularMarketOpen || 0,
      regularMarketPreviousClose: quote.previousClose || quote.regularMarketPreviousClose || 0,
      postMarketPrice: quote.postMarketPrice || 0,
      postMarketChange: quote.postMarketChange || 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
      targetMeanPrice: quote.targetMeanPrice || 0,
      targetHighPrice: quote.targetHighPrice || 0,
      targetLowPrice: quote.targetLowPrice || 0,
      recommendationKey: quote.recommendationKey || 'none',
      numberOfAnalystOpinions: quote.numberOfAnalystOpinions || 0,
      marketCap: quote.marketCap || 0,
      peRatio: quote.trailingPE || 0,
    };
  } catch (e: any) {
    throw new Error(`Error: ${e.message}`);
  }
}

export async function getStockSummary(
  symbol: string,
): Promise<StockSummary | null> {
  const sym = symbol.toUpperCase();

  try {
    const quote: any = await yf.quote(sym);

    return {
      marketCap: quote.marketCap || 0,
      peRatio: quote.trailingPE || 0,
      pegRatio: 0,
      epsTrailingTwelveMonths: 0,
      epsForward: 0,
      beta: 0,
      dividendYield: (quote.dividendYield || 0) * 100,
      dividendRate: quote.dividendRate || 0,
      bookValue: 0,
      priceToBook: 0,
      priceToSalesTrailingTwelveMonths: 0,
      trailingAnnualDividendYield: (quote.dividendYield || 0) * 100,
      exDividendDate: '',
      profitMargins: quote.profitMargins || 0,
      operatingMargins: quote.operatingMargins || 0,
      returnOnAssets: quote.returnOnAssets || 0,
      returnOnEquity: quote.returnOnEquity || 0,
      grossProfits: 0,
      totalCash: 0,
      totalDebt: 0,
      totalRevenue: quote.revenueTTM || 0,
      revenuePerShare: quote.revenuePerShare || 0,
      revenueGrowth: quote.revenueGrowth || 0,
      earningsGrowth: quote.earningsGrowth || 0,
      grossMargins: quote.grossMargins || 0,
      ebitdaMargins: quote.ebitdaMargins || 0,
      operatingCashflow: 0,
      freeCashflow: 0,
    };
  } catch (e) {
    return null;
  }
}

export async function getHistoricalData(
  symbol: string,
): Promise<HistoricalData[]> {
  const sym = symbol.toUpperCase();

  try {
    const result: any = await yf.historical(sym, {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d',
    });

    return result.map((item: any) => ({
      date: item.date.toISOString().split('T')[0],
      close: item.close,
      high: item.high,
      low: item.low,
      open: item.open,
      volume: item.volume,
    }));
  } catch (e) {
    return [];
  }
}

export async function getAnalystPriceTargets(
  symbol: string,
): Promise<AnalystPriceTarget | null> {
  const sym = symbol.toUpperCase();

  try {
    const quote: any = await yf.quote(sym);
    
    if (!quote.targetMeanPrice) {
      return null;
    }

    return {
      symbol: sym,
      targetMean: quote.targetMeanPrice || 0,
      targetHigh: quote.targetHighPrice || 0,
      targetLow: quote.targetLowPrice || 0,
      targetMedian: quote.targetMedianPrice || 0,
      numberOfAnalysts: quote.numberOfAnalystOpinions || 0,
    };
  } catch (e) {
    return null;
  }
}

export async function getStockData(symbol: string) {
  const [quote, summary, historical, priceTarget] = await Promise.all([
    getStockQuote(symbol),
    getStockSummary(symbol).catch(() => null),
    getHistoricalData(symbol),
    getAnalystPriceTargets(symbol).catch(() => null),
  ]);

  return { quote, summary, historical, priceTarget };
}
