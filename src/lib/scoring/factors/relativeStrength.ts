import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.10;

export function scoreRelativeStrength(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  const r1m = data.return1m;
  const r3m = data.return3m;

  // 1-month relative strength (0-50 pts)
  if (r1m !== null) {
    let pts: number;
    let detail: string;
    if (r1m > 10) { pts = 50; detail = `1-mes +${r1m.toFixed(1)}% vs mercado (muy fuerte)`; }
    else if (r1m > 5) { pts = 40; detail = `1-mes +${r1m.toFixed(1)}% vs mercado (fuerte)`; }
    else if (r1m > 0) { pts = 28; detail = `1-mes +${r1m.toFixed(1)}% vs mercado (positivo)`; }
    else if (r1m > -5) { pts = 15; detail = `1-mes ${r1m.toFixed(1)}% vs mercado (débil)`; }
    else if (r1m > -10) { pts = 8; detail = `1-mes ${r1m.toFixed(1)}% vs mercado (muy débil)`; }
    else { pts = 0; detail = `1-mes ${r1m.toFixed(1)}% vs mercado (laggard)`; }
    score = pts;
    breakdown.push({ metric: "RS 1-mes", value: pts, detail });
  }

  // 3-month relative strength (0-50 pts)
  if (r3m !== null) {
    let pts: number;
    let detail: string;
    if (r3m > 20) { pts = 50; detail = `3-meses +${r3m.toFixed(1)}% vs mercado (liderazgo)`; }
    else if (r3m > 10) { pts = 40; detail = `3-meses +${r3m.toFixed(1)}% vs mercado (fuerte)`; }
    else if (r3m > 0) { pts = 28; detail = `3-meses +${r3m.toFixed(1)}% vs mercado (positivo)`; }
    else if (r3m > -10) { pts = 12; detail = `3-meses ${r3m.toFixed(1)}% vs mercado (débil)`; }
    else { pts = 0; detail = `3-meses ${r3m.toFixed(1)}% vs mercado (laggard)`; }
    // Blend: average of 1m and 3m
    score = Math.round((score + pts) / 2 + (score > 25 && pts > 25 ? 10 : 0));
    breakdown.push({ metric: "RS 3-meses", value: pts, detail });
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Relative Strength excepcional: supera al mercado por amplio margen";
  else if (clamped >= 60) explanation = "Relative Strength fuerte: consistentemente por encima del mercado";
  else if (clamped >= 40) explanation = "Relative Strength neutral: en línea con el mercado";
  else if (clamped >= 20) explanation = "Relative Strength débil: bajo el mercado";
  else explanation = "Relative Strength muy débil: laggard significativo";

  return {
    id: "relativeStrength",
    label: "Relative Strength",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
