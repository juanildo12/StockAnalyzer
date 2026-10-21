import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { cacheAside } from '@/src/lib/cache';
import { fetchMassiveSafe, getMassiveDailyBars, hasMassive } from '@/src/services/massiveClient';
import { getHistoricalData } from '@/src/services/yahooFinance';
import {
  computeGammaLevels,
  contractsFromChain,
  ivFromOptionPrice,
  type GammaLevelsResult,
} from '@/src/lib/options/gamma';
import { buildPlaybook, classifyMomentum, type PlaybookLevel, type MomentumResult } from '@/src/lib/options/gammaScreener';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL = 90; // intra-día: el spot pre/post se mueve, refrescar seguido
const MASSIVE_WAIT_MS = 1200; // no bloquear el render esperando slot Massive

interface GammaCheckIv {
  strike: number;
  type: 'call' | 'put';
  yahooIv: number;
  massiveIv: number | null;
  deviationPct: number | null;
}

interface GammaBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface GammaLevelsResponse {
  symbol: string;
  spot: number;
  asOf: number;
  expiry: string | null;
  dte: number;
  levels: GammaLevelsResult;
  playbook: PlaybookLevel[];
  momentum: MomentumResult | null;
  bars: GammaBar[];
  source: {
    chain: 'yahoo' | 'massive';
    massiveContracts: boolean;
    ivCheck: GammaCheckIv[] | null;
  };
  coverage: {
    yahooStrikes: number;
    massiveStrikes: number;
    extraStrikes: number[]; // present in Massive, missing in Yahoo
  } | null;
  marketState?: string;
  priceBasis?: 'pre' | 'post' | 'regular';
}

function toDateStr(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.split('T')[0];
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  if (typeof raw === 'number') return new Date(raw).toISOString().split('T')[0];
  return null;
}

/**
 * Spot según el estado del mercado: así los niveles se recalculan con el
 * precio pre/post-market aunque el OI/IV de la chain sigan del cierre previo.
 */
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

/** Pick the expiration closest to the target DTE (default ~38 days). */
function pickExpiration<T extends { dte: number }>(expirations: T[], targetDte: number): T | null {
  const usable = expirations.filter((e) => e.dte >= 1);
  if (usable.length === 0) return null;
  return usable.reduce((best, e) => (Math.abs(e.dte - targetDte) < Math.abs(best.dte - targetDte) ? e : best));
}

/** Last ~60 daily bars for the mini chart: Massive free tier first, Yahoo fallback. */
async function fetchBars(sym: string): Promise<GammaBar[]> {
  const toMs = Date.now();
  const fromMs = toMs - 90 * 86_400_000;
  try {
    const massiveBars = await getMassiveDailyBars(sym, fromMs, toMs).catch(() => []);
    if (massiveBars.length > 0) {
      return massiveBars.slice(-60).map((b) => ({
        t: b.date.getTime(),
        o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume,
      }));
    }
  } catch { /* fall through to Yahoo */ }
  const hist = await getHistoricalData(sym).catch(() => []);
  return hist.slice(-60).map((h) => ({
    t: new Date(h.date).getTime(),
    o: h.open, h: h.high, l: h.low, c: h.close, v: h.volume,
  })).filter((b) => Number.isFinite(b.t) && b.c > 0);
}

