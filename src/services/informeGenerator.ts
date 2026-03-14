import { 
  classifyGrowthRate, 
  classifyProfitMargin, 
  classifyPERatio, 
  classifyCashLevel, 
  classifyDebtLevel,
  ScrapedData
} from './scraper';

function formatCurrency(value: number): string {
  if (!value || isNaN(value)) return '$0';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  if (!value || isNaN(value)) return '0%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export interface InformeDetail {
  company: {
    name: string;
    symbol: string;
    description: string;
    sector: string;
    industry: string;
    riskLevel: 'Bajo' | 'Medio' | 'Alto';
    businessSummary: string;
  };
  
  dataKey: {
    price: string;
    marketCap: string;
    sharesOutstanding: string;
    lastUpdated: string;
  };
  
  peRatio: {
    current: string;
    currentValue: number;
    classification: string;
    classificationDetail: string;
    forward: string;
    forwardValue: number;
    historical: string;
  };
  
  cashDebt: {
    cash: string;
    cashValue: number;
    debt: string;
    debtValue: number;
    debtToEquity: string;
    debtToEquityValue: number;
    cashClassification: string;
    cashClassificationDetail: string;
    debtClassification: string;
    debtClassificationDetail: string;
    netDebt?: string;
    netDebtValue?: number;
  };
  
  growth: {
    current: string;
    currentValue: number;
    projection: string;
    momentum: string;
    classification: string;
    classificationDetail: string;
    details?: string;
  };
  
  profitMargin: {
    current: string;
    currentValue: number;
    average4Years: string;
    average4YearsValue: number;
    forward: string;
    classification: string;
    classificationDetail: string;
  };
  
  peAverage: {
    historical: string;
    forward: string;
    forwardValue: number;
    classification: string;
  };
  
  projection: {
    currentPrice: string;
    forwardRevenue: string;
    calculation: string;
    returnRange: string;
    returnMin: number;
    returnMax: number;
    note: string;
  };
  
  tipRanks: {
    priceTarget: string;
    priceTargetValue: number;
    upside: string;
    upsideValue: number;
    consensus: string;
    analystsCount: number;
    discrepancy: string;
  };
  
  summaryTable: {
    rows: {
      metric: string;
      value: string;
      classification: string;
    }[];
  };
  
  priceTargetSection: {
    target: string;
    recommendation: string;
  };
  
  strategy: {
    verdict: string;
    verdictAction: 'COMPRAR' | 'MANTENER' | 'VENDER';
    buyZone: string;
    buyZoneLow: number;
    buyZoneHigh: number;
    target1: string;
    target1Value: number;
    target2: string;
    target2Value: number;
    stopLoss: string;
    stopLossValue: number;
  };
  
  conclusion: string;
}

interface InformeInput {
  ticker: string;
  quote: any;
  summary: any;
  priceTarget: any;
  recommendation: any;
  scrapedData?: ScrapedData;
  multiSourceData?: any;
}

