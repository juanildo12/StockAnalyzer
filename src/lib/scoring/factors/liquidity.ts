import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.05;

export function scoreLiquidity(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  // 1. Average daily volume tier (0-50 pts)
  const avgVol = data.avgVolume20d || data.volume;
  let volPts: number;
  let volDetail: string;
  if (avgVol > 10e6) { volPts = 50; volDetail = `Alta liquidez ${(avgVol / 1e6).toFixed(1)}M avg`; }
  else if (avgVol > 5e6) { volPts = 42; volDetail = `Buena liquidez ${(avgVol / 1e6).toFixed(1)}M avg`; }
  else if (avgVol > 1e6) { volPts = 30; volDetail = `Liquidez moderada ${(avgVol / 1e6).toFixed(1)}M avg`; }
  else if (avgVol > 500e3) { volPts = 18; volDetail = `Liquidez baja ${(avgVol / 1e3).toFixed(0)}K avg`; }
  else { volPts = 5; volDetail = `Muy baja liquidez ${(avgVol / 1e3).toFixed(0)}K avg`; }
  breakdown.push({ metric: "Volumen promedio", value: volPts, detail: volDetail });

  // 2. Market cap tier (0-50 pts)
  let capPts: number;
  let capDetail: string;
  if (data.marketCap > 200e9) { capPts = 50; capDetail = "Mega cap ($200B+)"; }
  else if (data.marketCap > 50e9) { capPts = 42; capDetail = "Large cap ($50B+)"; }
  else if (data.marketCap > 10e9) { capPts = 32; capDetail = "Mid cap ($10B+)"; }
  else if (data.marketCap > 2e9) { capPts = 20; capDetail = "Small cap ($2B+)"; }
  else if (data.marketCap > 300e6) { capPts = 10; capDetail = "Micro cap ($300M+)"; }
  else { capPts = 3; capDetail = "Nano cap (<$300M)"; }
  breakdown.push({ metric: "Market Cap", value: capPts, detail: capDetail });

  score = Math.round((volPts + capPts) / 2 + (volPts > 35 && capPts > 35 ? 10 : 0));
  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Liquidez excelente: entrada/salida sin fricción";
  else if (clamped >= 60) explanation = "Liquidez buena: ejecución limpia en la mayoría de operaciones";
  else if (clamped >= 40) explanation = "Liquidez moderada: posible slippage en órdenes grandes";
  else explanation = "Liquidez baja: riesgo de slippage significativo";

  return {
    id: "liquidity",
    label: "Liquidez",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
