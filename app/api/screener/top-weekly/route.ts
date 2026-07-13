import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getQuote as finnhubQuote } from '@/src/services/finnhubClient';

const yf = new YahooFinance();

export const dynamic = 'force-dynamic';

const POOL = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'CRM',
  'ORCL', 'ADBE', 'KO', 'PEP', 'WMT', 'COST', 'MCD', 'NKE', 'DIS',
  'BA', 'CAT', 'GE', 'GS', 'MS', 'BAC', 'JPM', 'V', 'MA', 'AXP',
  'T', 'VZ', 'CMCSA', 'PM', 'MDT', 'BMY', 'GILD', 'AMGN', 'TXN',
  'QCOM', 'AVGO', 'NOW', 'INTU', 'MU', 'AMAT', 'UBER', 'IBM',
  'SHOP', 'SQ', 'PYPL', 'SE', 'PLTR', 'COIN', 'HOOD', 'SNOW',
  'PANW', 'CRWD', 'NET', 'DDOG', 'MDB', 'ZS', 'OKTA', 'TWLO',
  'MRNA', 'VRTX', 'REGN', 'ILMN', 'ISRG', 'UNH', 'ABBV', 'LLY',
  'MRK', 'PFE', 'ABT', 'NFLX', 'SPGI', 'BLK', 'SCHW', 'ICE',
  'FDX', 'UPS', 'LUV', 'DAL', 'RCL', 'CCL', 'MGM', 'LVS',
  'MAR', 'HLT', 'AZO', 'ORLY', 'ROST', 'BBY', 'DG', 'DLTR',
  'CMG', 'SBUX', 'MELI', 'CPRT', 'FAST', 'PAYX', 'CTAS',
  'SNPS', 'CDNS', 'FTNT', 'ANSS', 'WDAY', 'TEAM', 'TTD', 'HUBS',
  'GDDY', 'SMAR', 'FIVN', 'WK', 'BR', 'TORO', 'ESTC', 'MNDY',
  'STNE', 'PAGS', 'NU', 'SOFI', 'UPST', 'RKT', 'LC', 'ENV',
];

function getRaw(value: any): any {
  if (value && typeof value === 'object' && 'raw' in value) return value.raw;
  return value;
}