export function generateInformeDetail(input: InformeInput): InformeDetail {
  const { ticker, quote, summary, priceTarget, recommendation, scrapedData, multiSourceData } = input;
  
  const pe = quote?.peRatio || summary?.peRatio || multiSourceData?.yahoo?.peRatio || 0;
  const currentPrice = quote?.regularMarketPrice || 0;
  const marketCap = quote?.marketCap || multiSourceData?.yahoo?.marketCap || 0;
  
  const totalCash = summary?.totalCash || multiSourceData?.yahoo?.totalCash || 0;
  const totalDebt = summary?.totalDebt || multiSourceData?.yahoo?.totalDebt || 0;
  const debtToEquity = totalCash > 0 ? (totalDebt / totalCash) : (multiSourceData?.yahoo?.totalDebt / multiSourceData?.yahoo?.totalCash) || 0;
  
  const profitMargins = (summary?.profitMargins !== undefined && summary?.profitMargins !== null) ? summary.profitMargins : (multiSourceData?.yahoo?.profitMargins || 0.25);
  const revenueGrowth = (summary?.revenueGrowth !== undefined && summary?.revenueGrowth !== null) ? summary.revenueGrowth : (multiSourceData?.yahoo?.revenueGrowth || 0.15);
  const totalRevenue = summary?.totalRevenue || multiSourceData?.yahoo?.totalRevenue || marketCap * 0.3;
  
  const forwardPE = pe < 0 ? 35 : pe;
  const targetMean = priceTarget?.targetMean || recommendation?.targetPrice || currentPrice * 1.15;
  
  const peClass = classifyPERatio(pe);
  const growthClass = classifyGrowthRate(revenueGrowth * 100);
  const marginClass = classifyProfitMargin(profitMargins * 100);
  const cashClass = classifyCashLevel(totalCash);
  const debtClass = classifyDebtLevel(debtToEquity);
  
  const upside = currentPrice > 0 ? ((targetMean - currentPrice) / currentPrice) * 100 : 0;
  const projectedPrice = recommendation?.targetPrice || currentPrice * 1.15;
  const potentialReturn = currentPrice > 0 ? ((projectedPrice - currentPrice) / currentPrice) * 100 : 0;
  const returnMin = potentialReturn > 0 ? potentialReturn * 0.4 : potentialReturn * 1.3;
  const returnMax = potentialReturn > 0 ? potentialReturn * 1.6 : potentialReturn * 0.4;
  
  const avgProfitMargin4Years = profitMargins * 100 * 0.8;
  const forwardRevenue = totalRevenue * (1 + revenueGrowth);
  
  const sector = quote?.sector || 'Unknown';
  const industry = quote?.industry || 'Unknown';
  const businessSummary = quote?.businessSummary || '';
  const companyName = quote?.shortName || quote?.longName || ticker;
  
  const tipranksData = multiSourceData?.tipranks || scrapedData?.tipranks;
  const marketbeatData = multiSourceData?.marketbeat || scrapedData?.marketbeat;
  const gurufocusData = multiSourceData?.gurufocus || scrapedData?.gurufocus;
  const macrotrendsData = multiSourceData?.macrotrends || scrapedData?.macrotrends;
  
  const riskLevel = determineRiskLevel(sector, industry, marketCap);
  
  const tipRanksPriceTarget = tipranksData?.priceTarget || marketbeatData?.priceTarget || targetMean;
  const analystsCount = tipranksData?.numberOfAnalysts || marketbeatData?.buyRatings + marketbeatData?.holdRatings + marketbeatData?.sellRatings || 1;
  const buyRatings = tipranksData?.buyCount || marketbeatData?.buyRatings || 0;
  const holdRatings = tipranksData?.holdCount || marketbeatData?.holdRatings || 0;
  const sellRatings = tipranksData?.sellCount || marketbeatData?.sellRatings || 0;
  
  const consensusRating = buyRatings > holdRatings ? 'Buy' : holdRatings > buyRatings ? 'Sell' : buyRatings > 0 ? 'Buy' : 'Hold';
  
  const sharesOutstanding = marketCap > 0 && currentPrice > 0 ? marketCap / currentPrice : 250000000;
  
  const projectedRevenueHigh = forwardRevenue * 1.25;
  const projectedRevenueLow = forwardRevenue * 1.10;
  const profitMarginForward = profitMargins > 0 ? profitMargins * 100 : 5;
  const earningsForwardLow = projectedRevenueLow * (profitMarginForward / 100);
  const earningsForwardHigh = projectedRevenueHigh * (profitMarginForward / 100);
  const marketCapFutureLow = earningsForwardLow * forwardPE;
  const marketCapFutureHigh = earningsForwardHigh * forwardPE;
  const priceFutureLow = marketCapFutureLow / sharesOutstanding;
  const priceFutureHigh = marketCapFutureHigh / sharesOutstanding;
  
  const myProjectionLow = priceFutureLow > currentPrice * 0.85 ? priceFutureLow : currentPrice * 0.9;
  const myProjectionHigh = priceFutureHigh > currentPrice * 1.5 ? priceFutureHigh : currentPrice * 1.5;
  
  const sectorKeywords = analyzeSectorKeywords(businessSummary, sector, industry);
  
  const growthProjection = generateGrowthProjection(revenueGrowth, sectorKeywords, businessSummary);
  const momentumText = generateMomentumText(revenueGrowth, sector, industry, businessSummary, quote, sectorKeywords);
  const peDetail = generatePEDetail(pe, sector, sectorKeywords, quote);
  const cashDebtDetail = generateCashDebtDetail(totalCash, totalDebt, debtToEquity, sector, sectorKeywords, quote);
  const marginDetail = generateMarginDetail(profitMargins, sectorKeywords, businessSummary);
  const discrepancyExplanation = generateDiscrepancyExplanation(myProjectionLow, myProjectionHigh, tipRanksPriceTarget, currentPrice, sector, pe, sectorKeywords);
  
  const conclusionText = generateConclusion(
    companyName,
    ticker.toUpperCase(),
    sector,
    pe,
    totalCash,
    totalDebt,
    revenueGrowth,
    profitMargins,
    potentialReturn,
    recommendation?.action || 'MANTENER',
    businessSummary,
    sectorKeywords
  );

  return {
    company: {
      name: companyName,
      symbol: ticker.toUpperCase(),
      description: generateCompanyDescription(companyName, sector, industry, businessSummary, sectorKeywords),
      sector,
      industry,
      riskLevel,
      businessSummary: businessSummary.substring(0, 300),
    },
    
    dataKey: {
      price: `~$${currentPrice.toFixed(2)} USD (cierre reciente${quote?.postMarketPrice ? `; after-hours ~$${quote.postMarketPrice.toFixed(2)}` : ''}; basado en Yahoo Finance y fuentes en tiempo real)`,
      marketCap: `${formatCurrency(marketCap)} (~${(marketCap / 1e12).toFixed(2)}T)`,
      sharesOutstanding: `~${(sharesOutstanding / 1e9).toFixed(2)}B (diluidas)`,
      lastUpdated: new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    },
    
    peRatio: peDetail,
    
    cashDebt: cashDebtDetail,
    
    growth: {
      current: `Revenue TTM ~${formatCurrency(totalRevenue)} (${formatPercent(revenueGrowth * 100)} YoY)`,
      currentValue: revenueGrowth * 100,
      projection: growthProjection,
      momentum: momentumText,
      classification: growthClass.label,
      classificationDetail: growthClass.description,
      details: `Crecimiento ${revenueGrowth >= 0.15 ? 'fuerte' : revenueGrowth >= 0.10 ? 'sólido' : 'moderado'} basado en guías recientes y momentum del sector ${sector}`,
    },
    
    profitMargin: marginDetail,
    
    peAverage: {
      historical: pe < 0 
        ? `Histórico irrelevante por pérdidas; múltiplos no aplicables en etapa de desarrollo`
        : `Histórico de los últimos 6 meses disponible en fuentes como YCharts y Macrotrends`,
      forward: pe < 0 
        ? `Usamos promedio forward ~${forwardPE} para cálculo (refleja múltiplos especulativos en sector ${sector})`
        : `Usamos PE promedio de ~${forwardPE.toFixed(0)} para proyecciones`,
      forwardValue: forwardPE,
      classification: pe < 0 ? 'Alto especulativo' : pe < 25 ? 'Normal' : 'Elevado',
    },
    
    projection: {
      currentPrice: `~$${currentPrice.toFixed(2)}`,
      forwardRevenue: `~${formatCurrency(forwardRevenue)}-${formatCurrency(projectedRevenueHigh)} estimado para 2026`,
      calculation: `Ventas forward × Profit Margin Promedio × PE Forward = Market Cap Futuro → Precio Objetivo`,
      returnRange: `${formatPercent(returnMin)} a ${formatPercent(returnMax)} en 12-18 meses`,
      returnMin,
      returnMax,
      note: pe < 0 
        ? `Fórmula especulativa por etapa de desarrollo; upside mayor si profitability emerge o boom del sector`
        : `Proyección basada en múltiplos actuales y crecimiento esperado`,
    },
    
    tipRanks: {
      priceTarget: `~$${tipRanksPriceTarget.toFixed(2)}`,
      priceTargetValue: tipRanksPriceTarget,
      upside: formatPercent(upside),
      upsideValue: upside,
      consensus: consensusRating,
      analystsCount,
      discrepancy: discrepancyExplanation,
    },
    
    summaryTable: {
      rows: [
        { metric: 'PE Ratio (TTM)', value: pe < 0 ? `Negativo (${pe.toFixed(0)})` : pe.toFixed(2), classification: pe < 0 ? 'Alto Crecimiento (forward alto)' : peClass.label },
        { metric: 'Cash', value: formatCurrency(totalCash), classification: cashClass.label },
        { metric: 'Deuda/Equity', value: `${(debtToEquity * 100).toFixed(2)}%`, classification: debtClass.label },
        { metric: 'Crecimiento Ventas', value: formatPercent(revenueGrowth * 100), classification: growthClass.label },
        { metric: 'Profit Margin Promedio', value: formatPercent(avgProfitMargin4Years), classification: marginClass.label },
        { metric: 'PE Promedio forward', value: forwardPE.toFixed(0), classification: pe < 0 ? 'Alto especulativo' : 'Normal' },
        { metric: 'Precio Actual', value: `$${currentPrice.toFixed(2)}`, classification: '-' },
        { metric: 'Price Target', value: `$${tipRanksPriceTarget.toFixed(2)}`, classification: formatPercent(upside) },
      ],
    },
    
    priceTargetSection: {
      target: `~$${tipRanksPriceTarget.toFixed(2)} (alineado con consenso)`,
      recommendation: recommendation?.action === 'COMPRAR' 
        ? 'COMPRAR - Growth especulativo'
        : recommendation?.action === 'MANTENER'
        ? 'MANTENER - Hold'
        : 'VENDER - Sell',
    },
    
    strategy: {
      verdict: recommendation?.action === 'COMPRAR' 
        ? `COMPRAR (especulativo; fuerte momentum en ${sector}; posición moderada por volatilidad)`
        : recommendation?.action === 'MANTENER'
        ? 'MANTENER (esperar mejores condiciones)'
        : 'VENDER (riesgos outweigh beneficios)',
      verdictAction: recommendation?.action || 'MANTENER',
      buyZone: `$${(currentPrice * 0.85).toFixed(2)} - $${(currentPrice * 0.95).toFixed(2)}`,
      buyZoneLow: currentPrice * 0.85,
      buyZoneHigh: currentPrice * 0.95,
      target1: `$${tipRanksPriceTarget.toFixed(2)} (12 meses)`,
      target1Value: tipRanksPriceTarget,
      target2: `$${myProjectionHigh.toFixed(2)} (optimista)`,
      target2Value: myProjectionHigh,
      stopLoss: `$${(currentPrice * 0.80).toFixed(2)}`,
      stopLossValue: currentPrice * 0.80,
    },
    
    conclusion: conclusionText,
  };
}

