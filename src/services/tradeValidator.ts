export interface TradeInput {
  ticker: string;
  currentPrice: number;
  targetPrice: number;
  adr: number;
  impliedVolatility?: number;
  expirationDays: number;
  setupType: 'breakout' | 'rechazo' | 'lateral';
}

export interface TradeStructureLeg {
  type: 'buy' | 'sell';
  strike: number;
  optionType: 'call' | 'put';
  premium?: number;
}

export interface TradeStructure {
  type: string;
  legs: TradeStructureLeg[];
  description: string;
}

export interface TradeValidationMessage {
  timeValidation: string;
  timeOk: boolean;
  volatilityValidation?: string;
  volatilityOk?: boolean;
  expirationValidation: string;
  expirationOk: boolean;
  overall: string;
}

export interface TradeResult {
  tradeValid: boolean;
  score: number;
  strategy: string;
  estimatedDays: number;
  expectedMove?: number;
  distance: number;
  structure: TradeStructure;
  messages: TradeValidationMessage;
}

export function evaluateTrade(data: TradeInput): TradeResult {
  const { ticker, currentPrice, targetPrice, adr, impliedVolatility, expirationDays, setupType } = data;
  
  const distance = Math.abs(targetPrice - currentPrice);
  const estimatedDays = adr > 0 ? distance / adr : 0;
  let expectedMove: number | undefined;
  
  if (impliedVolatility !== undefined && impliedVolatility > 0) {
    expectedMove = currentPrice * impliedVolatility * Math.sqrt(expirationDays / 365);
  }
  
  let expectedDays = 30;
  if (setupType === 'breakout') {
    expectedDays = 10;
  } else if (setupType === 'rechazo') {
    expectedDays = 10;
  }
  
  let score = 0;
  
  if (estimatedDays <= expirationDays) {
    score += 1;
  }
  
  if (expectedMove !== undefined && expectedMove >= distance) {
    score += 1;
  }
  
  if (expirationDays >= expectedDays) {
    score += 1;
  }
  
  const tradeValid = score >= 2;
  
  let strategy = '';
  let structure: TradeStructure;
  
  if (setupType === 'breakout') {
    strategy = 'Bull Call Spread';
    structure = {
      type: 'Bull Call Spread',
      legs: [
        { type: 'buy', strike: currentPrice, optionType: 'call' },
        { type: 'sell', strike: targetPrice, optionType: 'call' }
      ],
      description: `Buy ${ticker} ${currentPrice} Call / Sell ${ticker} ${targetPrice} Call`
    };
  } else if (setupType === 'rechazo') {
    strategy = 'Bear Put Spread';
    structure = {
      type: 'Bear Put Spread',
      legs: [
        { type: 'buy', strike: currentPrice, optionType: 'put' },
        { type: 'sell', strike: targetPrice, optionType: 'put' }
      ],
      description: `Buy ${ticker} ${currentPrice} Put / Sell ${ticker} ${targetPrice} Put`
    };
  } else {
    strategy = 'Put Credit Spread';
    const buyPutStrike = targetPrice - (adr * 2);
    structure = {
      type: 'Put Credit Spread',
      legs: [
        { type: 'sell', strike: targetPrice, optionType: 'put' },
        { type: 'buy', strike: buyPutStrike, optionType: 'put' }
      ],
      description: `Sell ${ticker} ${targetPrice} Put / Buy ${ticker} ${buyPutStrike.toFixed(2)} Put`
    };
  }
  
  const timeOk = estimatedDays <= expirationDays;
  const volatilityOk = expectedMove !== undefined && expectedMove >= distance;
  const expirationOk = expirationDays >= expectedDays;
  
  const messages: TradeValidationMessage = {
    timeValidation: timeOk 
      ? `Movimiento de ${distance.toFixed(2)} (${estimatedDays.toFixed(1)} días estimados) cabe dentro de ${expirationDays} días`
      : `⚠️ El movimiento de ${distance.toFixed(2)} requiere ~${estimatedDays.toFixed(1)} días, pero solo tienes ${expirationDays} días`,
    timeOk,
    volatilityValidation: expectedMove !== undefined
      ? volatilityOk
        ? `Movimiento esperado (${expectedMove.toFixed(2)}) cubre la distancia`
        : `⚠️ Movimiento esperado (${expectedMove.toFixed(2)}) no cubre la distancia (${distance.toFixed(2)})`
      : undefined,
    volatilityOk: volatilityOk || undefined,
    expirationValidation: expirationOk
      ? `Expiración de ${expirationDays} días es adecuada para setup ${setupType}`
      : `⚠️ Setup ${setupType} requiere mínimo ${expectedDays} días`,
    expirationOk,
    overall: tradeValid
      ? '✅ Trade válido - Estructura recomendada'
      : '❌ Trade no recomendado - Ajusta parámetros'
  };
  
  return {
    tradeValid,
    score,
    strategy,
    estimatedDays,
    expectedMove,
    distance,
    structure,
    messages
  };
}
