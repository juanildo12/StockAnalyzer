import { bsGreeks } from './bs';

/**
 * Riesgo / Beneficio de un trade de opciones expresado en PRIMA.
 *
 * El R/R clásico (precio de la acción) miente para opciones: un call de $0.50
 * puede triplicar con que la acción se mueva un 2%. Aquí se traduce el stop y
 * el target de la acción a precio de opción con Black-Scholes (IV y DTE reales
 * del contrato) y se pondera el beneficio por la calidad del trade.
 *
 * Todo es estimación: el precio real de la opción también depende de cómo
 * mueva la IV (skew,_EVENTOS) y de la microestructura del libro.
 */

export interface PremiumRiskInput {
  /** Precio de la acción en la entrada. */
  entry: number;
  /** Precio de la acción en el stop. */
  stop: number;
  /** Precio de la acción en el target. */
  target: number;
  /** Strike del contrato. */
  strike: number;
  /** Prima pagada (mid del contrato). */
  premium: number;
  /** IV del contrato (decimal, ej. 0.45). 0 si no hay dato. */
  iv: number;
  /** Días a vencimiento. */
  dte: number;
  isCall: boolean;
  /** Delta del contrato si se conoce (fallback si no hay IV). */
  delta?: number | null;
}

export interface TradeQualityInput {
  /** Score compuesto del trade 0-100 (weightedScore: acción 60% + opción 40%). */
  score: number;
  /** 'near' = gatillo aún sin romper; 'confirmed' = ruptura con volumen. */
  setupState?: 'near' | 'confirmed';
  /** El target cabe en el movimiento esperado (tradeability). */
  targetReachable?: boolean;
  /** Un muro de OI frena el target. */
  targetBlockedByOi?: boolean;
  /** Earnings dentro de la ventana del DTE. */
  earningsSoon?: boolean;
  /**
   * Ajustes extra NO incluidos en el score. El score ya penaliza earnings,
   * muros de OI, IV vs RV, tradeability, liquidez y estado del setup, así que
   * no se repiten aquí (sería doble conteo). Este canal existe para fricciones
   * de ejecución que el score no mide.
   */
  adjustments?: { label: string; factor: number }[];
}

export interface QualityAssessment {
  /** Multiplicador 0..1 sobre el beneficio bruto. */
  factor: number;
  label: 'alta' | 'media' | 'baja';
  /** Desglose auditable de cada ajuste aplicado. */
  reasons: string[];
}

