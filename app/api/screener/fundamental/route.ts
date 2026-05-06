import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

const SP500_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'V',
  'JPM', 'UNH', 'XOM', 'JNJ', 'MA', 'PG', 'HD', 'CVX', 'MRK', 'PFE',
  'ABBV', 'KO', 'PEP', 'COST', 'AVGO', 'TMO', 'CSCO', 'BAC', 'ACN', 'MCD',
  'ABT', 'CRM', 'LLY', 'ADBE', 'LIN', 'DHR', 'DIS', 'TXN', 'VZ', 'NEE',
  'AMD', 'NFLX', 'PM', 'INTC', 'WMT', 'CMCSA', 'QCOM', 'NKE', 'BMY', 'AMGN',
  'RTX', 'UPS', 'LOW', 'HON', 'UNP', 'ORCL', 'SBUX', 'INTU', 'CAT', 'BA',
  'GS', 'GE', 'BLK', 'ISRG', 'AMAT', 'NOW', 'T', 'MDT', 'PGR', 'SPGI',
  'LMT', 'GILD', 'AXP', 'CVS', 'BKNG', 'ADI', 'SYK', 'MMM', 'TMUS', 'DE',
  'MDLZ', 'ADP', 'ZTS', 'CI', 'TJX', 'VRTX', 'MMC', 'C', 'SCHW', 'CB',
  'PLD', 'MO', 'SO', 'USB', 'DUK', 'BDX', 'CL', 'EOG', 'SLB', 'ITW',
  'REGN', 'NOC', 'WM', 'COP', 'PYPL', 'EQIX', 'PNC', 'NSC', 'MCO', 'FIS',
  'AON', 'HUM', 'FCX', 'ATVI', 'CCI', 'APD', 'SHW', 'ECL', 'ICE', 'GM',
  'FISV', 'D', 'CSX', 'GD', 'EMR', 'F', 'PSX', 'WELL', 'KLAC', 'TGT',
  'MU', 'EL', 'HCA', 'MSI', 'MAR', 'PSA', 'MPC', 'NXPI', 'AEP', 'VLO',
  'DXCM', 'EW', 'SNPS', 'CDNS', 'CMG', 'ROP', 'CARR', 'ORLY', 'PAYX', 'AZO',
  'ROST', 'KMB', 'CTAS', 'PCAR', 'CTSH', 'IDXX', 'MCHP', 'MSCI', 'A', 'ODFL',
  'FAST', 'VRSK', 'KHC', 'LRCX', 'EA', 'EXC', 'XEL', 'WBA', 'BIIB', 'YUM',
  'IQV', 'GPN', 'ANSS', 'CHTR', 'ALL', 'AFL', 'O', 'PRU', 'DLTR', 'HLT',
  'STZ', 'ILMN', 'FTNT', 'CTVA', 'HPQ', 'DOW', 'KEYS', 'GIS', 'WEC', 'DD',
  'EBAY', 'RSG', 'WLTW', 'SBAC', 'AVB', 'CMI', 'GLW', 'ALGN', 'DLR', 'ENPH',
  'SIVB', 'APTV', 'CDW', 'TTWO', 'ZBRA', 'TDG', 'WST', 'TTD', 'CPRT', 'TROW',
  'WBA', 'PPG', 'ES', 'RMD', 'ARE', 'DHI', 'WDC', 'TSCO', 'EXR', 'KMI',
  'DTE', 'MPWR', 'AWK', 'ETR', 'FRC', 'MTB', 'NTRS', 'RF', 'CFG', 'HBAN',
  'FITB', 'KEY', 'CMA', 'ZION', 'SIVB', 'PFG', 'L', 'AKAM', 'JBHT', 'SYY',
  'LEN', 'PH', 'PAYC', 'CINF', 'WAT', 'NTAP', 'MKTX', 'UAL', 'DISH', 'NCLH',
  'AAL', 'CCL', 'LUV', 'DAL', 'ALK', 'JNPR', 'HPE', 'NTAP', 'STX', 'WDC',
  'SWKS', 'QRVO', 'MPWR', 'CRWD', 'ZS', 'NET', 'DDOG', 'OKTA', 'S', 'SNOW',
  'PLTR', 'U', 'RBLX', 'DASH', 'ABNB', 'LYFT', 'UBER', 'DIDI', 'GRAB', 'CPNG',
  'SQ', 'AFRM', 'SOFI', 'LC', 'UPST', 'HOOD', 'COIN', 'MARA', 'RIOT', 'CLSK',
  'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'LAZR', 'VLDR', 'LIDR', 'OS', 'GOEV',
  'RACE', 'FERR', 'HOG', 'HAR', 'APTV', 'BWA', 'LEA', 'VC', 'ALV', 'ADNT',
  'DLPH', 'GNTX', 'GT', 'MOD', 'SYF', 'DFS', 'COF', 'ALLY', 'ALLY', 'GM',
  'TFC', 'FITB', 'CBOE', 'MKTX', 'MSCI', 'SPGI', 'MCO', 'NDAQ', 'ICE', 'CME',
  'CME', 'CBOE', 'ICE', 'NDAQ', 'MSCI', 'MKTX', 'SPGI', 'MCO', 'CME', 'ICE',
];

