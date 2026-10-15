// Legacy façade over the Massive (ex-Polygon) REST API.
//
// Kept for backwards compatibility with the ~20 call sites that import
// `@/src/services/polygonClient`. Transport, key resolution, throttling and
// capability probing all live in `./massiveClient`.

import {
  fetchMassiveSafe,
  getMassiveDividends,
  getMassiveIndicator,
  getMassiveMarketHolidays,
  getMassiveMarketStatus,
  getMassiveRelatedTickers,
  getMassiveShortInterest,
  getMassiveSplits,
  type FetchMassiveOptions,
  type IndicatorPoint,
  type MassiveIndicatorType,
  type NormalizedDividend,
  type NormalizedMarketStatus,
  type NormalizedShortInterest,
  type NormalizedSplit,
} from './massiveClient';

async function fetchPolygon(path: string, opts?: FetchMassiveOptions) {
  return fetchMassiveSafe(path, opts);
}

export interface PolygonBar {
  o: number; h: number; l: number; c: number; v: number; t: number;
}

// ---------- Aggregates (Bars) ----------

export async function getBars(symbol: string, from: string, to: string, multiplier = 1, timespan: 'day' | 'minute' = 'day') {
  const data = await fetchPolygon(`/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`);
  return (data?.results || []) as PolygonBar[];
}

export async function getPreviousDayBar(symbol: string) {
  const data = await fetchPolygon(`/v2/aggs/ticker/${symbol}/prev`);
  return (data?.results?.[0] || null) as PolygonBar | null;
}

export async function getDailyOpenClose(symbol: string, date: string) {
  const data = await fetchPolygon(`/v1/open-close/${symbol}/${date}`);
  return (data || null) as { open: number; close: number; high: number; low: number; volume: number } | null;
}

// ---------- Snapshots / Market Overview ----------

export async function getSnapshot(symbol: string) {
  const data = await fetchPolygon(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);
  return (data?.ticker || null) as Record<string, any> | null;
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
  return (data?.tickers || []) as SnapshotTicker[];
}

export async function getMarketMovers(direction: 'gainers' | 'losers' = 'gainers') {
  const data = await fetchPolygon(`/v2/snapshot/locale/us/markets/stocks/${direction}?limit=10`);
  return (data?.tickers || []) as SnapshotTicker[];
}

// ---------- Market Status ----------

export async function getMarketStatus(): Promise<NormalizedMarketStatus | null> {
  return getMassiveMarketStatus();
}

export async function getMarketHolidays(): Promise<any[]> {
  return getMassiveMarketHolidays();
}

// ---------- Ticker Reference ----------

export async function getTickerDetails(symbol: string) {
  const data = await fetchPolygon(`/v3/reference/tickers/${symbol}`);
  return (data?.results || null) as Record<string, any> | null;
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
  return (data?.results || []) as TickerSearchResult[];
}

export async function getTickerRelated(symbol: string): Promise<string[]> {
  return getMassiveRelatedTickers(symbol);
}

export async function getExchanges() {
  const data = await fetchPolygon('/v3/reference/exchanges');
  return (data?.results || []) as any[];
}

// ---------- Fundamentals ----------

export async function getFinancials(symbol: string, limit = 4) {
  const data = await fetchPolygon(`/v3/reference/financials/${symbol}?limit=${limit}`);
  return (data?.results || []) as any[];
}

export async function getFinancialRatios(symbol: string) {
  const data = await fetchPolygon(`/stocks/financials/v1/ratios?ticker=${symbol}`);
  return (data?.results?.[0] || null) as Record<string, any> | null;
}

export async function getShortInterest(symbol: string): Promise<NormalizedShortInterest | null> {
  return getMassiveShortInterest(symbol);
}

export async function getDividends(symbol: string, limit = 12): Promise<NormalizedDividend[]> {
  return getMassiveDividends(symbol, limit);
}

export async function getSplits(symbol: string, limit = 10): Promise<NormalizedSplit[]> {
  return getMassiveSplits(symbol, limit);
}

// ---------- News ----------

export async function getTickerNews(symbol: string, limit = 10) {
  const data = await fetchPolygon(`/v2/reference/news?ticker=${symbol}&limit=${limit}`);
  return (data?.results || []) as any[];
}

export async function getMarketNews(limit = 20) {
  const data = await fetchPolygon(`/v2/reference/news?limit=${limit}`);
  return (data?.results || []) as any[];
}

// ---------- Conditions ----------

export async function getConditions(ticktype: 'stocks' | 'options' | 'indices' | 'fx') {
  const data = await fetchPolygon(`/v3/reference/conditions?asset_class=${ticktype}`);
  return (data?.results || []) as any[];
}

// ---------- Technical Indicators ----------

// Uses a short wait budget: indicators are optional enrichment on the scoring
// routes, so on a tight quota it is better to skip than to stall the request.
export async function getIndicator(
  symbol: string,
  indicator: MassiveIndicatorType,
  params: Record<string, any> = {}
): Promise<IndicatorPoint[]> {
  return getMassiveIndicator(symbol, indicator, {
    window: params.window,
    timespan: params.timespan ?? 'day',
    seriesType: params.series_type ?? params.seriesType,
    limit: params.limit,
    order: params.order,
    maxWaitMs: 1200,
  });
}
