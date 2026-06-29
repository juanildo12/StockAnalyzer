const BASE = 'https://api.polygon.io';

async function fetchPolygon(path: string) {
  const key = process.env.POLYGON_API_KEY;
  if (!key) throw new Error('POLYGON_API_KEY not set');
  const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${key}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Polygon ${res.status}: ${txt}`);
  }
  return res.json();
}

export interface PolygonBar {
  o: number; h: number; l: number; c: number; v: number; t: number;
}

// ---------- Aggregates (Bars) ----------

export async function getBars(symbol: string, from: string, to: string, multiplier = 1, timespan: 'day' | 'minute' = 'day') {
  const data = await fetchPolygon(`/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`);
  return (data.results || []) as PolygonBar[];
}

export async function getPreviousDayBar(symbol: string) {
  const data = await fetchPolygon(`/v2/aggs/ticker/${symbol}/prev`);
  return (data.results?.[0] || null) as PolygonBar | null;
}

export async function getDailyOpenClose(symbol: string, date: string) {
  const data = await fetchPolygon(`/v1/open-close/${symbol}/${date}`);
  return data as { open: number; close: number; high: number; low: number; volume: number } | null;
}

// ---------- Snapshots / Market Overview ----------

export async function getSnapshot(symbol: string) {
  const data = await fetchPolygon(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);
  return data.ticker as Record<string, any> | null;
}

export interface SnapshotTicker {
  ticker: string;
  day: { o: number; h: number; l: number; c: number; v: number };
  prevDay: { c: number };
  todaysChange: number;
  todaysChangePerc: number;
  updated: number;
}

export async function getAllTickersSnapshot() {
  const data = await fetchPolygon('/v2/snapshot/locale/us/markets/stocks/tickers?limit=250');
  return (data.tickers || []) as SnapshotTicker[];
}

export async function getMarketMovers(direction: 'gainers' | 'losers' = 'gainers') {
  const data = await fetchPolygon(`/v2/snapshot/locale/us/markets/stocks/${direction}?limit=10`);
  return (data.tickers || []) as SnapshotTicker[];
}

// ---------- Market Status ----------

export async function getMarketStatus() {
  const data = await fetchPolygon('/v1/marketstatus/now');
  return data as { market: string; serverTime: string; exchanges: Record<string, string> } | null;
}

export async function getMarketHolidays() {
  const data = await fetchPolygon('/v1/marketstatus/holidays');
  return (data || []) as any[];
}

// ---------- Ticker Reference ----------

export async function getTickerDetails(symbol: string) {
  const data = await fetchPolygon(`/v3/reference/tickers/${symbol}`);
  return data.results as Record<string, any> | null;
}

export interface TickerSearchResult {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  type: string;
  active: boolean;
  currency_name: string;
  last_updated_utc: string;
}

export async function searchTickers(query: string, limit = 20) {
  const data = await fetchPolygon(`/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=${limit}`);
  return (data.results || []) as TickerSearchResult[];
}

export async function getTickerRelated(symbol: string) {
  const data = await fetchPolygon(`/v3/reference/tickers/${symbol}/related`);
  return (data.results || []) as string[];
}

export async function getExchanges() {
  const data = await fetchPolygon('/v3/reference/exchanges');
  return (data.results || []) as any[];
}

// ---------- Fundamentals ----------

export async function getFinancials(symbol: string, limit = 4) {
  const data = await fetchPolygon(`/v3/reference/financials/${symbol}?limit=${limit}`);
  return (data.results || []) as any[];
}

export async function getFinancialRatios(symbol: string) {
  const data = await fetchPolygon(`/v3/reference/financials/${symbol}/ratios`);
  return data as Record<string, any> | null;
}

export async function getShortInterest(symbol: string) {
  const data = await fetchPolygon(`/v3/reference/short-interest/${symbol}`);
  return (data.results || []) as any[];
}

export async function getDividends(symbol: string, limit = 12) {
  const data = await fetchPolygon(`/v3/reference/dividends/${symbol}?limit=${limit}`);
  return (data.results || []) as any[];
}

export async function getSplits(symbol: string, limit = 10) {
  const data = await fetchPolygon(`/v3/reference/splits/${symbol}?limit=${limit}`);
  return (data.results || []) as any[];
}

// ---------- News ----------

export async function getTickerNews(symbol: string, limit = 10) {
  const data = await fetchPolygon(`/v2/reference/news?ticker=${symbol}&limit=${limit}`);
  return (data.results || []) as any[];
}

export async function getMarketNews(limit = 20) {
  const data = await fetchPolygon(`/v2/reference/news?limit=${limit}`);
  return (data.results || []) as any[];
}

// ---------- Conditions ----------

export async function getConditions(ticktype: 'stocks' | 'options' | 'indices' | 'fx') {
  const data = await fetchPolygon(`/v3/reference/conditions?asset_class=${ticktype}`);
  return (data.results || []) as any[];
}

// ---------- Technical Indicators (Massive) ----------

export async function getIndicator(symbol: string, indicator: 'sma' | 'ema' | 'rsi' | 'macd', params: Record<string, any> = {}) {
  const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
  const data = await fetchPolygon(`/v1/indicators/${indicator}/${symbol}${query ? '?' + query : ''}`);
  return data as Record<string, any> | null;
}
