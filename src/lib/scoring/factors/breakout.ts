import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.15;

export function scoreBreakout(data: StockInput): FactorResult {
  let score = 0;
  const breakdown: BreakdownItem[] = [];

  // 1. Proximity to resistance (0-35 pts)
  if (data.resistance > 0) {
    const distPct = ((data.resistance - data.price) / data.price) * 100;
    let pts: number;
    let detail: string;
    if (distPct < 0.5) { pts = 35; detail = `En resistencia (${distPct.toFixed(1)}%)`; }
    else if (distPct < 1.5) { pts = 30; detail = `Muy cerca de resistencia (${distPct.toFixed(1)}%)`; }
    else if (distPct < 3) { pts = 22; detail = `Cerca de resistencia (${distPct.toFixed(1)}%)`; }
    else if (distPct < 5) { pts = 12; detail = `A ${distPct.toFixed(1)}% de resistencia`; }
    else { pts = 0; detail = `Lejos de resistencia (${distPct.toFixed(1)}%)`; }
    score += pts;
    breakdown.push({ metric: "Proximidad resistencia", value: pts, detail });
  }

  // 2. Consolidation tightness (0-25 pts)
  if (data.consolidationHigh > 0 && data.consolidationLow > 0) {
    const rangePct = ((data.consolidationHigh - data.consolidationLow) / data.consolidationHigh) * 100;
    let pts: number;
    let detail: string;
    if (rangePct < 3) { pts = 25; detail = `Consolidación muy apretada (${rangePct.toFixed(1)}% rango)`; }
    else if (rangePct < 6) { pts = 20; detail = `Consolidación apretada (${rangePct.toFixed(1)}% rango)`; }
    else if (rangePct < 10) { pts = 12; detail = `Consolidación moderada (${rangePct.toFixed(1)}% rango)`; }
    else if (rangePct < 15) { pts = 5; detail = `Rango amplio (${rangePct.toFixed(1)}%)`; }
    else { pts = 0; detail = `Sin consolidación clara (${rangePct.toFixed(1)}%)`; }
    score += pts;
    breakdown.push({ metric: "Compactación", value: pts, detail });
  }

  // 3. Risk/Reward ratio (0-20 pts)
  if (data.riskReward > 0) {
    let pts: number;
    let detail: string;
    if (data.riskReward >= 3) { pts = 20; detail = `R/R excelente ${data.riskReward.toFixed(1)}:1`; }
    else if (data.riskReward >= 2) { pts = 16; detail = `R/R bueno ${data.riskReward.toFixed(1)}:1`; }
    else if (data.riskReward >= 1.5) { pts = 10; detail = `R/R aceptable ${data.riskReward.toFixed(1)}:1`; }
    else if (data.riskReward >= 1) { pts = 5; detail = `R/R marginal ${data.riskReward.toFixed(1)}:1`; }
    else { pts = 0; detail = `R/R desfavorable ${data.riskReward.toFixed(1)}:1`; }
    score += pts;
    breakdown.push({ metric: "Risk/Reward", value: pts, detail });
  }

  // 4. Price near 52-week high (0-20 pts)
  if (data.weekHigh52 > 0) {
    const pctFromHigh = ((data.weekHigh52 - data.price) / data.weekHigh52) * 100;
    let pts: number;
    let detail: string;
    if (pctFromHigh < 2) { pts = 20; detail = `Casi en máx 52wk (${pctFromHigh.toFixed(1)}%)`; }
    else if (pctFromHigh < 5) { pts = 15; detail = `Cerca del máximo 52wk (${pctFromHigh.toFixed(1)}%)`; }
    else if (pctFromHigh < 10) { pts = 8; detail = `A ${pctFromHigh.toFixed(1)}% del máximo 52wk`; }
    else { pts = 0; detail = `Lejos del máximo 52wk (${pctFromHigh.toFixed(1)}%)`; }
    score += pts;
    breakdown.push({ metric: "Proximidad 52wk high", value: pts, detail });
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Setup de breakout fuerte: compactación apretada cerca de resistencia con buen R/R";
  else if (clamped >= 60) explanation = "Setup de breakout en formación: acercándose a niveles clave";
  else if (clamped >= 40) explanation = "Potencial de breakout moderado: necesita más compactación o proximidad";
  else if (clamped >= 20) explanation = "Débil señal de breakout: lejos de resistencia y sin compactación";
  else explanation = "Sin setup de breakout: precio disperso sin estructura clara";

  return {
    id: "breakout",
    label: "Breakout",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