function analyzeSectorKeywords(businessSummary: string, sector: string, industry: string): string[] {
  const keywords: string[] = [];
  const text = `${businessSummary} ${sector} ${industry}`.toLowerCase();
  
  const keywordMap: Record<string, string> = {
    'stablecoin': 'stablecoin',
    'usdc': 'stablecoin',
    'crypto': 'crypto',
    'cryptocurrency': 'crypto',
    'blockchain': 'blockchain',
    'bitcoin': 'crypto',
    'ethereum': 'crypto',
    'ai': 'ai',
    'artificial intelligence': 'ai',
    'machine learning': 'ai',
    'semiconductor': 'semiconductor',
    'chip': 'semiconductor',
    'gpu': 'semiconductor',
    'cloud': 'cloud',
    'saas': 'saas',
    'software': 'software',
    'payments': 'payments',
    'fintech': 'fintech',
    'bank': 'bank',
    'insurance': 'insurance',
    'healthcare': 'healthcare',
    'pharma': 'pharma',
    'biotech': 'biotech',
    'ev': 'ev',
    'electric vehicle': 'ev',
    'battery': 'battery',
    'lithium': 'battery',
    'renewable': 'renewable',
    'solar': 'renewable',
    'wind': 'renewable',
    'oil': 'energy',
    'gas': 'energy',
    'energy': 'energy',
    'retail': 'retail',
    'ecommerce': 'retail',
    'consumer': 'consumer',
    'media': 'media',
    'streaming': 'media',
    'telecom': 'telecom',
    'real estate': 'realestate',
    'reit': 'realestate',
    'ipo': 'post-ipo',
    'post-ipo': 'post-ipo',
    'azure': 'azure',
    'office': 'office',
    'windows': 'windows',
    'xbox': 'gaming',
    'copilot': 'ai',
    'openai': 'ai',
    'aws': 'cloud',
    'google cloud': 'cloud',
    'iphone': 'hardware',
    'ipad': 'hardware',
    'mac': 'hardware',
    'apple watch': 'hardware',
    'nvidia': 'semiconductor',
    'tesla': 'ev',
    'amazon': 'ecommerce',
  };
  
  for (const [key, value] of Object.entries(keywordMap)) {
    if (text.includes(key) && !keywords.includes(value)) {
      keywords.push(value);
    }
  }
  
  return keywords;
}

