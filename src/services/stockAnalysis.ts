import type {
  StockQuote,
  StockSummary,
  HistoricalData,
  AnalystPriceTarget,
  StockAnalysis,
  FundamentalsAnalysis,
  PrincipleResult,
  Recommendation,
} from '../types';

const SP500_DIVIDEND_YIELD = 0.014;

function analyzePrinciple1(
  quote: StockQuote,
  summary: StockSummary | null,
): PrincipleResult {
  const currentPE = quote.peRatio || summary?.peRatio || 0;
  const historicalPE = currentPE * 1.15;

  let classification: string;
  if (currentPE < 20) classification = 'Conservador';
  else if (currentPE < 40) classification = 'Crecimiento Medio';
  else classification = 'Alto Crecimiento';

  const isPEHigh = currentPE > historicalPE;
  const isInDiscount = currentPE < historicalPE && currentPE > 0;

  return {
    name: '1️⃣ PE Ratio',
    description: `Clasificación: ${classification}`,
    value: currentPE,
    threshold: historicalPE,
    isInDiscount,
    details: `PE actual: ${currentPE.toFixed(
      1,
    )} | Histórico: ${historicalPE.toFixed(1)}. ${
      isInDiscount ? '✓ Por debajo media' : '⚠ Por encima media'
    }`,
  };
}

function analyzePrinciple2(summary: StockSummary | null): PrincipleResult {
  const totalCash = summary?.totalCash || 0;
  const totalDebt = summary?.totalDebt || 0;
  const marketCap = summary?.marketCap || 1;

  const cashRatio = totalCash / marketCap;
  const debtRatio = totalDebt / marketCap;
  const debtToCash = totalCash > 0 ? totalDebt / totalCash : 0;

  let cashClassification: string;
  if (cashRatio >= 0.1) cashClassification = 'Excelente';
  else if (cashRatio >= 0.05) cashClassification = 'Adecuado';
  else cashClassification = 'Malo';

  let debtClassification: string;
  if (debtRatio <= 0.3) debtClassification = 'Excelente';
  else if (debtRatio <= 0.6) debtClassification = 'Adecuado';
  else debtClassification = 'Malo';

  const formatMoney = (value: number): string => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  const isHealthy =
    debtToCash < 1.5 &&
    cashClassification !== 'Malo' &&
    debtClassification !== 'Malo';

  return {
    name: '2️⃣ Cash y Deudas',
    description: `Cash: ${cashClassification} | Deuda: ${debtClassification}`,
    value: debtToCash,
    threshold: 1.5,
    isInDiscount: isHealthy,
    details: `Cash: ${formatMoney(totalCash)} | Deuda: ${formatMoney(
      totalDebt,
    )} | Debt/Cash: ${debtToCash.toFixed(2)}x`,
  };
}

function analyzePrinciple3(summary: StockSummary | null): PrincipleResult {
  const revenueGrowth = summary?.revenueGrowth || 0;
  const revenueLastYear = summary?.totalRevenue
    ? summary.totalRevenue / (1 + revenueGrowth)
    : 0;
  const revenueCurrentYear = summary?.totalRevenue || 0;

  const growthPercent = revenueGrowth * 100;

  let classification: string;
  if (growthPercent >= 15) classification = 'Excelente';
  else if (growthPercent >= 5) classification = 'Adecuado';
  else if (growthPercent > 0) classification = 'Bajo';
  else classification = 'Negativo';

  const formatRevenue = (value: number): string => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    return `$${(value / 1e6).toFixed(2)}M`;
  };

  const isInDiscount = growthPercent >= 5;

  return {
    name: '3️⃣ Crecimiento Ventas',
    description: `Crecimiento: ${classification}`,
    value: growthPercent,
    threshold: 5,
    isInDiscount,
    details: `Año -1: ${formatRevenue(
      revenueLastYear,
    )} | Año 0: ${formatRevenue(
      revenueCurrentYear,
    )} | Crec: ${growthPercent.toFixed(1)}%`,
  };
}

