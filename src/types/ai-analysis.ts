export interface AnalysisLevel {
  price: number;
  type: string;
}

export interface AnalysisSection {
  signal: string;
  strength?: string;
  status?: string;
  alignment?: string;
  level?: number;
  vsAverage?: number;
  rsi?: number;
  macd?: string;
  detail: string;
}

export interface AnalysisEntry {
  ideal: number;
  currentOk: boolean;
  stopLoss: number;
  tp1: number;
  tp2: number;
}

export interface AnalysisResult {
  verdict: "BUY" | "HOLD" | "SELL";
  conviction: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  analysis: {
    trend: AnalysisSection;
    ema: AnalysisSection;
    breakout: AnalysisSection;
    volume: AnalysisSection;
    momentum: AnalysisSection;
    risk: AnalysisSection;
  };
  support: AnalysisLevel[];
  resistance: AnalysisLevel[];
  entry: AnalysisEntry;
  catalysts: string[];
  warnings: string[];
}

export interface AnalysisRequest {
  symbol: string;
}

export interface AnalysisResponse {
  success: boolean;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name: string;
  analysis: AnalysisResult;
  timestamp: string;
}
