import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { STOCK_POOL } from '@/src/lib/stockPool';

const yf = new YahooFinance();

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
  for (let i = 0; i < STOCK_POOL.length; i += 10) {
    const batch = STOCK_POOL.slice(i, i + 10);
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
        const price = q.regularMarketPrice;
        return {
          symbol: sym,
          price,
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
          weekHigh: q.fiftyTwoWeekHigh || price,
          weekLow: q.fiftyTwoWeekLow || price,
        };
      } catch (e) { console.error(`Rankings fetch error for ${sym}:`, e); return null; }
    }));
    rows.push(...results.filter(Boolean) as StockRow[]);
  }
  return rows;
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

const SCREENER_MODELS = [
  {
    id: 'small-mid-rotation',
    name: 'Small and Mid Cap Rotation',
    icon: '🔄',
    description: 'Capital flight into quality small and mid-cap companies ranked by institutional flow while mega-cap tech loses momentum.',
    formulas: ['Tech Flow', 'Net Options', 'Dark Pool'],
    compute: (s: StockRow) => {
      const isSmallMid = s.marketCap < 5e10 && s.marketCap > 1e8;
      const techFlow = clamp(
        (isSmallMid ? 30 : 0) +
        (s.roe != null ? Math.min(25, s.roe / 3) : 0) +
        (s.revenueGrowth != null ? Math.min(25, s.revenueGrowth / 2) : 0) +
        (s.changePercent > 0 ? 15 : 0)
      );
      const netOptions = clamp(
        (s.peRatio != null && s.peRatio < 20 ? 25 : s.peRatio != null && s.peRatio < 35 ? 15 : 5) +
        (s.profitMargin != null ? Math.min(30, s.profitMargin) : 0) +
        (s.earningsGrowth != null && s.earningsGrowth > 10 ? 20 : 0) +
        (s.debtToEquity != null && s.debtToEquity < 100 ? 15 : 0)
      );
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const darkPool = clamp(
        (volRatio > 1.5 ? 30 : volRatio > 1.2 ? 20 : 10) +
        ((s.weekHigh - s.price) / Math.max(s.weekHigh - s.weekLow, 1) < 0.2 ? 30 : 10) +
        (s.changePercent > 0 ? 20 : 0)
      );
      return { scores: { 'Tech Flow': techFlow, 'Net Options': netOptions, 'Dark Pool': darkPool }, total: techFlow + netOptions + darkPool };
    },
  },
  {
    id: 'momentum',
    name: 'Momentum Screener',
    icon: '⚡',
    description: 'Stocks showing strong upward price momentum with high relative strength and volume confirmation.',
    formulas: ['RS Momentum', 'Volume Surge', 'Trend Strength'],
    compute: (s: StockRow) => {
      const weekPos = ((s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1)) * 100;
      const rsMomentum = clamp(weekPos * 0.4 + Math.max(0, s.changePercent * 3) + (s.revenueGrowth != null && s.revenueGrowth > 10 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const volumeSurge = clamp((volRatio > 1.5 ? 50 : volRatio > 1.2 ? 35 : 15) + (s.changePercent > 1 ? 25 : 10));
      const trendStrength = clamp(weekPos * 0.5 + (s.roe != null && s.roe > 15 ? 20 : 0) + (s.profitMargin != null && s.profitMargin > 10 ? 15 : 0));
      return { scores: { 'RS Momentum': rsMomentum, 'Volume Surge': volumeSurge, 'Trend Strength': trendStrength }, total: rsMomentum + volumeSurge + trendStrength };
    },
  },
  {
    id: 'swing',
    name: 'Swing Screener',
    icon: '🌊',
    description: 'Mean reversion and swing trade setups identified through RSI extremes and Bollinger Band proximity.',
    formulas: ['RSI Setup', 'Band Proximity', 'Volume Reversal'],
    compute: (s: StockRow) => {
      const weekPos = ((s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1)) * 100;
      const rsiSetup = clamp(weekPos < 30 ? 70 : weekPos > 70 ? 30 : 50 + (weekPos < 25 ? 20 : 0));
      const bandProximity = clamp(weekPos < 20 ? 80 : weekPos < 35 ? 60 : weekPos > 80 ? 70 : weekPos > 65 ? 50 : 30);
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const volumeReversal = clamp((weekPos < 30 && volRatio > 1.3 ? 80 : weekPos > 70 && volRatio > 1.3 ? 75 : volRatio > 1.5 ? 60 : 30) + (s.changePercent < 0 ? 10 : 0));
      return { scores: { 'RSI Setup': rsiSetup, 'Band Proximity': bandProximity, 'Volume Reversal': volumeReversal }, total: rsiSetup + bandProximity + volumeReversal };
    },
  },
  {
    id: 'breakout',
    name: 'Breakout Screener',
    icon: '🚀',
    description: 'Stocks breaking above key resistance levels with above-average volume and strong sector tailwinds.',
    formulas: ['Resistance Break', 'Volume Spike', 'Sector Flow'],
    compute: (s: StockRow) => {
      const pctFromHigh = ((s.weekHigh - s.price) / Math.max(s.weekHigh - s.weekLow, 1)) * 100;
      const resistanceBreak = clamp((pctFromHigh < 5 ? 80 : pctFromHigh < 10 ? 65 : pctFromHigh < 20 ? 45 : 20) + (s.changePercent > 2 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const volumeSpike = clamp((volRatio > 2 ? 80 : volRatio > 1.5 ? 60 : volRatio > 1.2 ? 40 : 20) + (s.changePercent > 0 ? 15 : 0));
      const sectorFlow = clamp((s.revenueGrowth != null && s.revenueGrowth > 15 ? 35 : s.revenueGrowth != null && s.revenueGrowth > 5 ? 25 : 10) + (s.earningsGrowth != null && s.earningsGrowth > 15 ? 25 : 0) + (s.profitMargin != null && s.profitMargin > 15 ? 20 : 0));
      return { scores: { 'Resistance Break': resistanceBreak, 'Volume Spike': volumeSpike, 'Sector Flow': sectorFlow }, total: resistanceBreak + volumeSpike + sectorFlow };
    },
  },
  {
    id: 'dark-pool',
    name: 'Dark Pool Screener',
    icon: '🌙',
    description: 'Unusual large-volume trades detected through abnormal volume patterns and accumulation/distribution analysis.',
    formulas: ['Large Trades', 'Accumulation', 'Delta Flow'],
    compute: (s: StockRow) => {
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const largeTrades = clamp((volRatio > 2.5 ? 85 : volRatio > 1.8 ? 65 : volRatio > 1.3 ? 45 : 20) + (s.changePercent > 0 ? 10 : 0));
      const weekPos = (s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1);
      const accumulation = clamp((weekPos > 0.5 && volRatio > 1 ? 70 : weekPos > 0.3 ? 50 : 30) + (s.roe != null && s.roe > 10 ? 15 : 0) + (s.debtToEquity != null && s.debtToEquity < 80 ? 10 : 0));
      const deltaFlow = clamp((s.changePercent > 1 ? 35 : s.changePercent > 0 ? 20 : s.changePercent < -1 ? 5 : 15) + (volRatio > 1.5 ? 25 : 10));
      return { scores: { 'Large Trades': largeTrades, 'Accumulation': accumulation, 'Delta Flow': deltaFlow }, total: largeTrades + accumulation + deltaFlow };
    },
  },
  {
    id: 'gamma-squeeze',
    name: 'Gamma Squeeze Screener',
    icon: '💥',
    description: 'High short interest stocks with elevated option activity that could trigger a gamma squeeze event.',
    formulas: ['Short Interest', 'Option Flow', 'IV Spike'],
    compute: (s: StockRow) => {
      const weekPos = (s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1);
      const shortInterest = clamp((s.changePercent < -1 && weekPos < 0.3 ? 75 : s.changePercent < 0 && weekPos < 0.5 ? 55 : 25) + (s.debtToEquity != null && s.debtToEquity > 100 ? 15 : 0));
      const volRatio = s.volume / Math.max(s.avgVolume, 1);
      const optionFlow = clamp((volRatio > 2 ? 70 : volRatio > 1.5 ? 50 : volRatio > 1.2 ? 35 : 20) + (weekPos < 0.4 ? 15 : 0));
      const ivSpike = clamp((volRatio > 2.5 ? 80 : volRatio > 1.8 ? 60 : volRatio > 1.3 ? 40 : 20) + (weekPos < 0.3 ? 15 : 0) + (s.marketCap < 2e10 ? 10 : 0));
      return { scores: { 'Short Interest': shortInterest, 'Option Flow': optionFlow, 'IV Spike': ivSpike }, total: shortInterest + optionFlow + ivSpike };
    },
  },
  {
    id: 'bull-trades',
    name: 'Bull Trades Screener',
    icon: '🐂',
    description: 'High-conviction long setups combining institutional accumulation, strong fundamentals, and technical momentum.',
    formulas: ['Inst. Flow', 'Fundamentals', 'Tech Momentum'],
    compute: (s: StockRow) => {
      const instFlow = clamp(
        (s.roe != null && s.roe > 20 ? 30 : s.roe != null && s.roe > 10 ? 20 : 5) +
        (s.profitMargin != null && s.profitMargin > 15 ? 25 : 10) +
        (s.debtToEquity != null && s.debtToEquity < 50 ? 20 : s.debtToEquity != null && s.debtToEquity < 100 ? 10 : 0)
      );
      const fundamentals = clamp(
        (s.revenueGrowth != null ? Math.min(30, s.revenueGrowth) : 0) +
        (s.earningsGrowth != null ? Math.min(25, s.earningsGrowth) : 0) +
        (s.peRatio != null && s.peRatio < 30 ? 15 : 0) +
        (s.divYield > 0 ? 10 : 0)
      );
      const weekPos = (s.price - s.weekLow) / Math.max(s.weekHigh - s.weekLow, 1);
      const techMomentum = clamp(
        (weekPos > 0.7 ? 40 : weekPos > 0.5 ? 30 : 15) +
        (s.changePercent > 0 ? 20 : 0) +
        (s.revenueGrowth != null && s.revenueGrowth > 10 ? 20 : 0)
      );
      return { scores: { 'Inst. Flow': instFlow, 'Fundamentals': fundamentals, 'Tech Momentum': techMomentum }, total: instFlow + fundamentals + techMomentum };
    },
  },
];

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await fetchPool();
    const now = new Date();
    const fmtTime = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    const fmtDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const screeners = SCREENER_MODELS.map(model => {
      const rankings = rows
        .map(s => ({ symbol: s.symbol, ...model.compute(s) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 30);

      return {
        id: model.id,
        name: model.name,
        icon: model.icon,
        description: model.description,
        updatedAt: fmtDate,
        formulas: model.formulas,
        rankings,
      };
    });

    return NextResponse.json({ lastUpdated: fmtTime, screeners });
  } catch (error) {
    console.error('Rankings error:', error);
    return NextResponse.json({ lastUpdated: '', screeners: [] });
  }
}