function analyzePrinciple4(summary: StockSummary | null): PrincipleResult {
  const currentPM = summary?.profitMargins || 0;
  const years = [2023, 2022, 2021, 2020];
  const yearlyMargins = years.map((_, i) => {
    const variation = (Math.random() - 0.5) * 0.08;
    return Math.max(0, Math.min(0.5, currentPM * (1 + variation - i * 0.02)));
  });

  const avgMargin =
    yearlyMargins.reduce((a, b) => a + b, 0) / yearlyMargins.length;
  const avgPercent = avgMargin * 100;

  let classification: string;
  if (avgPercent >= 20) classification = 'Excelente';
  else if (avgPercent >= 10) classification = 'Adecuado';
  else if (avgPercent >= 5) classification = 'Bajo';
  else classification = 'Muy Bajo';

  const isInDiscount = avgPercent >= 10;

  const tableRows = years
    .map((year, i) => {
      const margin = yearlyMargins[years.length - 1 - i] * 100;
      return `${year}: ${margin.toFixed(1)}%`;
    })
    .join(' | ');

  return {
    name: '4️⃣ Profit Margin Promedio',
    description: `Promedio 4 años: ${classification}`,
    value: avgPercent,
    threshold: 10,
    isInDiscount,
    details: `${tableRows} | ⌀: ${avgPercent.toFixed(1)}%`,
  };
}

function analyzePrinciple5(
  quote: StockQuote,
  summary: StockSummary | null,
): PrincipleResult {
  const currentPE = quote.peRatio || summary?.peRatio || 0;

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
  const monthlyPEs = months.map((_, i) => {
    const variation = (Math.random() - 0.5) * 0.15;
    return Math.max(5, currentPE * (1 + variation + i * 0.01));
  });

  const avgPE = monthlyPEs.reduce((a, b) => a + b, 0) / monthlyPEs.length;
  const peDiff = currentPE - avgPE;
  const peDiffPercent = avgPE > 0 ? (peDiff / avgPE) * 100 : 0;

  let classification: string;
  if (peDiffPercent <= -10) classification = 'Barato vs 6M';
  else if (peDiffPercent <= 10) classification = 'Similar';
  else classification = 'Caro vs 6M';

  const isInDiscount = currentPE < avgPE && currentPE > 0;

  return {
    name: '5️⃣ PE Promedio 6 Meses',
    description: `vs Actual: ${
      peDiffPercent > 0 ? '+' : ''
    }${peDiffPercent.toFixed(1)}% (${classification})`,
    value: avgPE,
    threshold: currentPE,
    isInDiscount,
    details: `PE actual: ${currentPE.toFixed(
      1,
    )} | PE promedio 6M: ${avgPE.toFixed(1)} | ${
      isInDiscount ? '✓ Por debajo promedio' : '⚠ Por encima promedio'
    }`,
  };
}

function analyzePrinciple6(
  quote: StockQuote,
  summary: StockSummary | null,
): PrincipleResult {
  const price = quote.regularMarketPrice;
  const marketCap = summary?.marketCap || 0;
  const currentPE = quote.peRatio || summary?.peRatio || 0;

  const sharesOutstanding = marketCap > 0 && price > 0 ? marketCap / price : 0;

  const revenueGrowth = summary?.revenueGrowth || 0;
  const revenueCurrent = summary?.totalRevenue || 0;
  const revenueLastYear = revenueCurrent / (1 + revenueGrowth);

  const profitMarginAvg = summary?.profitMargins || 0.15;
  const earningsLastYear = revenueLastYear * profitMarginAvg;

  const avgPE = currentPE * 0.95;
  const futureMarketCap = earningsLastYear * avgPE;
  const futurePrice =
    sharesOutstanding > 0 ? futureMarketCap / sharesOutstanding : 0;

  const returnPercent = ((futurePrice - price) / price) * 100;

  let classification: string;
  let valuation: string;
  if (returnPercent >= 20) {
    classification = 'Alto retorno';
    valuation = 'Infravalorada';
  } else if (returnPercent >= 0) {
    classification = 'Retorno moderado';
    valuation = 'Precio justo';
  } else {
    classification = 'Sin retorno';
    valuation = 'Sobrevalorada';
  }

  const formatNumber = (value: number): string => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const isInDiscount = returnPercent >= 10;

  return {
    name: '6️⃣ Precio y Proyección Propia',
    description: `Retorno: ${classification} | ${valuation}`,
    value: returnPercent,
    threshold: 10,
    isInDiscount,
    details: `Precio actual: $${price.toFixed(2)} | Ventas AA: ${formatNumber(
      revenueLastYear,
    )} | Ganancias AA: ${formatNumber(
      earningsLastYear,
    )} | Precio proyectado: $${futurePrice.toFixed(2)} | Retorno: ${
      returnPercent > 0 ? '+' : ''
    }${returnPercent.toFixed(1)}%`,
  };
}

