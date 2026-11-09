import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ContractReq = { symbol: string; type: 'CALL' | 'PUT'; strike: number; expiry: string };

type ContractQuote = {
  symbol: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiry: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spot: number | null;
  dte: number;
  source: 'mid' | 'last' | 'intrinsic' | 'none';
};

const CACHE_TTL = 60 * 1000; // 1 min
const chainCache = new Map<string, { data: any; ts: number }>();

function toDateStr(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.split('T')[0];
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  if (typeof raw === 'number') return new Date(raw).toISOString().split('T')[0];
  return null;
}

function dteOf(dateStr: string): number {
  return Math.max(0, Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86_400_000));
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mid del contrato si hay quote verificable; si no, último precio. */
function contractMark(c: any): { price: number | null; bid: number | null; ask: number | null; last: number | null; source: 'mid' | 'last' | 'none' } {
  const bid = num(c?.bid);
  const ask = num(c?.ask);
  const last = num(c?.lastPrice);
  if (bid != null && ask != null && ask >= bid) {
    return { price: (bid + ask) / 2, bid, ask, last, source: 'mid' };
  }
  if (last != null) return { price: last, bid, ask, last, source: 'last' };
  return { price: null, bid, ask, last, source: 'none' };
}

function intrinsic(spot: number | null, strike: number, type: 'CALL' | 'PUT'): number | null {
  if (spot == null) return null;
  return type === 'CALL' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

async function getChain(sym: string, dateStr: string): Promise<any | null> {
  const key = `${sym}:${dateStr}`;
  const now = Date.now();
  const hit = chainCache.get(key);
  if (hit && now - hit.ts < CACHE_TTL) return hit.data;

  const res: any = await yf
    .options(sym, { date: new Date(dateStr + 'T00:00:00.000Z') })
    .catch(() => null);
  const raw = res?.options?.[0] ?? null;
  chainCache.set(key, { data: raw, ts: Date.now() });
  return raw;
}

async function quoteSymbol(sym: string, contracts: ContractReq[]): Promise<Record<string, ContractQuote>> {
  const out: Record<string, ContractQuote> = {};

  const [quote, nearest] = await Promise.all([
    yf.quote(sym).catch(() => null),
    yf.options(sym).catch(() => null),
  ]);
  const spot = num(quote?.regularMarketPrice) ?? num(quote?.postMarketPrice) ?? num(quote?.preMarketPrice);

  const byExpiry = new Map<string, ContractReq[]>();
  for (const c of contracts) {
    const arr = byExpiry.get(c.expiry) || [];
    arr.push(c);
    byExpiry.set(c.expiry, arr);
  }

  for (const [expiry, list] of Array.from(byExpiry.entries())) {
    const dte = dteOf(expiry);
    const isPast = new Date(expiry + 'T23:59:59.999').getTime() < Date.now();
    let raw: any = null;

    if (!isPast) {
      raw = (nearest?.options || []).find((e: any) => toDateStr(e.expirationDate) === expiry) ?? null;
      if (!raw) raw = await getChain(sym, expiry);
    }

    for (const c of list) {
      const key = `${c.symbol}|${c.type}|${c.strike}|${c.expiry}`;
      const side = c.type === 'CALL' ? raw?.calls : raw?.puts;
      const row = Array.isArray(side)
        ? side.find((r: any) => Math.abs(Number(r.strike) - c.strike) < 0.001)
        : null;

      if (row) {
        const mark = contractMark(row);
        out[key] = {
          symbol: c.symbol, type: c.type, strike: c.strike, expiry: c.expiry,
          price: mark.price, bid: mark.bid, ask: mark.ask, last: mark.last,
          spot, dte, source: mark.source,
        };
      } else {
        // Vencido o sin fila: valor intrínseco con el spot actual (nunca se inventa una prima).
        const intr = isPast ? intrinsic(spot, c.strike, c.type) : null;
        out[key] = {
          symbol: c.symbol, type: c.type, strike: c.strike, expiry: c.expiry,
          price: intr, bid: null, ask: null, last: null, spot, dte,
          source: intr != null ? 'intrinsic' : 'none',
        };
      }
    }
  }

  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const raw: any[] = Array.isArray(body?.contracts) ? body.contracts : [];
    if (raw.length === 0) return NextResponse.json({ quotes: {} });

    const contracts: ContractReq[] = raw
      .map((c: any) => ({
        symbol: String(c?.symbol || '').toUpperCase().trim(),
        type: String(c?.type || '').toUpperCase() === 'PUT' ? 'PUT' as const : 'CALL' as const,
        strike: Number(c?.strike),
        expiry: toDateStr(c?.expiry) || '',
      }))
      .filter((c) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(c.symbol) && Number.isFinite(c.strike) && c.strike > 0 && c.expiry)
      .slice(0, 100);

    if (contracts.length === 0) return NextResponse.json({ quotes: {} });

    const bySymbol = new Map<string, ContractReq[]>();
    for (const c of contracts) {
      const arr = bySymbol.get(c.symbol) || [];
      arr.push(c);
      bySymbol.set(c.symbol, arr);
    }

    const quotes: Record<string, ContractQuote> = {};
    const symbols = Array.from(bySymbol.keys());
    const batchSize = 6;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((sym) => quoteSymbol(sym, bySymbol.get(sym)!).catch(() => ({} as Record<string, ContractQuote>))),
      );
      for (const r of results) Object.assign(quotes, r);
    }

    return NextResponse.json({ quotes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