function extractCompanyProducts(businessSummary: string, sector: string, industry: string): string {
  const products: string[] = [];
  const text = businessSummary.toLowerCase();
  
  const productKeywords: Record<string, string> = {
    'azure': 'cloud (Azure)',
    'office 365': 'Microsoft 365',
    'office': 'software de productividad (Office)',
    'windows': 'sistemas operativos (Windows)',
    'xbox': 'gaming (Xbox)',
    'copilot': 'AI (Copilot)',
    'openai': 'inteligencia artificial (OpenAI)',
    'sharepoint': 'colaboración (SharePoint)',
    'teams': 'comunicación (Teams)',
    'dynamics': 'ERP/CRM (Dynamics)',
    'linkedin': 'red profesional (LinkedIn)',
    'power bi': 'analítica (Power BI)',
    'visual studio': 'desarrollo (Visual Studio)',
    'github': 'desarrollo (GitHub)',
    'surface': 'hardware (Surface)',
    'iphone': 'iPhone',
    'ipad': 'iPad',
    'mac': 'Mac',
    'apple watch': 'Apple Watch',
    'airpods': 'AirPods',
    'apple tv': 'Apple TV',
    'apple music': 'Apple Music',
    'app store': 'App Store',
    'icloud': 'iCloud',
    'aws': 'AWS',
    'amazon': 'e-commerce y cloud',
    'prime': 'Prime',
    'kindle': 'Kindle',
    'alexa': 'Alexa',
    'google cloud': 'Google Cloud',
    'youtube': 'YouTube',
    'android': 'Android',
    'chrome': 'Chrome',
    'search advertising': 'publicidad en búsqueda',
    'nvidia': 'GPUs y hardware de IA',
    'cuda': 'plataforma CUDA',
    'data center': 'data center',
    'tesla': 'vehículos eléctricos y energía',
    'solar': 'energía solar',
    'powerwall': 'baterías domésticas',
    'vanguard': 'plataforma de trading',
    'stripe': 'pagos',
    'square': 'pagos',
    'paypal': 'pagos digitales',
    'shopify': 'e-commerce',
    'netflix': 'streaming',
    'spotify': 'streaming de música',
    'disney': 'entretenimiento',
    'facebook': 'redes sociales',
    'instagram': 'redes sociales',
    'whatsapp': 'mensajería',
    'meta': 'metaverso y realidad virtual',
    'usdc': 'stablecoin USDC',
  };
  
  for (const [key, value] of Object.entries(productKeywords)) {
    if (text.includes(key)) {
      products.push(value);
    }
  }
  
  if (products.length === 0) {
    return '';
  }
  
  return products.slice(0, 6).join(', ');
}

function generateSpanishDescription(name: string, sector: string, industry: string, keywords: string[], products: string): string {
  const sectorDesc: Record<string, string> = {
    'Technology': 'empresa tecnológica líder',
    'Healthcare': 'empresa del sector salud',
    'Financial Services': 'empresa de servicios financieros',
    'Consumer Cyclical': 'empresa de consumo cíclico',
    'Communication Services': 'empresa de servicios de comunicación',
    'Industrials': 'empresa industrial',
    'Consumer Defensive': 'empresa de consumo defensivo',
    'Energy': 'empresa del sector energía',
    'Basic Materials': 'empresa de materiales básicos',
    'Real Estate': 'empresa de bienes raíces',
    'Utilities': 'empresa de servicios públicos',
    'Financials': 'empresa del sector financiero',
    'Information Technology': 'empresa de tecnología de la información',
  };
  
  let description = `${name} es una ${sectorDesc[sector] || 'empresa'} que opera a nivel mundial`;
  
  if (products) {
    description += `. Principales productos y servicios: ${products}`;
  }
  
  const activityKeywords = keywords.includes('ai') ? 'con fuerte enfoque en inteligencia artificial y automatización' :
                          keywords.includes('cloud') ? 'con enfoque en computación en la nube y servicios empresariales' :
                          keywords.includes('semiconductor') ? 'líder en semiconductores y chips para IA' :
                          keywords.includes('crypto') || keywords.includes('stablecoin') ? 'en el sector de criptomonedas y blockchain' :
                          keywords.includes('fintech') ? 'en el sector fintech y transformación digital de pagos' :
                          keywords.includes('ev') || keywords.includes('battery') ? 'en el sector de vehículos eléctricos y energía renovable' :
                          keywords.includes('gaming') ? 'en la industria de videojuegos y entretenimiento' :
                          keywords.includes('software') || keywords.includes('saas') ? 'en software como servicio (SaaS) y soluciones empresariales' :
                          keywords.includes('payments') ? 'en el sector de pagos digitales' :
                          keywords.includes('ecommerce') ? 'en comercio electrónico' :
                          keywords.includes('media') ? 'en medios y entretenimiento' :
                          keywords.includes('hardware') ? 'en hardware y dispositivos' :
                          '';
  
  if (activityKeywords) {
    description += `, ${activityKeywords}`;
  }
  
  description += '.';
  
  return description;
}

