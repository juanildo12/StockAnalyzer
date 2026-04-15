import YahooFinance from 'yahoo-finance2';
import type {
  OptionsAnalysis,
  OptionStrategy,
  OptionExpiration,
  OptionContract,
  TechnicalAnalysis,
} from '../types';

const yf = new YahooFinance();

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function blackScholesPrice(
  spotPrice: number,
  strikePrice: number,
  daysToExpiry: number,
  volatility: number,
  isCall: boolean,
  riskFreeRate: number = 0.05
): number {
  if (daysToExpiry <= 0) return 0;
  
  const T = daysToExpiry / 365;
  const r = riskFreeRate;
  const sigma = volatility;
  
  const d1 = (Math.log(spotPrice / strikePrice) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  if (isCall) {
    return spotPrice * normalCDF(d1) - strikePrice * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return strikePrice * Math.exp(-r * T) * normalCDF(-d2) - spotPrice * normalCDF(-d1);
  }
}

function estimateOptionPrice(
  currentPrice: number,
  strike: number,
  daysToExpiration: number,
  iv: number,
  type: 'call' | 'put'
): number {
  if (daysToExpiration <= 0 || currentPrice <= 0 || strike <= 0) return 0;
  
  const price = blackScholesPrice(currentPrice, strike, daysToExpiration, iv, type === 'call');
  
  const intrinsicValue = type === 'call' 
    ? Math.max(0, currentPrice - strike)
    : Math.max(0, strike - currentPrice);
  
  const minPrice = type === 'call' ? Math.max(0.01, (currentPrice - strike) * 0.1) : 0.01;
  
  return Math.max(minPrice, price, intrinsicValue * 0.5);
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateIVRank(currentIV: number, high52Week: number, low52Week: number): number {
  if (high52Week === low52Week) return 50;
  const rank = ((currentIV - low52Week) / (high52Week - low52Week)) * 100;
  return Math.max(0, Math.min(100, rank));
}

function determineTrend(sma50: number, sma200: number, rsi: number): 'alcista' | 'bajista' | 'lateral' {
  if (sma50 > sma200 * 1.02 && rsi > 45) return 'alcista';
  if (sma50 < sma200 * 0.98 && rsi < 55) return 'bajista';
  return 'lateral';
}

const OPTION_STRATEGIES: OptionStrategy[] = [
  {
    name: 'Covered Call',
    description: 'Vender una call sobre acciones que ya posees. Genera ingresos adicionales.',
    idealCondition: 'Acción en tendencia lateral o ligeramente alcista, IV moderadamente baja.',
    riskLevel: 'bajo',
    maxProfit: 'ilimitado',
    maxLoss: 'ilimitado',
    breakeven: [0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Cash-Secured Put',
    description: 'Vender una put con suficiente efectivo para comprar las acciones si es asignado.',
    idealCondition: 'Quieres comprar la acción a un precio menor, IV alta.',
    riskLevel: 'medio',
    maxProfit: 'ilimitado',
    maxLoss: 'ilimitado',
    breakeven: [0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Bull Put Spread',
    description: 'Vender una put ITM y comprar una put OTM para limitar el riesgo.',
    idealCondition: 'Perspectiva alcista moderada, IV alta, busca ingresos con riesgo limitado.',
    riskLevel: 'bajo',
    maxProfit: 0,
    maxLoss: 0,
    breakeven: [0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Bull Call Spread',
    description: 'Comprar una call y vender otra call a un strike mayor. Estrategia alcista barata.',
    idealCondition: 'Perspectiva alcista moderada, IV baja, capital limitado.',
    riskLevel: 'medio',
    maxProfit: 0,
    maxLoss: 0,
    breakeven: [0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Protective Put',
    description: 'Comprar una put para proteger tus acciones de una caída.',
    idealCondition: 'Posees acciones y temes una caída a corto plazo, IV baja.',
    riskLevel: 'bajo',
    maxProfit: 'ilimitado',
    maxLoss: 'ilimitado',
    breakeven: [0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Long Straddle',
    description: 'Comprar una call y una put al mismo strike. Ganancia si hay movimiento grande.',
    idealCondition: 'Esperas volatilidad alta (earnings, eventos), IV muy baja.',
    riskLevel: 'alto',
    maxProfit: 'ilimitado',
    maxLoss: 0,
    breakeven: [0, 0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Long Strangle',
    description: 'Comprar call OTM y put OTM. Más barato que straddle, necesita más movimiento.',
    idealCondition: 'Similar a straddle pero con menor costo, IV baja.',
    riskLevel: 'alto',
    maxProfit: 'ilimitado',
    maxLoss: 0,
    breakeven: [0, 0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
  {
    name: 'Iron Condor',
    description: 'Combina bull put spread y bear call spread. Neutral con rango definido.',
    idealCondition: 'Mercado lateral, IV alta, busca ingresos con rango definido.',
    riskLevel: 'medio',
    maxProfit: 0,
    maxLoss: 0,
    breakeven: [0, 0],
    example: {
      strike: 0,
      premium: 0,
      contracts: 1,
      totalCost: 0,
    },
  },
];

function selectBestStrategies(
  trend: 'alcista' | 'bajista' | 'lateral',
  ivRank: number,
  currentIV: number,
  rsi: number,
  currentPrice: number,
  optionContracts?: { calls: OptionContract[]; puts: OptionContract[] }
): { strategy: OptionStrategy; rationale: string; suitabilityScore: number }[] {
  const results: { strategy: OptionStrategy; rationale: string; suitabilityScore: number }[] = [];

  for (const strategy of OPTION_STRATEGIES) {
    let score = 50;
    let rationale = '';
    let example = calculateStrategyExample(strategy.name, currentPrice, optionContracts, currentIV);

    switch (strategy.name) {
      case 'Covered Call':
        if (trend === 'lateral' || trend === 'alcista') {
          score += 30;
          rationale = 'Tendencia favorable para generar ingresos con primas.';
        } else {
          score -= 20;
          rationale = 'Tendencia bajista reduce el potencial.';
        }
        if (ivRank > 30) {
          score += 20;
          rationale += ' IV alta = primas mejores.';
        }
        break;

      case 'Cash-Secured Put':
        if (trend === 'bajista' || trend === 'lateral') {
          score += 25;
          rationale = 'Buena oportunidad para vender puts a buenos precios.';
        }
        if (ivRank > 40) {
          score += 25;
          rationale += ' IV alta hace las primas atractivas.';
        }
        if (rsi < 40) {
          score += 15;
          rationale += ' RSI sugiere sobreventa, potencial recuperación.';
        }
        break;

      case 'Bull Put Spread':
        if (trend === 'alcista' || trend === 'lateral') {
          score += 30;
          rationale = 'Estrategia ideal para mercados alcistas con IV alta.';
        }
        if (ivRank > 35) {
          score += 25;
          rationale += ' Buenas primas por IV elevada.';
        }
        score += 10;
        rationale += ' Riesgo limitado = buena relación riesgo/beneficio.';
        break;

      case 'Bull Call Spread':
        if (trend === 'alcista') {
          score += 35;
          rationale = 'Tendencia alcista perfecta para esta estrategia.';
        } else if (trend === 'lateral') {
          score += 15;
          rationale = 'Funciona si hay cualquier movimiento al alza.';
        }
        if (ivRank < 30) {
          score += 20;
          rationale += ' IV baja = primas más baratas.';
        } else if (ivRank > 50) {
          score -= 15;
          rationale += ' IV alta encarece la estrategia.';
        }
        break;

      case 'Protective Put':
        if (trend === 'bajista') {
          score += 35;
          rationale = 'Necesitas protección contra caída.';
        }
        if (ivRank < 25) {
          score += 20;
          rationale += ' IV baja = puts más baratos.';
        } else {
          score -= 15;
          rationale += ' IV alta hace la protección cara.';
        }
        break;

      case 'Long Straddle':
        if (ivRank < 20) {
          score += 40;
          rationale = ' IV muy baja = straddle barato. Excelente para eventos.';
        } else {
          score -= 30;
          rationale = ' IV alta = straddle muy caro.';
        }
        if (rsi < 35 || rsi > 65) {
          score += 15;
          rationale += ' Lectura extrema sugiere movimiento.';
        }
        break;

      case 'Long Strangle':
        if (ivRank < 25) {
          score += 35;
          rationale = ' IV baja hace el strangle accesible.';
        }
        score += 5;
        rationale += ' Alternativa más barata al straddle.';
        break;

      case 'Iron Condor':
        if (trend === 'lateral') {
          score += 35;
          rationale = ' Mercado lateral = ambiente perfecto para iron condor.';
        }
        if (ivRank > 40) {
          score += 25;
          rationale += ' IV alta = mejores primas.';
        }
        score += 10;
        rationale += ' Estrategia de ingresos con riesgo definido.';
        break;
    }

    results.push({
      strategy: { ...strategy, example },
      rationale,
      suitabilityScore: Math.max(0, Math.min(100, score)),
    });
  }

  return results
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
    .slice(0, 4)
    .map((r, idx) => ({
      ...r,
      suitabilityScore: Math.max(20, r.suitabilityScore - idx * 10),
    }));
}

function calculateStrategyExample(
  strategyName: string,
  currentPrice: number,
  optionContracts?: { calls: OptionContract[]; puts: OptionContract[]; expiration?: string; daysToExpiration?: number },
  currentIV: number = 0.30
): OptionStrategy['example'] {
  const contracts = 1;
  const expiration = optionContracts?.expiration || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const daysToExpiration = optionContracts?.daysToExpiration || 30;
  const iv = currentIV > 0 ? currentIV : 0.30;
  
  if (!optionContracts || (!optionContracts.calls.length && !optionContracts.puts.length)) {
    const strikeWidth = currentPrice * 0.08;
    const strikeForCalc = Math.round(currentPrice * 1.05);
    const estimatedPremium = estimateOptionPrice(currentPrice, strikeForCalc, daysToExpiration, iv, 'call');
    const capital = currentPrice * 100;
    
    switch (strategyName) {
      case 'Covered Call':
        const ccCost = estimatedPremium * 100;
        const ccProfit = estimatedPremium * 100 + (currentPrice * 100 - Math.round(currentPrice * 1.05) * 100);
        return {
          strike: Math.round(currentPrice * 1.05),
          premium: estimatedPremium,
          contracts,
          totalCost: ccCost,
          costPercent: (ccCost / capital * 100).toFixed(1),
          maxProfit: ccProfit,
          maxProfitPercent: (ccProfit / capital * 100).toFixed(1),
          maxLoss: 'ilimitado',
          maxLossPercent: '∞',
          delta: 0.30,
          expiration,
          daysToExpiration,
          type: 'call',
          takeProfit: { price: currentPrice * 1.10, percent: 10, tpPercent: 50, description: 'Cierra al 50%' },
          stopLoss: { price: currentPrice * 0.92, percent: -8, slPercent: 50, description: 'Cierra si pierde 50%' },
        };
      case 'Cash-Secured Put':
        const putStrike = Math.round(currentPrice * 0.95);
        const putPremium = estimateOptionPrice(currentPrice, putStrike, daysToExpiration, iv, 'put');
        const cspCost = putPremium * 100;
        const cspProfit = putPremium * 100 + (putStrike * 100 - currentPrice * 100);
        return {
          strike: putStrike,
          premium: putPremium,
          contracts,
          totalCost: cspCost,
          costPercent: (cspCost / capital * 100).toFixed(1),
          maxProfit: cspProfit,
          maxProfitPercent: (cspProfit / capital * 100).toFixed(1),
          maxLoss: 'ilimitado',
          maxLossPercent: '∞',
          delta: -0.30,
          expiration,
          daysToExpiration,
          type: 'put',
          takeProfit: { price: currentPrice * 0.97, percent: 3, tpPercent: 50, description: 'Cierra al 50%' },
          stopLoss: { price: currentPrice * 0.85, percent: -15, slPercent: 50, description: 'Roll o cierra si pierde 50%' },
        };
      case 'Bull Call Spread':
        const lowerStrike = Math.round(currentPrice);
        const upperStrike = Math.round(currentPrice * 1.08);
        const callPremium = estimateOptionPrice(currentPrice, lowerStrike, daysToExpiration, iv, 'call');
        const shortCallPremium = estimateOptionPrice(currentPrice, upperStrike, daysToExpiration, iv, 'call');
        const spreadPremium = Math.abs(callPremium - shortCallPremium);
        const bcsCost = spreadPremium * 100;
        const bcsMaxProfit = strikeWidth * 100 - spreadPremium * 100;
        const bcsMaxLoss = spreadPremium * 100;
        return {
          strike: lowerStrike,
          strikeUpper: upperStrike,
          premium: spreadPremium,
          contracts,
          totalCost: bcsCost,
          costPercent: (bcsCost / capital * 100).toFixed(1),
          maxProfit: bcsMaxProfit,
          maxProfitPercent: (bcsMaxProfit / bcsCost * 100).toFixed(0),
          maxLoss: bcsMaxLoss,
          maxLossPercent: 100,
          delta: 0.40,
          deltaUpper: 0.15,
          expiration,
          daysToExpiration,
          type: 'spread',
          takeProfit: { price: upperStrike, percent: 8, tpPercent: 80, description: 'Cierra al 80%' },
          stopLoss: { price: currentPrice * 0.97, percent: -3, slPercent: 50, description: 'Cierra si pierde 50%' },
        };
      case 'Bull Put Spread':
        const bullPutStrike = Math.round(currentPrice * 0.95);
        const bullPutStrikeLower = Math.round(currentPrice * 0.85);
        const bullPutPremium = estimateOptionPrice(currentPrice, bullPutStrike, daysToExpiration, iv, 'put');
        const bullPutLowerPremium = estimateOptionPrice(currentPrice, bullPutStrikeLower, daysToExpiration, iv, 'put');
        const bullPutCredit = Math.abs(bullPutPremium - bullPutLowerPremium);
        const bpsCost = bullPutCredit * 100;
        const bpsMaxProfit = bullPutCredit * 100;
        const bpsMaxLoss = (bullPutStrike - bullPutStrikeLower) * 100 - bullPutCredit * 100;
        return {
          strike: bullPutStrike,
          strikeUpper: bullPutStrikeLower,
          premium: bullPutCredit,
          contracts,
          totalCost: bpsCost,
          costPercent: (bpsCost / capital * 100).toFixed(1),
          maxProfit: bpsMaxProfit,
          maxProfitPercent: (bpsMaxProfit / bpsCost * 100).toFixed(0),
          maxLoss: bpsMaxLoss,
          maxLossPercent: (bpsMaxLoss / capital * 100).toFixed(1),
          delta: -0.30,
          deltaUpper: -0.10,
          expiration,
          daysToExpiration,
          type: 'spread',
          takeProfit: { price: currentPrice * 0.98, percent: 2, tpPercent: 50, description: 'Cierra al 50%' },
          stopLoss: { price: currentPrice * 0.82, percent: -18, slPercent: 100, description: 'Pierde todo si asigna' },
        };
      case 'Protective Put':
        const protPutStrike = Math.round(currentPrice * 0.95);
        const protPutPremium = estimateOptionPrice(currentPrice, protPutStrike, daysToExpiration, iv, 'put');
        const ppCost = protPutPremium * 100;
        const ppMaxLoss = currentPrice * 0.05 * 100 + protPutPremium * 100;
        return {
          strike: protPutStrike,
          premium: protPutPremium,
          contracts,
          totalCost: ppCost,
          costPercent: (ppCost / capital * 100).toFixed(1),
          maxProfit: 'ilimitado',
          maxProfitPercent: '∞',
          maxLoss: ppMaxLoss,
          maxLossPercent: (ppMaxLoss / capital * 100).toFixed(1),
          delta: -0.40,
          expiration,
          daysToExpiration,
          type: 'put',
          takeProfit: { price: currentPrice * 1.15, percent: 15, tpPercent: 50, description: 'Vende put protector' },
          stopLoss: { price: currentPrice * 0.90, percent: -10, slPercent: 100, description: 'Ejercuta put si cae 10%' },
        };
      case 'Long Straddle':
        const straddleCall = estimateOptionPrice(currentPrice, Math.round(currentPrice), daysToExpiration, iv, 'call');
        const straddlePut = estimateOptionPrice(currentPrice, Math.round(currentPrice), daysToExpiration, iv, 'put');
        const straddleCostTotal = straddleCall + straddlePut;
        const sdCost = straddleCostTotal * 100;
        return {
          strike: Math.round(currentPrice),
          premium: straddleCostTotal,
          contracts,
          totalCost: sdCost,
          costPercent: (sdCost / capital * 100).toFixed(1),
          maxProfit: 'ilimitado',
          maxProfitPercent: '∞',
          maxLoss: sdCost,
          maxLossPercent: (sdCost / capital * 100).toFixed(1),
          delta: 0.30,
          expiration,
          daysToExpiration,
          type: 'call',
          takeProfit: { price: currentPrice * 1.15, percent: 15, tpPercent: 100, description: 'Si movimiento > 15%' },
          stopLoss: { price: currentPrice * 0.97, percent: -3, slPercent: 50, description: 'Corta al 50%' },
        };
      case 'Long Strangle':
        const stranglePut = estimateOptionPrice(currentPrice, Math.round(currentPrice * 0.95), daysToExpiration, iv, 'put');
        const strangleCall = estimateOptionPrice(currentPrice, Math.round(currentPrice * 1.05), daysToExpiration, iv, 'call');
        const strangleCostTotal = stranglePut + strangleCall;
        const sgCost = strangleCostTotal * 100;
        return {
          strike: Math.round(currentPrice * 0.95),
          strikeUpper: Math.round(currentPrice * 1.05),
          premium: strangleCostTotal,
          contracts,
          totalCost: sgCost,
          costPercent: (sgCost / capital * 100).toFixed(1),
          maxProfit: 'ilimitado',
          maxProfitPercent: '∞',
          maxLoss: sgCost,
          maxLossPercent: (sgCost / capital * 100).toFixed(1),
          delta: 0.20,
          deltaUpper: -0.20,
          expiration,
          daysToExpiration,
          type: 'spread',
          takeProfit: { price: currentPrice * 1.12, percent: 12, tpPercent: 100, description: 'Si movimiento > 12%' },
          stopLoss: { price: currentPrice * 0.98, percent: -2, slPercent: 50, description: 'Corta al 50%' },
        };
      case 'Iron Condor':
        const icPutSell = Math.round(currentPrice * 0.95);
        const icPutBuy = Math.round(currentPrice * 0.85);
        const icCallSell = Math.round(currentPrice * 1.05);
        const icCallBuy = Math.round(currentPrice * 1.15);
        const icPutSellPrem = estimateOptionPrice(currentPrice, icPutSell, daysToExpiration, iv, 'put');
        const icPutBuyPrem = estimateOptionPrice(currentPrice, icPutBuy, daysToExpiration, iv, 'put');
        const icCallSellPrem = estimateOptionPrice(currentPrice, icCallSell, daysToExpiration, iv, 'call');
        const icCallBuyPrem = estimateOptionPrice(currentPrice, icCallBuy, daysToExpiration, iv, 'call');
        const icCredit = (icPutSellPrem - icPutBuyPrem) + (icCallSellPrem - icCallBuyPrem);
        const icCost = Math.abs(icCredit) * 100;
        const icMaxLoss = (icPutSell - icPutBuy) * 100;
        return {
          strike: icPutSell,
          strikeUpper: icCallSell,
          premium: Math.abs(icCredit),
          contracts,
          totalCost: icCost,
          costPercent: (icCost / capital * 100).toFixed(1),
          maxProfit: icCost,
          maxProfitPercent: (icCost / icMaxLoss * 100).toFixed(0),
          maxLoss: icMaxLoss,
          maxLossPercent: (icMaxLoss / capital * 100).toFixed(1),
          delta: -0.20,
          deltaUpper: 0.20,
          expiration,
          daysToExpiration,
          type: 'spread',
          takeProfit: { price: currentPrice * 1.02, percent: 2, tpPercent: 50, description: 'Cierra al 50%' },
          stopLoss: { price: currentPrice * 0.85, percent: -15, slPercent: 100, description: 'Cierra si sale rango' },
        };
      default:
        const defCost = estimatedPremium * 100;
        return {
          strike: Math.round(currentPrice),
          premium: estimatedPremium,
          contracts,
          totalCost: defCost,
          costPercent: (defCost / capital * 100).toFixed(1),
          maxProfit: defCost,
          maxProfitPercent: 100,
          maxLoss: defCost,
          maxLossPercent: (defCost / capital * 100).toFixed(1),
          delta: 0.50,
          expiration,
          daysToExpiration,
          type: 'call',
          takeProfit: { price: currentPrice * 1.10, percent: 10, tpPercent: 50, description: 'Cierra al 50%' },
          stopLoss: { price: currentPrice * 0.95, percent: -5, slPercent: 50, description: 'Cierra si pierde 50%' },
        };
    }
  }

  const { calls, puts } = optionContracts;
  const atmStrike = Math.round(currentPrice);
  
  switch (strategyName) {
    case 'Covered Call': {
      const otmCall = calls.find(c => c.strike > currentPrice && c.strike <= currentPrice * 1.1) || calls[0];
      const premium = otmCall?.lastPrice || currentPrice * 0.03;
      const strike = otmCall?.strike || Math.round(currentPrice * 1.05);
      const ccCost = premium * 100;
      const ccProfit = premium * 100 + (currentPrice * 100 - strike * 100);
      return {
        strike,
        premium,
        contracts,
        totalCost: ccCost,
        costPercent: (ccCost / capital * 100).toFixed(1),
        maxProfit: ccProfit,
        maxProfitPercent: (ccProfit / capital * 100).toFixed(1),
        maxLoss: 'ilimitado',
        maxLossPercent: '∞',
        delta: otmCall?.delta || 0.30,
        expiration: otmCall?.expiration || expiration,
        daysToExpiration: otmCall?.expiration ? Math.max(1, Math.ceil((new Date(otmCall.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'call',
        takeProfit: { price: currentPrice * 1.10, percent: 10, tpPercent: 50, description: 'Cierra al 50%' },
        stopLoss: { price: currentPrice * 0.92, percent: -8, slPercent: 50, description: 'Cierra si cae 8%' },
      };
    }
    case 'Cash-Secured Put': {
      const itmPut = puts.find(p => p.strike < currentPrice && p.strike >= currentPrice * 0.9) || puts[0];
      const premium = itmPut?.lastPrice || currentPrice * 0.03;
      const strike = itmPut?.strike || Math.round(currentPrice * 0.95);
      const cspCost = premium * 100;
      const cspProfit = premium * 100 + (strike * 100 - currentPrice * 100);
      return {
        strike,
        premium,
        contracts,
        totalCost: cspCost,
        costPercent: (cspCost / capital * 100).toFixed(1),
        maxProfit: cspProfit,
        maxProfitPercent: (cspProfit / capital * 100).toFixed(1),
        maxLoss: 'ilimitado',
        maxLossPercent: '∞',
        delta: itmPut?.delta || -0.30,
        expiration: itmPut?.expiration || expiration,
        daysToExpiration: itmPut?.expiration ? Math.max(1, Math.ceil((new Date(itmPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'put',
        takeProfit: { price: currentPrice * 0.97, percent: 3, tpPercent: 50, description: 'Cierra al 50%' },
        stopLoss: { price: currentPrice * 0.85, percent: -15, slPercent: 50, description: 'Roll o cierra si cae 15%' },
      };
    }
    case 'Bull Call Spread': {
      const lowerCall = calls.find(c => c.strike <= currentPrice) || calls[0];
      const upperCall = calls.find(c => c.strike > currentPrice * 1.05) || calls[calls.length - 1];
      const netPremium = (lowerCall?.lastPrice || 0) - (upperCall?.lastPrice || 0);
      const strikeLower = lowerCall?.strike || atmStrike;
      const strikeUpper = upperCall?.strike || Math.round(currentPrice * 1.08);
      const cost = Math.abs(netPremium) * 100;
      const bcsCost = cost;
      const bcsMaxProfit = (strikeUpper - strikeLower) * 100 - cost;
      return {
        strike: strikeLower,
        strikeUpper,
        premium: Math.abs(netPremium) || currentPrice * 0.02,
        contracts,
        totalCost: cost,
        costPercent: (cost / capital * 100).toFixed(1),
        maxProfit: (strikeUpper - strikeLower) * 100 - cost,
        maxProfitPercent: (bcsMaxProfit / capital * 100).toFixed(1),
        maxLoss: cost,
        maxLossPercent: (cost / capital * 100).toFixed(1),
        delta: lowerCall?.delta || 0.50,
        deltaUpper: upperCall?.delta || 0.15,
        expiration: lowerCall?.expiration || expiration,
        daysToExpiration: lowerCall?.expiration ? Math.max(1, Math.ceil((new Date(lowerCall.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'spread',
        takeProfit: { price: strikeUpper, percent: 8, tpPercent: 80, description: 'Cierra al 80% de max profit' },
        stopLoss: { price: currentPrice * 0.97, percent: -3, slPercent: 50, description: 'Cierra si pierde 50% del costo' },
      };
    }
    case 'Bull Put Spread': {
      const soldPut = puts.find(p => p.strike >= currentPrice * 0.95 && p.strike <= currentPrice) || puts[0];
      const boughtPut = puts.find(p => p.strike < (soldPut?.strike || currentPrice) * 0.9) || puts[puts.length - 1];
      const netPremium = (soldPut?.lastPrice || 0) - (boughtPut?.lastPrice || 0);
      const strikeSold = soldPut?.strike || Math.round(currentPrice * 0.95);
      const strikeBought = boughtPut?.strike || Math.round(currentPrice * 0.85);
      const credit = Math.abs(netPremium) * 100;
      const bpsMaxLoss = (strikeSold - strikeBought) * 100 - credit;
      return {
        strike: strikeSold,
        strikeUpper: strikeBought,
        premium: Math.abs(netPremium) || currentPrice * 0.02,
        contracts,
        totalCost: credit,
        costPercent: (credit / capital * 100).toFixed(1),
        maxProfit: credit,
        maxProfitPercent: (credit / capital * 100).toFixed(1),
        maxLoss: bpsMaxLoss,
        maxLossPercent: (bpsMaxLoss / capital * 100).toFixed(1),
        delta: soldPut?.delta || -0.30,
        deltaUpper: boughtPut?.delta || -0.10,
        expiration: soldPut?.expiration || expiration,
        daysToExpiration: soldPut?.expiration ? Math.max(1, Math.ceil((new Date(soldPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'spread',
        takeProfit: { price: currentPrice * 0.98, percent: 2, tpPercent: 50, description: 'Cierra al 50% de profit' },
        stopLoss: { price: currentPrice * 0.82, percent: -18, slPercent: 100, description: 'Cierra si pierde 2x la prima' },
      };
    }
    case 'Protective Put': {
      const otmPut = puts.find(p => p.strike < currentPrice && p.strike >= currentPrice * 0.9) || puts[0];
      const premium = otmPut?.lastPrice || currentPrice * 0.02;
      const strike = otmPut?.strike || Math.round(currentPrice * 0.95);
      const distanceDown = currentPrice - strike;
      const ppCost = premium * 100;
      const ppMaxLoss = distanceDown * 100 + premium * 100;
      return {
        strike,
        premium,
        contracts,
        totalCost: ppCost,
        costPercent: (ppCost / capital * 100).toFixed(1),
        maxProfit: 'ilimitado',
        maxProfitPercent: '∞',
        maxLoss: ppMaxLoss,
        maxLossPercent: (ppMaxLoss / capital * 100).toFixed(1),
        delta: otmPut?.delta || -0.40,
        expiration: otmPut?.expiration || expiration,
        daysToExpiration: otmPut?.expiration ? Math.max(1, Math.ceil((new Date(otmPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'put',
        takeProfit: { price: currentPrice * 1.15, percent: 15, tpPercent: 50, description: 'Vende put protector si sube 15%' },
        stopLoss: { price: currentPrice * 0.90, percent: -10, slPercent: 50, description: 'Ejercuta put si cae 10%' },
      };
    }
    case 'Long Straddle': {
      const atmCall = calls.find(c => Math.abs(c.strike - currentPrice) < currentPrice * 0.05) || calls[0];
      const atmPut = puts.find(p => Math.abs(p.strike - currentPrice) < currentPrice * 0.05) || puts[0];
      const totalPremium = (atmCall?.lastPrice || 0) + (atmPut?.lastPrice || 0);
      const days = atmCall?.expiration ? Math.max(1, Math.ceil((new Date(atmCall.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration;
      const cost = totalPremium * 100;
      return {
        strike: atmCall?.strike || atmStrike,
        premium: totalPremium || currentPrice * 0.05,
        contracts,
        totalCost: cost,
        costPercent: (cost / capital * 100).toFixed(1),
        maxProfit: 'ilimitado',
        maxProfitPercent: '∞',
        maxLoss: cost,
        maxLossPercent: (cost / capital * 100).toFixed(1),
        delta: atmCall?.delta || 0.50,
        expiration: atmCall?.expiration || expiration,
        daysToExpiration: days,
        type: 'call',
        takeProfit: { price: currentPrice * 1.15, percent: 15, tpPercent: 50, description: 'Cierra si movimiento > 15%' },
        stopLoss: { price: currentPrice * 0.97, percent: -3, slPercent: 100, description: 'Corta si expira sin movimiento' },
      };
    }
    case 'Long Strangle': {
      const otmCall = calls.find(c => c.strike > currentPrice * 1.05) || calls[calls.length - 1];
      const otmPut = puts.find(p => p.strike < currentPrice * 0.95) || puts[0];
      const totalPremium = (otmCall?.lastPrice || 0) + (otmPut?.lastPrice || 0);
      const days = otmCall?.expiration ? Math.max(1, Math.ceil((new Date(otmCall.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration;
      const cost = totalPremium * 100;
      return {
        strike: otmPut?.strike || Math.round(currentPrice * 0.95),
        strikeUpper: otmCall?.strike || Math.round(currentPrice * 1.05),
        premium: totalPremium || currentPrice * 0.03,
        contracts,
        totalCost: cost,
        costPercent: (cost / capital * 100).toFixed(1),
        maxProfit: 'ilimitado',
        maxProfitPercent: '∞',
        maxLoss: cost,
        maxLossPercent: (cost / capital * 100).toFixed(1),
        delta: otmPut?.delta || -0.20,
        deltaUpper: otmCall?.delta || 0.20,
        expiration: otmCall?.expiration || expiration,
        daysToExpiration: days,
        type: 'spread',
        takeProfit: { price: currentPrice * 1.12, percent: 12, tpPercent: 50, description: 'Cierra si movimiento > 12%' },
        stopLoss: { price: currentPrice * 0.98, percent: -2, slPercent: 100, description: 'Corta si expira sin movimiento' },
      };
    }
    case 'Iron Condor': {
      const soldPut = puts.find(p => p.strike >= currentPrice * 0.9 && p.strike <= currentPrice) || puts[0];
      const boughtPut = puts.find(p => p.strike < (soldPut?.strike || currentPrice) * 0.85) || puts[puts.length - 1];
      const soldCall = calls.find(c => c.strike >= currentPrice && c.strike < currentPrice * 1.1) || calls[0];
      const boughtCall = calls.find(c => c.strike > (soldCall?.strike || currentPrice) * 1.1) || calls[calls.length - 1];
      const netCredit = ((soldPut?.lastPrice || 0) - (boughtPut?.lastPrice || 0)) + 
                        ((soldCall?.lastPrice || 0) - (boughtCall?.lastPrice || 0));
      const credit = Math.abs(netCredit) * 100;
      const putSpreadWidth = ((soldPut?.strike || currentPrice * 0.95) - (boughtPut?.strike || currentPrice * 0.85)) * 100;
      const callSpreadWidth = ((boughtCall?.strike || currentPrice * 1.15) - (soldCall?.strike || currentPrice * 1.05)) * 100;
      const maxRisk = Math.max(putSpreadWidth, callSpreadWidth) - credit;
      return {
        strike: soldPut?.strike || Math.round(currentPrice * 0.95),
        strikeUpper: soldCall?.strike || Math.round(currentPrice * 1.05),
        premium: Math.abs(netCredit) || currentPrice * 0.02,
        contracts,
        totalCost: credit,
        costPercent: (credit / capital * 100).toFixed(1),
        maxProfit: credit,
        maxProfitPercent: (credit / capital * 100).toFixed(1),
        maxLoss: maxRisk,
        maxLossPercent: (maxRisk / capital * 100).toFixed(1),
        delta: soldPut?.delta || -0.20,
        deltaUpper: soldCall?.delta || 0.20,
        expiration: soldPut?.expiration || expiration,
        daysToExpiration: soldPut?.expiration ? Math.max(1, Math.ceil((new Date(soldPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'spread',
        takeProfit: { price: currentPrice * 1.02, percent: 2, tpPercent: 50, description: 'Cierra al 50% de profit' },
        stopLoss: { price: currentPrice * 0.85, percent: -15, slPercent: 100, description: 'Cierra si sale del rango' },
      };
    }
    default: {
      const cost = currentPrice * 0.03 * 100;
      const defaultMaxProfit = cost * 2;
      return {
        strike: atmStrike,
        premium: currentPrice * 0.03,
        contracts,
        totalCost: cost,
        costPercent: (cost / capital * 100).toFixed(1),
        maxProfit: defaultMaxProfit,
        maxProfitPercent: (defaultMaxProfit / capital * 100).toFixed(1),
        maxLoss: cost,
        maxLossPercent: (cost / capital * 100).toFixed(1),
        delta: 0.50,
        expiration,
        daysToExpiration,
        type: 'call',
        takeProfit: { price: currentPrice * 1.10, percent: 10, tpPercent: 50, description: 'Cierra al 50% de profit' },
        stopLoss: { price: currentPrice * 0.95, percent: -5, slPercent: 50, description: 'Cierra si pierde 50% del costo' },
      };
    }
  }
}

export async function getOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
  const sym = symbol.toUpperCase();

  try {
    const [quote, historical, chainResult]: [any, any[], any] = await Promise.all([
      yf.quote(sym).catch(() => null),
      yf.historical(sym, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: '1d',
      }).catch(() => []),
      yf.options(sym).catch(() => null),
    ]);

    if (!quote || !quote.regularMarketPrice) {
      return null;
    }

    const currentPrice = quote.regularMarketPrice;
    const prices = historical.map((h: any) => h.close);

    const sma50 = prices.slice(-50).reduce((a: number, b: number) => a + b, 0) / Math.min(50, prices.length);
    const sma200 = prices.slice(-200).reduce((a: number, b: number) => a + b, 0) / Math.min(200, prices.length);
    const rsi = calculateRSI(prices);
    const trend = determineTrend(sma50, sma200, rsi);

    let impliedVolatility = 0.30;
    let ivRank = 50;
    let ivPercentile = 50;
    
    if (chainResult?.options && chainResult.options.length > 0) {
      const allExpirations = chainResult.options.flat();
      const allContracts = allExpirations.flatMap((exp: any) => [...(exp.calls || []), ...(exp.puts || [])]);
      
      if (allContracts.length > 0) {
        const ivs = allContracts
          .map((c: any) => c.impliedVolatility)
          .filter((iv: number) => iv && iv > 0);
        
        if (ivs.length > 0) {
          impliedVolatility = ivs.reduce((a: number, b: number) => a + b, 0) / ivs.length;
          const sortedIVs = [...ivs].sort((a: number, b: number) => a - b);
          const percentileIndex = sortedIVs.filter((iv: number) => iv <= impliedVolatility).length;
          ivPercentile = (percentileIndex / sortedIVs.length) * 100;
          
          const minIV = sortedIVs[0];
          const maxIV = sortedIVs[sortedIVs.length - 1];
          ivRank = calculateIVRank(impliedVolatility, maxIV, minIV);
        }
      }
    }

    const historicalAvgIV = impliedVolatility * 0.9;

    const support = Math.min(...prices.slice(-60));
    const resistance = Math.max(...prices.slice(-60));
    const pivot = (support + currentPrice + resistance) / 3;

    const nextExpirations: OptionExpiration[] = [];
    if (chainResult?.options) {
      for (const expDate of chainResult.options.slice(0, 3)) {
        if (!expDate || !expDate.date) continue;
        
        const expDateStr = typeof expDate.date === 'string' 
          ? expDate.date 
          : expDate.date.toISOString?.()?.split('T')[0] || '';
        
        const daysToExpiration = Math.max(
          1,
          Math.ceil((new Date(expDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );

        const processContracts = (contracts: any[]): OptionContract[] => {
          return contracts.slice(0, 10).map((c: any) => ({
            strike: c.strike,
            lastPrice: c.lastPrice || 0,
            bid: c.bid || 0,
            ask: c.ask || 0,
            volume: c.volume || 0,
            openInterest: c.openInterest || 0,
            impliedVolatility: c.impliedVolatility || 0,
            delta: c.greeks?.delta || calculateDelta(c.strike, currentPrice, daysToExpiration, impliedVolatility, true),
            gamma: c.greeks?.gamma || 0,
            theta: c.greeks?.theta || 0,
            vega: c.greeks?.vega || 0,
            inTheMoney: c.inTheMoney || false,
            expiration: expDateStr,
            type: 'call' as const,
          }));
        };

        nextExpirations.push({
          date: expDateStr,
          daysToExpiration,
          calls: processContracts(expDate.calls || []),
          puts: processContracts(expDate.puts || []),
        });
      }
    }

    const optionContracts = nextExpirations.length > 0 
      ? { 
          calls: nextExpirations[0].calls, 
          puts: nextExpirations[0].puts,
          expiration: nextExpirations[0].date,
          daysToExpiration: nextExpirations[0].daysToExpiration
        }
      : undefined;

    const recommendedStrategies = selectBestStrategies(
      trend,
      ivRank,
      impliedVolatility,
      rsi,
      currentPrice,
      optionContracts
    );

    let earningsDate: string | null = null;
    let dividendDate: string | null = null;
    let earningsEstimate: boolean = false;

    try {
      const cal: any = await yf.quoteSummary(sym, { modules: ['calendarEvents'] }).catch(() => null);
      const now = new Date();
      
      if (cal?.calendarEvents?.earnings?.earningsDate) {
        const earningsDates = cal.calendarEvents.earnings.earningsDate;
        const isEstimated = cal.calendarEvents?.earnings?.isEarningsDateEstimate || false;
        
        for (const rawDate of earningsDates) {
          const dateStr = typeof rawDate === 'string' ? rawDate : rawDate?.toISOString?.();
          if (dateStr) {
            const date = new Date(dateStr);
            if (date > now) {
              earningsDate = date.toISOString().split('T')[0];
              earningsEstimate = isEstimated;
              break;
            }
          }
        }
        
        if (!earningsDate && earningsDates[0]) {
          const dateStr = typeof earningsDates[0] === 'string' ? earningsDates[0] : earningsDates[0]?.toISOString?.();
          if (dateStr) {
            const date = new Date(dateStr);
            earningsDate = date.toISOString().split('T')[0];
            earningsEstimate = isEstimated;
          }
        }
      }
      
      if (cal?.calendarEvents?.dividendDate) {
        const divRaw = cal.calendarEvents.dividendDate;
        const divStr = typeof divRaw === 'string' ? divRaw : divRaw?.toISOString?.();
        if (divStr) {
          const divDate = new Date(divStr);
          if (divDate > now) {
            dividendDate = divDate.toISOString().split('T')[0];
          }
        }
      }
      
      if (cal?.calendarEvents?.exDividendDate) {
        const exDivRaw = cal.calendarEvents.exDividendDate;
        const exDivStr = typeof exDivRaw === 'string' ? exDivRaw : exDivRaw?.toISOString?.();
        if (exDivStr && !dividendDate) {
          const exDivDate = new Date(exDivStr);
          if (exDivDate > now) {
            dividendDate = exDivDate.toISOString().split('T')[0];
          }
        }
      }
    } catch (e) {
      console.error('Error fetching calendar events:', e);
    }

    return {
      symbol: sym,
      currentPrice,
      stockTrend: trend,
      impliedVolatility,
      ivRank,
      ivPercentile,
      earningsDate,
      earningsEstimate,
      earningsDaysUntil: earningsDate ? Math.ceil((new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
      dividendDate,
      recommendedStrategies,
      nextExpirations,
      keyLevels: {
        support,
        resistance,
        pivot,
      },
      ivComparison: {
        current: impliedVolatility,
        historicalAverage: historicalAvgIV,
        interpretation: impliedVolatility > historicalAvgIV * 1.1
          ? 'IV actualmente alta - primas caras, mejor para vender opciones'
          : impliedVolatility < historicalAvgIV * 0.9
          ? 'IV actualmente baja - primas baratas, mejor para comprar opciones'
          : 'IV cerca del promedio histórico',
      },
    };
  } catch (error) {
    console.error('Error in getOptionsAnalysis:', error);
    return null;
  }
}

function calculateDelta(
  strike: number,
  currentPrice: number,
  daysToExpiration: number,
  iv: number,
  isCall: boolean
): number {
  const timeToExpiry = daysToExpiration / 365;
  const moneyness = currentPrice / strike;
  
  if (timeToExpiry <= 0) return isCall ? (moneyness > 1 ? 1 : 0) : (moneyness < 1 ? -1 : 0);
  
  let delta: number;
  if (isCall) {
    delta = moneyness > 1.05 ? 0.7 + Math.random() * 0.25 : 
            moneyness < 0.95 ? 0.3 - Math.random() * 0.25 : 
            0.5;
  } else {
    delta = moneyness < 0.95 ? -0.7 - Math.random() * 0.25 : 
            moneyness > 1.05 ? -0.3 + Math.random() * 0.25 : 
            -0.5;
  }
  
  return Math.max(-1, Math.min(1, delta));
}

export function evaluateStockForOptions(
  symbol: string,
  quote: any,
  technical: TechnicalAnalysis | null,
  historical: any[],
  ivRank: number = 50
): {
  suitabilityScore: number;
  topStrategy: string;
  recommendation: 'excelente' | 'buena' | 'regular' | 'no_recomendada';
  reasons: string[];
} {
  let score = 50;
  const reasons: string[] = [];

  const price = quote?.regularMarketPrice || 0;
  const change = quote?.regularMarketChangePercent || 0;
  const volume = quote?.regularMarketVolume || 0;
  const avgVolume = quote?.averageTradingVolume || volume;
  const dividendYield = quote?.dividendYield || 0;

  if (volume > avgVolume * 1.5) {
    score += 10;
    reasons.push('Alto volumen de negociación');
  }

  if (price >= 5 && price <= 500) {
    score += 10;
    reasons.push('Precio en rango óptimo para opciones');
  } else if (price < 5) {
    score -= 15;
    reasons.push('Precio muy bajo - poco movimiento en opciones');
  }

  const trend = technical?.trend || 'lateral';
  const rsi = technical?.rsi || 50;
  const high52w = quote?.fiftyTwoWeekHigh || price * 1.2;
  const low52w = quote?.fiftyTwoWeekLow || price * 0.8;
  const nearHighs = price > high52w * 0.85;
  const nearLows = price < low52w * 1.15;

  if (trend === 'alcista') {
    score += 15;
    reasons.push('Tendencia alcista favorable');
  } else if (trend === 'bajista') {
    score += 5;
    reasons.push('Tendencia bajista - buena para estrategias de protección');
  }

  if (rsi < 35) {
    score += 10;
    reasons.push('RSI sobrevendido - potencial de recuperación');
  } else if (rsi > 70) {
    score += 5;
    reasons.push('RSI sobrecomprado - potencial de volatilidad');
  }

  if (dividendYield > 0.02) {
    score += 10;
    reasons.push('Buen dividend yield - Covered Calls atractivos');
  }

  if (ivRank > 50) {
    score += 15;
    reasons.push('IV alta - buenas primas para venta de opciones');
  } else if (ivRank < 30) {
    score += 5;
    reasons.push('IV baja - primas reducidas');
  }

  if (nearHighs) {
    score += 5;
    reasons.push('Near 52w High - momentum alcista');
  }

  if (nearLows) {
    score -= 5;
    reasons.push('Near 52w Low - cautela');
  }

  let topStrategy = 'Long Call';
  
  if (ivRank > 70) {
    topStrategy = 'Short Straddle';
  } else if (ivRank > 60) {
    topStrategy = 'Iron Condor';
  } else if (ivRank > 50 && dividendYield > 0.02) {
    topStrategy = 'Covered Call';
  } else if (ivRank > 50) {
    topStrategy = 'Bull Put Spread';
  } else if (dividendYield > 0.02) {
    topStrategy = 'Covered Call';
  } else if (trend === 'alcista') {
    topStrategy = 'Bull Call Spread';
  } else if (trend === 'bajista') {
    topStrategy = 'Cash-Secured Put';
  } else {
    topStrategy = 'Long Call';
  }

  let recommendation: 'excelente' | 'buena' | 'regular' | 'no_recomendada';
  if (score >= 75) recommendation = 'excelente';
  else if (score >= 55) recommendation = 'buena';
  else if (score >= 35) recommendation = 'regular';
  else recommendation = 'no_recomendada';

  return {
    suitabilityScore: Math.max(0, Math.min(100, score)),
    topStrategy,
    recommendation,
    reasons,
  };
}