async function build(sym: string, targetDte: number): Promise<GammaLevelsResponse> {
  const [quote, chain, bars] = await Promise.all([
    yf.quote(sym).catch(() => null),
    yf.options(sym).catch(() => null),
    fetchBars(sym),
  ]);
  if (!quote?.regularMarketPrice) throw new Error('No quote data');
  const { price: spot, basis: priceBasis } = liveSpot(quote);
  if (!Number.isFinite(spot) || spot <= 0) throw new Error('No quote data');
  if (!chain?.options?.length) throw new Error('No options chain');

  // Yahoo trae solo 1 expiración en `options` (la más cercana); la lista
  // completa vive en `expirationDates` y cada fecha se pide con { date }.
  const dateStrs = new Set<string>();
  for (const d of chain.expirationDates || []) {
    const s = toDateStr(d);
    if (s) dateStrs.add(s);
  }
  for (const exp of chain.options || []) {
    const s = toDateStr((exp as any).expirationDate);
    if (s) dateStrs.add(s);
  }
  const expirations = Array.from(dateStrs)
    .map((date) => ({ date, dte: dteOf(date) }))
    .filter((e) => e.dte >= 1);

  const picked = pickExpiration(expirations, targetDte);
  if (!picked) throw new Error('No future expirations');

  // Cargar la chain de la expiración elegida (si no es la que ya viene cargada)
  let raw = (chain.options || []).find((e: any) => toDateStr(e.expirationDate) === picked.date);
  if (!raw) {
    const withDate: any = await yf
      .options(sym, { date: new Date(picked.date + 'T00:00:00.000Z') })
      .catch(() => null);
    raw = withDate?.options?.[0];
  }
  const expiryDate = raw ? toDateStr(raw.expirationDate) : null;
  const dte = expiryDate ? dteOf(expiryDate) : 0;
  if (!raw || !expiryDate || dte < 1) throw new Error('No future expirations');

  const contracts = contractsFromChain(raw.calls || [], raw.puts || []);
  const levels = computeGammaLevels({ contracts, spot, dte, expiry: expiryDate });
  const playbook: PlaybookLevel[] = buildPlaybook(
    { callWall: levels.gammaWallUp, putWall: levels.gammaWallDown, gammaFlip: levels.gammaFlip },
    spot,
  );
  const momentum: MomentumResult | null = bars.length >= 50
    ? classifyMomentum({ closes: bars.map((b) => b.c), price: spot, volumes: bars.map((b) => b.v) })
    : null;

  // ── Massive free-tier complement (best-effort, never blocking) ──────────────
  let massiveContracts = false;
  let ivCheck: GammaCheckIv[] | null = null;
  let coverage: GammaLevelsResponse['coverage'] = null;

  if (hasMassive()) {
    const ref = await fetchMassiveSafe(
      `/v3/reference/options/contracts?underlying_ticker=${sym}&expiration_date=${expiryDate}&limit=1000`,
      { maxWaitMs: MASSIVE_WAIT_MS }
    ).catch(() => null);

    const massiveList: { strike: number; type: 'call' | 'put'; ticker: string }[] = ref?.results
      ? ref.results.map((r: any) => ({
          strike: Number(r.strike_price),
          type: r.contract_type === 'put' ? ('put' as const) : ('call' as const),
          ticker: String(r.ticker),
        })).filter((r: any) => Number.isFinite(r.strike))
      : [];

    if (massiveList.length > 0) {
      massiveContracts = true;
      const yahooStrikes = new Set(contracts.map((c) => c.strike));
      const massiveStrikes = new Set(massiveList.map((c) => c.strike));
      const extraStrikes = Array.from(massiveStrikes).filter((s) => !yahooStrikes.has(s)).sort((a, b) => a - b);

      // IV cross-check: ATM call + put (2 Massive req max, next expirations aggs)
      const T = Math.max(dte, 1) / 365;
      const nearestAtm = (type: 'call' | 'put') =>
        massiveList
          .filter((c) => c.type === type)
          .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))[0];

      const checks: GammaCheckIv[] = [];
      for (const atm of [nearestAtm('call'), nearestAtm('put')]) {
        if (!atm) continue;
        const yahooC = contracts.find((c) => c.strike === atm.strike && c.type === atm.type);
        const prev = await fetchMassiveSafe(
          `/v2/aggs/ticker/${encodeURIComponent(atm.ticker)}/prev`,
          { maxWaitMs: MASSIVE_WAIT_MS }
        ).catch(() => null);
        const close = prev?.results?.[0]?.c;
        const massiveIv =
          typeof close === 'number' && close > 0
            ? ivFromOptionPrice(close, spot, atm.strike, T, atm.type === 'call')
            : null;
        checks.push({
          strike: atm.strike,
          type: atm.type,
          yahooIv: yahooC?.iv ?? 0,
          massiveIv,
          deviationPct:
            massiveIv != null && yahooC?.iv
              ? ((massiveIv - yahooC.iv) / yahooC.iv) * 100
              : null,
        });
      }
      ivCheck = checks.length > 0 ? checks : null;
      coverage = {
        yahooStrikes: yahooStrikes.size,
        massiveStrikes: massiveStrikes.size,
        extraStrikes: extraStrikes.slice(0, 50),
      };
    }
  }

  return {
    symbol: sym,
    spot,
    asOf: Date.now(),
    expiry: expiryDate,
    dte: dte,
    levels,
    playbook,
    momentum,
    bars,
    source: {
      chain: massiveContracts ? 'massive' : 'yahoo',
      massiveContracts,
      ivCheck,
    },
    coverage,
    marketState: quote.marketState,
    priceBasis,
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol || !symbol.trim()) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }
  const sym = symbol.trim().toUpperCase();
  const targetDte = Math.min(120, Math.max(1, Number(req.nextUrl.searchParams.get('dte')) || 38));
  const force = req.nextUrl.searchParams.get('force') === '1';

  try {
    const data = force
      ? await build(sym, targetDte)
      : await cacheAside(`gamma-levels:${sym}:${targetDte}`, CACHE_TTL, () => build(sym, targetDte));
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'gamma levels failed' }, { status: 500 });
  }
}