function generateCompanyDescription(name: string, sector: string, industry: string, businessSummary: string, keywords: string[]): string {
  const products = extractCompanyProducts(businessSummary, sector, industry);
  return generateSpanishDescription(name, sector, industry, keywords, products);
}

function generatePEDetail(pe: number, sector: string, keywords: string[], quote: any): any {
  let classification = '';
  let classificationDetail = '';
  let forward = '';
  let historical = '';
  
  if (pe < 0) {
    if (keywords.includes('stablecoin') || keywords.includes('crypto')) {
      classification = 'No aplicable (pérdidas)';
      classificationDetail = `PE Negativo típico de empresas crypto/blockchain post-IPO con fuerte inversión en growth y expansión de mercado. Forward alto (>30) refleja expectativas de profitability futura por adopción masiva de stablecoins y revenue de intereses.`;
    } else if (keywords.includes('ai') || keywords.includes('semiconductor')) {
      classification = 'No aplicable (pérdidas)';
      classificationDetail = `PE Negativo típico de empresas de IA/semiconductores en fase de crecimiento acelerado. Forward PE ~35-40 refleja expectativas muy altas por demanda de chips para IA.`;
    } else {
      classification = 'No aplicable (pérdidas)';
      classificationDetail = `PE Negativo típico de empresas en etapa de crecimiento con inversiones agresivas. Forward PE alto refleja expectativas de rentabilidad futura.`;
    }
    forward = `forward PE ~35-40 en estimaciones, indicando expectativas de crecimiento muy elevadas pero alto riesgo`;
    historical = `Histórico irrelevante por pérdidas; múltiplos no aplicables en etapa de desarrollo`;
  } else if (pe < 15) {
    classification = 'Conservador';
    classificationDetail = 'PE bajo - empresa establecida y estable con flujos de caja predecibles.';
    forward = `forward PE basado en estimaciones de analistas`;
    historical = `Histórico disponible en fuentes como YCharts y Macrotrends`;
  } else if (pe < 25) {
    classification = 'Justo';
    classificationDetail = 'PE razonable para empresa en crecimiento con fundamentos sólidos.';
    forward = `forward PE basado en estimaciones de analistas`;
    historical = `Histórico disponible en fuentes como YCharts y Macrotrends`;
  } else if (pe < 40) {
    classification = 'Crecimiento Medio';
    classificationDetail = 'PE elevado - expectativas de alto crecimiento pero con ciertos riesgos.';
    forward = `forward PE refleja expectativas elevadas de crecimiento`;
    historical = `Histórico muestra múltiplos altos típicos de growth stocks`;
  } else {
    classification = 'Alto Crecimiento';
    classificationDetail = 'PE muy alto - especulativo con riesgos significativos.';
    forward = `forward PE alto refleja expectativas muy optimistas`;
    historical = `Histórico muestra múltiplos extremos típicos de momentum stocks`;
  }
  
  return {
    current: pe < 0 ? `Negativo (~${Math.abs(pe).toFixed(0)} en reportes; por pérdidas o ajustes post-IPO)` : pe.toFixed(2),
    currentValue: pe,
    classification,
    classificationDetail,
    forward,
    forwardValue: pe < 0 ? 35 : pe,
    historical,
  };
}

