export interface Position {
  shares: number;
  avgPrice: number;
  totalCost: number;
}

export interface Portfolio {
  cash: number;
  positions: Record<string, Position>;
}

export interface Order {
  symbol: string;
  side: 'buy' | 'sell';
  targetCash: number;
  reason: string;
}

export interface PortfolioSnapshot {
  date: string;
  cash: number;
  equity: number;
  positions: Record<string, { shares: number; value: number }>;
}

export interface TradeRecord {
  date: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
}

export interface BacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCash: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  finalReturn: number;
  maxDrawdown: number;
  sortino: number;
  totalTrades: number;
  nav: { date: string; value: number }[];
  trades: TradeRecord[];
  benchmarkReturn: number;
}

export interface StockFeatures {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  week52High?: number;
  week52Low?: number;
  news: { headline: string; summary: string }[];
  rsi?: number;
  sma50?: number;
  sma200?: number;
}
