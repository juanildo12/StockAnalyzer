import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { cacheAside, cacheGet, cacheSet } from '@/src/lib/cache';
import {
  computeBoth,
  aggregateContracts,
  ratioZone,
  percentileRank,
  type PcrContract,
  type PcrHistoryPoint,
  type RatioComputation,
} from '@/src/lib/options/pcr';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL = 90; // intra-día
const HISTORY_TTL = 90 * 86_400; // 90 días
const HISTORY_MAX = 90;
// ETF proxies with liquid option chains (cash indices ^GSPC/^VIX are not
// optionable and Yahoo exposes no chain for them).
const MARKET_UNIVERSE = ['SPY', 'QQQ', 'IWM', 'DIA'];

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

interface PcrSymbolPart {
  symbol: string;
  /** Volume-based ratio for this member (null = undefined/zero denom). */
  volumeRatio: number | null;
  /** Open-interest-based ratio for this member. */
  oiRatio: number | null;
  putVolume: number;
  callVolume: number;
  putOi: number;
  callOi: number;
  error?: string;
}

interface PcrResponse {
  universe: string;
  kind: 'symbol' | 'index' | 'market';
  members: string[];
  spot: number | null;
  volumeRatio: number | null;
  oiRatio: number | null;
  volume: RatioComputation;
  openInterest: RatioComputation;
  zone: 'low' | 'balanced' | 'high' | 'na';
  oiZone: 'low' | 'balanced' | 'high' | 'na';
  volumePercentile: number | null;
  oiPercentile: number | null;
  history: PcrHistoryPoint[];
  parts: PcrSymbolPart[];
  source: string;
  asOf: number;
  updatedAt: string;
  notes: string[];
}

function toDateStr(d = new Date()): string {
  return d.toISOString().split('T')[0];
}

/** Normalize one symbol's chain (nearest expiration calls+puts) into rows. */
function chainRows(calls: any[], puts: any[]): PcrContract[] {
  const out: PcrContract[] = [];
  const push = (arr: any[], type: 'call' | 'put') => {
    for (const c of arr || []) {
      out.push({
        type,
        volume: Number.isFinite(Number(c?.volume)) ? Number(c.volume) : NaN,
        openInterest: Number.isFinite(Number(c?.openInterest)) ? Number(c.openInterest) : NaN,
      });
    }
  };
  push(calls, 'call');
  push(puts, 'put');
  return out;
}

async function fetchSymbolRows(sym: string): Promise<{ rows: PcrContract[]; spot: number | null; error?: string }> {
  try {
    const [quote, chain] = await Promise.all([
      yf.quote(sym).catch(() => null),
      yf.options(sym).catch(() => null),
    ]);
    const spot = Number((quote as any)?.regularMarketPrice);
    if (!chain || !Array.isArray(chain.options) || chain.options.length === 0) {
      return { rows: [], spot: Number.isFinite(spot) ? spot : null, error: 'Sin cadena de opciones' };
    }
    // Nearest expiration carries today's volume/OI activity.
    const nearest = chain.options[0];
    const rows = chainRows(nearest?.calls || [], nearest?.puts || []);
    return { rows, spot: Number.isFinite(spot) ? spot : null };
  } catch (e: any) {
    return { rows: [], spot: null, error: e?.message || 'Error' };
  }
}

async function readHistory(key: string): Promise<PcrHistoryPoint[]> {
  const h = await cacheGet<PcrHistoryPoint[]>(key);
  return Array.isArray(h) ? h : [];
}

/** Append/update today's point, keeping the series bounded. */
async function appendHistory(
  key: string,
  point: PcrHistoryPoint,
  existing: PcrHistoryPoint[]
): Promise<PcrHistoryPoint[]> {
  const today = point.date;
  const cleaned = existing.filter((p) => p && p.date && p.date !== today);
  const next = [...cleaned, point].sort((a, b) => a.date.localeCompare(b.date)).slice(-HISTORY_MAX);
  await cacheSet(key, next, HISTORY_TTL).catch(() => {});
  return next;
}

