// Massive (ex-Polygon.io) REST client — transport + capability probe + endpoints.
//
// Env:
//   MASSIVE_API_KEY            preferred (fallback: POLYGON_API_KEY)
//   MASSIVE_BASE_URL           default https://api.massive.com
//   MASSIVE_REQUESTS_PER_MINUTE throttle limit (default 5 = free tier)
//
// Free tier (verified): /v2/aggs, /v3/reference/tickers, /v2/reference/news,
// /v1/indicators, /v1/marketstatus all work; every snapshot endpoint returns
// 403 NOT_AUTHORIZED. Snapshots unlock on paid Stocks/Options plans, so the
// snapshot helpers below degrade to `null` and callers fall back to Yahoo.

import { cacheGet, cacheSet } from '@/src/lib/cache';
import { acquireMassiveSlot, MassiveThrottledError } from '@/src/lib/massiveThrottle';

export const MASSIVE_BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const FETCH_TIMEOUT_MS = 12_000;

export function getMassiveKey(): string | null {
  return process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY || null;
}

export function hasMassive(): boolean {
  return !!getMassiveKey();
}

export class MassiveNotEntitledError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'MassiveNotEntitledError';
    this.status = status;
  }
}

export interface FetchMassiveOptions {
  maxWaitMs?: number;
  timeoutMs?: number;
}

/**
 * Low-level GET. Throttles, times out, and throws a typed error for the
 * "plan does not include this endpoint" case (401/403).
 */
