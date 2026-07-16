import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.05;

export function scoreATR(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  if (data.atr !== null && data.price > 0) {
    const atrPct = (data.atr / data.price) * 100;

    // Optimal: 1-3% = enough movement, not too risky
    if (atrPct > 5) { score = 20; breakdown.push({ metric: "ATR % precio", value: 20, detail: `Extremo ${atrPct.toFixed(1)}% — muy volátil` }); }
    else if (atrPct > 3) { score = 45; breakdown.push({ metric: "ATR % precio", value: 45, detail: `Alto ${atrPct.toFixed(1)}% — volátil` }); }
    else if (atrPct > 2) { score = 85; breakdown.push({ metric: "ATR % precio", value: 85, detail: `Óptimo ${atrPct.toFixed(1)}%` }); }
    else if (atrPct > 1) { score = 90; breakdown.push({ metric: "ATR % precio", value: 90, detail: `Ideal ${atrPct.toFixed(1)}%` }); }
    else if (atrPct > 0.5) { score = 60; breakdown.push({ metric: "ATR % precio", value: 60, detail: `Bajo ${atrPct.toFixed(1)}% — poco movimiento` }); }
    else { score = 25; breakdown.push({ metric: "ATR % precio", value: 25, detail: `Muy bajo ${atrPct.toFixed(1)}% — sin movimiento` }); }
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Volatilidad ATR en rango ideal: movimiento suficiente sin exceso";
  else if (clamped >= 50) explanation = "Volatilidad ATR moderada";
  else explanation = "Volatilidad ATR fuera de rango ideal";

  return {
    id: "atr",
    label: "ATR",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