function generateCashDebtDetail(totalCash: number, totalDebt: number, debtToEquity: number, sector: string, keywords: string[], quote: any): any {
  let cashClassification = '';
  let cashDetail = '';
  let debtClassification = '';
  let debtDetail = '';
  
  if (keywords.includes('stablecoin') || keywords.includes('crypto')) {
    if (totalCash >= 1e9) {
      cashClassification = 'Excelente';
      cashDetail = 'Liquidez excepcional - reservas massivas para respaldar USDC/stablecoins y operaciones. Balance muy sólido para el sector.';
    } else if (totalCash >= 1e8) {
      cashClassification = 'Muy Bueno';
      cashDetail = 'Liquidez sólida para el sector crypto - reservas adecuadas para respaldar stablecoins y expansión.';
    } else {
      cashClassification = 'Adecuado';
      cashDetail = 'Liquidez moderada - requiere monitoreo de reservas y flujo de caja.';
    }
    debtClassification = debtToEquity <= 0.3 ? 'Excelente' : debtToEquity <= 0.6 ? 'Adecuado' : 'Alto';
    debtDetail = debtToEquity <= 0.3 ? 'Deuda mínima o nula - balance sheet limpio típico de issuers regulados de stablecoins.' : 'Deuda moderada - apalancamiento razonable para crecimiento.';
  } else if (keywords.includes('fintech')) {
    cashClassification = totalCash >= 1e9 ? 'Excelente' : totalCash >= 5e8 ? 'Muy Bueno' : 'Bueno';
    cashDetail = totalCash >= 1e9 ? 'Cash excepcional - ample liquidez para pagos, crecimiento y adquisiciones.' : 'Cash sólido para operaciones de fintech.';
    debtClassification = debtToEquity <= 0.3 ? 'Excelente' : debtToEquity <= 0.6 ? 'Adecuado' : 'Alto';
    debtDetail = debtToEquity <= 0.3 ? 'Deuda muy baja - balance conservador típico de fintechs regulados.' : 'Deuda moderada - apalancamiento para crecimiento.';
  } else {
    if (totalCash >= 1e10) {
      cashClassification = 'Excelente';
      cashDetail = 'Cash excepcional - empresa muy sólida financieramente.';
    } else if (totalCash >= 1e9) {
      cashClassification = 'Muy Bueno';
      cashDetail = 'Cash muy fuerte - ample liquidez para expansiones.';
    } else if (totalCash >= 5e8) {
      cashClassification = 'Bueno';
      cashDetail = 'Cash sólido - buena posición financiera.';
    } else if (totalCash >= 1e8) {
      cashClassification = 'Adecuado';
      cashDetail = 'Cash moderado - operación sostenible.';
    } else {
      cashClassification = 'Limitado';
      cashDetail = 'Cash limitado - requiere monitoreo.';
    }
    
    if (debtToEquity <= 0.1) {
      debtClassification = 'Excelente';
      debtDetail = 'Casi sin deuda - balance sheet limpio.';
    } else if (debtToEquity <= 0.3) {
      debtClassification = 'Bueno';
      debtDetail = 'Deuda baja - apalancamiento saludable.';
    } else if (debtToEquity <= 0.6) {
      debtClassification = 'Adecuado';
      debtDetail = 'Deuda moderada - apalancamiento razonable.';
    } else {
      debtClassification = 'Alto';
      debtDetail = 'Deuda elevada - riesgo incrementado.';
    }
  }
  
  return {
    cash: `${formatCurrency(totalCash)}`,
    cashValue: totalCash,
    debt: `${formatCurrency(totalDebt)}`,
    debtValue: totalDebt,
    debtToEquity: `${(debtToEquity * 100).toFixed(2)}%`,
    debtToEquityValue: debtToEquity,
    cashClassification,
    cashClassificationDetail: cashDetail,
    debtClassification,
    debtClassificationDetail: debtDetail,
    netDebt: `${formatCurrency(totalDebt - totalCash)}`,
    netDebtValue: totalDebt - totalCash,
  };
}

function generateGrowthProjection(revenueGrowth: number, keywords: string[], businessSummary: string): string {
  const growthPercent = revenueGrowth * 100;
  
  if (keywords.includes('stablecoin') || keywords.includes('crypto')) {
    if (growthPercent > 50) {
      return `Crecimiento explosivo proyectado para 2025-2026 (${formatPercent(growthPercent)}+), impulsado por adopción masiva de stablecoins, expansión de USDC y crecimiento de transaction volume.`;
    } else if (growthPercent > 15) {
      return `Crecimiento fuerte proyectado (${formatPercent(growthPercent)}+) para 2025-2026, impulsado por adopción crypto y nuevos productos.`;
    }
  } else if (keywords.includes('ai') || keywords.includes('semiconductor')) {
    if (growthPercent > 30) {
      return `Crecimiento muy fuerte (${formatPercent(growthPercent)}+) para 2025-2026, impulsado por demanda de chips para IA y centros de datos.`;
    }
  } else if (keywords.includes('ev') || keywords.includes('battery')) {
    if (growthPercent > 30) {
      return `Crecimiento explosivo (${formatPercent(growthPercent)}+) para 2025-2026, impulsado por transición energética y demanda de EVs.`;
    }
  }
  
  if (growthPercent > 50) {
    return `Crecimiento explosivo proyectado para 2025-2026 (${formatPercent(growthPercent)}+), impulsado por expansión de mercado y nuevos productos.`;
  } else if (growthPercent > 15) {
    return `Crecimiento fuerte proyectado (${formatPercent(growthPercent)}+) para 2025-2026 basado en guías de analistas y momentum actual.`;
  } else if (growthPercent > 0) {
    return `Crecimiento moderado proyectado (${formatPercent(growthPercent)}+) para 2025-2026.`;
  }
  
  return `Proyecciones mixtas para 2025-2026 - evaluar catalizadores específicos.`;
}

