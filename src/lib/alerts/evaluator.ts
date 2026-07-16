import { EvalContext, AlertDecision } from "./types";
import { ALERT_CONFIG as C } from "./config";

export function evaluate(ctx: EvalContext): AlertDecision {
  // ── REGLA 1: Score mínimo ──────────────────────
  if (ctx.totalScore < C.minScore) {
    return { alert: false, reason: `Score ${ctx.totalScore} < ${C.minScore}` };
  }

  // ── REGLA 2: Confluencia de factores ──────────
  const strong = ctx.factors.filter(f => f.score >= C.minFactorForStrong).length;
  if (strong < C.minStrongFactors) {
    return { alert: false, reason: `${strong} factores fuertes (min ${C.minStrongFactors})` };
  }

  // ── REGLA 3: Sin factores críticos ────────────
  const critical = ctx.factors.find(f => f.score <= C.criticalFactorThreshold);
  if (critical) {
    return { alert: false, reason: `Factor critico: ${critical.label} (${critical.score})` };
  }

  // ── REGLA 4: Breakout presente ────────────────
  const breakout = ctx.factors.find(f => f.id === "breakout");
  if (!breakout || breakout.score < C.minBreakoutScore) {
    return { alert: false, reason: `Breakout débil (${breakout?.score ?? 0})` };
  }

  // ── REGLA 5: Volumen confirma ─────────────────
  const volume = ctx.factors.find(f => f.id === "volume");
  if (!volume || volume.score < C.minVolumeScore) {
    return { alert: false, reason: `Volumen no confirma (${volume?.score ?? 0})` };
  }

  // ── REGLA 6: R/R mínimo ───────────────────────
  if (ctx.levels.riskReward < C.minRiskReward) {
    return { alert: false, reason: `R/R ${ctx.levels.riskReward.toFixed(1)} < ${C.minRiskReward}` };
  }

  // ── REGLA 7: No sobreextendido ────────────────
  if (ctx.changePercent > 5) {
    return { alert: false, reason: `Sobreextendido +${ctx.changePercent.toFixed(1)}%` };
  }

  // ── TODAS LAS REGLAS PASAN ────────────────────
  const confidence = calcConfidence(ctx);
  return { alert: true, confidence };
}

export function calcConfidence(ctx: EvalContext): number {
  let conf = 0;
  const W = C.confidence;

  // Score contribution
  conf += Math.round((ctx.totalScore / 100) * W.scoreWeight);

  // Factor alignment
  const veryStrong = ctx.factors.filter(f => f.score >= 70).length;
  conf += Math.min(W.alignmentWeight, veryStrong * 4);

  // R/R quality
  if (ctx.levels.riskReward >= 3) conf += W.rrWeight;
  else if (ctx.levels.riskReward >= 2) conf += Math.round(W.rrWeight * 0.75);
  else if (ctx.levels.riskReward >= 1.5) conf += Math.round(W.rrWeight * 0.5);

  // Volume confirmation
  const vol = ctx.factors.find(f => f.id === "volume");
  if (vol) conf += Math.round((vol.score / 100) * W.volumeWeight);

  // Trend alignment
  const trend = ctx.factors.find(f => f.id === "trend");
  if (trend && trend.score >= 70) conf += W.trendWeight;

  return Math.min(100, conf);
}

export function calcRiskLevel(ctx: EvalContext): "Bajo" | "Medio" | "Alto" {
  const risk = ctx.factors.find(f => f.id === "risk");
  const volatility = ctx.factors.find(f => f.id === "volatility");

  if (!risk) return "Medio";
  if (risk.score >= 70 && (volatility?.score ?? 50) >= 40) return "Bajo";
  if (risk.score <= 30 || (volatility?.score ?? 50) <= 20) return "Alto";
  return "Medio";
}

export function calcTradeTime(ctx: EvalContext): string {
  if (!ctx.atr || ctx.atr <= 0) return "Swing (2-5 dias)";

  const distToTarget = ctx.levels.tp1 - ctx.price;
  if (distToTarget <= 0) return "Intradia (1 dia)";

  const daysToTarget = Math.ceil(distToTarget / ctx.atr);

  if (daysToTarget <= 1) return "Intradia (1 dia)";
  if (daysToTarget <= 3) return "Swing corto (1-3 dias)";
  if (daysToTarget <= 7) return "Swing (3-7 dias)";
  return "Position (1-4 semanas)";
}
