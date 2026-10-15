// Análisis profundo para Trade Picks:
// - Volatilidad realizada vs IV (no pagar IV cara)
// - Breakeven + retorno esperado de la opción sobre el target de la acción
// - Soportes/resistencias por swing pivots (no solo "cualquier high")
// - Muros de open interest (max OI call/put del strike)
// - Earnings dentro de la ventana del contrato
// - Fuerza relativa vs sector (ETF) y amplitud del mercado (breadth)

/** Volatilidad anualizada (20 sesiones) de los retornos logarítmicos. */
export function realizedVol(closes: number[], period = 20): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-(period + 1));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (!(slice[i - 1] > 0) || !(slice[i] > 0)) continue;
    rets.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

/**
 * Ajuste por IV: penaliza pagar volatilidad implícita muy por encima de la
 * realizada (overpay) o IV absurda (>200%). Sin datos → 0.
 */
export function ivAdjustment(iv: number | null | undefined, rv: number | null | undefined): number {
  if (!iv || iv <= 0) return 0;
  if (iv > 2) return -18; // IV > 200% → casi siempre eventos/binarios
  if (!rv || rv <= 0) return iv > 1.2 ? -6 : 0;
  const ratio = iv / rv;
  if (ratio <= 1.2) return 6; // IV ≈ RV → pagas precio justo
  if (ratio <= 1.6) return 0;
  if (ratio <= 2.2) return -10;
  return -18;
}

/** Precio de equilibrio de una CALL: strike + prima (de la PUT: strike − prima). */
export function breakevenPrice(strike: number, premium: number, isCall: boolean): number {
  if (!(strike > 0)) return 0;
  return isCall ? strike + premium : strike - premium;
}

export interface TradeabilityInput {
  price: number; // precio actual de la acción
  target: number; // target técnico de la acción
  strike: number;
  premium: number; // mid del contrato
  delta: number;
  dte: number;
  adr: number; // ADR % (rango medio diario)
  isCall: boolean;
}

export interface Tradeability {
  score: number; // 0-24
  breakeven: number;
  breakevenPct: number; // % que debe subir la acción para empatar
  expectedReturn: number; // retorno estimado del premium si se alcanza el target
  reachable: boolean; // breakeven dentro del movimiento esperado (ADR × √DTE)
}

/**
 * ¿Tiene sentido pagar esta prima para llegar al target técnico?
 * - El target debe superar el breakeven con margen.
 * - Retorno estimado ≈ (delta × movimiento al target − prima) / prima.
 * - El breakeven debe estar dentro del movimiento esperado en el DTE.
 */
export function tradeability(input: TradeabilityInput): Tradeability {
  const { price, target, strike, premium, delta, dte, adr, isCall } = input;
  const breakeven = breakevenPrice(strike, premium, isCall);
  const breakevenPct = price > 0 ? ((breakeven - price) / price) * 100 : 999;
  const move = isCall ? target - price : price - target;
  const expectedReturn = premium > 0 ? (Math.abs(delta) * move - premium) / premium : -1;

  const expectedMovePct = adr * Math.sqrt(Math.max(dte, 1));
  const reachable = breakevenPct <= expectedMovePct;

  let score = 0;
  // El target cubre el breakeven → la tesis técnica paga la prima
  if (breakeven <= target) score += 7;
  // Retorno sobre la prima si el target se alcanza
  if (expectedReturn >= 1) score += 10;
  else if (expectedReturn >= 0.5) score += 7;
  else if (expectedReturn >= 0) score += 3;
  // Breakeven alcanzable dentro del movimiento esperado del DTE
  if (reachable) score += 7;
  else if (breakevenPct <= expectedMovePct * 1.5) score += 3;

  return { score: Math.min(score, 24), breakeven, breakevenPct, expectedReturn, reachable };
}

export interface SwingLevels {
  supports: number[]; // descendente (el más cercano al precio primero)
  resistances: number[]; // ascendente (el más cercano al precio primero)
}

/**
 * Swing pivots (barra alta/baja más que sus 2 vecinas) agrupados por
 * proximidad: niveles reales de soporte/resistencia, no cada mero high.
 */
export function swingLevels(highs: number[], lows: number[], price: number): SwingLevels {
  const pivHi: number[] = [];
  const pivLo: number[] = [];
  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      pivHi.push(highs[i]);
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      pivLo.push(lows[i]);
    }
  }
  const cluster = (levels: number[]): number[] => {
    const sorted = [...levels].sort((a, b) => a - b);
    const out: number[] = [];
    for (const lv of sorted) {
      const last = out[out.length - 1];
      if (last !== undefined && Math.abs(lv - last) / last <= 0.02) {
        out[out.length - 1] = Math.max(last, lv); // agrupa dentro del 2%
      } else {
        out.push(lv);
      }
    }
    return out;
  };
  const resistances = cluster(pivHi).filter((r) => r > price);
  const supports = cluster(pivLo).filter((s) => s < price).reverse();
  return { supports, resistances };
}

