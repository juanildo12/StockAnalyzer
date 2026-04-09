export interface TechnicalAnalysis {
  rsi: number;
  sma50: number;
  sma200: number;
  currentPrice: number;
  trend: 'alcista' | 'bajista' | 'lateral';
  support: number;
  resistance: number;
  signal: 'comprar' | 'vender' | 'neutral';
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
  targetCount?: number;
}

export interface PortfolioTransaction {
  id?: number;
  symbol: string;
  type: 'compra' | 'venta';
  shares: number;
  pricePerShare: number;
  totalValue: number;
  date: string;
  notes?: string;
}

export interface PortfolioPosition {
  id?: number;
  symbol: string;
  purchasePrice: number;
  shares: number;
  purchaseDate: string;
  currentPrice?: number;
  currentValue?: number;
  profitLoss?: number;
  profitLossPercent?: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  positions: PortfolioPosition[];
}

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
  sector?: string;
  industry?: string;
  businessSummary?: string;
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
  avgProfitMargin?: number;
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

export interface StockAnalysis {
  quote: StockQuote;
  summary: StockSummary | null;
  historical: HistoricalData[];
  priceTarget: AnalystPriceTarget | null;
  fundamentals: FundamentalsAnalysis;
  technical: TechnicalAnalysis | null;
  discountScore: number;
  recommendation: Recommendation;
}

export interface FCFHistoryData {
  year: number;
  freeCashFlow: number;
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
  principle10: PrincipleResult;
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
  purchasePrice?: number;
  shares?: number;
}

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  lastPriceUpdate?: string;
  notes?: string;
  alertPrice?: number;
  alertType?: 'above' | 'below';
  alertEnabled: boolean;
  analysis?: StockAnalysis;
  currentPrice?: number;
  changePercent?: number;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface TipRanksData {
  symbol: string;
  companyName: string;
  analystConsensus: string;
  priceTarget: number;
  highTarget: number;
  lowTarget: number;
  numberOfAnalysts: number;
  smartScore: number;
  buyCount: number;
  holdCount: number;
  sellCount: number;
  upside: number;
  lastUpdated: string;
}

export interface MacrotrendsData {
  symbol: string;
  profitMargins: {
    year: number;
    value: number;
  }[];
  peRatioHistory: {
    date: string;
    value: number;
  }[];
}

export interface MarketBeatData {
  symbol: string;
  consensusRating: string;
  averagePriceTarget: number;
  highPriceTarget: number;
  lowPriceTarget: number;
  numberOfAnalysts: number;
  buyRatings: number;
  holdRatings: number;
  sellRatings: number;
  lastUpdated: string;
}

export interface CircleUSDCData {
  symbol: string;
  totalCirculation: number;
  lastUpdated: string;
}

export interface GuruFocusData {
  symbol: string;
  peRatio: number;
  pegRatio: number;
  profitMargin: number;
  operatingMargin: number;
  returnOnEquity: number;
  returnOnAssets: number;
  debtToEquity: number;
  priceToBook: number;
  priceToSales: number;
  grahamNumber: number;
  dividendYield: number;
}

export interface MultiSourceData {
  tipranks?: TipRanksData;
  macrotrends?: MacrotrendsData;
  marketbeat?: MarketBeatData;
  circle?: CircleUSDCData;
  gurufocus?: GuruFocusData;
  sources: string[];
}

export interface OptionContract {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  inTheMoney: boolean;
  expiration: string;
  type: 'call' | 'put';
}

export interface OptionExpiration {
  date: string;
  daysToExpiration: number;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionStrategy {
  name: string;
  description: string;
  idealCondition: string;
  riskLevel: 'bajo' | 'medio' | 'alto';
  maxProfit: number | 'ilimitado';
  maxLoss: number | 'ilimitado';
  breakeven: number[];
  example: {
    strike: number;
    strikeUpper?: number;
    premium: number;
    contracts: number;
    totalCost: number;
    maxProfit: number;
    maxLoss: number;
    delta: number;
    deltaUpper?: number;
    expiration: string;
    daysToExpiration: number;
    type: 'call' | 'put' | 'spread';
    takeProfit?: { price: number; percent: number; description: string };
    stopLoss?: { price: number; percent: number; description: string };
  };
}

export interface OptionsAnalysis {
  symbol: string;
  currentPrice: number;
  stockTrend: 'alcista' | 'bajista' | 'lateral';
  impliedVolatility: number;
  ivRank: number;
  ivPercentile: number;
  earningsDate: string | null;
  earningsEstimate: boolean;
  dividendDate: string | null;
  recommendedStrategies: {
    strategy: OptionStrategy;
    rationale: string;
    suitabilityScore: number;
  }[];
  nextExpirations: OptionExpiration[];
  keyLevels: {
    support: number;
    resistance: number;
    pivot: number;
  };
  ivComparison: {
    current: number;
    historicalAverage: number;
    interpretation: string;
  };
}

export interface ScreenerOptionsResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  suitabilityScore: number;
  topStrategy: string;
  ivRank: number;
  trend: string;
  recommendation: 'excelente' | 'buena' | 'regular' | 'no_recomendada';
  keyMetrics: {
    ivRank: number;
    trend: string;
    volume: number;
    dividendYield: number;
  };
}
