import type {
  StockQuote,
  StockSummary,
  HistoricalData,
  AnalystPriceTarget,
} from '../types';

const ALPHA_VANTAGE_KEY = '68GKXL4N6LO9KJHW';
const FINNHUB_API_KEY = 'ctq07hr01qns0f36u8hgctq07hr01qns0f36u8i0';
const ALPHA_BASE = 'https://www.alphavantage.co/query';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

let lastCallTime = 0;
const MIN_DELAY_MS = 15000;

async function rateLimitDelay() {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_DELAY_MS) {
    const waitTime = MIN_DELAY_MS - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastCallTime = Date.now();
}

async function fetchAV(
  functionName: string,
  symbol: string,
  extraParams: string = '',
): Promise<any> {
  await rateLimitDelay();

  let url = `${ALPHA_BASE}?function=${functionName}&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
  console.log(url);
  if (extraParams) url += `&${extraParams}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (data['Note'] || data['Information']) {
    throw new Error(
      'Límite de API alcanzado. Espera 15 segundos entre búsquedas.',
    );
  }

  if (data['Error Message']) {
    throw new Error(`Ticker "${symbol}" no encontrado`);
  }

  return data;
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const sym = symbol.toUpperCase();

  try {
    const data = await fetchAV('GLOBAL_QUOTE', sym);
    const q = data['Global Quote'];

    if (!q || !q['05. price']) {
      throw new Error(`Ticker "${sym}" no encontrado`);
    }

    return {
      symbol: q['01. symbol'] || sym,
      shortName: sym,
      longName: sym,
      currency: 'USD',
      regularMarketPrice: parseFloat(q['05. price']) || 0,
      regularMarketChange: parseFloat(q['09. change']) || 0,
      regularMarketChangePercent:
        parseFloat(q['10. change percent']?.replace('%', '')) || 0,
      regularMarketDayHigh: parseFloat(q['03. high']) || 0,
      regularMarketDayLow: parseFloat(q['04. low']) || 0,
      regularMarketVolume: parseInt(q['06. volume']) || 0,
      regularMarketOpen: parseFloat(q['02. open']) || 0,
      regularMarketPreviousClose: parseFloat(q['08. previous close']) || 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
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
    const data = await fetchAV('OVERVIEW', sym);

    if (!data || !data['Symbol']) {
      return null;
    }

    return {
      marketCap: parseInt(data['MarketCapitalization'] || '0') * 1000000,
      peRatio: parseFloat(data['PERatio'] || '0'),
      pegRatio: parseFloat(data['PEGRatio'] || '0'),
      epsTrailingTwelveMonths: parseFloat(data['EPS'] || '0'),
      epsForward: 0,
      beta: parseFloat(data['Beta'] || '0'),
      dividendYield: parseFloat(data['DividendYield'] || '0') / 100,
      dividendRate: parseFloat(data['DividendPerShare'] || '0'),
      bookValue: parseFloat(data['BookValue'] || '0'),
      priceToBook: parseFloat(data['PriceToBookRatio'] || '0'),
      priceToSalesTrailingTwelveMonths: parseFloat(
        data['PriceToSalesRatioTTM'] || '0',
      ),
      trailingAnnualDividendYield:
        parseFloat(data['DividendYield'] || '0') / 100,
      exDividendDate: data['ExDividendDate'] || '',
      profitMargins: parseFloat(data['ProfitMargin'] || '0') / 100,
      operatingMargins: parseFloat(data['OperatingMargin'] || '0') / 100,
      returnOnAssets: parseFloat(data['ReturnOnAssets'] || '0') / 100,
      returnOnEquity: parseFloat(data['ReturnOnEquity'] || '0') / 100,
      grossProfits: parseFloat(data['GrossProfitTTM'] || '0'),
      totalCash: 0,
      totalDebt: parseFloat(data['EVToDebt'] || '0') * 1000000,
      totalRevenue: parseFloat(data['RevenueTTM'] || '0') * 1000000,
      revenuePerShare: parseFloat(data['RevenuePerShareTTM'] || '0'),
      revenueGrowth: parseFloat(data['RevenueGrowth'] || '0') / 100,
      earningsGrowth: parseFloat(data['EPSGrowth'] || '0') / 100,
      grossMargins:
        parseFloat(data['GrossProfitTTM'] || '0') /
        parseFloat(data['RevenueTTM'] || '1'),
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
    const data = await fetchAV('TIME_SERIES_DAILY', sym, 'outputsize=compact');
    const timeSeries = data['Time Series (Daily)'];

    if (!timeSeries) return [];

    const dates = Object.keys(timeSeries).slice(0, 100).reverse();

    return dates
      .map(date => {
        const day = timeSeries[date];
        return {
          date,
          close: parseFloat(day['4. close']) || 0,
          high: parseFloat(day['2. high']) || 0,
          low: parseFloat(day['3. low']) || 0,
          open: parseFloat(day['1. open']) || 0,
          volume: parseInt(day['5. volume']) || 0,
        };
      })
      .filter(d => d.close > 0);
  } catch (e) {
    return [];
  }
}

export async function getAnalystPriceTargets(
  symbol: string,
): Promise<AnalystPriceTarget | null> {
  const sym = symbol.toUpperCase();

  try {
    const url = `${FINNHUB_BASE}/stock/price-target?symbol=${sym}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data || !data.symbol || !data.targetMean) {
      return null;
    }

    return {
      symbol: data.symbol || sym,
      targetMean: data.targetMean || 0,
      targetHigh: data.targetHigh || 0,
      targetLow: data.targetLow || 0,
      targetMedian: data.targetMedian || 0,
      numberOfAnalysts: data.numberOfAnalysts || 0,
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
