export interface BreakdownItem {
  metric: string;
  value: number;
  detail: string;
}

export interface FactorResult {
  id: string;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  breakdown: BreakdownItem[];
}

export interface ScoreResult {
  symbol: string;
  totalScore: number;
  grade: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";
  factors: FactorResult[];
  summary: string;
  timestamp: string;
}

export interface StockInput {
  symbol: string;
  price: number;
  changePercent: number;

  sma50: number | null;
  sma200: number | null;
  ema8: number | null;
  ema21: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  atr: number | null;

  volume: number;
  avgVolume20d: number;

  high60d: number;
  low60d: number;
  weekHigh52: number;
  weekLow52: number;
  closes60d: number[];

  resistance: number;
  support: number;
  riskReward: number;
  consolidationHigh: number;
  consolidationLow: number;

  marketCap: number;
  pe: number | null;

  return1m: number | null;
  return3m: number | null;

  hv20: number | null;
  bbWidth: number | null;
}
