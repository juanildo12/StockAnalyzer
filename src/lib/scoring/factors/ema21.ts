import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.05;

export function scoreEMA21(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  if (data.ema21 !== null && data.ema21 > 0) {
    const distPct = ((data.price - data.ema21) / data.ema21) * 100;

    if (distPct > 5) { score = 60; breakdown.push({ metric: "Distancia EMA21", value: 60, detail: `Sobreextendido +${distPct.toFixed(1)}%` }); }
    else if (distPct > 2) { score = 90; breakdown.push({ metric: "Distancia EMA21", value: 90, detail: `Posicion fuerte +${distPct.toFixed(1)}%` }); }
    else if (distPct > 0) { score = 80; breakdown.push({ metric: "Distancia EMA21", value: 80, detail: `Por encima +${distPct.toFixed(1)}%` }); }
    else if (distPct > -2) { score = 40; breakdown.push({ metric: "Distancia EMA21", value: 40, detail: `Por debajo ${distPct.toFixed(1)}%` }); }
    else if (distPct > -5) { score = 15; breakdown.push({ metric: "Distancia EMA21", value: 15, detail: `Lejos por debajo ${distPct.toFixed(1)}%` }); }
    else { score = 5; breakdown.push({ metric: "Distancia EMA21", value: 5, detail: `Muy por debajo ${distPct.toFixed(1)}%` }); }
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Tendencia medio plazo alcista: precio sobre EMA21";
  else if (clamped >= 50) explanation = "Tendencia medio plazo neutral: precio cerca de EMA21";
  else explanation = "Tendencia medio plazo bajista: precio por debajo de EMA21";

  return {
    id: "ema21",
    label: "EMA21",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
