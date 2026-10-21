// Gamma Screener API — ranks NYSE / NASDAQ / AMEX names on options-market
// positioning (dealer gamma exposure), skew, momentum and liquidity.
//
// Universe strategy (staged, documented): a full real-time sweep of every
// listed symbol is not possible under the available free data plan (Yahoo
// rate limits, no Massive option snapshots). We therefore screen a PRIORITIZED
// LIQUID SUBSET (the trade-picks eligible universe, which is already gated for
// price / market cap / average volume, plus the curated STOCK_POOL). Results are
// cached; `refresh=1` bypasses the cache. This is stated in the response as
// `universe.mode` so the UI can label it honestly.

import { NextRequest, NextResponse } from 'next/server';
import { cacheAside } from '@/src/lib/cache';
import { STOCK_POOL, fetchTradePickUniverse } from '@/src/lib/stockPool';
import { buildScreenerRow, mapLimit, type ScreenerRow } from '@/src/lib/options/gammaScreenerService';
import {
  DEFAULT_POSITIONING,
  DEFAULT_EDGE_WEIGHTS,
  type ExpiryScope,
} from '@/src/lib/options/gammaScreener';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL = 180; // 3 min: gamma data is intra-day but heavy to compute
const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

// Universe size cap: bounds latency against the free data plan. Users can pass
// a smaller `limit` or a custom `symbols` list.
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 120;
const CONCURRENCY = 6;

type SortKey =
  | 'edge' | 'gammaRegime' | 'netGex' | 'netGexNorm' | 'skew' | 'momentum'
  | 'optVolume' | 'totalOi' | 'relVolume' | 'distCallWall' | 'distPutWall'
  | 'distFlip' | 'dataQuality';

interface ScreenerResponse {
  asOf: number;
  universe: { mode: 'liquid' | 'custom'; requested: number; scanned: number; limit: number };
  scope: ExpiryScope;
  positioning: { signCalls: number; signPuts: number; assumed: true };
  weights: typeof DEFAULT_EDGE_WEIGHTS;
  rows: ScreenerRow[];
  errors: { symbol: string; error: string }[];
  notes: string[];
}

/**
 * Priority ordering for the liquid universe: keep an interleaved, deterministic
 * order so the first `limit` symbols are a stable, broad sample. Sorting for the
 * UI happens on the full result set after scanning.
 */
function prioritize(universe: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const s of universe) {
    const u = s.toUpperCase();
    if (SYMBOL_RE.test(u) && !seen.has(u)) { seen.add(u); merged.push(u); }
  }
  return merged;
}

function validScope(v: string | null): ExpiryScope {
  if (v === 'nearest' || v === 'weekly' || v === 'monthly' || v === 'all') return v;
  return 'all';
}

async function resolveUniverse(req: NextRequest): Promise<{ symbols: string[]; mode: 'liquid' | 'custom' }> {
  const custom = req.nextUrl.searchParams.get('symbols');
  if (custom) {
    const list = custom.split(',').map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL_RE.test(s));
    return { symbols: prioritize(list), mode: 'custom' };
  }
  // Liquid subset: trade-picks eligible universe (gated) ∪ curated pool.
  const liquid = await fetchTradePickUniverse().catch(() => [...STOCK_POOL]);
  return { symbols: prioritize(liquid), mode: 'liquid' };
}

function sortValue(row: ScreenerRow, key: SortKey): number | null {
  switch (key) {
    case 'edge': return row.edge;
    case 'netGex': return row.netGex;
    case 'netGexNorm': return row.netGexNorm;
    case 'skew': return row.skewRiskReversal25;
    case 'optVolume': return row.optVolume;
    case 'totalOi': return row.totalOi;
    case 'relVolume': return row.relVolume;
    case 'distCallWall': return row.distCallWallPct;
    case 'distPutWall': return row.distPutWallPct;
    case 'distFlip': return row.distFlipPct;
    case 'dataQuality': return row.dataQuality.completeness;
    case 'gammaRegime': {
      const order: Record<string, number> = { positive: 2, neutral: 1, negative: 0, unknown: -1 };
      return order[row.gammaRegime] ?? -1;
    }
    case 'momentum': {
      const order: Record<string, number> = { bullish: 4, lean_bullish: 3, neutral: 2, lean_bearish: 1, bearish: 0 };
      return order[row.momentum] ?? -1;
    }
    default: return row.edge;
  }
}

function applySort(rows: ScreenerRow[], key: SortKey, dir: 'asc' | 'desc'): ScreenerRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls always last
    if (bv == null) return -1;
    return (av - bv) * sign;
  });
}

