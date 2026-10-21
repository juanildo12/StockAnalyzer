// Gamma Screener service layer — data acquisition + per-symbol metric
// computation. Provider-agnostic at the boundary: swap `buildScreenerRow`'s
// chain/quote source (Yahoo today) without touching the scoring engine.
//
// Yahoo `yf.options` returns the nearest expiration in `options` and the full
// list in `expirationDates`; other expirations are fetched with { date }.
// Greeks are computed locally (Yahoo mostly omits them). OI/volume/IV come from
// the real chain. Nothing is fabricated: missing fields stay null.

import YahooFinance from 'yahoo-finance2';
import { getHistoricalData } from '@/src/services/yahooFinance';
import {
  computeGammaLevelsMulti,
  computeSkew,
  classifyMomentum,
  computeEdgeScore,
  assessDataQuality,
  DEFAULT_POSITIONING,
  DEFAULT_EDGE_WEIGHTS,
  type ScreenerContract,
  type ExpiryScope,
  type DealerPositioning,
  type EdgeWeights,
  type GammaLevelsMultiResult,
  type SkewResult,
  type MomentumResult,
  type EdgeBreakdown,
  type DataQuality,
  type GammaRegime,
  type SkewRegime,
  type MomentumClass,
} from './gammaScreener';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface ScreenerRow {
  symbol: string;
  name: string | null;
  exchange: string | null;
  spot: number;
  changePct: number | null;
  asOf: number;
  marketState: string | null;
  priceBasis: 'pre' | 'post' | 'regular';

  edge: number | null;
  edgeBreakdown: EdgeBreakdown['components'] | null;
  edgeAvailable: boolean;
  gammaRegime: GammaRegime;
  skewRegime: SkewRegime;
  skewRiskReversal25: number | null;
  atmIv: number | null;
  momentum: MomentumClass;
  momentumRet20d: number | null;
  relVolume: number | null;

  callWall: number | null;
  putWall: number | null;
  gammaFlip: number | null;
  distCallWallPct: number | null;
  distPutWallPct: number | null;
  distFlipPct: number | null;

  netGex: number;
  netGexNorm: number | null;
  totalCallGex: number;
  totalPutGex: number;

  optVolume: number;
  callVolume: number;
  putVolume: number;
  putCallVolumeRatio: number | null;
  totalOi: number;
  callOi: number;
  putOi: number;
  liquidity: 'high' | 'medium' | 'low' | 'unknown';

  scope: ExpiryScope;
  expirations: string[];
  dataQuality: DataQuality;
  warnings: string[];
  isEtf: boolean | null;

  gexByStrike: { strike: number; netGex: number; callGex: number; putGex: number; callOi: number; putOi: number }[];
}

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

