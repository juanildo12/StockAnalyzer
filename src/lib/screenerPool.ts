import { cacheGet, cacheSet } from '@/src/lib/cache';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

function getRaw(value: any): any {
  if (value && typeof value === 'object' && 'raw' in value) return value.raw;
  return value;
}

export interface PoolRow {
  symbol: string;
  price: number;
  changePercent: number;
  marketCap: number;
  sector: string;
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  divYield: number;
  roe: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  volume: number;
  avgVolume: number;
  weekHigh: number;
  weekLow: number;
}

const POOL_CACHE_KEY = 'screener:pool:full';
const POOL_CACHE_TTL = 300; // 5 minutes

export async function fetchPoolData(pool: string[]): Promise<PoolRow[]> {
  const cached = await cacheGet<PoolRow[]>(POOL_CACHE_KEY);
  if (cached && cached.length > 0) return cached;

  const rows: PoolRow[] = [];
  const BATCHConcurrency = 10;

  const batches: Array<Promise<PoolRow[]>> = [];
  for (let i = 0; i < pool.length; i += 10) {
    const batch = pool.slice(i, i + 10);
    batches.push(
      Promise.all(batch.map(async (sym) => {
        try {
          const [qs, q] = await Promise.all([
            yf.quoteSummary(sym, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'] }).catch(() => null),
            yf.quote(sym).catch(() => null),
          ]);
          if (!q || !q.regularMarketPrice) return null;
          const sd = (qs as any)?.summaryDetail || {};
          const dk = (qs as any)?.defaultKeyStatistics || {};
          const fd = (qs as any)?.financialData || {};
          return {
            symbol: sym,
            price: q.regularMarketPrice,
            changePercent: q.regularMarketChangePercent || 0,
            marketCap: getRaw(sd.marketCap) || 0,
            sector: (qs as any)?.assetProfile?.sector || '',
            peRatio: getRaw(sd.trailingPE) || null,
            pbRatio: getRaw(dk.priceToBook) || null,
            psRatio: getRaw(sd.priceToSalesTrailing12Months) || null,
            divYield: (getRaw(sd.dividendYield) || 0) * 100,
            roe: getRaw(fd.returnOnEquity) != null ? getRaw(fd.returnOnEquity) * 100 : null,
            profitMargin: getRaw(fd.profitMargins) != null ? getRaw(fd.profitMargins) * 100 : null,
            revenueGrowth: getRaw(fd.revenueGrowth) != null ? getRaw(fd.revenueGrowth) * 100 : null,
            earningsGrowth: getRaw(fd.earningsGrowth) != null ? getRaw(fd.earningsGrowth) * 100 : null,
            debtToEquity: getRaw(fd.debtToEquity) || null,
            volume: q.regularMarketVolume || 0,
            avgVolume: getRaw(sd.averageVolume) || 1,
            weekHigh: q.fiftyTwoWeekHigh || q.regularMarketPrice,
            weekLow: q.fiftyTwoWeekLow || q.regularMarketPrice,
          };
        } catch { return null; }
      })).then(r => r.filter(Boolean) as PoolRow[])
    );
  }

  for (let i = 0; i < batches.length; i += BATCHConcurrency) {
    const chunk = batches.slice(i, i + BATCHConcurrency);
    const chunkResults = await Promise.all(chunk);
    for (const result of chunkResults) rows.push(...result);
  }

  if (rows.length > 0) {
    await cacheSet(POOL_CACHE_KEY, rows, POOL_CACHE_TTL);
  }

  return rows;
}