export interface OiLevels {
  callWall: number | null; // strike con máximo OI call → muro de resistencia
  putWall: number | null; // strike con máximo OI put → muro de soporte
  callWallOi: number;
  putWallOi: number;
}

/** Muros de open interest de la cadena: strike con más OI call y más OI put. */
export function oiLevelsFromChain(chain: { calls?: any[]; puts?: any[] }): OiLevels {
  let callWall: number | null = null;
  let putWall: number | null = null;
  let callWallOi = 0;
  let putWallOi = 0;
  for (const c of chain.calls || []) {
    const oi = c.openInterest || 0;
    if (oi > callWallOi) {
      callWallOi = oi;
      callWall = c.strike;
    }
  }
  for (const p of chain.puts || []) {
    const oi = p.openInterest || 0;
    if (oi > putWallOi) {
      putWallOi = oi;
      putWall = p.strike;
    }
  }
  return { callWall, putWall, callWallOi, putWallOi };
}

/** ¿Caen los earnings dentro de la ventana [hoy, hoy + dte]? */
export function earningsInWindow(earningsTs: Date | number | null | undefined, dteDays: number, now = Date.now()): boolean {
  if (!earningsTs) return false;
  const ts = typeof earningsTs === 'number' ? earningsTs * (earningsTs < 1e12 ? 1000 : 1) : earningsTs.getTime();
  if (!isFinite(ts) || ts <= 0) return false;
  return ts >= now && ts <= now + dteDays * 86400000;
}

export const SECTOR_ETF: Record<string, string> = {
  Technology: 'XLK',
  'Financial Services': 'XLF',
  Healthcare: 'XLV',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  Energy: 'XLE',
  Utilities: 'XLU',
  'Real Estate': 'XLRE',
  'Communication Services': 'XLC',
  Industrials: 'XLI',
  'Basic Materials': 'XLB',
};

/** Ajuste por amplitud del mercado (% del universo sobre MA50). */
export function breadthAdjust(breadth: number | null): number {
  if (breadth === null || !isFinite(breadth)) return 0;
  if (breadth >= 65) return 3;
  if (breadth >= 50) return 1;
  if (breadth >= 35) return -3;
  return -6;
}

export interface PeerRsResult {
  score: number; // −6..+3
  rs: number; // exceso de retorno % vs la mediana de pares
  medianPeerReturn: number;
  reason: string;
}

/**
 * Fuerza relativa vs pares (Massive `/v1/related-companies`). El exceso de
 * retorno de la acción sobre la mediana de sus pares, en la misma ventana.
 * Liderar a los pares confirma el momentum; quedar rezagado lo debilita.
 */
export function peerRelativeStrength(stockReturnPct: number, peerReturnsPct: number[]): PeerRsResult {
  const peers = peerReturnsPct.filter((r) => isFinite(r));
  if (!isFinite(stockReturnPct) || peers.length === 0) {
    return { score: 0, rs: 0, medianPeerReturn: 0, reason: '' };
  }
  const sorted = [...peers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const rs = stockReturnPct - median;

  let score = 0;
  if (rs >= 5) score = 3;
  else if (rs >= 2) score = 2;
  else if (rs <= -5) score = -6;
  else if (rs <= -2) score = -3;

  const reason = score > 0 ? `Lidera a sus pares (+${rs.toFixed(1)}% de exceso)` : score < 0 ? `Rezagada vs pares (${rs.toFixed(1)}%)` : '';
  return { score, rs, medianPeerReturn: median, reason };
}

export interface CorpActionResult {
  score: number; // −3..0
  reasons: string[];
}

/**
 * Riesgo por acciones corporativas dentro de la ventana del contrato:
 * ex-dividendo cercano (riesgo de asignación/ajuste) o split reciente
 * (volatilidad y spreads más amplios). No premia; solo resta.
 */
export function corpActionAdjustment(
  dte: number,
  daysToExDividend: number | null | undefined,
  daysSinceSplit: number | null | undefined
): CorpActionResult {
  const reasons: string[] = [];
  let score = 0;

  if (daysToExDividend != null && daysToExDividend >= 0 && daysToExDividend <= dte) {
    score -= 1;
    reasons.push(`Ex-dividendo en ${daysToExDividend}d (dentro del vencimiento)`);
  }
  if (daysSinceSplit != null && daysSinceSplit >= 0 && daysSinceSplit <= 30) {
    score -= 2;
    reasons.push(`Split hace ${daysSinceSplit}d (spreads/volatilidad irregulares)`);
  }

  return { score: Math.max(score, -3), reasons };
}
