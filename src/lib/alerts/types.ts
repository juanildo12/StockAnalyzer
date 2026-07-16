export interface SmartAlert {
  id: string;
  userId: string;
  symbol: string;
  score: number;
  grade: string;

  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskReward: number;

  confidence: number;
  riskLevel: "Bajo" | "Medio" | "Alto";
  tradeTime: string;

  summary: string;
  topFactors: string[];
  warnings: string[];

  status: "active" | "expired" | "triggered" | "dismissed";
  createdAt: Date;
  expiresAt: Date;
}

export interface AlertDecision {
  alert: boolean;
  reason?: string;
  confidence?: number;
}

export interface EvalContext {
  symbol: string;
  price: number;
  totalScore: number;
  grade: string;
  factors: {
    id: string;
    label: string;
    score: number;
    weight: number;
    explanation: string;
  }[];
  levels: {
    entry: number;
    stopLoss: number;
    tp1: number;
    tp2: number;
    riskReward: number;
  };
  atr: number | null;
  changePercent: number;
}
