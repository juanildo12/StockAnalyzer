export { runBacktest, normalizeConfig } from './runner';
export type { RunOptions } from './runner';
export { runEngine, buildSignalMap, tradingCalendar } from './engine';
export { buildAiSignalMap, AI_MODEL } from './ai';
export { evaluateStrategy, momentum12_1, STRATEGIES } from './strategy';
export type { Signal } from './strategy';
export { loadBars } from './data';
export {
  sma,
  ema,
  rsi,
  atr,
  sortino,
  sharpe,
  maxDrawdown,
  cagr,
  stdev,
  dailyReturns,
  downsideDeviation,
  annualizedVolatility,
} from './indicators';
export type {
  BacktestConfig,
  BacktestResult,
  BacktestStrategy,
  Bar,
  NavPoint,
  SymbolStats,
  TradeRecord,
} from './types';
