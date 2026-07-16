import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.05;

export function scoreEMA8(data: StockInput): FactorResult {
  let score = 50; // Base neutral
  const breakdown: BreakdownItem[] = [];

  if (data.ema8 !== null && data.ema8 > 0) {
    const distPct = ((data.price - data.ema8) / data.ema8) * 100;

    // Sweet spot: 0.5-2% above EMA8 = strong short-term momentum
    if (distPct > 5) { score = 55; breakdown.push({ metric: "Distancia EMA8", value: 55, detail: `Sobreextendido +${distPct.toFixed(1)}%` }); }
    else if (distPct > 2) { score = 85; breakdown.push({ metric: "Distancia EMA8", value: 85, detail: `Momentum fuerte +${distPct.toFixed(1)}%` }); }
    else if (distPct > 0.5) { score = 95; breakdown.push({ metric: "Distancia EMA8", value: 95, detail: `Zona ideal +${distPct.toFixed(1)}%` }); }
    else if (distPct > 0) { score = 70; breakdown.push({ metric: "Distancia EMA8", value: 70, detail: `Por encima débil +${distPct.toFixed(1)}%` }); }
    else if (distPct > -2) { score = 40; breakdown.push({ metric: "Distancia EMA8", value: 40, detail: `Por debajo ${distPct.toFixed(1)}%` }); }
    else if (distPct > -5) { score = 20; breakdown.push({ metric: "Distancia EMA8", value: 20, detail: `Lejos por debajo ${distPct.toFixed(1)}%` }); }
    else { score = 5; breakdown.push({ metric: "Distancia EMA8", value: 5, detail: `Muy por debajo ${distPct.toFixed(1)}%` }); }
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Precio bien posicionado sobre EMA8 — momentum corto plazo fuerte";
  else if (clamped >= 50) explanation = "Precio cerca de EMA8 — momentum corto plazo neutral";
  else explanation = "Precio por debajo de EMA8 — debilidad en corto plazo";

  return {
    id: "ema8",
    label: "EMA8",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
