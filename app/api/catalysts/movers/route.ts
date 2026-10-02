import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getCompanyNews } from '@/src/services/finnhubClient';
import { cacheGet, cacheSet } from '@/src/lib/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

const CACHE_KEY = 'catalysts:movers';
const CACHE_TTL = 600; // 10 min
const SIDE_LIMIT = 6;
const POOL_SIZE = 30;
const MIN_PRICE = 5;
const MIN_MARKET_CAP = 1e9;
const MIN_VOLUME = 100_000;
const MAX_MOVE_PCT = 60;

export interface MoverNews {
  headline: string;
  source: string;
  url: string;
  datetime: number;
}

export interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap: number;
  news: MoverNews | null;
}

export interface MoversPayload {
  updatedAt: number;
  gainers: MarketMover[];
  losers: MarketMover[];
}

const fmtDay = (d: Date) => d.toISOString().split('T')[0];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function extractQuotes(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.quotes)) return res.quotes;
  if (Array.isArray(res.results)) return res.results.flatMap((r: any) => r?.quotes || []);
  return [];
}

async function screenQuotes(scrIds: 'day_gainers' | 'day_losers'): Promise<any[]> {
  try {
    return extractQuotes(await yf.screener({ scrIds, count: POOL_SIZE }));
  } catch (err: any) {
    // v3 throws when the payload misses its schema, but the raw quotes ride along
    return extractQuotes(err?.result);
  }
}

function isTradableSymbol(sym: unknown): sym is string {
  return typeof sym === 'string' && /^[A-Z][A-Z0-9.-]{0,9}$/.test(sym);
}

function toMover(q: any): MarketMover | null {
  if (!isTradableSymbol(q?.symbol)) return null;
  const price = Number(q.regularMarketPrice) || 0;
  const changePct = Number(q.regularMarketChangePercent) || 0;
  const marketCap = Number(q.marketCap) || 0;
  const volume = Number(q.regularMarketVolume) || 0;
  if (price < MIN_PRICE) return null;
  if (marketCap && marketCap < MIN_MARKET_CAP) return null;
  if (volume < MIN_VOLUME) return null;
  // A move this large is almost always a split artifact or a halted print
  if (!changePct || Math.abs(changePct) > MAX_MOVE_PCT) return null;
  return {
    symbol: q.symbol,
    name: q.longName || q.shortName || q.displayName || q.symbol,
    price,
    changePct,
    volume,
    marketCap,
    news: null,
  };
}

function mentions(text: string, needle: string): boolean {
  if (!text || !needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(text);
}

/**
 * Finnhub mixes company headlines with broad market wires, so a headline only
 * counts when it is actually about this ticker.
 */
function pickNews(items: any[], symbol: string, name: string, midnightTs: number): MoverNews | null {
  const usable = (items || []).filter(n => n?.headline);
  if (usable.length === 0) return null;

  const aboutTicker = usable.filter(n =>
    (Array.isArray(n.related) && n.related.includes(symbol)) || mentions(n.headline, symbol)
  );
  const aboutCompany = aboutTicker.length > 0
    ? aboutTicker
    : usable.filter(n => name && n.headline.toLowerCase().includes(name.toLowerCase()));

  if (aboutCompany.length === 0) return null;

  const top = aboutCompany.find(n => (n.datetime || 0) * 1000 >= midnightTs) || aboutCompany[0];
  return {
    headline: top.headline,
    source: top.source || 'Market News',
    url: top.url || '',
    datetime: top.datetime || 0,
  };
}

async function attachNews(movers: MarketMover[]): Promise<MarketMover[]> {
  const now = new Date();
  const from = fmtDay(addDays(now, -2));
  const to = fmtDay(now);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = midnight.getTime();

  return Promise.all(
    movers.map(async m => {
      try {
        const items = ((await getCompanyNews(m.symbol, from, to)) as any[]) || [];
        return { ...m, news: pickNews(items, m.symbol, m.name, midnightTs) };
      } catch {
        return m;
      }
    })
  );
}

async function buildSide(scrIds: 'day_gainers' | 'day_losers'): Promise<MarketMover[]> {
  const quotes = await screenQuotes(scrIds);
  const movers = quotes
    .map(toMover)
    .filter((m): m is MarketMover => m !== null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return attachNews(movers.slice(0, SIDE_LIMIT));
}

export async function GET() {
  try {
    const cached = await cacheGet<MoversPayload>(CACHE_KEY);
    if (cached && Array.isArray(cached.gainers) && Array.isArray(cached.losers)) {
      return NextResponse.json(cached);
    }

    const [gainers, losers] = await Promise.all([buildSide('day_gainers'), buildSide('day_losers')]);
    const payload: MoversPayload = { updatedAt: Date.now(), gainers, losers };
    cacheSet(CACHE_KEY, payload, CACHE_TTL).catch(() => {});
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}