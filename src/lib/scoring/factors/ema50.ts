import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.05;

export function scoreEMA50(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  if (data.sma50 !== null && data.sma50 > 0) {
    const distPct = ((data.price - data.sma50) / data.sma50) * 100;

    if (distPct > 8) { score = 55; breakdown.push({ metric: "Distancia SMA50", value: 55, detail: `Sobreextendido +${distPct.toFixed(1)}%` }); }
    else if (distPct > 3) { score = 90; breakdown.push({ metric: "Distancia SMA50", value: 90, detail: `Posicion fuerte +${distPct.toFixed(1)}%` }); }
    else if (distPct > 0) { score = 75; breakdown.push({ metric: "Distancia SMA50", value: 75, detail: `Por encima +${distPct.toFixed(1)}%` }); }
    else if (distPct > -3) { score = 35; breakdown.push({ metric: "Distancia SMA50", value: 35, detail: `Por debajo ${distPct.toFixed(1)}%` }); }
    else if (distPct > -8) { score = 15; breakdown.push({ metric: "Distancia SMA50", value: 15, detail: `Lejos por debajo ${distPct.toFixed(1)}%` }); }
    else { score = 5; breakdown.push({ metric: "Distancia SMA50", value: 5, detail: `Muy por debajo ${distPct.toFixed(1)}%` }); }
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Tendencia largo plazo alcista: precio sobre SMA50";
  else if (clamped >= 50) explanation = "Tendencia largo plazo neutral: precio cerca de SMA50";
  else explanation = "Tendencia largo plazo bajista: precio por debajo de SMA50";

  return {
    id: "ema50",
    label: "EMA50",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
