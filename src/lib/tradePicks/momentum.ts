// Sistema de momentum de Sean (@SRxTrades) aplicado a Trade Picks:
// 1) Régimen de mercado: SPY/QQQ sobre EMA 8/21/50 → convicción completa.
// 2) Liderazgo: precio sobre EMA 8/21/50 + fuerza relativa vs SPY.
// 3) Setup: base ajustada (tightness) con volumen secándose, cerca de su
//    trigger (resistencia de la base) o recién roto con volumen.

export function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

export interface EmaState {
  ema8: number | null;
  ema21: number | null;
  ema50: number | null;
  priceAboveAll: boolean; // precio sobre 8/21/50 (gate de Sean)
  stacked: boolean; // 8 > 21 > 50
  extFromEma8: number; // % sobre EMA8
  priceBelowAll: boolean; // precio bajo 8/21/50 (gate bajista)
  stackedDown: boolean; // 8 < 21 < 50
}

export function emaState(closes: number[], price?: number): EmaState {
  const ema8 = calcEMA(closes, 8);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const p = price ?? closes[closes.length - 1];
  const ready = ema8 != null && ema21 != null && ema50 != null;
  const priceAboveAll = !!(ready && p > (ema8 as number) && p > (ema21 as number) && p > (ema50 as number));
  const stacked = !!(ready && (ema8 as number) > (ema21 as number) && (ema21 as number) > (ema50 as number));
  const priceBelowAll = !!(ready && p < (ema8 as number) && p < (ema21 as number) && p < (ema50 as number));
  const stackedDown = !!(ready && (ema8 as number) < (ema21 as number) && (ema21 as number) < (ema50 as number));
  const extFromEma8 = ema8 && ema8 > 0 ? ((p - ema8) / ema8) * 100 : 0;
  return { ema8, ema21, ema50, priceAboveAll, stacked, extFromEma8, priceBelowAll, stackedDown };
}

/** Average Daily Range en % (rango medio diario de las últimas N barras). */
export function adrPct(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  const n = Math.min(period, highs.length, lows.length, closes.length);
  if (n < 5) return null;
  let sum = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const c = closes[i];
    if (!c || c <= 0) continue;
    sum += (highs[i] - lows[i]) / c;
  }
  return (sum / n) * 100;
}

export type RegimeLevel = 'BULL' | 'MIXED' | 'CHOP';

export interface MarketRegime {
  level: RegimeLevel;
  spyAbove: boolean;
  qqqAbove: boolean;
  vix?: number | null;
  breadth?: number | null; // % del universo por encima de MA50
}

/** SPY/QQQ sobre EMA 8/21/50 = BULL (convicción completa); uno = MIXED; ninguno = CHOP. */
export function evalRegime(spyCloses: number[], qqqCloses: number[]): MarketRegime {
  const spy = emaState(spyCloses);
  const qqq = emaState(qqqCloses);
  const above = (spy.priceAboveAll ? 1 : 0) + (qqq.priceAboveAll ? 1 : 0);
  return {
    level: above === 2 ? 'BULL' : above === 1 ? 'MIXED' : 'CHOP',
    spyAbove: spy.priceAboveAll,
    qqqAbove: qqq.priceAboveAll,
  };
}

/** Fuerza relativa: retorno del activo menos retorno del benchmark (en %) en N barras. */
export function relativeStrength(closes: number[], benchCloses: number[], period = 20): number | null {
  if (closes.length < period + 1 || benchCloses.length < period + 1) return null;
  const s0 = closes[closes.length - 1 - period];
  const s1 = closes[closes.length - 1];
  const b0 = benchCloses[benchCloses.length - 1 - period];
  const b1 = benchCloses[benchCloses.length - 1];
  if (!s0 || !b0 || s0 <= 0 || b0 <= 0) return null;
  return (s1 / s0 - 1) * 100 - (b1 / b0 - 1) * 100;
}

export type BreakoutState = 'near' | 'confirmed';

export interface Setup {
  state: BreakoutState;
  trigger: number; // resistencia de la base (nivel de entrada/gatillo)
  baseLow: number; // piso de la base → stop
  baseHigh: number;
  poleHeight: number; // impulso previo a la base (asta de la bandera)
  distToTriggerPct: number; // >0 falta romper, <0 ya rompió
  rangePct: number; // rango de la base (%)
  volChangePct: number; // vol consolidación vs previo (%), negativo = secándose
  volDryUp: boolean;
  volRatio: number; // volumen de la ruptura vs media 20 previa a la base
}

const BASE_BARS = 15;
const NEAR_MAX_PCT = 3; // "a punto de romper" = a ≤3% del trigger

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Detecta la base (consolidación) de las últimas ~15 sesiones y su trigger.
 * - Si cerró sobre el máximo de la base en los últimos 5 días → 'confirmed'.
 * - Si está a ≤3% del máximo → 'near' (a punto de romper).
 * - Si está más lejos → null (no hay setup).
 */