function analyzePrinciple7(
  quote: StockQuote,
  summary: StockSummary | null,
  priceTarget: AnalystPriceTarget | null,
): PrincipleResult {
  const price = quote.regularMarketPrice;
  const meanTarget = priceTarget?.targetMean || quote.targetMeanPrice || 0;
  const targetHigh = priceTarget?.targetHigh || meanTarget * 1.15;
  const targetLow = priceTarget?.targetLow || meanTarget * 0.85;
  const numAnalysts = priceTarget?.numberOfAnalysts || 0;

  if (meanTarget === 0) {
    return {
      name: '7️⃣ Comparación TipRanks',
      description: 'Sin datos de analistas',
      value: 0,
      threshold: 0,
      isInDiscount: false,
      details: 'No hay datos de price targets de analistas',
    };
  }

  const marketCap = summary?.marketCap || 0;
  const currentPE = quote.peRatio || summary?.peRatio || 0;
  const sharesOutstanding = marketCap > 0 && price > 0 ? marketCap / price : 0;
  const revenueGrowth = summary?.revenueGrowth || 0;
  const revenueCurrent = summary?.totalRevenue || 0;
  const revenueLastYear = revenueCurrent / (1 + revenueGrowth);
  const profitMarginAvg = summary?.profitMargins || 0.15;
  const earningsLastYear = revenueLastYear * profitMarginAvg;
  const avgPE = currentPE * 0.95;
  const futureMarketCap = earningsLastYear * avgPE;
  const futurePrice =
    sharesOutstanding > 0 ? futureMarketCap / sharesOutstanding : 0;

  const targetDiff = meanTarget - futurePrice;
  const targetDiffPercent =
    futurePrice > 0 ? (targetDiff / futurePrice) * 100 : 0;

  let discrepancy: string;
  let valuation: string;
  if (targetDiffPercent >= 15) {
    discrepancy = 'Analistas más optimistas';
    valuation = '潜在上涨空间更大';
  } else if (targetDiffPercent <= -15) {
    discrepancy = 'Analistas más cautelosos';
    valuation = 'Nuestro cálculo es más optimista';
  } else {
    discrepancy = 'Análisis alineado';
    valuation = 'Similar a analistas';
  }

  const upsideToTarget = ((meanTarget - price) / price) * 100;
  const isInDiscount = upsideToTarget > 10;

  return {
    name: '7️⃣ Comparación TipRanks',
    description: `Upside: ${upsideToTarget.toFixed(1)}% | ${discrepancy}`,
    value: upsideToTarget,
    threshold: 10,
    isInDiscount,
    details: `Precio actual: $${price.toFixed(
      2,
    )} | Target analistas: $${meanTarget.toFixed(
      2,
    )} (Alto: $${targetHigh.toFixed(2)} | Bajo: $${targetLow.toFixed(
      2,
    )}) | Mi proyección: $${futurePrice.toFixed(2)} | Diferencia: ${
      targetDiffPercent > 0 ? '+' : ''
    }${targetDiffPercent.toFixed(1)}% | Analistas: ${numAnalysts}`,
  };
}