const GROWTH_MID_CAP = [
  'ARM', 'SMCI', 'CEG', 'GEV', 'TPG', 'KKR', 'BX', 'APO', 'CG', 'OWL',
  'ARES', 'SLRC', 'HTGC', 'PSEC', 'MAIN', 'GAIN', 'TSLX', 'FSK', 'CSWC', 'GBDC',
  'APP', 'DKNG', 'PENN', 'MGM', 'WYNN', 'LVS', 'CZR', 'RRR', 'RSI', 'GENI',
  'RBLX', 'U', 'PATH', 'DUOL', 'BMBL', 'MTCH', 'IAC', 'ANGI', 'YELP', 'TRIP',
  'FOUR', 'AFRM', 'UPST', 'OPEN', 'RDFN', 'EXPI', 'COMP', 'RMAX', 'HOUS', 'JLL',
  'MRVL', 'ON', 'SWKS', 'QRVO', 'ENTG', 'TER', 'COHR', 'LITE', 'II-VI', 'MTSI',
  'POWI', 'ALGM', 'SITM', 'DIOD', 'MXL', 'OCLS', 'AMBA', 'SLAB', 'CRUS', 'RMBS',
  'FORM', 'PLAB', 'ACLS', 'UCTT', 'ICHR', 'CAMT', 'VSH', 'NPTN', 'LSCC', 'CEVA',
  'HIMS', 'CVNA', 'VROOM', 'CARG', 'KMX', 'LAD', 'ABG', 'GPI', 'SAH', 'AN',
  'PAG', 'RUSHA', 'RUSHB', 'TCS', 'BGFV', 'BBWI', 'GES', 'CHRW', 'EXPD', 'XPO',
  'JBHT', 'KNX', 'ODFL', 'SAIA', 'ARCB', 'WERN', 'HTLD', 'MRTN', 'SNDR', 'TFII',
  'MATX', 'SBLK', 'SBOW', 'EGLE', 'GOGL', 'SBLK', 'DAC', 'INSW', 'NMM', 'PXS',
  'ZIM', 'CMRE', 'EDRY', 'CTRM', 'SINO', 'SHIP', 'TOP', 'MATX', 'KEX', 'GATX',
  'HUBG', 'RXO', 'ECHO', 'LSTR', 'MRTN', 'CVLG', 'GFF', 'GNE', 'AY', 'CWEN',
  'BE', 'FCEL', 'BLDP', 'PLUG', 'ENPH', 'SEDG', 'RUN', 'NOVA', 'ARRY', 'SHLS',
  'CSIQ', 'JKS', 'SOL', 'DQ', 'SPWR', 'MAXN', 'VSLR', 'AMRC', 'CLNE', 'GEVO',
  'RENEW', 'CWEN', 'PEGI', 'HASI', 'NEP', 'NYLD', 'CAFD', 'TERP', 'BEP', 'BEPC',
  'BROS', 'DNUT', 'JAMF', 'CART', 'RDDT', 'GTLB', 'ESTC', 'CFLT', 'MNDY', 'ALRM',
  'SMAR', 'BL', 'NCNO', 'BIGC', 'PD', 'GDRX', 'HIMS', 'DOCS', 'VERV', 'DOCS',
  'TDOC', 'ONEM', 'VEEV', 'CORT', 'DXCM', 'ISRG', 'INTV', 'HOLX', 'PODD', 'ALGN',
  'NVST', 'GMED', 'LMAT', 'OFIX', 'TMDX', 'AXNX', 'ICUI', 'CNMD', 'NARI', 'ATRC',
  'IRTC', 'LIVN', 'NUVA', 'OSIS', 'PDCO', 'QDEL', 'TMDX', 'UFPT', 'VREX', 'XRAY',
  'ZYXI', 'ARHS', 'PRCT', 'OMCL', 'NVCR', 'NEOG', 'MOH', 'CNC', 'ELV', 'OSCR',
  'ACHC', 'EHC', 'THC', 'UHS', 'CYH', 'LPNT', 'AMED', 'ENSG', 'ADUS', 'CHCO',
  'PNTG', 'SGRY', 'GH', 'OPCH', 'AHCO', 'CCRN', 'AMED', 'LHC', 'PDCO', 'USPH',
  'HWC', 'CNOB', 'PFBC', 'CCSI', 'CVGW', 'IMKTA', 'NGVC', 'SFM', 'TCS', 'VLGEA',
  'CHEF', 'PBJ', 'JJSF', 'LANC', 'SENEA', 'SENEB', 'HAIN', 'BGS', 'POST', 'JJSF',
  'MDLZ', 'KDP', 'MNST', 'CELH', 'COKE', 'FIZZ', 'ZVIA', 'REED', 'KDP', 'SAM',
  'BREW', 'STZ', 'DEO', 'TAP', 'BUD', 'ABEV', 'CCU', 'FMX', 'BF-B', 'BF-A',
];

