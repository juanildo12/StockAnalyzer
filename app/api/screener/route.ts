import { NextResponse } from 'next/server';

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
  epsCurrentYear?: number;
  price?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekChange?: number;
  analystTargetPrice?: number;
  analystRating?: string;
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
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', sector: 'Financial' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial' },
  { symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Defensive' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.', sector: 'Healthcare' },
  { symbol: 'HD', name: 'Home Depot Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial' },
  { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication Services' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.', sector: 'Financial' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology' },
  { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Technology' },
  { symbol: 'IBM', name: 'IBM Corporation', sector: 'Technology' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy' },
  { symbol: 'KO', name: 'Coca-Cola Company', sector: 'Consumer Defensive' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Defensive' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive' },
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Defensive' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
  { symbol: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare' },
  { symbol: 'ACN', name: 'Accenture plc', sector: 'Technology' },
  { symbol: 'MCD', name: "McDonald's Corporation", sector: 'Consumer Cyclical' },
  { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'BA', name: 'Boeing Company', sector: 'Industrials' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials' },
  { symbol: 'GE', name: 'General Electric', sector: 'Industrials' },
  { symbol: 'MMM', name: '3M Company', sector: 'Industrials' },
  { symbol: 'HON', name: 'Honeywell International', sector: 'Industrials' },
  { symbol: 'UPS', name: 'United Parcel Service', sector: 'Industrials' },
  { symbol: 'GS', name: 'Goldman Sachs Group', sector: 'Financial' },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financial' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financial' },
  { symbol: 'WFC', name: 'Wells Fargo & Co.', sector: 'Financial' },
  { symbol: 'AXP', name: 'American Express', sector: 'Financial' },
  { symbol: 'C', name: 'Citigroup Inc.', sector: 'Financial' },
  { symbol: 'BLK', name: 'BlackRock Inc.', sector: 'Financial' },
  { symbol: 'SCHW', name: 'Charles Schwab', sector: 'Financial' },
  { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication Services' },
  { symbol: 'VZ', name: 'Verizon Communications', sector: 'Communication Services' },
  { symbol: 'CMCSA', name: 'Comcast Corporation', sector: 'Communication Services' },
  { symbol: 'PM', name: 'Philip Morris', sector: 'Consumer Defensive' },
  { symbol: 'MDT', name: 'Medtronic plc', sector: 'Healthcare' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'Eli Lilly and Co.', sector: 'Healthcare' },
  { symbol: 'GILD', name: 'Gilead Sciences', sector: 'Healthcare' },
  { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare' },
  { symbol: 'ISRG', name: 'Intuitive Surgical', sector: 'Healthcare' },
  { symbol: 'TXN', name: 'Texas Instruments', sector: 'Technology' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Technology' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology' },
  { symbol: 'NOW', name: 'ServiceNow Inc.', sector: 'Technology' },
  { symbol: 'INTU', name: 'Intuit Inc.', sector: 'Technology' },
  { symbol: 'MU', name: 'Micron Technology', sector: 'Technology' },
  { symbol: 'LRCX', name: 'Lam Research', sector: 'Technology' },
  { symbol: 'AMAT', name: 'Applied Materials', sector: 'Technology' },
  { symbol: 'ADI', name: 'Analog Devices', sector: 'Technology' },
  { symbol: 'MCHP', name: 'Microchip Technology', sector: 'Technology' },
  { symbol: 'F', name: 'Ford Motor Co.', sector: 'Consumer Cyclical' },
  { symbol: 'GM', name: 'General Motors', sector: 'Consumer Cyclical' },
  { symbol: 'RIVN', name: 'Rivian Automotive', sector: 'Consumer Cyclical' },
  { symbol: 'NIO', name: 'NIO Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'UBER', name: 'Uber Technologies', sector: 'Technology' },
  { symbol: 'SPOT', name: 'Spotify Technology', sector: 'Communication Services' },
  { symbol: 'SNAP', name: 'Snap Inc.', sector: 'Communication Services' },
  { symbol: 'SQ', name: 'Block Inc.', sector: 'Financial' },
  { symbol: 'HOOD', name: 'Robinhood Markets', sector: 'Financial' },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Technology' },
  { symbol: 'DOGE-USD', name: 'Dogecoin', sector: 'Cryptocurrency' },
  { symbol: 'BTC-USD', name: 'Bitcoin', sector: 'Cryptocurrency' },
];

function generateMockFundamentals(symbol: string): StockSummary {
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (min: number, max: number) => Math.abs(Math.sin(seed * (min + max))) * (max - min) + min;
  const randomInt = (min: number, max: number) => Math.floor(random(min, max));
  const pick = <T>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];

  const sectors = ['Technology', 'Healthcare', 'Financial', 'Consumer Cyclical', 'Consumer Defensive', 'Energy', 'Industrials', 'Communication Services'];
  const industries = ['Software', 'Hardware', 'Semiconductors', 'Banking', 'Insurance', 'Retail', 'Pharmaceuticals', 'Oil & Gas'];
  
  const price = random(20, 500);
  const marketCap = price * random(100000000, 3000000000);
  const eps = random(1, 25);
  const bookValue = random(10, 200);
  const revenue = random(1000000000, 500000000000);
  const peRatio = price / eps;
  const priceToBook = price / bookValue;

  return {
    symbol,
    shortName: SAMPLE_STOCKS.find(s => s.symbol === symbol)?.name || symbol,
    sector: pick(sectors),
    industry: pick(industries),
    marketCap,
    peRatio: random(5, 50),
    pegRatio: random(0.5, 3),
    priceToBook,
    dividendYield: random(0, 5),
    epsTrailingTwelveMonths: eps,
    epsForward: eps * random(0.8, 1.2),
    price,
    fiftyTwoWeekHigh: price * random(1.05, 1.5),
    fiftyTwoWeekLow: price * random(0.5, 0.95),
    fiftyTwoWeekChange: random(-30, 50),
    debtToEquity: random(0, 200),
    returnOnEquity: random(5, 35),
    profitMargin: random(-10, 30),
    operatingMargin: random(-5, 35),
    grossMargin: random(20, 70),
    revenueGrowth: random(-10, 30),
    earningsGrowth: random(-20, 50),
    bookValue,
    totalRevenue: revenue,
    regularMarketPrice: price,
    regularMarketChange: random(-10, 15),
    regularMarketChangePercent: random(-5, 8),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  const action = searchParams.get('action') || 'quotes';

  try {
    if (action === 'screener') {
      const filteredStocks = SAMPLE_STOCKS.map(s => generateMockFundamentals(s.symbol));
      return NextResponse.json({
        stocks: filteredStocks,
        total: filteredStocks.length,
        screenerStocks: filteredStocks
      });
    }

    if (symbolsParam) {
      const symbols = symbolsParam.split(',');
      const summaries: StockSummary[] = [];
      
      for (const symbol of symbols) {
        try {
          const quoteRes = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0',
              },
            }
          );
          
          const quoteData = await quoteRes.json();
          const meta = quoteData?.chart?.result?.[0]?.meta;
          
          if (meta) {
            summaries.push({
              symbol,
              shortName: meta.shortName || meta.symbol || symbol,
              regularMarketPrice: meta.regularMarketPrice || meta.previousClose,
              regularMarketChange: meta.regularMarketChange || 0,
              regularMarketChangePercent: meta.regularMarketChangePercent || 0,
              fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
              fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
            });
          }
        } catch (e) {
          console.error(`Error fetching ${symbol}:`, e);
        }
      }
      
      return NextResponse.json({ summaries });
    }

    return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
  } catch (error) {
    console.error('Error in stock API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