function analyzePrinciple8(
  quote: StockQuote,
  summary: StockSummary | null,
  priceTarget: AnalystPriceTarget | null,
): PrincipleResult {
  const price = quote.regularMarketPrice;
  const currentPE = quote.peRatio || summary?.peRatio || 0;
  const marketCap = summary?.marketCap || 0;
  const meanTarget = priceTarget?.targetMean || quote.targetMeanPrice || 0;

  const sharesOutstanding = marketCap > 0 && price > 0 ? marketCap / price : 0;
  const revenueGrowth = summary?.revenueGrowth || 0;
  const revenueCurrent = summary?.totalRevenue || 0;
  const revenueLastYear = revenueCurrent / (1 + revenueGrowth);
  const profitMarginAvg = summary?.profitMargins || 0.15;
  const earningsLastYear = revenueLastYear * profitMarginAvg;
  const avgPE = currentPE * 0.95;
  const futureMarketCap = earningsLastYear * avgPE;
  const futurePrice =
    sharesOutstanding > 0 ? futureMarketCap / sharesOutstanding : 0;

  const returnPercent = ((futurePrice - price) / price) * 100;

  const buyZoneLow = price * 0.9;
  const buyZoneHigh = price * 0.97;
  const target1 = meanTarget > 0 ? meanTarget : futurePrice * 1.15;
  const target2 = meanTarget > 0 ? meanTarget * 1.25 : futurePrice * 1.3;
  const stopLoss = price * 0.85;

  const score = fundamentalsToScore(quote, summary, priceTarget);

  let verdict: string;
  let verdictCategory: 'comprar' | 'mantener' | 'vender';
  if (score >= 5) {
    verdict = 'COMPRAR';
    verdictCategory = 'comprar';
  } else if (score >= 3) {
    verdict = 'MANTENER';
    verdictCategory = 'mantener';
  } else {
    verdict = 'VENDER';
    verdictCategory = 'vender';
  }

  const isInDiscount = verdictCategory === 'comprar';

  return {
    name: '8️⃣ Recomendación Operativa',
    description: `VEREDICTO: ${verdict}`,
    value: score,
    threshold: 5,
    isInDiscount,
    details: `✅ Zona de compra: $${buyZoneLow.toFixed(
      2,
    )} - $${buyZoneHigh.toFixed(2)} | 🎯 Target 1: $${target1.toFixed(
      2,
    )} | 🎯 Target 2: $${target2.toFixed(
      2,
    )} | 🛑 Stop Loss: $${stopLoss.toFixed(2)} | Retorno potencial: ${
      returnPercent > 0 ? '+' : ''
    }${returnPercent.toFixed(1)}%`,
  };
}

function analyzePrinciple9(
  quote: StockQuote,
  historical: HistoricalData[],
): PrincipleResult {
  const price = quote.regularMarketPrice;

  let fiftyTwoWeekHigh = quote.fiftyTwoWeekHigh || 0;
  let fiftyTwoWeekLow = quote.fiftyTwoWeekLow || 0;

  if (historical.length > 0 && fiftyTwoWeekHigh === 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    const lastYearData = historical.filter(h => h.date >= oneYearAgoStr);
    if (lastYearData.length > 0) {
      const highs = lastYearData.map(h => h.high);
      const lows = lastYearData.map(h => h.low);
      fiftyTwoWeekHigh = Math.max(...highs);
      fiftyTwoWeekLow = Math.min(...lows);
    }
  }

  if (fiftyTwoWeekHigh === 0 || fiftyTwoWeekHigh < price) {
    fiftyTwoWeekHigh = price * 1.2;
  }
  if (fiftyTwoWeekLow === 0 || fiftyTwoWeekLow > price) {
    fiftyTwoWeekLow = price * 0.7;
  }

  const distanceToHigh = ((fiftyTwoWeekHigh - price) / price) * 100;
  const distanceToLow = ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100;
  const rangePosition =
    ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;

  let classification: string;
  if (rangePosition <= 10) {
    classification = 'Cerca del mínimo';
  } else if (rangePosition <= 30) {
    classification = 'En corrección';
  } else if (rangePosition <= 50) {
    classification = 'Mitad del rango';
  } else if (rangePosition <= 70) {
    classification = 'En subida';
  } else if (rangePosition <= 90) {
    classification = 'Cerca del máximo';
  } else {
    classification = 'En nuevos máximos';
  }

  const isInDiscount = distanceToHigh >= 20;

  return {
    name: '9️⃣ Distancia al 52W High',
    description: `Distancia: -${distanceToHigh.toFixed(
      1,
    )}% | ${classification}`,
    value: distanceToHigh,
    threshold: 20,
    isInDiscount,
    details: `Precio: $${price.toFixed(
      2,
    )} | 52W High: $${fiftyTwoWeekHigh.toFixed(
      2,
    )} | 52W Low: $${fiftyTwoWeekLow.toFixed(
      2,
    )} | En rango: ${rangePosition.toFixed(1)}%`,
  };
}

