import { StockInput, FactorResult, BreakdownItem } from "../types";

const WEIGHT = 0.12;

export function scoreMomentum(data: StockInput): FactorResult {
  let score = 50;
  const breakdown: BreakdownItem[] = [];

  // 1. RSI zone (0-35 pts)
  if (data.rsi !== null) {
    let pts: number;
    let detail: string;
    // Optimal: 40-65 (bullish momentum, not overbought)
    if (data.rsi > 80) { pts = 10; detail = `RSI ${data.rsi.toFixed(0)} — sobrecomprado extremo`; }
    else if (data.rsi > 70) { pts = 18; detail = `RSI ${data.rsi.toFixed(0)} — sobrecomprado`; }
    else if (data.rsi > 60) { pts = 32; detail = `RSI ${data.rsi.toFixed(0)} — momentum fuerte`; }
    else if (data.rsi > 50) { pts = 35; detail = `RSI ${data.rsi.toFixed(0)} — zona ideal`; }
    else if (data.rsi > 40) { pts = 28; detail = `RSI ${data.rsi.toFixed(0)} — neutral`; }
    else if (data.rsi > 30) { pts = 15; detail = `RSI ${data.rsi.toFixed(0)} — débil`; }
    else { pts = 5; detail = `RSI ${data.rsi.toFixed(0)} — sobreventa`; }
    score = pts;
    breakdown.push({ metric: "RSI(14)", value: pts, detail });
  }

  // 2. MACD direction (0-35 pts)
  if (data.macd !== null && data.macdSignal !== null) {
    const macdDiff = data.macd - data.macdSignal;
    let pts: number;
    let detail: string;
    if (macdDiff > 0 && data.macd > 0) { pts = 35; detail = "MACD bullish en territorio positivo"; }
    else if (macdDiff > 0) { pts = 28; detail = "MACD bullish (cruz al alza)"; }
    else if (macdDiff > -0.5) { pts = 15; detail = "MACD neutral (cerca de cruz)"; }
    else { pts = 5; detail = "MACD bearish"; }
    score = Math.round((score + pts) / 2 + (score > 25 && pts > 25 ? 10 : 0));
    breakdown.push({ metric: "MACD", value: pts, detail });
  }

  // 3. Intraday momentum (0-30 pts)
  let dayPts: number;
  let dayDetail: string;
  if (data.changePercent > 3) { dayPts = 30; dayDetail = `Movimiento fuerte +${data.changePercent.toFixed(1)}%`; }
  else if (data.changePercent > 1) { dayPts = 22; dayDetail = `Positivo +${data.changePercent.toFixed(1)}%`; }
  else if (data.changePercent > 0) { dayPts = 15; dayDetail = `Ligeramente positivo +${data.changePercent.toFixed(1)}%`; }
  else if (data.changePercent > -1) { dayPts = 10; dayDetail = `Neutral ${data.changePercent.toFixed(1)}%`; }
  else if (data.changePercent > -3) { dayPts = 5; dayDetail = `Negativo ${data.changePercent.toFixed(1)}%`; }
  else { dayPts = 0; dayDetail = `Fuerte bajada ${data.changePercent.toFixed(1)}%`; }
  breakdown.push({ metric: "Cambio intradía", value: dayPts, detail: dayDetail });
  // Add day momentum as bonus (not in initial score calc since RSI + MACD already set it)
  score = Math.min(100, score + Math.round(dayPts * 0.3));

  const clamped = Math.min(100, Math.max(0, score));

  let explanation: string;
  if (clamped >= 80) explanation = "Momentum fuerte: RSI en zona ideal, MACD bullish, precio subiendo";
  else if (clamped >= 60) explanation = "Momentum positivo: indicadores apuntan al alza";
  else if (clamped >= 40) explanation = "Momentum mixto: señales neutrales o contradictorias";
  else if (clamped >= 20) explanation = "Momentum débil: indicadores bajistas";
  else explanation = "Momentum muy débil: sobreventa o tendencia bajista fuerte";

  return {
    id: "momentum",
    label: "Momentum",
    score: clamped,
    weight: WEIGHT,
    weightedScore: Math.round(clamped * WEIGHT * 10) / 10,
    explanation,
    breakdown,
  };
}
