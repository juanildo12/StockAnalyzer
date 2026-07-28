export interface ShareTrigger {
  alertId: string;
  symbol: string;
  userId: string;
  score: number;
  grade: string;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  hitPrice: number;
  hitType: "TP1" | "TP2";
  returnPct: number;
  heldDays: number;
  riskReward: number;
}

export interface ProspectPickTrigger {
  symbol: string;
  company: string;
  direction: 'CALL' | 'PUT';
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  confidence: number;
  score: number;
  reasons: string[];
  contract: {
    strike: number;
    expiration: string;
    premium: number;
    delta: number | null;
  } | null;
}

export interface ShareResult {
  platform: "twitter" | "linkedin" | "discord";
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface ShareLog {
  id: string;
  alertId: string;
  symbol: string;
  platform: string;
  postId: string | null;
  postUrl: string | null;
  success: boolean;
  error: string | null;
  createdAt: Date;
}
