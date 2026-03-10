export interface StockQuote {
  symbol: string;
  shortName: string;
  longName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketOpen: number;
  regularMarketPreviousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  targetMeanPrice: number;
  targetHighPrice: number;
  targetLowPrice: number;
  recommendationKey: string;
  numberOfAnalystOpinions: number;
  marketCap: number;
  peRatio: number;
  postMarketPrice?: number;
  postMarketChange?: number;
}

export interface StockSummary {
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  epsTrailingTwelveMonths: number;
  epsForward: number;
  beta: number;
  dividendYield: number;
  dividendRate: number;
  bookValue: number;
  priceToBook: number;
  priceToSalesTrailingTwelveMonths: number;
  trailingAnnualDividendYield: number;
  exDividendDate: string;
  profitMargins: number;
  operatingMargins: number;
  returnOnAssets: number;
  returnOnEquity: number;
  grossProfits: number;
  totalCash: number;
  totalDebt: number;
  totalRevenue: number;
  revenuePerShare: number;
  revenueGrowth: number;
  earningsGrowth: number;
  grossMargins: number;
  ebitdaMargins: number;
  operatingCashflow: number;
  freeCashflow: number;
}

export interface HistoricalData {
  date: string;
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

export interface AnalystPriceTarget {
  symbol: string;
  targetMean: number;
  targetHigh: number;
  targetLow: number;
  targetMedian: number;
  numberOfAnalysts: number;
}

export interface StockAnalysis {
  quote: StockQuote;
  summary: StockSummary | null;
  historical: HistoricalData[];
  priceTarget: AnalystPriceTarget | null;
  fundamentals: FundamentalsAnalysis;
  discountScore: number;
  recommendation: Recommendation;
}

export interface FundamentalsAnalysis {
  principle1: PrincipleResult;
  principle2: PrincipleResult;
  principle3: PrincipleResult;
  principle4: PrincipleResult;
  principle5: PrincipleResult;
  principle6: PrincipleResult;
  principle7: PrincipleResult;
  principle8: PrincipleResult;
  principle9: PrincipleResult;
}

export interface PrincipleResult {
  name: string;
  description: string;
  value: number;
  threshold: number;
  isInDiscount: boolean;
  details: string;
}

export interface Recommendation {
  action: 'COMPRAR' | 'MANTENER' | 'VENDER';
  confidence: number;
  reasoning: string;
  summary: string;
  buyZoneLow: number;
  buyZoneHigh: number;
  targetPrice: number;
  stopLoss: number;
}

export interface PortfolioItem {
  symbol: string;
  addedAt: string;
  lastPriceUpdate?: string;
  analysis: StockAnalysis;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
