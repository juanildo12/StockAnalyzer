import type {
  StockQuote,
  StockSummary,
  HistoricalData,
  AnalystPriceTarget,
} from '../types';

const ALPHA_VANTAGE_KEY = 'X1ZRC7915KT6TOHF';
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

const SYMBOL_MAP: Record<string, string> = {
  AAPL: 'Apple Inc',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc Class A',
  AMZN: 'Amazon.com Inc',
  NVDA: 'NVIDIA Corporation',
  META: 'Meta Platforms Inc',
  TSLA: 'Tesla Inc',
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const sym = symbol.toUpperCase();

  try {
    const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const quote = data['Global Quote'];

    if (!quote || !quote['05. price']) {
      throw new Error(`Ticker "${sym}" no encontrado`);
    }

    return {
      symbol: quote['01. symbol'] || sym,
      shortName: SYMBOL_MAP[sym] || sym,
      longName: SYMBOL_MAP[sym] || sym,
      currency: quote['08. currency'] || 'USD',
      regularMarketPrice: parseFloat(quote['05. price']) || 0,
      regularMarketChange: parseFloat(quote['09. change']) || 0,
      regularMarketChangePercent: parseFloat(quote['10. change percent']?.replace('%', '')) || 0,
      regularMarketDayHigh: parseFloat(quote['03. high']) || 0,
      regularMarketDayLow: parseFloat(quote['04. low']) || 0,
      regularMarketVolume: parseInt(quote['06. volume']) || 0,
      regularMarketOpen: parseFloat(quote['02. open']) || 0,
      regularMarketPreviousClose: parseFloat(quote['08. previous close']) || 0,
      fiftyTwoWeekHigh: parseFloat(quote['52. high']) || 0,
      fiftyTwoWeekLow: parseFloat(quote['52. low']) || 0,
      targetMeanPrice: 0,
      targetHighPrice: 0,
      targetLowPrice: 0,
      recommendationKey: 'none',
      numberOfAnalystOpinions: 0,
      marketCap: 0,
      peRatio: 0,
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
    const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${sym}&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data || data.Note || data.Information) {
      return null;
    }

    return {
      marketCap: parseInt(data.MarketCapitalization) * 1000000 || 0,
      peRatio: parseFloat(data.PERatio) || 0,
      pegRatio: parseFloat(data.PEGRatio) || 0,
      epsTrailingTwelveMonths: parseFloat(data.EPSTTM) || 0,
      epsForward: parseFloat(data.ForwardEPS) || 0,
      beta: parseFloat(data.Beta) || 0,
      dividendYield: parseFloat(data.DividendYield) || 0,
      dividendRate: parseFloat(data.DividendRate) || 0,
      bookValue: parseFloat(data.BookValue) || 0,
      priceToBook: parseFloat(data.PriceToBookRatio) || 0,
      priceToSalesTrailingTwelveMonths: parseFloat(data.PriceToSalesRatioTTM) || 0,
      trailingAnnualDividendYield: parseFloat(data.DividendYield) || 0,
      exDividendDate: data.ExDividendDate || '',
      profitMargins: parseFloat(data.ProfitMargin) || 0,
      operatingMargins: parseFloat(data.OperatingMargin) || 0,
      returnOnAssets: parseFloat(data.ReturnOnAssets) || 0,
      returnOnEquity: parseFloat(data.ReturnOnEquity) || 0,
      grossProfits: parseFloat(data.GrossProfitTTM) || 0,
      totalCash: 0,
      totalDebt: 0,
      totalRevenue: parseFloat(data.RevenueTTM) || 0,
      revenuePerShare: parseFloat(data.RevenuePerShareTTM) || 0,
      revenueGrowth: parseFloat(data.RevenueGrowth) || 0,
      earningsGrowth: parseFloat(data.EarningsGrowth) || 0,
      grossMargins: parseFloat(data.GrossProfitTTM) || 0,
      ebitdaMargins: 0,
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
    const url = `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${sym}&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const timeSeries = data['Time Series (Daily)'];

    if (!timeSeries) {
      return [];
    }

    const dates = Object.keys(timeSeries).slice(0, 365).reverse();

    return dates.map((date) => {
      const day = timeSeries[date];
      return {
        date,
        close: parseFloat(day['4. close']),
        high: parseFloat(day['2. high']),
        low: parseFloat(day['3. low']),
        open: parseFloat(day['1. open']),
        volume: parseInt(day['5. volume']),
      };
    });
  } catch (e) {
    return [];
  }
}

export async function getAnalystPriceTargets(
  symbol: string,
): Promise<AnalystPriceTarget | null> {
  return null;
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
