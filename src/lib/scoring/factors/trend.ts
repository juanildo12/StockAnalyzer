import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.15;

export function scoreTrend(data: StockInput): FactorResult {
  let score = 0;
  const breakdown: BreakdownItem[] = [];

  // 1. Golden/Death Cross (0-30 pts)
  if (data.sma50 !== null && data.sma200 !== null) {
    if (data.sma50 > data.sma200) {
      score += 30;
      breakdown.push({ metric: "SMA50 vs SMA200", value: 30, detail: "Golden cross activo" });
    } else {
      breakdown.push({ metric: "SMA50 vs SMA200", value: 0, detail: "Death cross" });
    }
  }

  // 2. Precio vs SMA50 (0-30 pts)
  if (data.sma50 !== null && data.sma50 > 0) {
    const pctAbove = ((data.price - data.sma50) / data.sma50) * 100;
    let pts: number;
    let detail: string;
    if (pctAbove > 8) { pts = 20; detail = `Sobreextendido +${pctAbove.toFixed(1)}% sobre SMA50`; }
    else if (pctAbove > 3) { pts = 30; detail = `Posicion fuerte +${pctAbove.toFixed(1)}% sobre SMA50`; }
    else if (pctAbove > 1) { pts = 25; detail = `Por encima +${pctAbove.toFixed(1)}% sobre SMA50`; }
    else if (pctAbove > 0) { pts = 15; detail = `Justo encima +${pctAbove.toFixed(1)}%`; }
    else if (pctAbove > -3) { pts = 5; detail = `Por debajo ${pctAbove.toFixed(1)}% de SMA50`; }
    else { pts = 0; detail = `Muy por debajo ${pctAbove.toFixed(1)}% de SMA50`; }
    score += pts;
    breakdown.push({ metric: "Precio vs SMA50", value: pts, detail });
  }

  // 3. Precio vs SMA200 (0-20 pts)
  if (data.sma200 !== null && data.sma200 > 0) {
    const pctAbove = ((data.price - data.sma200) / data.sma200) * 100;
    let pts: number;
    let detail: string;
    if (pctAbove > 15) { pts = 15; detail = `Muy fuerte +${pctAbove.toFixed(1)}% sobre SMA200`; }
    else if (pctAbove > 5) { pts = 20; detail = `Fuerte +${pctAbove.toFixed(1)}% sobre SMA200`; }
    else if (pctAbove > 0) { pts = 12; detail = `Por encima +${pctAbove.toFixed(1)}%`; }
    else if (pctAbove > -5) { pts = 5; detail = `Por debajo ${pctAbove.toFixed(1)}%`; }
    else { pts = 0; detail = `Muy por debajo ${pctAbove.toFixed(1)}% de SMA200`; }
    score += pts;
    breakdown.push({ metric: "Precio vs SMA200", value: pts, detail });
  }

  // 4. Pendiente SMA50 (0-20 pts)
  if (data.sma50 !== null && data.sma200 !== null && data.sma50 > 0) {
    const slope = ((data.sma50 - data.sma200) / data.sma200) * 100;
    let pts: number;
    let detail: string;
    if (slope > 3) { pts = 20; detail = `Pendiente fuerte al alza +${slope.toFixed(1)}%`; }
    else if (slope > 1) { pts = 15; detail = `Pendiente positiva +${slope.toFixed(1)}%`; }
    else if (slope > 0) { pts = 10; detail = `Pendiente plana +${slope.toFixed(1)}%`; }
    else if (slope > -2) { pts = 5; detail = `Pendiente negativa ${slope.toFixed(1)}%`; }
    else { pts = 0; detail = `Pendiente bajista ${slope.toFixed(1)}%`; }
    score += pts;
    breakdown.push({ metric: "Pendiente SMA50/200", value: pts, detail });
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Tendencia alcista fuerte: precio sobre todas las medias con golden cross";
  else if (clamped >= 60) explanation = "Tendencia alcista moderada: precio por encima de medias clave";
  else if (clamped >= 40) explanation = "Tendencia mixta: señales contradictorias entre medias";
  else if (clamped >= 20) explanation = "Tendencia bajista: precio debajo de medias importantes";
  else explanation = "Tendencia bajista fuerte:死亡 cross y precio muy por debajo de medias";

  return {
    id: "trend",
    label: "Tendencia",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