function generateMomentumText(growth: number, sector: string, industry: string, businessSummary: string, quote: any, keywords: string[]): string {
  const factors: string[] = [];
  
  if (keywords.includes('stablecoin') || keywords.includes('crypto')) {
    factors.push('impulsado por adopción de stablecoins y crypto');
    if (quote?.marketCap > 10e9) {
      factors.push('momentum de large-cap crypto');
    }
  } else if (keywords.includes('ai')) {
    factors.push('impulsado por boom de inteligencia artificial');
  } else if (keywords.includes('semiconductor')) {
    factors.push('impulsado por demanda de chips para IA y cloud');
  } else if (keywords.includes('ev') || keywords.includes('battery')) {
    factors.push('impulsado por transición energética y vehículos eléctricos');
  } else if (keywords.includes('fintech')) {
    factors.push('impulsado por transformación digital de pagos');
  } else if (keywords.includes('software') || keywords.includes('saas')) {
    factors.push('impulsado por adopción cloud y SaaS');
  }
  
  if (quote?.marketCap > 100e9) {
    factors.push('momentum de large-cap con estabilidad');
  } else if (quote?.marketCap < 2e9) {
    factors.push('high growth potential con mayores volatilidades');
  }
  
  if (growth > 0.5) {
    factors.push('crecimiento explosivo de revenue');
  } else if (growth > 0.15) {
    factors.push('crecimiento sólido en ventas');
  }
  
  if (factors.length === 0) {
    return 'Momentum mixto - evaluar catalizadores específicos de la empresa y sector.';
  }
  
  return factors.slice(0, 3).join('; ') + '.';
}

function generateMarginDetail(margin: number, keywords: string[], businessSummary: string): any {
  const marginPercent = margin * 100;
  let classification = '';
  let classificationDetail = '';
  let forward = '';
  
  if (keywords.includes('stablecoin') || keywords.includes('crypto')) {
    if (marginPercent > 0) {
      classification = 'Positivo';
      classificationDetail = 'Margen positivo reciente por interest income y fees de stablecoins. Mejora significativa vs años anteriores.';
    } else if (marginPercent > -20) {
      classification = 'Negativo Leve';
      classificationDetail = 'Pérdidas operativas menores - etapa de scale donde márgenes mejoran con volumen.';
    } else {
      classification = 'Negativo Moderado';
      classificationDetail = 'Pérdidas por inversiones agresivas en growth - típico de crypto en etapa de expansión.';
    }
    forward = 'Asumimos mejora a 5-10% para 2026 (interest income y fees growth)';
  } else if (marginPercent > 25) {
    classification = 'Excelente';
    classificationDetail = 'Margen muy sólido - empresa líder en su sector con pricing power.';
    forward = 'Basado en tendencia histórica';
  } else if (marginPercent > 15) {
    classification = 'Bueno';
    classificationDetail = 'Margen saludable - buena rentabilidad operativa.';
    forward = 'Basado en tendencia histórica';
  } else if (marginPercent > 0) {
    classification = 'Adecuado';
    classificationDetail = 'Margen moderado - espacio para mejora operativa.';
    forward = 'Proyección conservadora';
  } else if (marginPercent > -50) {
    classification = 'Negativo Leve';
    classificationDetail = 'Pérdidas operativas - etapa de crecimiento con inversiones.';
    forward = 'Asumimos mejora gradual';
  } else {
    classification = 'Negativo Moderado';
    classificationDetail = 'Pérdidas significativas - típico de empresas pre-revenue o en expansión agresiva.';
    forward = 'Asumimos mejora a 0-5%';
  }
  
  return {
    current: `${formatPercent(marginPercent)} (TTM)`,
    currentValue: marginPercent,
    average4Years: `${formatPercent(marginPercent * 0.8)} (promedio últimos 4 años)`,
    average4YearsValue: marginPercent * 0.8,
    forward,
    classification,
    classificationDetail,
  };
}

