// Squeeze Radar — puro y testeable.
//
// Puntúa el potencial de un short squeeze combinando el reporte de interés
// corto de FINRA (Massive, free tier), el free float y el volumen reciente.
// Fuente de datos: `getMassiveShortInterest` / `getMassiveFloat` y barras
// diarias. Este módulo no hace fetching: solo transforma y puntúa.

export interface SqueezeInput {
  /** Acciones en corto (FINRA, último settlement). */
  shortInterest: number;
  /** Volumen medio diario (ADV) de las últimas ~20 sesiones, en acciones. */
  avgDailyVolume: number;
  /** Acciones en free float. */
  freeFloat: number;
  /** Precio actual de la acción. */
  price: number;
  /** Volumen de la última sesión (opcional; habilita el factor de surgencia). */
  recentVolume?: number;
}

export type SqueezeSignal = 'extreme' | 'high' | 'moderate' | 'low';

export interface SqueezeResult {
  score: number; // 0-100
  daysToCover: number; // shortInterest / ADV
  shortPctFloat: number; // % del float que está en corto
  floatValue: number; // valor de mercado del float (acciones × precio)
  volumeSurge: number; // recentVolume / ADV (1 = normal)
  signal: SqueezeSignal;
  reasons: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Días necesarios para recomprar todo el corto al ADV actual. */
export function daysToCover(shortInterest: number, avgDailyVolume: number): number {
  if (!(avgDailyVolume > 0)) return 0;
  return shortInterest / avgDailyVolume;
}

/** Porcentaje del free float que está en corto. */
export function shortPctFloat(shortInterest: number, freeFloat: number): number {
  if (!(freeFloat > 0)) return 0;
  return (shortInterest / freeFloat) * 100;
}

/**
 * Puntuación de squeeze 0-100. Pesos: días-a-cubrir 40, % del float en corto 35,
 * tamaño del float 15 y surgencia de volumen 10. Sin datos de float/volumen
 * esos componentes se omiten (el score máximo disponible se reduce).
 */
export function computeSqueeze(input: SqueezeInput): SqueezeResult {
  const shortInterest = Math.max(0, input.shortInterest || 0);
  const avgDailyVolume = Math.max(0, input.avgDailyVolume || 0);
  const freeFloat = Math.max(0, input.freeFloat || 0);
  const price = Math.max(0, input.price || 0);
  const recentVolume = input.recentVolume != null ? Math.max(0, input.recentVolume) : undefined;

  const dtc = daysToCover(shortInterest, avgDailyVolume);
  const pctFloat = shortPctFloat(shortInterest, freeFloat);
  const floatValue = freeFloat * price;
  const volumeSurge = recentVolume != null && avgDailyVolume > 0 ? recentVolume / avgDailyVolume : NaN;

  const reasons: string[] = [];

  let dtcScore = 0;
  if (dtc > 10) dtcScore = 40;
  else if (dtc > 7) dtcScore = 32;
  else if (dtc > 5) dtcScore = 24;
  else if (dtc > 3) dtcScore = 14;
  else if (dtc > 1.5) dtcScore = 6;
  if (dtc >= 5) reasons.push(`${dtc.toFixed(1)} días a cubrir (>5 = presión alta)`);

  let pctScore = 0;
  if (freeFloat > 0) {
    if (pctFloat > 20) pctScore = 35;
    else if (pctFloat > 15) pctScore = 28;
    else if (pctFloat > 10) pctScore = 20;
    else if (pctFloat > 5) pctScore = 12;
    else pctScore = 4;
    if (pctFloat >= 15) reasons.push(`${pctFloat.toFixed(1)}% del float en corto`);
  }

  let floatScore = 0;
  if (freeFloat > 0) {
    if (freeFloat < 50e6) {
      floatScore = 15;
      reasons.push('Float pequeño (<50M acciones): fácil de apretar');
    } else if (freeFloat < 200e6) floatScore = 10;
    else if (freeFloat < 1e9) floatScore = 5;
  }

  let surgeScore = 0;
  if (isFinite(volumeSurge)) {
    if (volumeSurge > 2) {
      surgeScore = 10;
      reasons.push(`Volumen ${volumeSurge.toFixed(1)}× el promedio`);
    } else if (volumeSurge > 1.5) surgeScore = 6;
    else if (volumeSurge > 1) surgeScore = 2;
  }

  const score = clamp(Math.round(dtcScore + pctScore + floatScore + surgeScore), 0, 100);
  const signal: SqueezeSignal = score >= 75 ? 'extreme' : score >= 55 ? 'high' : score >= 35 ? 'moderate' : 'low';

  if (reasons.length === 0) reasons.push('Sin señales destacadas de compresión');

  return {
    score,
    daysToCover: Math.round(dtc * 100) / 100,
    shortPctFloat: Math.round(pctFloat * 100) / 100,
    floatValue,
    volumeSurge: isFinite(volumeSurge) ? Math.round(volumeSurge * 100) / 100 : 0,
    signal,
    reasons,
  };
}

/** ADV simple de un array de volúmenes (usa las últimas `period` sesiones). */
export function avgVolume(volumes: number[], period = 20): number {
  const clean = volumes.filter((v) => v > 0);
  if (clean.length === 0) return 0;
  const slice = clean.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}