async function build(universeParam: string | null, symbolParam: string | null): Promise<PcrResponse> {
  const notes: string[] = [];
  let kind: PcrResponse['kind'] = 'symbol';
  let members: string[];
  let label: string;

  const uni = (universeParam || '').toLowerCase();
  if (uni === 'market' || uni === 'aggregate') {
    kind = 'market';
    members = MARKET_UNIVERSE;
    label = 'Mercado (SPY·QQQ·IWM·DIA)';
  } else if (uni.startsWith('index:')) {
    kind = 'index';
    const idx = uni.slice('index:'.length).toUpperCase();
    members = [idx];
    label = `Índice (${idx})`;
  } else if (uni.startsWith('symbol:') || symbolParam) {
    kind = 'symbol';
    const s = (uni.startsWith('symbol:') ? uni.slice('symbol:'.length) : symbolParam || '').toUpperCase();
    members = [s];
    label = s;
  } else {
    throw new Error('Falta symbol o universe');
  }

  for (const m of members) {
    if (!SYMBOL_RE.test(m)) throw new Error(`Símbolo inválido: ${m}`);
  }

  // Fetch each member (sequentially to respect Yahoo; universe is small).
  const parts: PcrSymbolPart[] = [];
  const perSymbolRows: PcrContract[][] = [];
  let spot: number | null = null;

  for (const m of members) {
    const { rows, spot: sp, error } = await fetchSymbolRows(m);
    perSymbolRows.push(rows);
    if (spot == null && sp != null) spot = sp;
    const both = computeBoth(rows);
    parts.push({
      symbol: m,
      volumeRatio: both.volume.ratio,
      oiRatio: both.openInterest.ratio,
      putVolume: both.volume.putTotal,
      callVolume: both.volume.callTotal,
      putOi: both.openInterest.putTotal,
      callOi: both.openInterest.callTotal,
      ...(error ? { error } : {}),
    });
  }

  const allRows = aggregateContracts(perSymbolRows);
  const volume = computeBoth(allRows).volume;
  const openInterest = computeBoth(allRows).openInterest;

  if (volume.empty && openInterest.empty) notes.push('Sin datos de volumen ni open interest.');
  if (volume.denominatorZero) notes.push('Volumen de calls = 0 → ratio de volumen indefinido.');
  if (openInterest.denominatorZero) notes.push('Open interest de calls = 0 → ratio de OI indefinido.');
  if (volume.incomplete || openInterest.incomplete) notes.push('Algunos contratos tenían datos incompletos y se excluyeron.');

  const historyKey = `pcr:history:${kind}:${members.join('_')}`;
  const existing = await readHistory(historyKey);
  const today = toDateStr();
  const history = await appendHistory(
    historyKey,
    { date: today, volumeRatio: volume.ratio, oiRatio: openInterest.ratio },
    existing
  );

  const volSeries = history.map((h) => h.volumeRatio).filter((v): v is number => v != null);
  const oiSeries = history.map((h) => h.oiRatio).filter((v): v is number => v != null);

  return {
    universe: label,
    kind,
    members,
    spot,
    volumeRatio: volume.ratio,
    oiRatio: openInterest.ratio,
    volume,
    openInterest,
    zone: ratioZone(volume.ratio),
    oiZone: ratioZone(openInterest.ratio),
    volumePercentile: percentileRank(volSeries, volume.ratio),
    oiPercentile: percentileRank(oiSeries, openInterest.ratio),
    history,
    parts,
    source: 'Yahoo Finance (yf.options)',
    asOf: Date.now(),
    updatedAt: new Date().toISOString(),
    notes,
  };
}

export async function GET(request: NextRequest) {
  const symbolParam = request.nextUrl.searchParams.get('symbol');
  const universeParam = request.nextUrl.searchParams.get('universe');
  if (!symbolParam && !universeParam) {
    return NextResponse.json({ error: 'Falta symbol o universe' }, { status: 400 });
  }
  const force = request.nextUrl.searchParams.get('force') === '1';

  try {
    const key = `pcr:v1:${(universeParam || '').toLowerCase()}:${(symbolParam || '').toUpperCase()}`;
    const data = force
      ? await build(universeParam, symbolParam)
      : await cacheAside(key, CACHE_TTL, () => build(universeParam, symbolParam));
    return NextResponse.json(data);
  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    const status = /inválido|Falta/i.test(msg) ? 400 : /Sin cadena|Sin datos/i.test(msg) ? 404 : 500;
    if (status === 500) console.error('Put/Call ratio error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