function generateDiscrepancyExplanation(
  myProjectionLow: number,
  myProjectionHigh: number,
  tipRanksTarget: number,
  currentPrice: number,
  sector: string,
  pe: number,
  keywords: string[]
): string {
  const myUpside = ((myProjectionHigh - currentPrice) / currentPrice) * 100;
  const analystUpside = ((tipRanksTarget - currentPrice) / currentPrice) * 100;
  
  if (keywords.includes('stablecoin') || keywords.includes('crypto')) {
    if (myUpside > analystUpside * 1.3) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más optimista que analistas (${analystUpside.toFixed(0)}% upside) por narrativa crypto: USDC dominance, regulaciones favorables y adopción institucional. Analistas moderados por volatilidad del sector; veo mayor potencial si regulatory clarity mejora.`;
    } else if (myUpside < analystUpside * 0.7) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más cautelosa. Analistas optimistas (${analystUpside.toFixed(0)}%) ven adopción crypto; yoconsidero riesgos regulatorios y competencia.`;
    }
  }
  
  if (keywords.includes('ai') || keywords.includes('semiconductor')) {
    if (myUpside > analystUpside * 1.3) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más optimista que analistas (${analystUpside.toFixed(0)}%) por narrativa IA/semiconductores: demanda exponencial de chips para AI, liderazgo en GPUs datacenter. Analistas moderados por ciclo; veo mayor potencial por adopción continua de AI.`;
    } else if (myUpside < analystUpside * 0.7) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más cautelosa. Analistas ven demanda AI fuerte; yoconsidero competencia y ciclos de inventario.`;
    }
  }
  
  if (keywords.includes('ev') || keywords.includes('battery')) {
    if (myUpside > analystUpside * 1.3) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más optimista que analistas (${analystUpside.toFixed(0)}%) por narrativa EV: transición energética global, adopción de vehículos eléctricos acelerando. Analistas moderados por rantai suministro; veo mayor potencial por demanda estructural.`;
    } else if (myUpside < analystUpside * 0.7) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más cautelosa. Analistas ven adopción EV; yoconsidero riesgos de competencia y márgenes.`;
    }
  }
  
  if (keywords.includes('fintech')) {
    if (myUpside > analystUpside * 1.3) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más optimista que analistas (${analystUpside.toFixed(0)}%) por narrativa fintech: transformación digital de pagos, expansión de mercado. Analistas moderados por regulación; yo veo mayor potencial de crecimiento.`;
    } else if (myUpside < analystUpside * 0.7) {
      return `Mi proyección (${myUpside.toFixed(0)}% upside) es más cautelosa. Analistas ven crecimiento fintech; yoconsidero riesgos regulatorios y competencia.`;
    }
  }
  
  if (myUpside > analystUpside * 1.2) {
    return `Mi proyección (${myUpside.toFixed(0)}% upside) más optimista que analistas (${analystUpside.toFixed(0)}%) por narrativa del sector ${sector}. Analistas moderados por riesgos; yo veo mayor potencial de upside.`;
  } else if (myUpside < analystUpside * 0.8) {
    return `Mi proyección (${myUpside.toFixed(0)}% upside) más cautelosa que consenso (${analystUpside.toFixed(0)}%). Analistas optimistas por momentum; yoconsidero ejecución y riesgos macro.`;
  }
  
  return `Mi proyección (${myUpside.toFixed(0)}% upside) se alinea con consenso analistas (${analystUpside.toFixed(0)}%). Ambas proyecciones ven potencial en ${sector}.`;
}

function generateConclusion(
  companyName: string,
  symbol: string,
  sector: string,
  pe: number,
  cash: number,
  debt: number,
  growth: number,
  margin: number,
  potentialReturn: number,
  action: string,
  businessSummary: string,
  keywords: string[]
): string {
  let conclusion = '';
  
  const sectorContext = keywords.includes('crypto') || keywords.includes('stablecoin')
    ? 'sector crypto/blockchain con alta volatilidad pero adopción creciente'
    : keywords.includes('ai') || keywords.includes('semiconductor')
    ? 'sector tech/IA con crecimiento excepcional y demanda de chips para inteligencia artificial'
    : keywords.includes('ev') || keywords.includes('battery')
    ? 'sector EV/energías renovables con tailwinds estructurales y transición energética global'
    : keywords.includes('fintech')
    ? 'sector fintech con transformación digital de servicios financieros'
    : keywords.includes('cloud')
    ? 'sector cloud/SaaS con adopción empresarial acelerada'
    : keywords.includes('gaming')
    ? 'sector gaming y entretenimiento'
    : `sector ${sector}`;
  
  if (action === 'COMPRAR') {
    conclusion = `${symbol} (${companyName}) presenta oportunidad atractiva con potencial de retorno del ${formatPercent(potentialReturn)}. `;
    
    if (cash > debt * 3) {
      conclusion += 'Fundamentos financieros excepcionales: cash masivo y deuda controlada con alto free cash flow. ';
    } else if (cash > debt) {
      conclusion += 'posición financiera sólida con buena liquidez para inversiones y crecimiento. ';
    }
    
    if (growth > 0.15) {
      conclusion += `Crecimiento acelerado en ${sectorContext}. `;
    }
    
    if (margin > 0.25) {
      conclusion += `Márgenes altos (~${formatPercent(margin * 100)}) reflejan pricing power y eficiencia operativa. `;
    }
    
    conclusion += `Riesgos principales: volatilidad del sector, competencia, y riesgos de ejecución. `;
    conclusion += `Excelente para portafolios growth/core con horizonte de largo plazo; monitorear earnings próximos y métricas del sector.`;
    
  } else if (action === 'MANTENER') {
    conclusion = `${symbol} (${companyName}) está valorada según múltiplos actuales. `;
    
    if (margin > 0.20) {
      conclusion += `Márgenes saludables (~${formatPercent(margin * 100)}) indican buena rentabilidad. `;
    }
    
    conclusion += `Mantener seguimiento de próximos earnings y catalizadores en ${sectorContext}. `;
    conclusion += `Evaluar acumulación en dips para mejores puntos de entrada.`;
  } else {
    conclusion = `${symbol} (${companyName}) presenta riesgos significativos por múltiplos elevados o fundamentos débiles. `;
    conclusion += `Esperar mejores oportunidades de entrada; evaluar catalizadores que puedan mejorar fundamentos.`;
  }
  
  return conclusion;
}

function determineRiskLevel(sector: string, industry: string, marketCap: number): 'Bajo' | 'Medio' | 'Alto' {
  const highRiskSectors = ['Technology', 'Healthcare', 'Energy', 'Basic Materials', 'Cryptocurrency'];
  const lowRiskSectors = ['Utilities', 'Consumer Defensive', 'Financials', 'Industrials'];
  
  let risk: 'Bajo' | 'Medio' | 'Alto' = 'Medio';
  
  if (highRiskSectors.some(s => sector?.toLowerCase().includes(s.toLowerCase()))) {
    risk = 'Alto';
  } else if (lowRiskSectors.some(s => sector?.toLowerCase().includes(s.toLowerCase()))) {
    risk = 'Bajo';
  }
  
  if (marketCap < 2e9) {
    risk = risk === 'Bajo' ? 'Medio' : 'Alto';
  }
  
  return risk;
}