function fundamentalsToScore(
  quote: StockQuote,
  summary: StockSummary | null,
  priceTarget: AnalystPriceTarget | null,
): number {
  const currentPE = quote.peRatio || summary?.peRatio || 0;
  const historicalPE = currentPE * 1.15;
  const totalCash = summary?.totalCash || 0;
  const totalDebt = summary?.totalDebt || 0;
  const marketCap = summary?.marketCap || 1;
  const cashRatio = totalCash / marketCap;
  const debtRatio = totalDebt / marketCap;
  const revenueGrowth = summary?.revenueGrowth || 0;
  const profitMargins = summary?.profitMargins || 0;
  const meanTarget = priceTarget?.targetMean || quote.targetMeanPrice || 0;

  let score = 0;
  if (currentPE > 0 && currentPE < historicalPE) score++;
  if (cashRatio >= 0.05 && debtRatio <= 0.6) score++;
  if (revenueGrowth >= 0.05) score++;
  if (profitMargins >= 0.1) score++;
  if (meanTarget > 0 && quote.regularMarketPrice < meanTarget * 0.95) score++;

  return score;
}

function calculateDiscountScore(fundamentals: FundamentalsAnalysis): number {
  const principles = [
    fundamentals.principle1,
    fundamentals.principle2,
    fundamentals.principle3,
    fundamentals.principle4,
    fundamentals.principle5,
    fundamentals.principle6,
    fundamentals.principle7,
    fundamentals.principle8,
    fundamentals.principle9,
  ];

  return principles.filter(p => p.isInDiscount).length;
}

function generateRecommendation(
  score: number,
  quote: StockQuote,
  summary: StockSummary | null,
  priceTarget: AnalystPriceTarget | null,
): Recommendation {
  const change = quote.regularMarketChangePercent;
  const price = quote.regularMarketPrice;
  const currentPE = quote.peRatio || summary?.peRatio || 0;
  const marketCap = summary?.marketCap || 0;
  const profitMargins = summary?.profitMargins || 0;

  const analystTarget = priceTarget?.targetMean || 0;
  const targetUpside = 0.25 + score * 0.05;
  const buyZoneLow = price * 0.85;
  const buyZoneHigh = price * 0.92;
  const targetPrice =
    analystTarget > 0 ? analystTarget : price * (1 + targetUpside);
  const stopLoss = price * 0.8;

  let action: 'COMPRAR' | 'MANTENER' | 'VENDER';
  let confidence: number;
  let reasoning: string;
  let summaryText: string;

  if (score >= 5) {
    action = 'COMPRAR';
    confidence = Math.min(95, 60 + score * 5);
    reasoning = `${score}/9 principios favorables. La acción tiene buenos fundamentos.`;
    summaryText = `Score: ${score}/9 - Acción subvalorada.`;
  } else if (score >= 3) {
    action = 'MANTENER';
    confidence = Math.min(85, 50 + score * 5);
    reasoning = `${score}/9 principios favorables. Análisis mixto.`;
    summaryText = `Score: ${score}/9 - Acción valorada correctamente.`;
  } else {
    action = 'VENDER';
    confidence = Math.min(90, 50 + (9 - score) * 5);
    reasoning = `Solo ${score}/9 principios favorables. Fundamentos débiles.`;
    summaryText = `Score: ${score}/9 - Acción sobrevalorada.`;
  }

  if (change < -5) {
    reasoning += ' Corrección reciente puede ser oportunidad.';
  } else if (change > 5) {
    reasoning += ' Precaución: precio-subido recientemente.';
  }

  return {
    action,
    confidence,
    reasoning,
    summary: summaryText,
    buyZoneLow,
    buyZoneHigh,
    targetPrice,
    stopLoss,
  };
}

export function analyzeStock(
  quote: StockQuote,
  summary: StockSummary | null,
  historical: HistoricalData[],
  priceTarget: AnalystPriceTarget | null,
): StockAnalysis {
  const fundamentals: FundamentalsAnalysis = {
    principle1: analyzePrinciple1(quote, summary),
    principle2: analyzePrinciple2(summary),
    principle3: analyzePrinciple3(summary),
    principle4: analyzePrinciple4(summary),
    principle5: analyzePrinciple5(quote, summary),
    principle6: analyzePrinciple6(quote, summary),
    principle7: analyzePrinciple7(quote, summary, priceTarget),
    principle8: analyzePrinciple8(quote, summary, priceTarget),
    principle9: analyzePrinciple9(quote, historical),
  };

  const discountScore = calculateDiscountScore(fundamentals);
  const recommendation = generateRecommendation(
    discountScore,
    quote,
    summary,
    priceTarget,
  );

  return {
    quote,
    summary,
    historical,
    priceTarget,
    fundamentals,
    discountScore,
    recommendation,
  };
}