export async function fetchMassive(path: string, opts: FetchMassiveOptions = {}): Promise<any> {
  const key = getMassiveKey();
  if (!key) throw new MassiveNotEntitledError(0, 'MASSIVE_API_KEY / POLYGON_API_KEY not set');

  const { maxWaitMs = 15_000, timeoutMs = FETCH_TIMEOUT_MS } = opts;
  const gotSlot = await acquireMassiveSlot(maxWaitMs);
  if (!gotSlot) throw new MassiveThrottledError();

  const url = `${MASSIVE_BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) {
      const txt = await res.text().catch(() => '');
      throw new MassiveNotEntitledError(res.status, txt.slice(0, 160));
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Massive ${res.status}: ${txt.slice(0, 160)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Like fetchMassive but returns null (instead of throwing) when the endpoint
 * is not entitled, throttled, or errors — ideal for optional enrichment.
 */
export async function fetchMassiveSafe(path: string, opts: FetchMassiveOptions = {}): Promise<any | null> {
  try {
    return await fetchMassive(path, opts);
  } catch (err) {
    if (err instanceof MassiveThrottledError) return null;
    if (err instanceof MassiveNotEntitledError) return null;
    console.warn(`[Massive] ${path} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Capabilities probe ──────────────────────────────────────────────────────

export interface MassiveCapabilities {
  configured: boolean;
  snapshots: boolean;
  optionsSnapshot: boolean;
  checkedAt: number;
}

const CAPS_KEY = 'massive:capabilities:v1';
const CAPS_TTL = 1800; // seconds
let memCaps: MassiveCapabilities | null = null;

/**
 * Detects whether the configured key can read the (paid) snapshot endpoints.
 * Cached in memory + Redis so we don't burn free-tier quota on repeated probes.
 */
export async function getMassiveCapabilities(force = false): Promise<MassiveCapabilities> {
  if (!force && memCaps && Date.now() - memCaps.checkedAt < CAPS_TTL * 1000) return memCaps;

  const cached = force ? null : await cacheGet<MassiveCapabilities>(CAPS_KEY);
  if (cached) {
    memCaps = cached;
    return cached;
  }

  const configured = hasMassive();
  let snapshots = false;
  let optionsSnapshot = false;
  if (configured) {
    snapshots = (await fetchMassiveSafe('/v2/snapshot/locale/us/markets/stocks/tickers/AAPL')) !== null;
    optionsSnapshot = (await fetchMassiveSafe('/v3/snapshot/options/AAPL?limit=1')) !== null;
  }

  const caps: MassiveCapabilities = { configured, snapshots, optionsSnapshot, checkedAt: Date.now() };
  memCaps = caps;
  await cacheSet(CAPS_KEY, caps, CAPS_TTL);
  return caps;
}

// ─── Bars / Aggregates (free tier) ───────────────────────────────────────────

export interface MassiveBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface NormalizedBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getMassiveBars(
  symbol: string,
  from: string,
  to: string,
  multiplier = 1,
  timespan: 'day' | 'minute' = 'day'
): Promise<MassiveBar[]> {
  const data = await fetchMassive(
    `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}`,
    { maxWaitMs: 8000 }
  );
  return (data?.results || []) as MassiveBar[];
}

/** Daily bars normalized to the yahoo-finance style shape (Date + OHLCV). */
export async function getMassiveDailyBars(
  symbol: string,
  fromMs: number,
  toMs: number
): Promise<NormalizedBar[]> {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const bars = await getMassiveBars(symbol, day(fromMs), day(toMs), 1, 'day');
  return bars
    .filter((b) => b.h != null && b.l != null && b.c != null)
    .map((b) => ({ date: new Date(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
}

// ─── News (free tier) ────────────────────────────────────────────────────────

/** Shape expected by components that render Finnhub/legacy news items. */
export interface NormalizedNews {
  id: string;
  category: 'general';
  datetime: number; // unix seconds
  headline: string;
  summary: string;
  source: string;
  url: string;
  related: string;
  image: string | null;
  sentiment?: number;
  sentimentReasoning?: string;
}

export function normalizeMassiveNews(item: any): NormalizedNews {
  const sentiment = Array.isArray(item?.insights) && item.insights.length > 0 ? item.insights[0] : null;
  return {
    id: String(item?.id ?? item?.article_url ?? Math.random()),
    category: 'general',
    datetime: item?.published_utc ? Math.floor(new Date(item.published_utc).getTime() / 1000) : Math.floor(Date.now() / 1000),
    headline: item?.title || item?.headline || '',
    summary: (item?.description || item?.summary || '').slice(0, 400),
    source: item?.publisher?.name || item?.publisher || 'Massive',
    url: item?.article_url || item?.url || '',
    related: Array.isArray(item?.tickers) ? item.tickers.join(',') : '',
    image: item?.image_url || null,
    sentiment: sentiment?.sentiment ?? undefined,
    sentimentReasoning: sentiment?.sentiment_reasoning ?? undefined,
  };
}

export async function getMassiveNews(opts: { ticker?: string; limit?: number } = {}): Promise<NormalizedNews[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const q = opts.ticker ? `ticker=${encodeURIComponent(opts.ticker)}&limit=${limit}` : `limit=${limit}`;
  const data = await fetchMassiveSafe(`/v2/reference/news?${q}`, { maxWaitMs: 8000 });
  if (!data?.results) return [];
  return (data.results as any[]).map(normalizeMassiveNews);
}

// ─── Snapshots (paid plans; return null on free tier) ────────────────────────

export interface MassiveOptionContract {
  details: {
    ticker: string;
    contract_type: 'call' | 'put';
    expiration_date: string;
    strike_price: number;
    exercise_style?: string;
    shares_per_contract?: number;
  };
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number };
  implied_volatility?: number;
  open_interest?: number;
  break_even_price?: number;
  day?: { close?: number; volume?: number; vwap?: number; change?: number };
  last_quote?: { ask?: number; bid?: number; ask_size?: number; bid_size?: number; midpoint?: number };
  last_trade?: { price?: number; size?: number };
  underlying_asset?: { ticker?: string; price?: number };
}

export interface OptionsChainQuery {
  contractType?: 'call' | 'put';
  expirationDate?: string; // YYYY-MM-DD (or gte./lte. variants)
  strikePrice?: number;
  strikeGte?: number;
  strikeLte?: number;
  limit?: number;
  order?: 'asc' | 'desc';
  sort?: string;
  maxWaitMs?: number;
}

function buildChainQuery(q: OptionsChainQuery): string {
  const parts: string[] = [];
  if (q.contractType) parts.push(`contract_type=${q.contractType}`);
  if (q.expirationDate) parts.push(`expiration_date=${q.expirationDate}`);
  if (q.strikePrice != null) parts.push(`strike_price=${q.strikePrice}`);
  if (q.strikeGte != null) parts.push(`strike_price.gte=${q.strikeGte}`);
  if (q.strikeLte != null) parts.push(`strike_price.lte=${q.strikeLte}`);
  if (q.order) parts.push(`order=${q.order}`);
  if (q.sort) parts.push(`sort=${q.sort}`);
  parts.push(`limit=${Math.min(Math.max(q.limit ?? 250, 1), 250)}`);
  return parts.join('&');
}

/**
 * Full option chain snapshot for an underlying: real greeks, IV, open interest
 * and (on Options Advanced) bid/ask. Returns null when not entitled.
 */
export async function getOptionsChainSnapshot(
  symbol: string,
  q: OptionsChainQuery = {}
): Promise<MassiveOptionContract[] | null> {
  const data = await fetchMassiveSafe(`/v3/snapshot/options/${encodeURIComponent(symbol)}?${buildChainQuery(q)}`, {
    maxWaitMs: q.maxWaitMs ?? 10_000,
  });
  if (!data?.results) return null;
  return data.results as MassiveOptionContract[];
}

export interface NormalizedQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  updated: number;
}

/** Batch stock quotes via the snapshot list endpoint (Starter+). Null when not entitled. */
export async function getQuotesBatch(symbols: string[], maxWaitMs = 6000): Promise<NormalizedQuote[] | null> {
  const uniq = Array.from(new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))).slice(0, 250);
  if (uniq.length === 0) return [];
  const data = await fetchMassiveSafe(
    `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${uniq.join(',')}&include_otc=false`,
    { maxWaitMs }
  );
  if (!data?.tickers) return null;
  return (data.tickers as any[]).map((t) => ({
    symbol: t.ticker,
    price: t.day?.c ?? t.lastTrade?.p ?? t.prevDay?.c ?? 0,
    change: t.todaysChange ?? 0,
    changePct: t.todaysChangePerc ?? 0,
    volume: t.day?.v ?? 0,
    open: t.day?.o ?? 0,
    high: t.day?.h ?? 0,
    low: t.day?.l ?? 0,
    previousClose: t.prevDay?.c ?? 0,
    updated: t.updated ?? 0,
  }));
}

/** Top gainers/losers (US only, min volume 10k). Null when not entitled. */
export async function getTopMovers(
  direction: 'gainers' | 'losers' = 'gainers',
  limit = 20
): Promise<NormalizedQuote[] | null> {
  const data = await fetchMassiveSafe(
    `/v2/snapshot/locale/us/markets/stocks/${direction}?limit=${Math.min(limit, 50)}`,
    { maxWaitMs: 6000 }
  );
  if (!data?.tickers) return null;
  return (data.tickers as any[]).slice(0, limit).map((t) => ({
    symbol: t.ticker,
    price: t.day?.c ?? 0,
    change: t.todaysChange ?? 0,
    changePct: t.todaysChangePerc ?? 0,
    volume: t.day?.v ?? 0,
    open: t.day?.o ?? 0,
    high: t.day?.h ?? 0,
    low: t.day?.l ?? 0,
    previousClose: t.prevDay?.c ?? 0,
    updated: t.updated ?? 0,
  }));
}