interface StockRow {
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

async function fetchPool(): Promise<StockRow[]> {
  const rows: StockRow[] = [];
  for (let i = 0; i < POOL.length; i += 10) {
    const batch = POOL.slice(i, i + 10);
    const results = await Promise.all(batch.map(async (sym) => {
      try {
        const [qs, q] = await Promise.all([
          yf.quoteSummary(sym, { modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'] }),
          yf.quote(sym),
        ]).catch(() => [null, null]);
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
    }));
    rows.push(...results.filter(Boolean) as StockRow[]);
  }
  return rows;
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

// Reuse the same 7 screener models
const SCREENER_MODELS = [
  {
    id: 'small-mid-rotation', name: 'Small/Mid Rotation',
    compute: (s: StockRow) => {
      const isSmallMid = s.marketCap < 5e10 && s.marketCap > 1e8;
      const f1 = clamp((isSmallMid ? 30 : 0) + (s.roe != null ? Math.min(25, s.roe / 3) : 0) + (s.revenueGrowth != null ? Math.min(25, s.revenueGrowth / 2) : 0) + (s.changePercent > 0 ? 15 : 0));
      const f2 = clamp((s.peRatio != null && s.peRatio < 20 ? 25 : s.peRatio != null && s.peRatio < 35 ? 15 : 5) + (s.profitMargin != null ? Math.min(30, s.profitMargin) : 0) + (s.earningsGrowth != null && s.earningsGrowth > 10 ? 20 : 0) + (s.debtToEquity != null && s.debtToEquity < 100 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const f3 = clamp((volRatio > 1.5 ? 30 : volRatio > 1.2 ? 20 : 10) + ((s.weekHigh - s.price) / Math.max(s.weekHigh - s.weekLow, 1) < 0.2 ? 30 : 10) + (s.changePercent > 0 ? 20 : 0));
      return { total: f1 + f2 + f3 };
    },
  },
  {
    id: 'momentum', name: 'Momentum',
    compute: (s: StockRow) => {
      const weekPos = ((s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1)) * 100;
      const f1 = clamp(weekPos * 0.4 + Math.max(0, s.changePercent * 3) + (s.revenueGrowth != null && s.revenueGrowth > 10 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const f2 = clamp((volRatio > 1.5 ? 50 : volRatio > 1.2 ? 35 : 15) + (s.changePercent > 1 ? 25 : 10));
      const f3 = clamp(weekPos * 0.5 + (s.roe != null && s.roe > 15 ? 20 : 0) + (s.profitMargin != null && s.profitMargin > 10 ? 15 : 0));
      return { total: f1 + f2 + f3 };
    },
  },
  {
    id: 'swing', name: 'Swing',
    compute: (s: StockRow) => {
      const weekPos = ((s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1)) * 100;
      const f1 = clamp(weekPos < 30 ? 70 : weekPos > 70 ? 30 : 50 + (weekPos < 25 ? 20 : 0));
      const f2 = clamp(weekPos < 20 ? 80 : weekPos < 35 ? 60 : weekPos > 80 ? 70 : weekPos > 65 ? 50 : 30);
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const f3 = clamp((weekPos < 30 && volRatio > 1.3 ? 80 : weekPos > 70 && volRatio > 1.3 ? 75 : volRatio > 1.5 ? 60 : 30) + (s.changePercent < 0 ? 10 : 0));
      return { total: f1 + f2 + f3 };
    },
  },
  {
    id: 'breakout', name: 'Breakout',
    compute: (s: StockRow) => {
      const pctFromHigh = ((s.weekHigh - s.price) / Math.max(s.weekHigh - s.weekLow, 1)) * 100;
      const f1 = clamp((pctFromHigh < 5 ? 80 : pctFromHigh < 10 ? 65 : pctFromHigh < 20 ? 45 : 20) + (s.changePercent > 2 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const f2 = clamp((volRatio > 2 ? 80 : volRatio > 1.5 ? 60 : volRatio > 1.2 ? 40 : 20) + (s.changePercent > 0 ? 15 : 0));
      const f3 = clamp((s.revenueGrowth != null && s.revenueGrowth > 15 ? 35 : s.revenueGrowth != null && s.revenueGrowth > 5 ? 25 : 10) + (s.earningsGrowth != null && s.earningsGrowth > 15 ? 25 : 0) + (s.profitMargin != null && s.profitMargin > 15 ? 20 : 0));
      return { total: f1 + f2 + f3 };
    },
  },
  {
    id: 'dark-pool', name: 'Dark Pool',
    compute: (s: StockRow) => {
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const f1 = clamp((volRatio > 2.5 ? 85 : volRatio > 1.8 ? 65 : volRatio > 1.3 ? 45 : 20) + (s.changePercent > 0 ? 10 : 0));
      const weekPos = (s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1);
      const f2 = clamp((weekPos > 0.5 && volRatio > 1 ? 70 : weekPos > 0.3 ? 50 : 30) + (s.roe != null && s.roe > 10 ? 15 : 0) + (s.debtToEquity != null && s.debtToEquity < 80 ? 10 : 0));
      const f3 = clamp((s.changePercent > 1 ? 35 : s.changePercent > 0 ? 20 : s.changePercent < -1 ? 5 : 15) + (volRatio > 1.5 ? 25 : 10));
      return { total: f1 + f2 + f3 };
    },
  },
  {
    id: 'gamma-squeeze', name: 'Gamma Squeeze',
    compute: (s: StockRow) => {
      const weekPos = (s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1);
      const f1 = clamp((s.changePercent < -1 && weekPos < 0.3 ? 75 : s.changePercent < 0 && weekPos < 0.5 ? 55 : 25) + (s.debtToEquity != null && s.debtToEquity > 100 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const f2 = clamp((volRatio > 2 ? 70 : volRatio > 1.5 ? 50 : volRatio > 1.2 ? 35 : 20) + (weekPos < 0.4 ? 15 : 0));
      const f3 = clamp((volRatio > 2.5 ? 80 : volRatio > 1.8 ? 60 : volRatio > 1.3 ? 40 : 20) + (weekPos < 0.3 ? 15 : 0) + (s.marketCap < 2e10 ? 10 : 0));
      return { total: f1 + f2 + f3 };
    },
  },
  {
    id: 'bull-trades', name: 'Bull Trades',
    compute: (s: StockRow) => {
      const f1 = clamp((s.roe != null && s.roe > 20 ? 30 : s.roe != null && s.roe > 10 ? 20 : 5) + (s.profitMargin != null && s.profitMargin > 15 ? 25 : 10) + (s.debtToEquity != null && s.debtToEquity < 50 ? 20 : s.debtToEquity != null && s.debtToEquity < 100 ? 10 : 0));
      const f2 = clamp((s.revenueGrowth != null ? Math.min(30, s.revenueGrowth) : 0) + (s.earningsGrowth != null ? Math.min(25, s.earningsGrowth) : 0) + (s.peRatio != null && s.peRatio < 30 ? 15 : 0) + (s.divYield > 0 ? 10 : 0));
      const weekPos = (s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1);
      const f3 = clamp((weekPos > 0.7 ? 40 : weekPos > 0.5 ? 30 : 15) + (s.changePercent > 0 ? 20 : 0) + (s.revenueGrowth != null && s.revenueGrowth > 10 ? 20 : 0));
      return { total: f1 + f2 + f3 };
    },
  },
];

interface RankedPick {
  symbol: string;
  price: number;
  changePercent: number;
  sector: string;
  marketCap: number;
  compositeScore: number;
  screenerHits: { id: string; name: string; rank: number }[];
  reasons: string[];
}

function calcRSI(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export async function GET() {
  try {
    const rows = await fetchPool();

    // Compute rankings for each screener model
    const screenerRankings = SCREENER_MODELS.map(model => {
      const ranked = rows
        .map(s => ({ symbol: s.symbol, ...model.compute(s) }))
        .sort((a, b) => b.total - a.total);
      return { id: model.id, name: model.name, rankings: ranked };
    });

    // For each stock, compute aggregate score across screeners
    const stockMap = new Map<string, {
      symbol: string;
      price: number;
      changePercent: number;
      sector: string;
      marketCap: number;
      screenerHits: { id: string; name: string; rank: number }[];
      totalScore: number;
    }>();

    for (const sr of screenerRankings) {
      sr.rankings.forEach((r, idx) => {
        const rank = idx + 1;
        let entry = stockMap.get(r.symbol);
        if (!entry) {
          const poolRow = rows.find(s => s.symbol === r.symbol);
          entry = {
            symbol: r.symbol,
            price: poolRow?.price || 0,
            changePercent: poolRow?.changePercent || 0,
            sector: poolRow?.sector || '',
            marketCap: poolRow?.marketCap || 0,
            screenerHits: [],
            totalScore: 0,
          };
          stockMap.set(r.symbol, entry);
        }
        // Only count top 15 positions
        if (rank <= 15) {
          const points = Math.max(0, 16 - rank); // 1st=15pts, 15th=1pt
          entry.totalScore += points;
          entry.screenerHits.push({ id: sr.id, name: sr.name, rank });
        }
      });
    }

    // Get technical data (RSI, trend) for top candidates
    const candidates = Array.from(stockMap.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 20);

    const techData = new Map<string, { rsi: number | null; trend: string }>();

    const BATCH_SIZE = 5;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (c) => {
        try {
          const hist: any = await yf.historical(c.symbol, {
            period1: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
            period2: new Date(),
            interval: '1d',
          });
          const closes = (hist || []).map((h: any) => h.close).filter((v: number) => v > 0);
          const rsi = calcRSI(closes);
          const trend = rsi !== null ? (rsi > 60 ? 'alcista' : rsi < 40 ? 'bajista' : 'neutral') : 'neutral';
          return { symbol: c.symbol, rsi, trend };
        } catch {
          return { symbol: c.symbol, rsi: null, trend: 'neutral' };
        }
      }));
      for (const r of results) techData.set(r.symbol, r);
    }

    // Score and filter: prefer bullish/fresh, penalize overbought
    const scored = candidates.map(c => {
      const tech = techData.get(c.symbol) || { rsi: null, trend: 'neutral' };
      let score = c.totalScore;

      // Penalize overbought (RSI > 70)
      if (tech.rsi !== null && tech.rsi > 70) score -= 10;
      if (tech.rsi !== null && tech.rsi > 80) score -= 15;

      // Boost bullish trend
      if (tech.trend === 'alcista') score += 8;
      if (tech.trend === 'bajista') score -= 8;

      // Boost positive momentum
      if (c.changePercent > 2) score += 5;
      if (c.changePercent < -2) score -= 5;

      // Generate reasons
      const reasons: string[] = [];
      const topHits = c.screenerHits.filter(h => h.rank <= 5).sort((a, b) => a.rank - b.rank);
      if (topHits.length > 0) {
        const topScreener = topHits[0];
        reasons.push(`#1 en ${topScreener.name} (pos #${topScreener.rank})`);
      }
      if (c.screenerHits.length >= 3) {
        reasons.push(`Aparece en ${c.screenerHits.length} screeners`);
      }
      if (tech.trend === 'alcista') reasons.push(`Tendencia alcista`);
      if (tech.rsi !== null && tech.rsi >= 40 && tech.rsi <= 60) reasons.push(`RSI neutro (${Math.round(tech.rsi)})`);
      if (c.changePercent > 1) reasons.push(`+${c.changePercent.toFixed(1)}% semanal`);
      if (c.sector) reasons.push(`Sector: ${c.sector}`);

      // Determine direction (ALZA/BAJA)
      let direction: 'ALZA' | 'BAJA' = 'ALZA';
      if (tech.trend === 'bajista') direction = 'BAJA';
      else if (tech.trend === 'neutral' && tech.rsi !== null && tech.rsi > 60) direction = 'BAJA';
      else if (tech.trend === 'neutral' && tech.rsi !== null && tech.rsi < 40) direction = 'ALZA';
      else if (tech.trend === 'neutral' && c.changePercent < -1) direction = 'BAJA';

      const signalLabel = direction === 'ALZA' ? 'Compra' : 'Venta';

      return {
        symbol: c.symbol,
        price: c.price,
        changePercent: c.changePercent,
        sector: c.sector,
        marketCap: c.marketCap,
        compositeScore: Math.round(score),
        screenerHits: c.screenerHits,
        rsi: tech.rsi,
        trend: tech.trend,
        direction,
        signalLabel,
        reasons: reasons.slice(0, 3),
      };
    });

    const top4 = scored
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 4);

    // Enrich top picks with real-time prices from Finnhub
    const enrichedTop4 = await Promise.all(
      top4.map(async (pick) => {
        try {
          const fh = await finnhubQuote(pick.symbol);
          if (fh && fh.c > 0) {
            return {
              ...pick,
              price: fh.c,
              changePercent: fh.dp || pick.changePercent,
            };
          }
        } catch {}
        return pick;
      })
    );

    const now = new Date();
    const fmt = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return NextResponse.json({ updatedAt: fmt, picks: enrichedTop4 });
  } catch (error) {
    console.error('Top weekly error:', error);
    return NextResponse.json({ updatedAt: '', picks: [] });
  }
}
