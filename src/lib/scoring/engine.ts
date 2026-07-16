import { StockInput, ScoreResult, FactorResult } from "./types";
import { scoreTrend } from "./factors/trend";
import { scoreVolume } from "./factors/volume";
import { scoreBreakout } from "./factors/breakout";
import { scoreEMA8 } from "./factors/ema8";
import { scoreEMA21 } from "./factors/ema21";
import { scoreEMA50 } from "./factors/ema50";
import { scoreATR } from "./factors/atr";
import { scoreRelativeStrength } from "./factors/relativeStrength";
import { scoreLiquidity } from "./factors/liquidity";
import { scoreMomentum } from "./factors/momentum";
import { scoreVolatility } from "./factors/volatility";
import { scoreRisk } from "./factors/risk";

const ALL_FACTORS = [
  scoreTrend,
  scoreVolume,
  scoreBreakout,
  scoreEMA8,
  scoreEMA21,
  scoreEMA50,
  scoreATR,
  scoreRelativeStrength,
  scoreLiquidity,
  scoreMomentum,
  scoreVolatility,
  scoreRisk,
];

function getGrade(score: number): ScoreResult["grade"] {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C+";
  if (score >= 40) return "C";
  if (score >= 30) return "D";
  return "F";
}

function generateSummary(data: StockInput, totalScore: number, factors: FactorResult[]): string {
  const top = [...factors].sort((a, b) => b.score - a.score).slice(0, 3);
  const weak = [...factors].sort((a, b) => a.score - b.score).slice(0, 2);

  const topStr = top.map(f => f.label).join(", ");
  const weakStr = weak.map(f => f.label).join(", ");

  if (totalScore >= 80) {
    return `${data.symbol}: Setup fuerte (${totalScore}/100). Fortalezas en ${topStr}.`;
  } else if (totalScore >= 60) {
    return `${data.symbol}: Setup favorable (${totalScore}/100). ${topStr} respaldan, pero ${weakStr} debilitan.`;
  } else if (totalScore >= 40) {
    return `${data.symbol}: Señales mixtas (${totalScore}/100). ${topStr} positivo, ${weakStr} preocupante.`;
  } else {
    return `${data.symbol}: Setup débil (${totalScore}/100). ${weakStr} en zona de riesgo.`;
  }
}

export function computeScore(data: StockInput): ScoreResult {
  const factors = ALL_FACTORS.map(fn => fn(data));

  const totalScore = Math.round(
    factors.reduce((sum, f) => sum + f.weightedScore, 0)
  );

  const clampedTotal = Math.min(100, Math.max(0, totalScore));

  return {
    symbol: data.symbol,
    totalScore: clampedTotal,
    grade: getGrade(clampedTotal),
    factors,
    summary: generateSummary(data, clampedTotal, factors),
    timestamp: new Date().toISOString(),
  };
}
