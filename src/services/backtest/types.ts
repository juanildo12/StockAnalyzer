// Tipos del motor de backtest.
//
// Todo el motor es determinista y sin look-ahead: la señal se calcula con los
// datos hasta el cierre del día D y la orden se ejecuta a la apertura del día
// D+1 (nunca al mismo día que genera la señal).

export interface Bar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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
  date: string; // fecha de ejecución (apertura)
  signalDate: string; // fecha que generó la señal (cierre)
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
  cost: number; // costes (comisión + slippage) pagados en la operación
  reason: string;
  pnl?: number; // resultado realizado de la venta (solo en ventas)
}

export type BacktestStrategy = 'trend' | 'momentum' | 'mean-reversion' | 'buy-and-hold' | 'ai';

export interface BacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCash: number;
  strategy: BacktestStrategy;
  /** Comisión por operación en puntos básicos (10 = 0,10 %). */
  commissionBps: number;
  /** Slippage por operación en puntos básicos. */
  slippageBps: number;
  /** Símbolo del benchmark (por defecto SPY). */
  benchmark: string;
}

export interface NavPoint {
  date: string;
  value: number; // equity de la cartera
  benchmark: number; // equity del benchmark con la misma capitalización
  cash: number;
  invested: number; // % del equity invertido
}

export interface SymbolStats {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  realizedPnl: number;
  returnPct: number; // retorno del activo en el periodo (buy & hold)
  contribution: number; // contribución al retorno de la cartera
}

export interface BacktestResult {
  config: BacktestConfig;
  finalReturn: number;
  maxDrawdown: number;
  sortino: number;
  sharpe: number;
  cagr: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  exposure: number; // % medio del equity invertido
  turnover: number; // turnover anualizado
  totalTrades: number;
  totalCosts: number;
  finalEquity: number;
  benchmarkReturn: number;
  benchmarkMaxDrawdown: number;
  alpha: number; // finalReturn - benchmarkReturn
  nav: NavPoint[];
  trades: TradeRecord[];
  symbolStats: SymbolStats[];
  tradingDays: number;
  dataSource: string;
  notes: string[];
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