function liveSpot(quote: any): { price: number; basis: 'pre' | 'post' | 'regular' } {
  const state = String(quote?.marketState || '');
  const pre = quote?.preMarketPrice;
  const post = quote?.postMarketPrice;
  const reg = quote?.regularMarketPrice;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (state === 'PRE' && ok(pre)) return { price: pre, basis: 'pre' };
  if ((state === 'POST' || state === 'POSTPOST' || state === 'CLOSED') && ok(post)) return { price: post, basis: 'post' };
  if (ok(reg)) return { price: reg, basis: 'regular' };
  if (ok(post)) return { price: post, basis: 'post' };
  return { price: pre, basis: 'pre' };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a normalized contract list across up to `maxExpiries` expirations,
 * with volume/OI preserved (NaN when absent, never silently zeroed), and DTE
 * computed per expiration. IV garbage is left as-is; the engine filters it.
 */
export async function fetchChainContracts(
  symbol: string,
  maxExpiries = 4
): Promise<{ contracts: ScreenerContract[]; expirations: string[]; hadChain: boolean }> {
  const chain: any = await yf.options(symbol as any).catch(() => null);
  if (!chain?.options?.length && !chain?.expirationDates?.length) {
    return { contracts: [], expirations: [], hadChain: false };
  }

  const dateStrs = new Set<string>();
  for (const d of chain.expirationDates || []) { const s = toDateStr(d); if (s) dateStrs.add(s); }
  for (const exp of chain.options || []) { const s = toDateStr(exp?.expirationDate); if (s) dateStrs.add(s); }

  const expirations = Array.from(dateStrs)
    .map((date) => ({ date, dte: dteOf(date) }))
    .filter((e) => e.dte >= 1)
    .sort((a, b) => a.dte - b.dte)
    .slice(0, maxExpiries);

  const contracts: ScreenerContract[] = [];
  const included: string[] = [];

  for (const exp of expirations) {
    let raw = (chain.options || []).find((e: any) => toDateStr(e?.expirationDate) === exp.date);
    if (!raw) {
      const withDate: any = await yf.options(symbol as any, { date: new Date(exp.date + 'T00:00:00.000Z') } as any).catch(() => null);
      raw = withDate?.options?.[0];
    }
    if (!raw) continue;
    const expiry = toDateStr(raw.expirationDate) || exp.date;
    const dte = dteOf(expiry);
    included.push(expiry);
    const push = (c: any, type: 'call' | 'put') => {
      const strike = num(c?.strike);
      if (strike == null) return;
      contracts.push({
        strike,
        type,
        oi: num(c?.openInterest) ?? NaN,
        volume: num(c?.volume) ?? NaN,
        iv: num(c?.impliedVolatility) ?? NaN,
        delta: num(c?.delta),
        expiry,
        dte,
      });
    };
    for (const c of raw.calls || []) push(c, 'call');
    for (const p of raw.puts || []) push(p, 'put');
  }

  return { contracts, expirations: included, hadChain: included.length > 0 };
}

function liquidityClass(totalOi: number, callVolume: number, putVolume: number): 'high' | 'medium' | 'low' | 'unknown' {
  const vol = callVolume + putVolume;
  if (totalOi <= 0 && vol <= 0) return 'unknown';
  if (totalOi >= 100_000 && vol >= 5_000) return 'high';
  if (totalOi >= 10_000 && vol >= 500) return 'medium';
  return 'low';
}

export interface BuildRowOptions {
  scope?: ExpiryScope;
  positioning?: DealerPositioning;
  weights?: EdgeWeights;
  now?: number;
}

/** Compute a full screener row for one symbol from real quote + chain data. */
export async function buildScreenerRow(symbol: string, opts: BuildRowOptions = {}): Promise<ScreenerRow | null> {
  const scope = opts.scope ?? 'all';
  const positioning = opts.positioning ?? DEFAULT_POSITIONING;
  const weights = opts.weights ?? DEFAULT_EDGE_WEIGHTS;
  const now = opts.now ?? Date.now();

  const [quoteRaw, chainData, hist] = await Promise.all([
    yf.quote(symbol as any).catch(() => null),
    fetchChainContracts(symbol, 4),
    getHistoricalData(symbol).catch(() => []),
  ]);
  const quote: any = quoteRaw;

  if (!quote?.regularMarketPrice && !quote?.postMarketPrice && !quote?.preMarketPrice) return null;
  const { price: spot, basis } = liveSpot(quote);
  if (!Number.isFinite(spot) || spot <= 0) return null;

  const contracts = chainData.contracts;
  const usableContracts = contracts.filter(
    (c) => Number.isFinite(c.oi) && c.oi > 0 && Number.isFinite(c.iv) && c.iv >= 0.005 && c.iv <= 5
  );

  // Volumes / OI summed over the fetched expirations (real values only).
  let callVolume = 0, putVolume = 0, callOi = 0, putOi = 0;
  for (const c of contracts) {
    const vol = Number.isFinite(c.volume) ? Math.max(0, c.volume) : 0;
    const oi = Number.isFinite(c.oi) ? Math.max(0, c.oi) : 0;
    if (c.type === 'call') { callVolume += vol; callOi += oi; }
    else { putVolume += vol; putOi += oi; }
  }
  const totalOi = callOi + putOi;
  const optVolume = callVolume + putVolume;

  const gamma = computeGammaLevelsMulti(usableContracts, spot, scope, positioning);
  const skew = computeSkew(usableContracts, spot, 30);

  const closes = hist.map((h) => h.close).filter((v) => Number.isFinite(v) && v > 0);
  const volumes = hist.map((h) => h.volume).filter((v) => Number.isFinite(v)) as number[];
  const momentum = classifyMomentum({ closes, price: spot, volumes });

  const strikes = new Set(usableContracts.map((c) => c.strike)).size;
  const expiries = new Set(usableContracts.map((c) => c.expiry)).size;
  const dataQuality = assessDataQuality({
    asOf: num(quote?.regularMarketTime) != null ? (num(quote.regularMarketTime) as number) * 1000 : now,
    now,
    hasChain: chainData.hadChain,
    strikes,
    expirations: expiries,
    usableContracts: usableContracts.length,
    expectedContracts: strikes * 2,
  });

  const edge = computeEdgeScore(
    { gamma, skew, momentum, spot, totalOptionVolume: optVolume, totalOi, dataCompleteness: dataQuality.completeness },
    weights
  );

  const warnings = [...dataQuality.warnings];
  if (putOi === 0 && callOi > 0) warnings.push('Sin open interest en puts');
  if (callOi === 0 && putOi > 0) warnings.push('Sin open interest en calls');
  if (!edge.available && edge.reason) warnings.push(edge.reason);

  return {
    symbol,
    name: (quote as any)?.longName || (quote as any)?.shortName || null,
    exchange: (quote as any)?.fullExchangeName || (quote as any)?.exchange || null,
    spot,
    changePct: num((quote as any)?.regularMarketChangePercent),
    asOf: num(quote?.regularMarketTime) != null ? (num(quote.regularMarketTime) as number) * 1000 : now,
    marketState: (quote as any)?.marketState ?? null,
    priceBasis: basis,

    edge: edge.score,
    edgeBreakdown: edge.available ? edge.components : null,
    edgeAvailable: edge.available,
    gammaRegime: gamma.regime,
    skewRegime: skew.regime,
    skewRiskReversal25: skew.riskReversal25,
    atmIv: skew.atmIv,
    momentum: momentum.classification,
    momentumRet20d: momentum.ret20d,
    relVolume: momentum.relVolume,

    callWall: gamma.callWall,
    putWall: gamma.putWall,
    gammaFlip: gamma.gammaFlip,
    distCallWallPct: gamma.distCallWallPct,
    distPutWallPct: gamma.distPutWallPct,
    distFlipPct: gamma.distFlipPct,

    netGex: gamma.totalNetGex,
    netGexNorm: gamma.netGexNorm,
    totalCallGex: gamma.totalCallGex,
    totalPutGex: gamma.totalPutGex,

    optVolume,
    callVolume,
    putVolume,
    putCallVolumeRatio: callVolume > 0 ? putVolume / callVolume : null,
    totalOi,
    callOi,
    putOi,
    liquidity: liquidityClass(totalOi, callVolume, putVolume),

    scope,
    expirations: chainData.expirations,
    dataQuality,
    warnings,
    isEtf: (quote as any)?.quoteType ? (quote as any).quoteType === 'ETF' : null,

    gexByStrike: gamma.gex.map((g) => ({
      strike: g.strike, netGex: g.netGex, callGex: g.callGex, putGex: g.putGex, callOi: g.callOi, putOi: g.putOi,
    })),
  };
}

/** Bounded-concurrency map to keep Yahoo requests from stampeding. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      try { out[i] = await fn(items[i], i); }
      catch { out[i] = undefined as unknown as R; }
    }
  });
  await Promise.all(workers);
  return out;
}

export type { GammaLevelsMultiResult, SkewResult, MomentumResult, EdgeBreakdown, DataQuality };
