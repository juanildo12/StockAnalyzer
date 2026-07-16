import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.12;

export function scoreVolume(data: StockInput): FactorResult {
  let score = 0;
  const breakdown: BreakdownItem[] = [];

  const volRatio = data.avgVolume20d > 0 ? data.volume / data.avgVolume20d : 1;

  // 1. Volume ratio vs 20d average (0-50 pts)
  let ratioPts: number;
  let ratioDetail: string;
  if (volRatio > 3.0) { ratioPts = 50; ratioDetail = `Volumen extremo ${volRatio.toFixed(1)}x`; }
  else if (volRatio > 2.0) { ratioPts = 42; ratioDetail = `Volumen alto ${volRatio.toFixed(1)}x`; }
  else if (volRatio > 1.5) { ratioPts = 35; ratioDetail = `Volumen elevado ${volRatio.toFixed(1)}x`; }
  else if (volRatio > 1.2) { ratioPts = 25; ratioDetail = `Volumen por encima ${volRatio.toFixed(1)}x`; }
  else if (volRatio > 0.8) { ratioPts = 15; ratioDetail = `Volumen normal ${volRatio.toFixed(1)}x`; }
  else if (volRatio > 0.5) { ratioPts = 8; ratioDetail = `Volumen bajo ${volRatio.toFixed(1)}x`; }
  else { ratioPts = 0; ratioDetail = `Volumen muy bajo ${volRatio.toFixed(1)}x`; }
  score += ratioPts;
  breakdown.push({ metric: "Ratio vs media 20d", value: ratioPts, detail: ratioDetail });

  // 2. Volume confirmation with price move (0-30 pts)
  if (volRatio > 1.2 && data.changePercent > 0) {
    const pts = Math.min(30, Math.round(volRatio * 12));
    score += pts;
    breakdown.push({ metric: "Confirmación precio+volumen", value: pts, detail: `Volumen sube con precio +${data.changePercent.toFixed(1)}%` });
  } else if (volRatio > 1.5 && data.changePercent < 0) {
    const pts = Math.min(20, Math.round(volRatio * 8));
    score += pts;
    breakdown.push({ metric: "Distribución", value: pts, detail: `Volumen alto con precio bajista` });
  } else {
    breakdown.push({ metric: "Confirmación precio+volumen", value: 0, detail: "Sin confirmación clara" });
  }

  // 3. Volume trend — consecutive above/below average (0-20 pts, estimated from current)
  if (volRatio > 1.3) {
    const pts = 20;
    score += pts;
    breakdown.push({ metric: "Tendencia volumen", value: pts, detail: "Volumen creciente" });
  } else if (volRatio > 1.0) {
    const pts = 10;
    score += pts;
    breakdown.push({ metric: "Tendencia volumen", value: pts, detail: "Volumen estable" });
  } else {
    breakdown.push({ metric: "Tendencia volumen", value: 0, detail: "Volumen decreciente" });
  }

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = `Volumen muy fuerte (${volRatio.toFixed(1)}x media) confirmando movimiento`;
  else if (clamped >= 60) explanation = `Volumen por encima del promedio (${volRatio.toFixed(1)}x)`;
  else if (clamped >= 40) explanation = `Volumen normal (${volRatio.toFixed(1)}x), sin confirmación especial`;
  else if (clamped >= 20) explanation = `Volumen por debajo del promedio (${volRatio.toFixed(1)}x)`;
  else explanation = `Volumen muy débil (${volRatio.toFixed(1)}x), sin interés`;

  return {
    id: "volume",
    label: "Volumen",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
