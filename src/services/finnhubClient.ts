const BASE = 'https://finnhub.io/api/v1';

async function fetchFinnhub(path: string) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY not set');
  const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}token=${key}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Finnhub ${res.status}: ${txt}`);
  }
  return res.json();
}

// ---------- News ----------

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export async function getNews(symbol: string, from: string, to: string): Promise<FinnhubNewsItem[]> {
  const data = await fetchFinnhub(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
  return (data || []) as FinnhubNewsItem[];
}

export async function getMarketNews(category: 'general' | 'forex' | 'crypto' | 'merger' = 'general', limit = 10): Promise<FinnhubNewsItem[]> {
  const data = await fetchFinnhub(`/news?category=${category}`);
  return (data || []).slice(0, limit) as FinnhubNewsItem[];
}

// ---------- Real-time Quote ----------

export interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High of the day
  l: number;  // Low of the day
  o: number;  // Open of the day
  pc: number; // Previous close
  t: number;  // Timestamp
}

export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  const data = await fetchFinnhub(`/quote?symbol=${symbol}`);
  return data || null;
}

// ---------- OHLCV Candles ----------

export async function getCandles(symbol: string, resolution: '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M', from: number, to: number) {
  const data = await fetchFinnhub(`/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
  return data as { o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; t: number[]; s: string } | null;
}

// ---------- Search ----------

export interface FinnhubSearchResult {
  symbol: string;
  description: string;
  type: string;
  displaySymbol: string;
}

export async function searchSymbols(query: string): Promise<FinnhubSearchResult[]> {
  const data = await fetchFinnhub(`/search?q=${encodeURIComponent(query)}`);
  return (data?.result || []) as FinnhubSearchResult[];
}

// ---------- Basic Financials ----------

export interface FinnhubMetric {
  [key: string]: number | null;
}

export async function getBasicFinancials(symbol: string): Promise<{ metric: FinnhubMetric } | null> {
  const data = await fetchFinnhub(`/stock/metric?symbol=${symbol}&metric=all`);
  return data || null;
}

// ---------- Technical Indicators ----------

export async function getStockIndicators(symbol: string, resolution: 'D' | 'W' = 'D', count = 120) {
  const data = await fetchFinnhub(`/stock/indicator?symbol=${symbol}&resolution=${resolution}&count=${count}`);
  return data as any;
}

export async function getAggregateIndicator(symbol: string) {
  const data = await fetchFinnhub(`/stock/aggregate-indicator?symbol=${symbol}`);
  return data as Record<string, any> | null;
}

export async function getSupportResistance(symbol: string, resolution: 'D' | 'W' | 'M' = 'D') {
  const data = await fetchFinnhub(`/stock/support-resistance?symbol=${symbol}&resolution=${resolution}`);
  return data as Record<string, any> | null;
}

export async function getPatternRecognition(symbol: string, resolution: 'D' | 'W' | 'M' = 'D') {
  const data = await fetchFinnhub(`/stock/pattern-recognition?symbol=${symbol}&resolution=${resolution}`);
  return data as Record<string, any> | null;
}

// ---------- Company Profile ----------

export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export async function getCompanyProfile(symbol: string): Promise<FinnhubProfile | null> {
  const data = await fetchFinnhub(`/stock/profile2?symbol=${symbol}`);
  return data || null;
}

// ---------- Earnings ----------

export async function getEarnings(symbol: string, limit = 4) {
  const data = await fetchFinnhub(`/earnings?symbol=${symbol}&limit=${limit}`);
  return (data || []) as any[];
}

export async function getEarningsCalendar(from: string, to: string) {
  const data = await fetchFinnhub(`/calendar/earnings?from=${from}&to=${to}`);
  return (data?.earningsCalendar || []) as any[];
}

const EARNINGS_ROW_CAP = 1490;

async function getEarningsRange(from: string, to: string): Promise<any[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getEarningsCalendar(from, to);
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return [];
}

/**
 * /calendar/earnings truncates at 1500 rows per response and spends that budget
 * on the densest days of the range, so a whole-month request during earnings
 * season came back with only Oct 20-29 and dropped Oct 1-19. Those days then
 * rendered as empty even though they had reports.
 *
 * Rather than walking day by day (93 API calls for a 3-month view, which blows
 * past Finnhub's 60/minute limit and loses rows to 429s), this asks for the
 * range and only subdivides the halves when a response comes back at the cap,
 * which is exactly when we know it was truncated. Dense ranges split down, thin
 * ones cost a single call. Calls are serial and merges are de-duplicated by
 * symbol+date because the midpoint day is fetched by both halves.
 */
export async function getEarningsCalendarChunked(from: string, to: string): Promise<any[]> {
  const byKey = new Map<string, any>();

  const walk = async (a: string, b: string, depth: number): Promise<void> => {
    const rows = await getEarningsRange(a, b);
    const truncated = rows.length >= EARNINGS_ROW_CAP;
    const single = a === b;
    if (!truncated || single || depth >= 8) {
      for (const r of rows) byKey.set(`${r.date}|${r.symbol}`, r);
      return;
    }
    const mid = new Date(new Date(`${a}T00:00:00Z`).getTime() / 2 + new Date(`${b}T00:00:00Z`).getTime() / 2)
      .toISOString()
      .slice(0, 10);
    if (mid <= a || mid >= b) {
      for (const r of rows) byKey.set(`${r.date}|${r.symbol}`, r);
      return;
    }
    await walk(a, mid, depth + 1);
    await walk(mid, b, depth + 1);
  };

  if (from > to) return [];
  await walk(from, to, 0);
  return Array.from(byKey.values());
}

// ---------- Recommendations ----------