export function detectSetup(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): Setup | null {
  const n = closes.length;
  if (n < 60 || highs.length < n || lows.length < n || volumes.length < n) return null;
  const price = closes[n - 1];
  if (!(price > 0)) return null;

  // ¿Hubo ruptura del máximo de 15 barras en los últimos 5 días?
  let baseEnd = n - 1; // primera barra fuera de la base (la actual si no hay ruptura)
  for (let j = n - 1; j >= Math.max(BASE_BARS + 1, n - 5); j--) {
    let priorHigh = -Infinity;
    for (let i = j - BASE_BARS; i < j; i++) if (highs[i] > priorHigh) priorHigh = highs[i];
    if (closes[j] > priorHigh) {
      baseEnd = j;
      break;
    }
  }

  const baseStart = baseEnd - BASE_BARS;
  if (baseStart < 30) return null; // necesita contexto de volumen previo

  let trigger = -Infinity;
  let baseLow = Infinity;
  for (let i = baseStart; i < baseEnd; i++) {
    if (highs[i] > trigger) trigger = highs[i];
    if (lows[i] < baseLow) baseLow = lows[i];
  }
  if (!isFinite(trigger) || !isFinite(baseLow) || trigger <= 0 || baseLow <= 0) return null;

  const rangePct = ((trigger - baseLow) / price) * 100;
  const distToTriggerPct = ((trigger - price) / price) * 100;
  const state: BreakoutState = price > trigger ? 'confirmed' : 'near';
  if (state === 'near' && distToTriggerPct > NEAR_MAX_PCT) return null; // demasiado lejos

  // Volumen secándose: media de las 10 barras del final de la base vs las 20 previas
  const recentVol = mean(volumes.slice(baseEnd - 10, baseEnd));
  const prevVol = mean(volumes.slice(baseEnd - 30, baseEnd - 10));
  const volChangePct = prevVol > 0 ? (recentVol / prevVol - 1) * 100 : 0;
  const volDryUp = volChangePct <= -10;

  // Volumen de la ruptura vs media 20 previa a la base
  const preBaseVol = mean(volumes.slice(baseStart - 20, baseStart));
  const breakVol = Math.max(...volumes.slice(baseEnd, n));
  const volRatio = preBaseVol > 0 ? breakVol / preBaseVol : 1;

  // Impulso previo a la base (asta de la bandera) — objetivo proyectado
  let poleLow = Infinity;
  for (let i = Math.max(0, baseStart - 20); i < baseStart; i++) {
    if (lows[i] < poleLow) poleLow = lows[i];
  }
  const poleHeight = isFinite(poleLow) && poleLow > 0 && trigger > poleLow ? trigger - poleLow : 0;

  return {
    state,
    trigger,
    baseLow,
    baseHigh: trigger,
    poleHeight,
    distToTriggerPct,
    rangePct,
    volChangePct,
    volDryUp,
    volRatio,
  };
}

/**
 * Espejo bajista de detectSetup: base de ~15 sesiones cuyo SOPORTE es el
 * gatillo de ruptura a la baja.
 * - Si cerró bajo el mínimo de la base en los últimos 5 días → 'confirmed'.
 * - Si está a ≤3% por encima del mínimo → 'near' (a punto de romper abajo).
 * - Si está más lejos → null.
 * En el Setup devuelto: `trigger`/`baseLow` = soporte de la base (entrada),
 * `baseHigh` = techo de la base (stop), `poleHeight` = caída previa (asta).
 */
export function detectShortSetup(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): Setup | null {
  const n = closes.length;
  if (n < 60 || highs.length < n || lows.length < n || volumes.length < n) return null;
  const price = closes[n - 1];
  if (!(price > 0)) return null;

  // ¿Hubo ruptura del mínimo de 15 barras en los últimos 5 días?
  let baseEnd = n - 1;
  for (let j = n - 1; j >= Math.max(BASE_BARS + 1, n - 5); j--) {
    let priorLow = Infinity;
    for (let i = j - BASE_BARS; i < j; i++) if (lows[i] < priorLow) priorLow = lows[i];
    if (closes[j] < priorLow) {
      baseEnd = j;
      break;
    }
  }

  const baseStart = baseEnd - BASE_BARS;
  if (baseStart < 30) return null;

  let trigger = Infinity; // soporte de la base (nivel de ruptura bajista)
  let baseHigh = -Infinity; // techo de la base → stop
  for (let i = baseStart; i < baseEnd; i++) {
    if (lows[i] < trigger) trigger = lows[i];
    if (highs[i] > baseHigh) baseHigh = highs[i];
  }
  if (!isFinite(trigger) || !isFinite(baseHigh) || trigger <= 0 || baseHigh <= 0) return null;

  const rangePct = ((baseHigh - trigger) / price) * 100;
  const distToTriggerPct = ((price - trigger) / price) * 100; // >0 aún por encima
  const state: BreakoutState = price < trigger ? 'confirmed' : 'near';
  if (state === 'near' && distToTriggerPct > NEAR_MAX_PCT) return null;

  const recentVol = mean(volumes.slice(baseEnd - 10, baseEnd));
  const prevVol = mean(volumes.slice(baseEnd - 30, baseEnd - 10));
  const volChangePct = prevVol > 0 ? (recentVol / prevVol - 1) * 100 : 0;
  const volDryUp = volChangePct <= -10;

  const preBaseVol = mean(volumes.slice(baseStart - 20, baseStart));
  const breakVol = Math.max(...volumes.slice(baseEnd, n));
  const volRatio = preBaseVol > 0 ? breakVol / preBaseVol : 1;

  // Impulso previo a la base (asta descendente) — objetivo proyectado
  let poleHigh = -Infinity;
  for (let i = Math.max(0, baseStart - 20); i < baseStart; i++) {
    if (highs[i] > poleHigh) poleHigh = highs[i];
  }
  const poleHeight = isFinite(poleHigh) && poleHigh > 0 && poleHigh > trigger ? poleHigh - trigger : 0;

  return {
    state,
    trigger,
    baseLow: trigger,
    baseHigh,
    poleHeight,
    distToTriggerPct,
    rangePct,
    volChangePct,
    volDryUp,
    volRatio,
  };
}
