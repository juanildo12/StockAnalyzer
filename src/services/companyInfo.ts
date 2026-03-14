export interface CompanyInfo {
  name: string;
  symbol: string;
  description: string;
  sector: string;
  industry: string;
  website: string;
  employees: number;
  businessSummary: string;
  executiveName: string;
  executiveTitle: string;
  riskLevel: 'Bajo' | 'Medio' | 'Alto';
  marketCap: number;
  price: number;
}

interface YahooResponse {
  quote: {
    shortName?: string;
    longName?: string;
    symbol: string;
    sector?: string;
    industry?: string;
    website?: string;
    fullTimeEmployees?: number;
    businessSummary?: string;
    companyOfficers?: { name: string; title: string }[];
    marketCap?: number;
    regularMarketPrice?: number;
  };
  summary?: {
    sector?: string;
    industry?: string;
  };
}

export async function getCompanyInfo(ticker: string, quote: any): Promise<CompanyInfo> {
  const symbol = ticker.toUpperCase();
  
  const name = quote?.shortName || quote?.longName || symbol;
  const sector = quote?.sector || 'Unknown';
  const industry = quote?.industry || 'Unknown';
  const website = quote?.website || '';
  const employees = quote?.fullTimeEmployees || 0;
  const businessSummary = quote?.businessSummary || '';
  const marketCap = quote?.marketCap || 0;
  const price = quote?.regularMarketPrice || 0;
  
  const executiveName = quote?.companyOfficers?.[0]?.name || '';
  const executiveTitle = quote?.companyOfficers?.[0]?.title || '';
  
  const riskLevel = determineRiskLevel(sector, industry, marketCap, price);
  
  return {
    name,
    symbol,
    description: generateDescription(name, sector, industry, businessSummary),
    sector,
    industry,
    website,
    employees,
    businessSummary,
    executiveName,
    executiveTitle,
    riskLevel,
    marketCap,
    price,
  };
}

function determineRiskLevel(
  sector: string,
  industry: string,
  marketCap: number,
  price: number
): 'Bajo' | 'Medio' | 'Alto' {
  const sectorRisks: Record<string, 'Bajo' | 'Medio' | 'Alto'> = {
    'Technology': 'Medio',
    'Healthcare': 'Medio',
    'Financial Services': 'Bajo',
    'Consumer Cyclical': 'Medio',
    'Communication Services': 'Medio',
    'Industrials': 'Bajo',
    'Consumer Defensive': 'Bajo',
    'Energy': 'Alto',
    'Basic Materials': 'Alto',
    'Real Estate': 'Medio',
    'Utilities': 'Bajo',
    'Financials': 'Medio',
    'Information Technology': 'Medio',
  };
  
  let baseRisk = sectorRisks[sector] || 'Medio';
  
  if (marketCap < 2e9) {
    if (baseRisk === 'Bajo') baseRisk = 'Medio';
    if (baseRisk === 'Medio') baseRisk = 'Alto';
  }
  
  const volatileSectors = ['Energy', 'Basic Materials', 'Technology', 'Healthcare'];
  if (volatileSectors.includes(sector) && marketCap < 10e9) {
    baseRisk = 'Alto';
  }
  
  return baseRisk;
}

function generateDescription(
  name: string,
  sector: string,
  industry: string,
  businessSummary: string
): string {
  if (businessSummary && businessSummary.length > 50) {
    return businessSummary;
  }
  
  const sectorDescriptions: Record<string, string> = {
    'Technology': 'empresa de tecnología',
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
  
  const sectorDesc = sectorDescriptions[sector] || 'empresa';
  
  return `${name} es una ${sectorDesc} en el sector ${industry || sector}.`;
}

export function getSectorDescription(sector: string): string {
  const descriptions: Record<string, string> = {
    'Technology': 'Sector de alta volatilidad con rápido crecimiento pero riesgo elevado',
    'Healthcare': 'Sector defensivo con innovación constante y regulación significativa',
    'Financial Services': 'Sector regulado con sensibilidad a tasas de interés',
    'Consumer Cyclical': 'Sector sensible al ciclo económico y consumidor',
    'Communication Services': 'Sector de crecimiento con competencia intensa',
    'Industrials': 'Sector cíclico vinculado a infraestructura y economía global',
    'Consumer Defensive': 'Sector defensivo estable con demanda constante',
    'Energy': 'Sector altamente volátil expuesto a precios de commodities',
    'Basic Materials': 'Sector cíclico sensible a economía global y commodities',
    'Real Estate': 'Sector con exposición a tasas de interés y ciclos inmobiliarios',
    'Utilities': 'Sector defensivo con ingresos estables y regulación',
    'Financials': 'Sector amplio con exposición a condiciones económicas',
    'Information Technology': 'Sector de innovación con alta competencia',
  };
  
  return descriptions[sector] || 'Sector con características específicas de la industria';
}
