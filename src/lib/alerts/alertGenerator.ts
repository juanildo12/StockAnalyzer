import { EvalContext, SmartAlert } from "./types";
import { evaluate, calcConfidence, calcRiskLevel, calcTradeTime } from "./evaluator";
import { ALERT_CONFIG } from "./config";

export function generateAlert(ctx: EvalContext, userId: string): SmartAlert | null {
  const decision = evaluate(ctx);
  if (!decision.alert) return null;

  const confidence = decision.confidence ?? calcConfidence(ctx);
  const riskLevel = calcRiskLevel(ctx);
  const tradeTime = calcTradeTime(ctx);

  const topFactors = [...ctx.factors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(f => `${f.label}: ${f.score}`);

  const warnings: string[] = [];
  const momentum = ctx.factors.find(f => f.id === "momentum");
  const ema8 = ctx.factors.find(f => f.id === "ema8");
  if (momentum && momentum.score >= 70 && momentum.score <= 85) {
    warnings.push("RSI elevado — posible sobrecompra corto plazo");
  }
  if (ema8 && ema8.score < 40) {
    warnings.push("Debilidad en EMA8 — momentum corto plazo débil");
  }
  if (ctx.changePercent > 3) {
    warnings.push(`Movimiento fuerte hoy (+${ctx.changePercent.toFixed(1)}%) — posible FOMO`);
  }

  const now = new Date();
  const expires = new Date(now.getTime() + ALERT_CONFIG.alertExpiryHours * 60 * 60 * 1000);

  return {
    id: "",
    userId,
    symbol: ctx.symbol,
    score: ctx.totalScore,
    grade: ctx.grade,
    entry: ctx.levels.entry,
    stopLoss: ctx.levels.stopLoss,
    tp1: ctx.levels.tp1,
    tp2: ctx.levels.tp2,
    riskReward: ctx.levels.riskReward,
    confidence,
    riskLevel,
    tradeTime,
    summary: "",
    topFactors,
    warnings,
    status: "active",
    createdAt: now,
    expiresAt: expires,
  };
}

export function generateAlertSummary(alert: SmartAlert): string {
  const riskEmoji = alert.riskLevel === "Bajo" ? "🟢" : alert.riskLevel === "Medio" ? "🟡" : "🔴";

  return `${alert.symbol} genera señal de breakout con score ${alert.score}/100 (confianza ${alert.confidence}%). ` +
    `Zona de entrada: $${alert.entry.toFixed(2)} | Stop: $${alert.stopLoss.toFixed(2)} | ` +
    `TP1: $${alert.tp1.toFixed(2)} | TP2: $${alert.tp2.toFixed(2)} | R/R ${alert.riskReward.toFixed(1)}:1. ` +
    `${riskEmoji} Riesgo ${alert.riskLevel} | Tiempo estimado: ${alert.tradeTime}. ` +
    `Factores clave: ${alert.topFactors.slice(0, 3).join(", ")}.`;
}