export async function getRecommendationTrends(symbol: string) {
  const data = await fetchFinnhub(`/stock/recommendation?symbol=${symbol}`);
  return (data || []) as any[];
}

export async function getPriceTarget(symbol: string) {
  const data = await fetchFinnhub(`/stock/price-target?symbol=${symbol}`);
  return data as Record<string, any> | null;
}

export async function getEPSEstimates(symbol: string, freq: 'annual' | 'quarterly' = 'annual') {
  const data = await fetchFinnhub(`/stock/eps-estimates?symbol=${symbol}&freq=${freq}`);
  return (data?.data || []) as any[];
}

export async function getRevenueEstimates(symbol: string, freq: 'annual' | 'quarterly' = 'annual') {
  const data = await fetchFinnhub(`/stock/revenue-estimates?symbol=${symbol}&freq=${freq}`);
  return (data?.data || []) as any[];
}

// ---------- Financial Statements ----------

export interface FinnhubFinancialStatement {
  symbol: string;
  period: string;
  reportDate: string;
  currency: string;
  [key: string]: any;
}

export async function getFinancialStatements(symbol: string, statement: 'ic' | 'bs' | 'cf', freq: 'annual' | 'quarterly' = 'annual') {
  const data = await fetchFinnhub(`/stock/financials?symbol=${symbol}&statement=${statement}&freq=${freq}`);
  return (data?.financials || []) as FinnhubFinancialStatement[];
}

export async function getRevenueBreakdown(symbol: string) {
  const data = await fetchFinnhub(`/stock/revenue-breakdown2?symbol=${symbol}`);
  return data as Record<string, any> | null;
}

// ---------- Insider Transactions ----------

export interface FinnhubInsiderTransaction {
  symbol: string;
  name: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionPrice: number;
  transactionCode: 'P' | 'S';
  [key: string]: any;
}

export async function getInsiderTransactions(symbol: string, limit = 20) {
  const data = await fetchFinnhub(`/stock/insider-transactions?symbol=${symbol}&limit=${limit}`);
  return (data?.data || []) as FinnhubInsiderTransaction[];
}

export async function getInsiderSentiment(symbol: string, from: string, to: string) {
  const data = await fetchFinnhub(`/stock/insider-sentiment?symbol=${symbol}&from=${from}&to=${to}`);
  return (data?.data || []) as any[];
}

// ---------- Ownership ----------

export async function getOwnership(symbol: string, limit = 20) {
  const data = await fetchFinnhub(`/stock/ownership?symbol=${symbol}&limit=${limit}`);
  return (data?.data || []) as any[];
}

// ---------- SEC Filings ----------

export async function getSECFilings(symbol: string, limit = 5) {
  const data = await fetchFinnhub(`/stock/filings?symbol=${symbol}&limit=${limit}`);
  return (data?.data || []) as any[];
}

// ---------- Social Sentiment ----------

export interface FinnhubSocialSentiment {
  symbol: string;
  reddit: { mention: number; positiveScore: number; negativeScore: number; positiveMention: number; negativeMention: number; score: number };
  twitter: { mention: number; positiveScore: number; negativeScore: number; positiveMention: number; negativeMention: number; score: number };
}

export async function getSocialSentiment(symbol: string) {
  const data = await fetchFinnhub(`/stock/social-sentiment?symbol=${symbol}`);
  return data as FinnhubSocialSentiment | null;
}

// ---------- Peer Groups ----------

export async function getPeerGroups(symbol: string) {
  const data = await fetchFinnhub(`/stock/peer-groups?symbol=${symbol}`);
  return (data?.peers || []) as string[];
}

// ---------- Earnings Transcripts ----------

export async function getEarningsTranscripts(symbol: string, limit = 1) {
  const data = await fetchFinnhub(`/stock/transcripts?symbol=${symbol}&limit=${limit}`);
  return (data?.transcripts || []) as any[];
}

// ---------- Supply Chain ----------

export async function getSupplyChainRelationships(symbol: string) {
  const data = await fetchFinnhub(`/stock/supply-chain?symbol=${symbol}`);
  return data as Record<string, any> | null;
}

// ---------- Company Executives ----------

export async function getCompanyExecutives(symbol: string) {
  const data = await fetchFinnhub(`/stock/executive?symbol=${symbol}`);
  return (data || []) as any[];
}

// ---------- ESG ----------

export async function getESGScore(symbol: string) {
  const data = await fetchFinnhub(`/stock/esg?symbol=${symbol}`);
  return data as Record<string, any> | null;
}

// ---------- Index Constituents ----------

export async function getIndexConstituents(index: string) {
  const data = await fetchFinnhub(`/index/constituents?symbol=${index}`);
  return (data?.constituents || []) as string[];
}

// ---------- IPO Calendar ----------

export async function getIPOCalendar(from: string, to: string) {
  const data = await fetchFinnhub(`/calendar/ipo?from=${from}&to=${to}`);
  return (data?.ipoCalendar || []) as any[];
}

// ---------- Economic Calendar ----------

export async function getEconomicCalendar() {
  const data = await fetchFinnhub('/economic/calendar');
  return (data?.economicCalendar || []) as any[];
}

// ---------- News ----------

export async function getCompanyNews(symbol: string, from: string, to: string) {
  const data = await fetchFinnhub(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
  return (Array.isArray(data) ? data : []) as any[];
}

export async function getGeneralNews() {
  const data = await fetchFinnhub('/news?category=general');
  return (Array.isArray(data) ? data : []) as any[];
}

// ---------- Congressional Trading ----------

export async function getCongressionalTrading(symbol: string) {
  const data = await fetchFinnhub(`/congressional-trading?symbol=${symbol}`);
  return (data?.data || []) as any[];
}
