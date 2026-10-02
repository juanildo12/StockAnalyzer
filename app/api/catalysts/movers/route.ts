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
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

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

const UP_WORDS =
  /\b(soar|jump|surg|rall|climb|rise|ris|rose|gain|gains?|gained|win|wins|boost|upgrad|beat|beats|outperform|buyback|bullish|record high|all-time high|higher|advanc|rebound|recover)\w*/i;
const DOWN_WORDS =
  /\b(fall|falls|fell|drop|slide|slump|tumble|plunge|sink|sank|declin|downgrad|miss|misses|undercut|cut|slashes|selloff|bearish|warn|loss|loses|lose|weak|weaker|halt|probe|lawsuit|fraud|bankrupt|delay|slips)\w*/i;

/** +1 bullish, -1 bearish, 0 neutral/unclear. */
function headlineDirection(headline: string): number {
  const up = UP_WORDS.test(headline);
  const down = DOWN_WORDS.test(headline);
  if (up === down) return 0;
  return up ? 1 : -1;
}

/**
 * Finnhub mixes company headlines with broad market wires, so a headline only
 * counts when it is about this ticker. It must also agree with the direction
 * of today's move: attaching "stock tumbles" to a +12% day is worse than
 * showing nothing at all.
 */
function pickNews(
  items: any[],
  symbol: string,
  name: string,
  sign: number,
  midnightTs: number,
  windowStartTs: number
): MoverNews | null {
  interface Candidate extends MoverNews { _ts: number }

  const toCandidate = (n: any): Candidate | null => {
    const ts = (n.datetime || 0) * 1000;
    if (!n.headline || ts < windowStartTs) return null;
    const dir = headlineDirection(n.headline);
    if (dir !== 0 && dir !== sign) return null;
    return {
      headline: n.headline,
      source: n.source || 'Market News',
      url: n.url || '',
      datetime: n.datetime || 0,
      _ts: ts,
    };
  };

  const candidates = ((items || []).map(toCandidate).filter(Boolean) as Candidate[])
    .sort((a, b) => b.datetime - a.datetime);

  if (candidates.length === 0) return null;

  const aboutTicker = candidates.filter(n =>
    (Array.isArray((n as any).related) && (n as any).related.includes(symbol)) ||
    mentions(n.headline, symbol)
  );
  const pool = aboutTicker.length > 0
    ? aboutTicker
    : candidates.filter(n => name && n.headline.toLowerCase().includes(name.toLowerCase()));

  if (pool.length === 0) return null;

  const todays = pool.filter(n => n._ts >= midnightTs);
  const top = todays[0] || pool[0];
  return { headline: top.headline, source: top.source, url: top.url, datetime: top.datetime };
}

async function attachNews(movers: MarketMover[]): Promise<MarketMover[]> {
  const now = new Date();
  const from = fmtDay(addDays(now, -3));
  const to = fmtDay(now);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = midnight.getTime();
  const windowStartTs = now.getTime() - NEWS_WINDOW_MS;

  return Promise.all(
    movers.map(async m => {
      try {
        const items = ((await getCompanyNews(m.symbol, from, to)) as any[]) || [];
        return {
          ...m,
          news: pickNews(items, m.symbol, m.name, Math.sign(m.changePct), midnightTs, windowStartTs),
        };
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