const SCORING_MODES = [
  { id: 'value', name: 'Value', icon: '💎', focus: 'P/E bajo, dividendos altos, P/B atractivo' },
  { id: 'growth', name: 'Growth', icon: '🚀', focus: 'Crecimiento de ingresos, earnings, PEG bajo' },
  { id: 'quality', name: 'Quality', icon: '🏆', focus: 'ROE alto, márgenes sólidos, deuda baja' },
  { id: 'momentum', name: 'Momentum', icon: '⚡', focus: 'Cerca del máximo 52 semanas, tendencia fuerte' },
  { id: 'balanced', name: 'Balanceado', icon: '⚖️', focus: 'Mix equilibrado de todos los criterios' },
];

function getDailyMode(date: Date) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return SCORING_MODES[seed % SCORING_MODES.length];
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dateToSeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

interface StockFundamental {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  pbRatio: number;
  psRatio: number;
  dividendYield: number;
  epsTrailing: number;
  epsForward: number;
  peForward: number;
  profitMargin: number;
  roe: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  revenueGrowth: number;
  earningsGrowth: number;
  '52WeekHigh': number;
  '52WeekLow': number;
  priceToFairValue: number;
  recommendation: string;
  score: number;
  reasons: string[];
}

function calculateScore(stock: any, mode: string): number {
  let score = 50;

  if (mode === 'value') {
    if (stock.peRatio > 0 && stock.peRatio < 12) score += 25;
    else if (stock.peRatio > 0 && stock.peRatio < 18) score += 15;
    else if (stock.peRatio > 0 && stock.peRatio < 25) score += 5;
    else if (stock.peRatio > 0 && stock.peRatio > 40) score -= 15;

    if (stock.pegRatio > 0 && stock.pegRatio < 1) score += 15;
    else if (stock.pegRatio > 0 && stock.pegRatio < 2) score += 5;

    if (stock.dividendYield > 0.04) score += 20;
    else if (stock.dividendYield > 0.025) score += 12;
    else if (stock.dividendYield > 0.01) score += 5;

    if (stock.profitMargin > 0.15) score += 8;
    else if (stock.profitMargin > 0.1) score += 4;
    else if (stock.profitMargin < 0) score -= 10;

    if (stock.roe > 0.15) score += 8;
    else if (stock.roe > 0.1) score += 4;

    if (stock.debtToEquity > 0 && stock.debtToEquity < 0.5) score += 10;
    else if (stock.debtToEquity > 0 && stock.debtToEquity < 1) score += 5;
    else if (stock.debtToEquity > 2) score -= 10;

    if (stock.revenueGrowth > 0.1) score += 5;
    else if (stock.revenueGrowth < 0) score -= 8;

    const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
    if (priceDiff < -30) score += 12;
    else if (priceDiff < -20) score += 8;
    else if (priceDiff < -10) score += 4;
    else if (priceDiff > -5) score -= 5;

  } else if (mode === 'growth') {
    if (stock.revenueGrowth > 0.25) score += 25;
    else if (stock.revenueGrowth > 0.15) score += 15;
    else if (stock.revenueGrowth > 0.05) score += 5;
    else if (stock.revenueGrowth < 0) score -= 15;

    if (stock.earningsGrowth > 0.25) score += 20;
    else if (stock.earningsGrowth > 0.15) score += 12;
    else if (stock.earningsGrowth > 0.05) score += 5;
    else if (stock.earningsGrowth < 0) score -= 10;

    if (stock.pegRatio > 0 && stock.pegRatio < 0.8) score += 18;
    else if (stock.pegRatio > 0 && stock.pegRatio < 1.5) score += 10;
    else if (stock.pegRatio > 2.5) score -= 10;

    if (stock.profitMargin > 0.15) score += 8;
    else if (stock.profitMargin > 0.1) score += 4;

    if (stock.roe > 0.15) score += 8;

    if (stock.debtToEquity > 0 && stock.debtToEquity < 1) score += 5;
    else if (stock.debtToEquity > 2) score -= 8;

    const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
    if (priceDiff > -15) score += 8;
    else if (priceDiff < -30) score -= 5;

    if (stock.dividendYield > 0.02) score += 3;

  } else if (mode === 'quality') {
    if (stock.roe > 0.25) score += 25;
    else if (stock.roe > 0.2) score += 18;
    else if (stock.roe > 0.15) score += 10;
    else if (stock.roe < 0) score -= 15;

    if (stock.profitMargin > 0.25) score += 20;
    else if (stock.profitMargin > 0.2) score += 15;
    else if (stock.profitMargin > 0.1) score += 8;
    else if (stock.profitMargin < 0) score -= 15;

    if (stock.debtToEquity > 0 && stock.debtToEquity < 0.3) score += 15;
    else if (stock.debtToEquity > 0 && stock.debtToEquity < 0.5) score += 10;
    else if (stock.debtToEquity > 0 && stock.debtToEquity < 1) score += 5;
    else if (stock.debtToEquity > 2) score -= 15;

    if (stock.currentRatio > 1.5) score += 8;
    else if (stock.currentRatio < 1) score -= 5;

    if (stock.revenueGrowth > 0.1) score += 8;
    else if (stock.revenueGrowth > 0) score += 4;
    else if (stock.revenueGrowth < 0) score -= 8;

    if (stock.earningsGrowth > 0.1) score += 8;
    else if (stock.earningsGrowth < 0) score -= 5;

    if (stock.peRatio > 0 && stock.peRatio < 25) score += 6;
    else if (stock.peRatio > 40) score -= 8;

    const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
    if (priceDiff > -20) score += 6;

    if (stock.dividendYield > 0.02) score += 5;

  } else if (mode === 'momentum') {
    const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
    if (priceDiff > -5) score += 30;
    else if (priceDiff > -10) score += 22;
    else if (priceDiff > -15) score += 15;
    else if (priceDiff > -25) score += 5;
    else if (priceDiff < -40) score -= 15;

    if (stock.revenueGrowth > 0.15) score += 12;
    else if (stock.revenueGrowth > 0.05) score += 6;
    else if (stock.revenueGrowth < 0) score -= 8;

    if (stock.earningsGrowth > 0.15) score += 10;
    else if (stock.earningsGrowth > 0) score += 5;
    else if (stock.earningsGrowth < 0) score -= 8;

    if (stock.peRatio > 0 && stock.peRatio < 30) score += 8;
    else if (stock.peRatio > 50) score -= 10;

    if (stock.profitMargin > 0.1) score += 8;
    else if (stock.profitMargin > 0) score += 4;

    if (stock.roe > 0.15) score += 8;

    if (stock.debtToEquity > 0 && stock.debtToEquity < 1) score += 5;

    if (stock.changePercent > 3) score += 12;
    else if (stock.changePercent > 1) score += 6;
    else if (stock.changePercent > 0) score += 2;
    else if (stock.changePercent < -3) score -= 8;

    if (stock.dividendYield > 0.01) score += 3;

  } else {
    if (stock.peRatio > 0 && stock.peRatio < 15) score += 15;
    else if (stock.peRatio > 0 && stock.peRatio < 20) score += 10;
    else if (stock.peRatio > 0 && stock.peRatio < 25) score += 5;
    else if (stock.peRatio > 0 && stock.peRatio > 40) score -= 10;

    if (stock.pegRatio > 0 && stock.pegRatio < 1) score += 15;
    else if (stock.pegRatio > 0 && stock.pegRatio < 1.5) score += 10;
    else if (stock.pegRatio > 0 && stock.pegRatio > 2.5) score -= 10;

    if (stock.dividendYield > 0.03) score += 10;
    else if (stock.dividendYield > 0.02) score += 5;

    if (stock.profitMargin > 0.2) score += 10;
    else if (stock.profitMargin > 0.1) score += 5;
    else if (stock.profitMargin < 0) score -= 10;

    if (stock.roe > 0.2) score += 10;
    else if (stock.roe > 0.15) score += 5;
    else if (stock.roe < 0) score -= 10;

    if (stock.debtToEquity > 0 && stock.debtToEquity < 0.5) score += 10;
    else if (stock.debtToEquity > 0 && stock.debtToEquity < 1) score += 5;
    else if (stock.debtToEquity > 2) score -= 10;

    if (stock.revenueGrowth > 0.2) score += 10;
    else if (stock.revenueGrowth > 0.1) score += 5;
    else if (stock.revenueGrowth < 0) score -= 10;

    if (stock.earningsGrowth > 0.2) score += 10;
    else if (stock.earningsGrowth > 0.1) score += 5;
    else if (stock.earningsGrowth < 0) score -= 5;

    const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
    if (priceDiff > -10) score += 5;
    else if (priceDiff > -20) score += 10;
    else if (priceDiff > -30) score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

function getRecommendation(score: number): string {
  if (score >= 75) return 'excelente';
  if (score >= 60) return 'buena';
  if (score >= 40) return 'regular';
  return 'sobrevalorada';
}

function getReasons(stock: any, score: number, mode: string): string[] {
  const reasons: string[] = [];

  if (stock.peRatio > 0 && stock.peRatio < 20) {
    reasons.push(`P/E: ${stock.peRatio.toFixed(1)} - ${stock.peRatio < 15 ? 'muy bueno' : 'aceptable'}`);
  }
  if (stock.pegRatio > 0 && stock.pegRatio < 2) {
    reasons.push(`PEG: ${stock.pegRatio.toFixed(1)} - ${stock.pegRatio < 1 ? 'barato' : 'razonable'}`);
  }
  if (stock.dividendYield > 0.01) {
    reasons.push(`Dividendo: ${(stock.dividendYield * 100).toFixed(1)}%`);
  }
  if (stock.profitMargin > 0.2) {
    reasons.push(`Margen: ${(stock.profitMargin * 100).toFixed(0)}%`);
  }
  if (stock.roe > 0.2) {
    reasons.push(`ROE: ${(stock.roe * 100).toFixed(0)}%`);
  }
  if (stock.revenueGrowth > 0.15) {
    reasons.push(`Crecimiento: ${(stock.revenueGrowth * 100).toFixed(0)}%`);
  }
  if (stock.earningsGrowth > 0.15) {
    reasons.push(`Earnings: ${(stock.earningsGrowth * 100).toFixed(0)}%`);
  }
  if (stock.debtToEquity > 0 && stock.debtToEquity < 0.5) {
    reasons.push(`Deuda baja: ${stock.debtToEquity.toFixed(1)}`);
  }

  const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
  if (priceDiff > -10) {
    reasons.push(`Momentum: cerca del máximo 52s`);
  } else if (priceDiff < -30) {
    reasons.push(`Descuento: ${Math.abs(priceDiff).toFixed(0)}% bajo máximo 52s`);
  }

  if (mode === 'value' && stock.dividendYield > 0.02) {
    reasons.unshift(`Alto dividendo ${(stock.dividendYield * 100).toFixed(1)}%`);
  }
  if (mode === 'growth' && stock.revenueGrowth > 0.2) {
    reasons.unshift(`Crecimiento ingresos ${(stock.revenueGrowth * 100).toFixed(0)}%`);
  }
  if (mode === 'quality' && stock.roe > 0.2) {
    reasons.unshift(`ROE excepcional ${(stock.roe * 100).toFixed(0)}%`);
  }
  if (mode === 'momentum' && stock.changePercent > 2) {
    reasons.unshift(`Impulso hoy +${stock.changePercent.toFixed(1)}%`);
  }

  return reasons.slice(0, 6);
}

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const combinedUniverse = Array.from(new Set([...SP500_TICKERS, ...GROWTH_MID_CAP]));
    const dailySeed = dateToSeed(today);
    const shuffledUniverse = seededShuffle(combinedUniverse, dailySeed);
    const dailyStocks = shuffledUniverse.slice(0, 80);
    const dailyMode = getDailyMode(today);

    const results = await Promise.all(
      dailyStocks.map(async (sym) => {
        try {
          const quoteResult = await yf.quote(sym).catch(() => null);
          const quote = quoteResult as any;
          if (!quote || !quote.regularMarketPrice) return null;

          const stats = await yf.quoteSummary(sym, { modules: ['assetProfile', 'defaultKeyStatistics', 'financialData', 'earnings', 'price'] }).catch(() => null);

          const peRatio = quote.trailingPE || 0;
          const pegRatio = (stats?.defaultKeyStatistics as any)?.pegRatio || (stats?.defaultKeyStatistics as any)?.pegTrailingRatio || 0;
          const pbRatio = (stats?.defaultKeyStatistics as any)?.priceToBook || 0;
          const psRatio = (stats?.defaultKeyStatistics as any)?.priceToSalesTrailing12Months || 0;
          const dividendYield = quote.dividendYield || 0;
          const epsTrailing = (stats?.defaultKeyStatistics as any)?.epsTrailing12Months || 0;
          const epsForward = (stats?.defaultKeyStatistics as any)?.epsForward || 0;
          const beta = (stats?.defaultKeyStatistics as any)?.beta || 1;

          const profitMargin = (stats?.financialData as any)?.profitMargins || 0;
          const roe = (stats?.financialData as any)?.returnOnEquity || 0;
          const debtToEquity = (stats?.financialData as any)?.debtToEquity || 0;
          const currentRatio = (stats?.financialData as any)?.currentRatio || 0;
          const quickRatio = (stats?.financialData as any)?.quickRatio || 0;
          const revenueGrowth = (stats?.financialData as any)?.revenueGrowth || 0;
          const earningsGrowth = (stats?.financialData as any)?.earningsGrowth || 0;

          const peForward = epsForward > 0 ? quote.regularMarketPrice / epsForward : 0;

          const score = calculateScore({
            peRatio,
            pegRatio,
            dividendYield,
            profitMargin,
            roe,
            debtToEquity,
            currentRatio,
            revenueGrowth,
            earningsGrowth,
            regularMarketPrice: quote.regularMarketPrice as number,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh as number,
            changePercent: (quote.regularMarketChangePercent as number) || 0,
          }, dailyMode.id);

          const stock: StockFundamental = {
            symbol: sym,
            name: (quote.shortName as string) || sym,
            price: quote.regularMarketPrice as number,
            change: (quote.regularMarketChange as number) || 0,
            changePercent: (quote.regularMarketChangePercent as number) || 0,
            sector: ((quote as any).sector as string) || (stats?.assetProfile as any)?.sector || 'Unknown',
            industry: (stats?.assetProfile as any)?.industry || 'Unknown',
            marketCap: (quote.marketCap as number) || 0,
            peRatio,
            pegRatio,
            pbRatio,
            psRatio,
            dividendYield,
            epsTrailing,
            epsForward,
            peForward,
            profitMargin,
            roe,
            debtToEquity,
            currentRatio,
            quickRatio,
            revenueGrowth,
            earningsGrowth,
            '52WeekHigh': (quote.fiftyTwoWeekHigh as number) || 0,
            '52WeekLow': (quote.fiftyTwoWeekLow as number) || 0,
            priceToFairValue: 0,
            recommendation: getRecommendation(score),
            score,
            reasons: getReasons({
              peRatio,
              pegRatio,
              dividendYield,
              profitMargin,
              roe,
              revenueGrowth,
              earningsGrowth,
              debtToEquity,
              regularMarketPrice: quote.regularMarketPrice as number,
              '52WeekHigh': quote.fiftyTwoWeekHigh as number,
              changePercent: (quote.regularMarketChangePercent as number) || 0,
            }, score, dailyMode.id),
          };

          return stock;
        } catch {
          return null;
        }
      })
    );

    const validStocks = results.filter((r): r is NonNullable<typeof r> => r !== null && r.price > 0);
    validStocks.sort((a, b) => b.score - a.score);

    const excelente = validStocks.filter((r) => r.score >= 75);
    const buena = validStocks.filter((r) => r.score >= 60 && r.score < 75);
    const regular = validStocks.filter((r) => r.score >= 40 && r.score < 60);

    const dateStr = today.toISOString().split('T')[0];
    const totalAnalyzed = validStocks.length;

    return NextResponse.json({
      stocks: validStocks.slice(0, 30),
      count: validStocks.length,
      totalAnalyzed: totalAnalyzed,
      totalUniverse: combinedUniverse.length,
      scanned: dailyStocks.length,
      date: dateStr,
      scoringMode: {
        id: dailyMode.id,
        name: dailyMode.name,
        icon: dailyMode.icon,
        focus: dailyMode.focus,
      },
      summary: {
        excelente: excelente.length,
        buena: buena.length,
        regular: regular.length,
        sobrevalorada: validStocks.length - excelente.length - buena.length - regular.length,
      },
      topPicks: validStocks.slice(0, 10),
      undervalued: validStocks.filter((r) => r.recommendation === 'excelente' || r.recommendation === 'buena').slice(0, 10),
      highYield: validStocks.filter((r) => r.dividendYield > 0.02).slice(0, 10),
      growth: validStocks.filter((r) => r.revenueGrowth > 0.15).slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fundamental screener error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