export interface PremiumRiskBenefit {
  /** Prima teórica de la opción en cada escenario (precio de la acción). */
  entryPremium: number;
  stopPremium: number;
  targetPremium: number;
  /** Pérdida por acción si salta el stop (prima entrada − prima stop). */
  riskPerShare: number;
  /** Ganancia por acción si llega al target (prima target − prima entrada). */
  rewardPerShare: number;
  /** Riesgo por contrato (×100). */
  riskPerContract: number;
  /** Beneficio bruto por contrato (×100). */
  rewardPerContract: number;
  /** Beneficio esperado por contrato, ponderado por calidad. */
  rewardExpectedPerContract: number;
  /** % de la prima en riesgo si salta el stop. */
  riskPct: number;
  /** % de la prima ganado si llega al target. */
  rewardPct: number;
  /** R/R en prima sin ponderar por calidad (null si el riesgo es 0). */
  rrBase: number | null;
  /** R/R en prima ponderado por la calidad del trade. */
  rrQuality: number | null;
  quality: QualityAssessment;
  /** true si el stop no reduce la prima (riesgo ≈ 0). */
  riskFree: boolean;
  /** true si al target la opción vale menos que lo pagado (el target no paga). */
  targetDoesNotPay: boolean;
  /** Breakeven del contrato al vencimiento, en precio de la acción. */
  breakeven: number;
  /** true si el target de la acción supera el breakeven (hay margen real). */
  targetClearsBreakeven: boolean;
  /** Movimiento que la acción necesita para llegar al breakeven, en %. */
  breakevenMovePct: number | null;
  /** Movimiento esperado de la acción en el plazo (ADR × √DTE), en %. */
  expectedMovePct: number | null;
  /** true si el breakeven está dentro del movimiento esperado. */
  breakevenWithinExpectedMove: boolean | null;
  /** Notas legibles sobre el resultado. */
  notes: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Precio teórico de la opción a un precio de la acción dado.
 *
 * Se ancla a la prima REAL que se pagó: se calcula la forma de la curva con
 * Black-Scholes (IV y DTE reales del contrato) y se escala por la prima de
 * mercado. Así el resultado es coherente con lo que realmente pagaste (el mid
 * incluye skew y microstructure que BSM no modela) y, además, el R/R en prima
 * queda invariante a la escala.
 *
 * Si no hay IV, cae a linealidad por delta desde la entrada. Nunca devuelve
 * menos que el valor intrínseco.
 */
export function priceOptionAt(
  input: PremiumRiskInput,
  stockPrice: number,
  entryStock: number
): number {
  const { strike, premium, iv, dte, isCall, delta } = input;
  if (!isFinite(stockPrice) || !isFinite(strike) || strike <= 0) return 0;
  const intrinsic = isCall
    ? Math.max(0, stockPrice - strike)
    : Math.max(0, strike - stockPrice);

  const bsEntry = bsPriceAt(input, entryStock);
  const bsHere = bsPriceAt(input, stockPrice);
  if (bsEntry != null && bsHere != null && bsEntry > 0) {
    return Math.max(intrinsic, premium * (bsHere / bsEntry), 0);
  }

  // Fallback: linealidad por delta desde la entrada.
  if (delta != null && isFinite(delta) && isFinite(entryStock)) {
    return Math.max(intrinsic, premium + Math.abs(delta) * (stockPrice - entryStock), 0);
  }
  return Math.max(intrinsic, premium, 0);
}

/** Precio Black-Scholes en un punto, o null si no hay IV/DTE utilizable. */
function bsPriceAt(input: PremiumRiskInput, stockPrice: number): number | null {
  const T = Math.max(0, input.dte) / 365;
  if (!(input.iv > 0) || T <= 0 || !isFinite(stockPrice) || stockPrice <= 0) return null;
  const p = bsGreeks(stockPrice, input.strike, T, input.iv, input.isCall).price;
  return isFinite(p) && p > 0 ? p : null;
}

/** Breakeven del contrato: precio de la acción en el que la opción vale 0. */
export function breakevenPrice(strike: number, premium: number, isCall: boolean): number {
  return isCall ? strike + premium : strike - premium;
}

/**
 * Evalúa la calidad del trade.
 *
 * La base es el score compuesto (la misma métrica que ordena la focus list:
 * acción 60% + opción 40%). Ese score YA incorpora IV vs RV, earnings, muros
 * de open interest, tradeability (target alcanzable), liquidez, DTE y el estado
 * del setup, así que no se vuelven a penalizar aquí — hacerlo sería doble
 * conteo. Solo se aplican los ajustes extra que el caller pase explícitamente.
 *
 * El score es una métrica de ranking, no una probabilidad calibrada: el factor
 * es lineal y se usa para "subcribir" el R/R según la calidad del trade.
 */
export function assessTradeQuality(input: TradeQualityInput): QualityAssessment {
  const reasons: string[] = [];
  let factor = clamp(input.score, 0, 100) / 100;
  reasons.push(
    `Score del trade ${Math.round(input.score)}/100 → factor ${factor.toFixed(2)} (score compuesto: acción 60% + opción 40%)`
  );

  for (const adj of input.adjustments ?? []) {
    factor *= clamp(adj.factor, 0, 10);
    reasons.push(`${adj.label} → ×${adj.factor.toFixed(2)}`);
  }

  factor = clamp(factor, 0, 1);
  const label: QualityAssessment['label'] = factor >= 0.7 ? 'alta' : factor >= 0.45 ? 'media' : 'baja';
  return { factor, label, reasons };
}

/**
 * Movimiento esperado de la acción en el horizonte del trade (en %):
 * ADR diario × √(días a vencimiento). Es la vara de medir si el target (y el
 * breakeven del contrato) son alcanzables en el plazo.
 */
export function expectedMovePct(adrPct: number, dte: number): number | null {
  if (!isFinite(adrPct) || adrPct <= 0) return null;
  if (!isFinite(dte) || dte <= 0) return null;
  return adrPct * Math.sqrt(dte);
}

/**
 * Riesgo y beneficio en prima de un trade de opciones.
 */
export function computePremiumRiskBenefit(
  input: PremiumRiskInput,
  qualityInput: TradeQualityInput,
  context: { adrPct?: number | null } = {}
): PremiumRiskBenefit {
  const { entry, stop, target, premium } = input;
  const notes: string[] = [];

  const entryPremium = Math.max(0, premium);
  const stopPremium = priceOptionAt(input, stop, entry);
  const targetPremium = priceOptionAt(input, target, entry);

  const riskPerShare = entryPremium - stopPremium;
  const rewardPerShare = targetPremium - entryPremium;

  const riskPerContract = riskPerShare * 100;
  const rewardPerContract = rewardPerShare * 100;

  const riskPct = entryPremium > 0 ? (riskPerShare / entryPremium) * 100 : 0;
  const rewardPct = entryPremium > 0 ? (rewardPerShare / entryPremium) * 100 : 0;

  const quality = assessTradeQuality(qualityInput);
  const rewardExpectedPerContract = rewardPerContract * quality.factor;

  const riskFree = riskPerShare <= 0.0001;
  const targetDoesNotPay = rewardPerShare <= 0;
  const breakeven = breakevenPrice(input.strike, entryPremium, input.isCall);
  const targetClearsBreakeven = input.isCall ? target > breakeven : target < breakeven;

  const breakevenMovePct = input.entry > 0
    ? ((breakeven - input.entry) / input.entry) * 100 * (input.isCall ? 1 : -1)
    : null;
  const expMove = expectedMovePct(context.adrPct ?? NaN, input.dte);
  const breakevenWithinExpectedMove =
    breakevenMovePct != null && expMove != null
      ? Math.abs(breakevenMovePct) <= expMove
      : null;

  const rrBase = riskPerShare > 0.0001 ? rewardPerShare / riskPerShare : null;
  const rrQuality = riskPerShare > 0.0001 ? (rewardPerShare * quality.factor) / riskPerShare : null;

  if (riskFree) {
    notes.push('El stop no reduce la prima: no hay pérdida definida en ese escenario.');
  }
  if (targetDoesNotPay) {
    notes.push('Al target la opción vale menos que lo pagado: el objetivo no paga la prima.');
  } else if (!targetClearsBreakeven) {
    notes.push(
      `El target no supera el breakeven al vencimiento ($${breakeven.toFixed(2)}): necesitas más recorrido del que el setup ofrece.`
    );
  }
  if (breakevenWithinExpectedMove === false && breakevenMovePct != null && expMove != null) {
    notes.push(
      `El breakeven exige ${Math.abs(breakevenMovePct).toFixed(1)}% de movimiento y el esperado en ${input.dte} días es ~${expMove.toFixed(1)}%: está fuera del rango habitual.`
    );
  }
  if (!targetDoesNotPay && rrBase != null && rrBase < 1) {
    notes.push('R/R en prima menor de 1: el objetivo no devuelve más de lo que arriesgas.');
  }
  if (quality.label === 'baja') {
    notes.push('Calidad baja: reduce el tamaño de posición aunque el R/R en prima sea bueno.');
  }

  return {
    entryPremium,
    stopPremium,
    targetPremium,
    riskPerShare,
    rewardPerShare,
    riskPerContract,
    rewardPerContract,
    rewardExpectedPerContract,
    riskPct,
    rewardPct,
    rrBase,
    rrQuality,
    quality,
    riskFree,
    targetDoesNotPay,
    breakeven,
    targetClearsBreakeven,
    breakevenMovePct,
    expectedMovePct: expMove,
    breakevenWithinExpectedMove,
    notes,
  };
}

/**
 * Número de contratos que caben en un presupuesto de riesgo, usando el riesgo
 * real por contrato (prima entrada − prima del stop). 0 si el riesgo es 0 o el
 * presupuesto no alcanza un contrato.
 */
export function contractsForRisk(riskPerContract: number, riskBudget: number): number {
  if (!isFinite(riskPerContract) || riskPerContract <= 0) return 0;
  if (!isFinite(riskBudget) || riskBudget <= 0) return 0;
  return Math.max(0, Math.floor(riskBudget / riskPerContract));
}