async function build(req: NextRequest): Promise<ScreenerResponse> {
  const scope = validScope(req.nextUrl.searchParams.get('scope'));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT));
  const { symbols: full, mode } = await resolveUniverse(req);
  const symbols = full.slice(0, limit);

  const errors: { symbol: string; error: string }[] = [];
  const results = await mapLimit(symbols, CONCURRENCY, async (sym) => {
    try {
      return await buildScreenerRow(sym, { scope, positioning: DEFAULT_POSITIONING, weights: DEFAULT_EDGE_WEIGHTS });
    } catch (e: any) {
      errors.push({ symbol: sym, error: e?.message || 'failed' });
      return null;
    }
  });

  const rows = results.filter((r): r is ScreenerRow => r != null);

  const notes: string[] = [
    'GEX es una ESTIMACIÓN bajo un supuesto de posición del dealer (calls + / puts −). El open interest no revela la posición real.',
    'Edge Score mide calidad del candidato, no probabilidad de beneficio.',
    'Universo: subconjunto líquido priorizado (no barrido completo en vivo bajo el plan de datos actual).',
  ];

  return {
    asOf: Date.now(),
    universe: { mode, requested: full.length, scanned: symbols.length, limit },
    scope,
    positioning: { signCalls: DEFAULT_POSITIONING.signCalls, signPuts: DEFAULT_POSITIONING.signPuts, assumed: true },
    weights: DEFAULT_EDGE_WEIGHTS,
    rows: applySort(rows, 'edge', 'desc'),
    errors,
    notes,
  };
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1' || req.nextUrl.searchParams.get('force') === '1';
  const scope = validScope(req.nextUrl.searchParams.get('scope'));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT));
  const symbolsParam = req.nextUrl.searchParams.get('symbols') || '';
  const cacheKey = `gamma-screener:v1:${scope}:${limit}:${symbolsParam.slice(0, 200)}`;

  try {
    const data = force ? await build(req) : await cacheAside<ScreenerResponse>(cacheKey, CACHE_TTL, () => build(req));

    // Post-cache sorting/filtering on the already-scanned rows.
    const sortKey = (req.nextUrl.searchParams.get('sort') as SortKey) || 'edge';
    const dir = req.nextUrl.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
    let rows = applySort(data.rows, sortKey, dir);

    const f = (k: string) => req.nextUrl.searchParams.get(k);
    const minEdge = f('minEdge') != null ? Number(f('minEdge')) : null;
    const regime = f('regime');
    const skew = f('skew');
    const momentum = f('momentum');
    const exchange = f('exchange');
    const minPrice = f('minPrice') != null ? Number(f('minPrice')) : null;
    const maxPrice = f('maxPrice') != null ? Number(f('maxPrice')) : null;
    const etf = f('etf'); // '1' | '0'
    const minOi = f('minOi') != null ? Number(f('minOi')) : null;
    const maxDistFlip = f('maxDistFlip') != null ? Number(f('maxDistFlip')) : null;

    if (minEdge != null && Number.isFinite(minEdge)) rows = rows.filter((r) => r.edge != null && r.edge >= minEdge);
    if (regime && regime !== 'all') rows = rows.filter((r) => r.gammaRegime === regime);
    if (skew && skew !== 'all') rows = rows.filter((r) => r.skewRegime === skew);
    if (momentum && momentum !== 'all') {
      if (momentum === 'bullish') rows = rows.filter((r) => r.momentum === 'bullish' || r.momentum === 'lean_bullish');
      else if (momentum === 'bearish') rows = rows.filter((r) => r.momentum === 'bearish' || r.momentum === 'lean_bearish');
      else rows = rows.filter((r) => r.momentum === momentum);
    }
    if (exchange) rows = rows.filter((r) => (r.exchange || '').toUpperCase().includes(exchange.toUpperCase()));
    if (minPrice != null && Number.isFinite(minPrice)) rows = rows.filter((r) => r.spot >= minPrice);
    if (maxPrice != null && Number.isFinite(maxPrice)) rows = rows.filter((r) => r.spot <= maxPrice);
    if (etf === '1') rows = rows.filter((r) => r.isEtf === true);
    if (etf === '0') rows = rows.filter((r) => r.isEtf !== true);
    if (minOi != null && Number.isFinite(minOi)) rows = rows.filter((r) => r.totalOi >= minOi);
    if (maxDistFlip != null && Number.isFinite(maxDistFlip)) {
      rows = rows.filter((r) => r.distFlipPct != null && Math.abs(r.distFlipPct) <= maxDistFlip);
    }

    return NextResponse.json({ ...data, rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'gamma screener failed' }, { status: 500 });
  }
}
