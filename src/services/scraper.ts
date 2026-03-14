const SCRAPER_API = '/api/scraper';

export interface ScrapedData {
  yahoo?: {
    companyName: string;
    shortDescription: string;
    sector: string;
    industry: string;
    employees: number;
    website: string;
    businessSummary: string;
    executiveName: string;
    executiveTitle: string;
  };
  macrotrends?: {
    profitMargins: { year: number; value: number }[];
    peRatios: { year: number; value: number }[];
    revenueGrowth: { year: number; value: number }[];
  };
  tipranks?: {
    priceTarget: number;
    consensus: string;
    numberOfAnalysts: number;
    buyCount: number;
    holdCount: number;
    sellCount: number;
    upside: number;
    highTarget: number;
    lowTarget: number;
  };
  marketbeat?: {
    priceTarget: number;
    highTarget: number;
    lowTarget: number;
    numberOfAnalysts: number;
    buyRatings: number;
    holdRatings: number;
    sellRatings: number;
  };
  gurufocus?: {
    peRatio: number;
    pegRatio: number;
    profitMargin: number;
    operatingMargin: number;
    returnOnEquity: number;
    returnOnAssets: number;
    debtToEquity: number;
    priceToBook: number;
    priceToSales: number;
    dividendYield: number;
    grahamNumber: number;
  };
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function scrapeYahooFinance(ticker: string): Promise<ScrapedData['yahoo'] | null> {
  try {
    const res = await fetch(`${SCRAPER_API}?ticker=${ticker}&source=yahoo`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (error) {
    console.error('Yahoo scrape error:', error);
  }
  return null;
}

export async function scrapeMacrotrends(ticker: string): Promise<ScrapedData['macrotrends'] | null> {
  try {
    const res = await fetch(`${SCRAPER_API}?ticker=${ticker}&source=macrotrends`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (error) {
    console.error('Macrotrends scrape error:', error);
  }
  return null;
}

export async function scrapeTipRanks(ticker: string): Promise<ScrapedData['tipranks'] | null> {
  try {
    const res = await fetch(`${SCRAPER_API}?ticker=${ticker}&source=tipranks`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (error) {
    console.error('TipRanks scrape error:', error);
  }
  return null;
}

export async function scrapeMarketBeat(ticker: string): Promise<ScrapedData['marketbeat'] | null> {
  try {
    const res = await fetch(`${SCRAPER_API}?ticker=${ticker}&source=marketbeat`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (error) {
    console.error('MarketBeat scrape error:', error);
  }
  return null;
}

export async function scrapeGuruFocus(ticker: string): Promise<ScrapedData['gurufocus'] | null> {
  try {
    const res = await fetch(`${SCRAPER_API}?ticker=${ticker}&source=gurufocus`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (error) {
    console.error('GuruFocus scrape error:', error);
  }
  return null;
}

export async function scrapeAllSources(ticker: string): Promise<ScrapedData> {
  const [yahoo, macrotrends, tipranks, marketbeat, gurufocus] = await Promise.allSettled([
    scrapeYahooFinance(ticker),
    scrapeMacrotrends(ticker),
    scrapeTipRanks(ticker),
    scrapeMarketBeat(ticker),
    scrapeGuruFocus(ticker),
  ]);

  return {
    yahoo: yahoo.status === 'fulfilled' ? yahoo.value ?? undefined : undefined,
    macrotrends: macrotrends.status === 'fulfilled' ? macrotrends.value ?? undefined : undefined,
    tipranks: tipranks.status === 'fulfilled' ? tipranks.value ?? undefined : undefined,
    marketbeat: marketbeat.status === 'fulfilled' ? marketbeat.value ?? undefined : undefined,
    gurufocus: gurufocus.status === 'fulfilled' ? gurufocus.value ?? undefined : undefined,
  };
}

export function classifyGrowthRate(growthPercent: number): { label: string; description: string } {
  if (growthPercent >= 100) {
    return { label: 'Explosivo', description: 'Crecimiento excepcional superior al 100%' };
  } else if (growthPercent >= 50) {
    return { label: 'Muy Fuerte', description: 'Crecimiento muy sólido entre 50-100%' };
  } else if (growthPercent >= 15) {
    return { label: 'Fuerte', description: 'Crecimiento sólido entre 15-50%' };
  } else if (growthPercent >= 5) {
    return { label: 'Moderado', description: 'Crecimiento moderado entre 5-15%' };
  } else if (growthPercent >= 0) {
    return { label: 'Bajo', description: 'Crecimiento bajo pero positivo' };
  } else {
    return { label: 'Negativo', description: 'Contracción en ventas' };
  }
}

export function classifyProfitMargin(marginPercent: number): { label: string; description: string } {
  if (marginPercent >= 25) {
    return { label: 'Excelente', description: 'Margen muy sólido superior al 25%' };
  } else if (marginPercent >= 15) {
    return { label: 'Bueno', description: 'Margen saludable entre 15-25%' };
  } else if (marginPercent >= 5) {
    return { label: 'Adecuado', description: 'Margen moderado entre 5-15%' };
  } else if (marginPercent >= 0) {
    return { label: 'Bajo', description: 'Margen bajo entre 0-5%' };
  } else if (marginPercent >= -50) {
    return { label: 'Negativo Leve', description: 'Pérdidas menores al 50%' };
  } else if (marginPercent >= -200) {
    return { label: 'Negativo Moderado', description: 'Pérdidas significativas entre 50-200%' };
  } else {
    return { label: 'Negativo Alto', description: 'Pérdidas muy elevadas - etapa de desarrollo' };
  }
}

export function classifyPERatio(pe: number): { label: string; description: string } {
  if (pe < 0) {
    return { label: 'Negativo', description: 'Empresa sin ganancias - típico de etapas tempranas o startups' };
  } else if (pe < 15) {
    return { label: 'Conservador', description: 'PE bajo - empresa establecida y estable' };
  } else if (pe < 25) {
    return { label: 'Justo', description: 'PE razonable para empresa en crecimiento' };
  } else if (pe < 40) {
    return { label: 'Crecimiento Medio', description: 'PE elevado - expectativas de crecimiento' };
  } else if (pe < 60) {
    return { label: 'Alto Crecimiento', description: 'PE muy alto - especulativo' };
  } else {
    return { label: 'Muy Alto', description: 'PE extremo - alto riesgo y expectativas muy elevadas' };
  }
}

export function classifyCashLevel(cashMillions: number): { label: string; description: string } {
  if (cashMillions >= 10000) {
    return { label: 'Excelente', description: 'Cash excepcional - empresa muy sólida financieramente' };
  } else if (cashMillions >= 1000) {
    return { label: 'Muy Bueno', description: 'Cash muy fuerte - ample liquidez' };
  } else if (cashMillions >= 500) {
    return { label: 'Bueno', description: 'Cash sólido - buena posición financiera' };
  } else if (cashMillions >= 100) {
    return { label: 'Adecuado', description: 'Cash moderado - operación sostenible' };
  } else if (cashMillions >= 50) {
    return { label: 'Limitado', description: 'Cash limitado -需要注意现金流' };
  } else {
    return { label: 'Crítico', description: 'Cash insuficiente - riesgo de insolvencia' };
  }
}

export function classifyDebtLevel(debtToEquity: number): { label: string; description: string } {
  if (debtToEquity <= 0.1) {
    return { label: 'Excelente', description: 'Casi sin deuda - balance sheet limpio' };
  } else if (debtToEquity <= 0.3) {
    return { label: 'Bueno', description: 'Deuda baja - apalancamiento saludable' };
  } else if (debtToEquity <= 0.6) {
    return { label: 'Adecuado', description: 'Deuda moderada - apalancamiento razonable' };
  } else if (debtToEquity <= 1.0) {
    return { label: 'Alto', description: 'Deuda elevada - riesgo incrementado' };
  } else {
    return { label: 'Muy Alto', description: 'Deuda excesiva - riesgo financiero significativo' };
  }
}

export function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
