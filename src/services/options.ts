import YahooFinance from 'yahoo-finance2';
import type {
  OptionsAnalysis,
  OptionStrategy,
  OptionExpiration,
  OptionContract,
  TechnicalAnalysis,
} from '../types';

const yf = new YahooFinance();

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
    let example = calculateStrategyExample(strategy.name, currentPrice, optionContracts);

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
  optionContracts?: { calls: OptionContract[]; puts: OptionContract[]; expiration?: string; daysToExpiration?: number }
): OptionStrategy['example'] {
  const contracts = 1;
  const expiration = optionContracts?.expiration || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const daysToExpiration = optionContracts?.daysToExpiration || 30;
  
  if (!optionContracts || (!optionContracts.calls.length && !optionContracts.puts.length)) {
    const estimatedPremium = currentPrice * 0.03;
    const strikeWidth = currentPrice * 0.08;
    
    switch (strategyName) {
      case 'Covered Call':
        return {
          strike: Math.round(currentPrice * 1.05),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: estimatedPremium * 100 + (currentPrice * 100 - Math.round(currentPrice * 1.05) * 100),
          maxLoss: 'ilimitado',
          delta: 0.30,
          expiration,
          daysToExpiration,
          type: 'call',
        };
      case 'Cash-Secured Put':
        return {
          strike: Math.round(currentPrice * 0.95),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: estimatedPremium * 100 + (Math.round(currentPrice * 0.95) * 100 - currentPrice * 100),
          maxLoss: 'ilimitado',
          delta: -0.30,
          expiration,
          daysToExpiration,
          type: 'put',
        };
      case 'Bull Call Spread':
        return {
          strike: Math.round(currentPrice),
          strikeUpper: Math.round(currentPrice * 1.08),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: strikeWidth * 100 - estimatedPremium * 100,
          maxLoss: estimatedPremium * 100,
          delta: 0.40,
          deltaUpper: 0.15,
          expiration,
          daysToExpiration,
          type: 'spread',
        };
      case 'Bull Put Spread':
        return {
          strike: Math.round(currentPrice * 0.95),
          strikeUpper: Math.round(currentPrice * 0.85),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: estimatedPremium * 100,
          maxLoss: (currentPrice * 0.95 - currentPrice * 0.85) * 100 - estimatedPremium * 100,
          delta: -0.30,
          deltaUpper: -0.10,
          expiration,
          daysToExpiration,
          type: 'spread',
        };
      case 'Protective Put':
        return {
          strike: Math.round(currentPrice * 0.95),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: 'ilimitado',
          maxLoss: currentPrice * 0.05 * 100 + estimatedPremium * 100,
          delta: -0.40,
          expiration,
          daysToExpiration,
          type: 'put',
        };
      case 'Long Straddle':
        return {
          strike: Math.round(currentPrice),
          premium: estimatedPremium * 2,
          contracts,
          totalCost: estimatedPremium * 200,
          maxProfit: 'ilimitado',
          maxLoss: estimatedPremium * 200,
          delta: 0.30,
          expiration,
          daysToExpiration,
          type: 'call',
        };
      case 'Long Strangle':
        return {
          strike: Math.round(currentPrice * 0.95),
          strikeUpper: Math.round(currentPrice * 1.05),
          premium: estimatedPremium * 1.5,
          contracts,
          totalCost: estimatedPremium * 150,
          maxProfit: 'ilimitado',
          maxLoss: estimatedPremium * 150,
          delta: 0.20,
          deltaUpper: -0.20,
          expiration,
          daysToExpiration,
          type: 'spread',
        };
      case 'Iron Condor':
        return {
          strike: Math.round(currentPrice * 0.90),
          strikeUpper: Math.round(currentPrice * 1.10),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: estimatedPremium * 100,
          maxLoss: (currentPrice * 0.95 - currentPrice * 0.85) * 100,
          delta: -0.20,
          deltaUpper: 0.20,
          expiration,
          daysToExpiration,
          type: 'spread',
        };
      default:
        return {
          strike: Math.round(currentPrice),
          premium: estimatedPremium,
          contracts,
          totalCost: estimatedPremium * 100,
          maxProfit: estimatedPremium * 100,
          maxLoss: estimatedPremium * 100,
          delta: 0.50,
          expiration,
          daysToExpiration,
          type: 'call',
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
      return {
        strike,
        premium,
        contracts,
        totalCost: premium * 100,
        maxProfit: premium * 100 + (currentPrice * 100 - strike * 100),
        maxLoss: 'ilimitado',
        delta: otmCall?.delta || 0.30,
        expiration: otmCall?.expiration || expiration,
        daysToExpiration: otmCall?.expiration ? Math.max(1, Math.ceil((new Date(otmCall.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'call',
      };
    }
    case 'Cash-Secured Put': {
      const itmPut = puts.find(p => p.strike < currentPrice && p.strike >= currentPrice * 0.9) || puts[0];
      const premium = itmPut?.lastPrice || currentPrice * 0.03;
      const strike = itmPut?.strike || Math.round(currentPrice * 0.95);
      return {
        strike,
        premium,
        contracts,
        totalCost: premium * 100,
        maxProfit: premium * 100 + (strike * 100 - currentPrice * 100),
        maxLoss: 'ilimitado',
        delta: itmPut?.delta || -0.30,
        expiration: itmPut?.expiration || expiration,
        daysToExpiration: itmPut?.expiration ? Math.max(1, Math.ceil((new Date(itmPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'put',
      };
    }
    case 'Bull Call Spread': {
      const lowerCall = calls.find(c => c.strike <= currentPrice) || calls[0];
      const upperCall = calls.find(c => c.strike > currentPrice * 1.05) || calls[calls.length - 1];
      const netPremium = (lowerCall?.lastPrice || 0) - (upperCall?.lastPrice || 0);
      const strikeLower = lowerCall?.strike || atmStrike;
      const strikeUpper = upperCall?.strike || Math.round(currentPrice * 1.08);
      const cost = Math.abs(netPremium) * 100;
      return {
        strike: strikeLower,
        strikeUpper,
        premium: Math.abs(netPremium) || currentPrice * 0.02,
        contracts,
        totalCost: cost,
        maxProfit: (strikeUpper - strikeLower) * 100 - cost,
        maxLoss: cost,
        delta: lowerCall?.delta || 0.50,
        deltaUpper: upperCall?.delta || 0.15,
        expiration: lowerCall?.expiration || expiration,
        daysToExpiration: lowerCall?.expiration ? Math.max(1, Math.ceil((new Date(lowerCall.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'spread',
      };
    }
    case 'Bull Put Spread': {
      const soldPut = puts.find(p => p.strike >= currentPrice * 0.95 && p.strike <= currentPrice) || puts[0];
      const boughtPut = puts.find(p => p.strike < (soldPut?.strike || currentPrice) * 0.9) || puts[puts.length - 1];
      const netPremium = (soldPut?.lastPrice || 0) - (boughtPut?.lastPrice || 0);
      const strikeSold = soldPut?.strike || Math.round(currentPrice * 0.95);
      const strikeBought = boughtPut?.strike || Math.round(currentPrice * 0.85);
      const credit = Math.abs(netPremium) * 100;
      return {
        strike: strikeSold,
        strikeUpper: strikeBought,
        premium: Math.abs(netPremium) || currentPrice * 0.02,
        contracts,
        totalCost: credit,
        maxProfit: credit,
        maxLoss: (strikeSold - strikeBought) * 100 - credit,
        delta: soldPut?.delta || -0.30,
        deltaUpper: boughtPut?.delta || -0.10,
        expiration: soldPut?.expiration || expiration,
        daysToExpiration: soldPut?.expiration ? Math.max(1, Math.ceil((new Date(soldPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'spread',
      };
    }
    case 'Protective Put': {
      const otmPut = puts.find(p => p.strike < currentPrice && p.strike >= currentPrice * 0.9) || puts[0];
      const premium = otmPut?.lastPrice || currentPrice * 0.02;
      const strike = otmPut?.strike || Math.round(currentPrice * 0.95);
      const distanceDown = currentPrice - strike;
      return {
        strike,
        premium,
        contracts,
        totalCost: premium * 100,
        maxProfit: 'ilimitado',
        maxLoss: distanceDown * 100 + premium * 100,
        delta: otmPut?.delta || -0.40,
        expiration: otmPut?.expiration || expiration,
        daysToExpiration: otmPut?.expiration ? Math.max(1, Math.ceil((new Date(otmPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'put',
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
        maxProfit: 'ilimitado',
        maxLoss: cost,
        delta: atmCall?.delta || 0.50,
        expiration: atmCall?.expiration || expiration,
        daysToExpiration: days,
        type: 'call',
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
        maxProfit: 'ilimitado',
        maxLoss: cost,
        delta: otmPut?.delta || -0.20,
        deltaUpper: otmCall?.delta || 0.20,
        expiration: otmCall?.expiration || expiration,
        daysToExpiration: days,
        type: 'spread',
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
        maxProfit: credit,
        maxLoss: maxRisk,
        delta: soldPut?.delta || -0.20,
        deltaUpper: soldCall?.delta || 0.20,
        expiration: soldPut?.expiration || expiration,
        daysToExpiration: soldPut?.expiration ? Math.max(1, Math.ceil((new Date(soldPut.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : daysToExpiration,
        type: 'spread',
      };
    }
    default: {
      const cost = currentPrice * 0.03 * 100;
      return {
        strike: atmStrike,
        premium: currentPrice * 0.03,
        contracts,
        totalCost: cost,
        maxProfit: cost * 2,
        maxLoss: cost,
        delta: 0.50,
        expiration,
        daysToExpiration,
        type: 'call',
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
  historical: any[]
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
    score += 15;
    reasons.push('Alto volumen de negociación');
  }

  if (price >= 5 && price <= 500) {
    score += 15;
    reasons.push('Precio en rango óptimo para opciones');
  } else if (price < 5) {
    score -= 20;
    reasons.push('Precio muy bajo - poco movimiento en opciones');
  }

  const trend = technical?.trend || 'lateral';
  if (trend === 'alcista') {
    score += 15;
    reasons.push('Tendencia alcista favorable');
  } else if (trend === 'bajista') {
    score += 5;
    reasons.push('Tendencia bajista - buena para estrategias de protección');
  }

  const rsi = technical?.rsi || 50;
  if (rsi < 35) {
    score += 10;
    reasons.push('RSI sobrevendido - potencial de recuperación');
  } else if (rsi > 65) {
    score += 5;
    reasons.push('RSI sobrecomprado - potencial de volatilidad');
  }

  if (dividendYield > 0.02) {
    score += 10;
    reasons.push('Buen dividend yield - Covered Calls atractivos');
  }

  let topStrategy = 'Covered Call';
  if (score >= 80) {
    topStrategy = 'Bull Put Spread / Iron Condor';
  } else if (score >= 65) {
    topStrategy = 'Covered Call / Bull Call Spread';
  } else if (score >= 50) {
    topStrategy = 'Cash-Secured Put';
  } else {
    topStrategy = 'Protective Put (protección)';
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
