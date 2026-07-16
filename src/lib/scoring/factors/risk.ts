import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.06;

export function scoreRisk(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  // 1. Distance from 52-week high (0-35 pts) — lower risk if near high
  if (data.weekHigh52 > 0) {
    const drawdown = ((data.weekHigh52 - data.price) / data.weekHigh52) * 100;
    let pts: number;
    let detail: string;
    if (drawdown < 3) { pts = 35; detail = `Drawdown mínimo ${drawdown.toFixed(1)}% del max 52wk`; }
    else if (drawdown < 8) { pts = 28; detail = `Drawdown bajo ${drawdown.toFixed(1)}%`; }
    else if (drawdown < 15) { pts = 18; detail = `Drawdown moderado ${drawdown.toFixed(1)}%`; }
    else if (drawdown < 25) { pts = 10; detail = `Drawdown significativo ${drawdown.toFixed(1)}%`; }
    else { pts = 0; detail = `Drawdown alto ${drawdown.toFixed(1)}% del max 52wk`; }
    score = pts;
    breakdown.push({ metric: "Drawdown 52wk", value: pts, detail });
  }

  // 2. Risk/Reward quality (0-35 pts)
  if (data.riskReward > 0) {
    let pts: number;
    let detail: string;
    if (data.riskReward >= 3) { pts = 35; detail = `R/R excelente ${data.riskReward.toFixed(1)}:1`; }
    else if (data.riskReward >= 2) { pts = 28; detail = `R/R bueno ${data.riskReward.toFixed(1)}:1`; }
    else if (data.riskReward >= 1.5) { pts = 18; detail = `R/R aceptable ${data.riskReward.toFixed(1)}:1`; }
    else if (data.riskReward >= 1) { pts = 8; detail = `R/R marginal ${data.riskReward.toFixed(1)}:1`; }
    else { pts = 0; detail = `R/R desfavorable ${data.riskReward.toFixed(1)}:1`; }
    score = Math.round((score + pts) / 2 + (score > 20 && pts > 20 ? 10 : 0));
    breakdown.push({ metric: "Risk/Reward", value: pts, detail });
  }

  // 3. Support proximity (0-30 pts) — closer to support = less downside risk
  if (data.support > 0 && data.price > 0) {
    const distToSupport = ((data.price - data.support) / data.price) * 100;
    let pts: number;
    let detail: string;
    if (distToSupport < 2) { pts = 30; detail = `Cerca de soporte ${distToSupport.toFixed(1)}%`; }
    else if (distToSupport < 5) { pts = 22; detail = `Soporte cercano ${distToSupport.toFixed(1)}%`; }
    else if (distToSupport < 10) { pts = 12; detail = `Soporte moderado ${distToSupport.toFixed(1)}%`; }
    else { pts = 5; detail = `Lejos del soporte ${distToSupport.toFixed(1)}%`; }
    breakdown.push({ metric: "Proximidad soporte", value: pts, detail });
    score = Math.min(100, score + Math.round(pts * 0.4));
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Riesgo bajo: cerca de soporte, buen R/R, poco drawdown";
  else if (clamped >= 60) explanation = "Riesgo moderado: estructura aceptable";
  else if (clamped >= 40) explanation = "Riesgo medio: drawdown significativo o R/R débil";
  else explanation = "Riesgo alto: drawdown grande o sin soporte cercano";

  return {
    id: "risk",
    label: "Riesgo",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
