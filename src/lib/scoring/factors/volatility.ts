import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.05;

export function scoreVolatility(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  // 1. Historical Volatility 20d (0-50 pts)
  if (data.hv20 !== null) {
    let pts: number;
    let detail: string;
    // Optimal: 15-30% HV (enough movement, manageable risk)
    if (data.hv20 > 50) { pts = 10; detail = `HV ${data.hv20.toFixed(0)}% — extrema`; }
    else if (data.hv20 > 35) { pts = 25; detail = `HV ${data.hv20.toFixed(0)}% — alta`; }
    else if (data.hv20 > 25) { pts = 45; detail = `HV ${data.hv20.toFixed(0)}% — óptima`; }
    else if (data.hv20 > 15) { pts = 50; detail = `HV ${data.hv20.toFixed(0)}% — ideal`; }
    else if (data.hv20 > 8) { pts = 30; detail = `HV ${data.hv20.toFixed(0)}% — baja`; }
    else { pts = 15; detail = `HV ${data.hv20.toFixed(0)}% — muy baja`; }
    score = pts;
    breakdown.push({ metric: "Historical Vol 20d", value: pts, detail });
  }

  // 2. Bollinger Band width (0-50 pts)
  if (data.bbWidth !== null) {
    let pts: number;
    let detail: string;
    // Narrow BB = squeeze (potential breakout), wide = volatile
    if (data.bbWidth < 3) { pts = 50; detail = `BB width ${data.bbWidth.toFixed(1)}% — squeeze`; }
    else if (data.bbWidth < 6) { pts = 40; detail = `BB width ${data.bbWidth.toFixed(1)}% — apretado`; }
    else if (data.bbWidth < 10) { pts = 30; detail = `BB width ${data.bbWidth.toFixed(1)}% — normal`; }
    else if (data.bbWidth < 15) { pts = 20; detail = `BB width ${data.bbWidth.toFixed(1)}% — amplio`; }
    else { pts = 10; detail = `BB width ${data.bbWidth.toFixed(1)}% — muy amplio`; }
    // Blend
    score = Math.round((score + pts) / 2);
    breakdown.push({ metric: "Bollinger Width", value: pts, detail });
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Volatilidad en rango ideal: movimiento presente sin exceso";
  else if (clamped >= 50) explanation = "Volatilidad moderada";
  else explanation = "Volatilidad fuera de rango ideal";

  return {
    id: "volatility",
    label: "Volatilidad",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
