import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { cacheAside } from '@/src/lib/cache';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL = 90; // intra-día: spot y quotes se mueven
const MAX_EXPIRATIONS = 6;
const MAX_STRIKES_PER_SIDE = 40;

interface SimContract {
  strike: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  mid: number; // reference only — not a guarantee of execution
  last: number;
  iv: number; // annualized decimal
  volume: number;
  openInterest: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  inTheMoney: boolean;
}

interface SimExpiration {
  date: string;
  dte: number;
  calls: SimContract[];
  puts: SimContract[];
}

interface OptionsSimResponse {
  symbol: string;
  spot: number;
  asOf: number;
  marketState?: string;
  priceBasis?: 'pre' | 'post' | 'regular';
  expirations: SimExpiration[];
  source: 'yahoo';
}

function toDateStr(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.split('T')[0];
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  if (typeof raw === 'number') return new Date(raw).toISOString().split('T')[0];
  return null;
}

function liveSpot(quote: any): { price: number; basis: 'pre' | 'post' | 'regular' } {
  const state = String(quote?.marketState || '');
  const pre = quote?.preMarketPrice;
  const post = quote?.postMarketPrice;
  const reg = quote?.regularMarketPrice;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (state === 'PRE' && ok(pre)) return { price: pre, basis: 'pre' };
  if ((state === 'POST' || state === 'POSTPOST' || state === 'CLOSED') && ok(post)) {
    return { price: post, basis: 'post' };
  }
  if (ok(reg)) return { price: reg, basis: 'regular' };
  if (ok(post)) return { price: post, basis: 'post' };
  return { price: pre, basis: 'pre' };
}

function dteOf(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86_400_000));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize a Yahoo contract into the simulator shape (mid is best-effort). */
function normalizeContract(c: any, type: 'call' | 'put'): SimContract | null {
  const strike = num(c?.strike);
  if (!Number.isFinite(strike) || strike <= 0) return null;
  const bid = num(c?.bid);
  const ask = num(c?.ask);
  const last = num(c?.lastPrice);
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
  const g = c?.greeks || {};
  return {
    strike,
    type,
    bid,
    ask,
    mid: Number.isFinite(mid) ? mid : 0,
    last,
    iv: num(c?.impliedVolatility),
    volume: num(c?.volume),
    openInterest: num(c?.openInterest),
    delta: typeof g.delta === 'number' ? g.delta : null,
    gamma: typeof g.gamma === 'number' ? g.gamma : null,
    theta: typeof g.theta === 'number' ? g.theta : null,
    vega: typeof g.vega === 'number' ? g.vega : null,
    inTheMoney: !!c?.inTheMoney,
  };
}

/** Keep the strikes closest to spot, preserving chain order by strike. */
function sliceStrikes(contracts: SimContract[], spot: number): SimContract[] {
  if (contracts.length <= MAX_STRIKES_PER_SIDE) return contracts.sort((a, b) => a.strike - b.strike);
  return contracts
    .map((c) => ({ c, d: Math.abs(c.strike - spot) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_STRIKES_PER_SIDE)
    .map((x) => x.c)
    .sort((a, b) => a.strike - b.strike);
}

async function build(sym: string): Promise<OptionsSimResponse> {
  const [quote, chain] = await Promise.all([
    yf.quote(sym).catch(() => null),
    yf.options(sym).catch(() => null),
  ]);
  if (!quote) throw new Error('No quote data');
  const { price: spot, basis } = liveSpot(quote);
  if (!Number.isFinite(spot) || spot <= 0) throw new Error('No quote data');
  if (!chain || !chain.options || chain.options.length === 0) throw new Error('No options chain');

  // Yahoo trae solo 1 expiración en `options`; la lista completa está en
  // `expirationDates` y cada fecha se pide con { date }.
  const dateStrs = new Set<string>();
  for (const d of (chain as any).expirationDates || []) {
    const s = toDateStr(d);
    if (s) dateStrs.add(s);
  }
  for (const exp of chain.options || []) {
    const s = toDateStr((exp as any).expirationDate);
    if (s) dateStrs.add(s);
  }
  const expirationsList = Array.from(dateStrs)
    .map((date) => ({ date, dte: dteOf(date) }))
    .filter((e) => e.dte >= 1)
    .sort((a, b) => a.dte - b.dte)
    .slice(0, MAX_EXPIRATIONS);

  const loaded = new Map<string, any>();
  for (const exp of chain.options || []) {
    const s = toDateStr((exp as any).expirationDate);
    if (s) loaded.set(s, exp);
  }

  const out: SimExpiration[] = [];
  for (const item of expirationsList) {
    let raw = loaded.get(item.date);
    if (!raw) {
      const withDate: any = await yf
        .options(sym, { date: new Date(item.date + 'T00:00:00.000Z') })
        .catch(() => null);
      raw = withDate?.options?.[0];
    }
    if (!raw) continue;
    const calls = (raw.calls || [])
      .map((c: any) => normalizeContract(c, 'call'))
      .filter((c: SimContract | null): c is SimContract => c !== null && c.mid > 0);
    const puts = (raw.puts || [])
      .map((c: any) => normalizeContract(c, 'put'))
      .filter((c: SimContract | null): c is SimContract => c !== null && c.mid > 0);
    if (calls.length === 0 && puts.length === 0) continue;
    out.push({
      date: item.date,
      dte: item.dte,
      calls: sliceStrikes(calls, spot),
      puts: sliceStrikes(puts, spot),
    });
  }

  if (out.length === 0) throw new Error('No options chain');

  return {
    symbol: sym,
    spot,
    asOf: Date.now(),
    marketState: String(quote.marketState || ''),
    priceBasis: basis,
    expirations: out,
    source: 'yahoo',
  };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }
  const sym = symbol.toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }
  const force = request.nextUrl.searchParams.get('force') === '1';

  try {
    const data = force
      ? await build(sym)
      : await cacheAside(`options-sim:${sym}`, CACHE_TTL, () => build(sym));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Options sim error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
