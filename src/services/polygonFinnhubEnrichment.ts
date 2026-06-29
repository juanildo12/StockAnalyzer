import * as Polygon from './polygonClient';
import * as Finnhub from './finnhubClient';

export interface EnrichedData {
  polygon: {
    details: Record<string, any> | null;
    financials: any[];
    dividends: any[];
    splits: any[];
    news: any[];
    snapshot: Record<string, any> | null;
  };
  finnhub: {
    profile: Finnhub.FinnhubProfile | null;
    metrics: Finnhub.FinnhubMetric | null;
    recommendation: any[];
    earnings: any[];
    insiderTransactions: Finnhub.FinnhubInsiderTransaction[];
    socialSentiment: Finnhub.FinnhubSocialSentiment | null;
    news: Finnhub.FinnhubNewsItem[];
    peerGroups: string[];
    priceTarget: Finnhub.FinnhubPriceTarget | null;
    incomeStatement: any[];
    balanceSheet: any[];
    cashFlow: any[];
  };
}

/**
 * Extract key balance sheet figures from Polygon financials
 */
function extractFinancialMetrics(financials: any[]): {
  totalCash: number;
  totalDebt: number;
  totalLiabilities: number;
  totalAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  accountsReceivable: number;
  inventory: number;
  revenue: number;
  netIncome: number;
} {
  const latest = financials?.[0]?.financials;
  if (!latest) return { totalCash: 0, totalDebt: 0, totalLiabilities: 0, totalAssets: 0, currentAssets: 0, currentLiabilities: 0, accountsReceivable: 0, inventory: 0, revenue: 0, netIncome: 0 };

  const bs = latest.balance_sheet || {};
  const is = latest.income_statement || {};
  const cf = latest.cash_flow_statement || {};

  return {
    totalCash: parseFloat(bs?.cash?.value) || 0,
    totalDebt: parseFloat(bs?.long_term_debt?.value) || parseFloat(bs?.current_debt?.value) || 0,
    totalLiabilities: parseFloat(bs?.total_liabilities?.value) || 0,
    totalAssets: parseFloat(bs?.total_assets?.value) || 0,
    currentAssets: parseFloat(bs?.current_assets?.value) || 0,
    currentLiabilities: parseFloat(bs?.current_liabilities?.value) || 0,
    accountsReceivable: parseFloat(bs?.accounts_receivable?.value) || 0,
    inventory: parseFloat(bs?.inventory?.value) || 0,
    revenue: parseFloat(is?.revenues?.value) || 0,
    netIncome: parseFloat(is?.net_income_loss?.value) || 0,
  };
}

/**
 * Extract key metrics from Finnhub basic financials
 */
function extractFinnhubMetrics(metrics: Finnhub.FinnhubMetric | null): Record<string, number | null> {
  if (!metrics) return {};
  const keys = [
    'marketCapitalization', 'peRatio', 'pegRatio', 'priceToBook',
    'priceToSales', 'priceToFreeCashFlow', 'dividendYield',
    'epsTrailing', 'epsForward', 'epsQuarterlyGrowth',
    'revenueGrowth', 'revenuePerShare', 'profitMargin',
    'operatingMargin', 'grossMargin', 'returnOnEquity',
    'returnOnAssets', 'debtToEquity', 'freeCashFlow',
    'currentRatio', 'quickRatio', 'bookValue',
    'enterpriseValue', '52WeekHigh', '52WeekLow',
  ];
  const result: Record<string, number | null> = {};
  for (const k of keys) {
    result[k] = metrics[k] ?? null;
  }
  return result;
}

/**
 * Fetch all enrichment data from Polygon + Finnhub in parallel.
 * Errors are caught per-source so one failure doesn't block the rest.
 */
export async function enrichStockData(symbol: string): Promise<EnrichedData> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const [polygonDetails, polygonFinancials, polygonDividends, polygonSplits, polygonNews, polygonSnapshot,
    finnhubProfile, finnhubMetrics, finnhubRec, finnhubEarnings, finnhubInsider, finnhubSentiment,
    finnhubNews, finnhubPeers, finnhubPT, finnhubIC, finnhubBS, finnhubCF] = await Promise.all([
    Polygon.getTickerDetails(symbol).catch(() => null),
    Polygon.getFinancials(symbol, 4).catch(() => []),
    Polygon.getDividends(symbol, 12).catch(() => []),
    Polygon.getSplits(symbol).catch(() => []),
    Polygon.getTickerNews(symbol).catch(() => []),
    Polygon.getSnapshot(symbol).catch(() => null),
    Finnhub.getCompanyProfile(symbol).catch(() => null),
    Finnhub.getBasicFinancials(symbol).catch(() => null),
    Finnhub.getRecommendationTrends(symbol).catch(() => []),
    Finnhub.getEarnings(symbol).catch(() => []),
    Finnhub.getInsiderTransactions(symbol).catch(() => []),
    Finnhub.getSocialSentiment(symbol).catch(() => null),
    Finnhub.getNews(symbol, fmt(from), fmt(today)).catch(() => []),
    Finnhub.getPeerGroups(symbol).catch(() => []),
    Finnhub.getPriceTarget(symbol).catch(() => null),
    Finnhub.getFinancialStatements(symbol, 'ic', 'annual').catch(() => []),
    Finnhub.getFinancialStatements(symbol, 'bs', 'annual').catch(() => []),
    Finnhub.getFinancialStatements(symbol, 'cf', 'annual').catch(() => []),
  ]);

  return {
    polygon: {
      details: polygonDetails,
      financials: polygonFinancials,
      dividends: polygonDividends,
      splits: polygonSplits,
      news: polygonNews,
      snapshot: polygonSnapshot,
    },
    finnhub: {
      profile: finnhubProfile,
      metrics: finnhubMetrics?.metric || null,
      recommendation: finnhubRec,
      earnings: finnhubEarnings,
      insiderTransactions: finnhubInsider,
      socialSentiment: finnhubSentiment,
      news: finnhubNews,
      peerGroups: finnhubPeers,
      priceTarget: finnhubPT,
      incomeStatement: finnhubIC,
      balanceSheet: finnhubBS,
      cashFlow: finnhubCF,
    },
  };
}

export { extractFinancialMetrics, extractFinnhubMetrics };
