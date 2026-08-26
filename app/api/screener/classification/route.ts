import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { cacheGet, cacheSet } from '../../../../src/lib/cache';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function getRaw(v: any): number | undefined {
  if (v && typeof v === 'object' && 'raw' in v) return v.raw;
  if (typeof v === 'number') return v;
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<T | null>((r) => setTimeout(() => r(null), ms))]);
}

function calcEMA200(closes: number[]): number | null {
  if (closes.length < 200) return null;
  const k = 2 / 201;
  let ema = closes.slice(0, 200).reduce((a, b) => a + b, 0) / 200;
  for (let i = 200; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  pe: number | null;
  fcfYield: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  sector: string;
  industry: string;
  category: 'joya' | 'growth' | 'valueTrap' | 'bomba' | null;
  reasons: string[];
  ema200: number | null;
  ema200Distance: number | null;
}

const UNIVERSE = [
  // Mega-cap tech
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','AMD','NFLX','CRM',
  'AVGO','ORCL','PLTR','ADBE','INTU','NOW','AMAT','TXN','QCOM','MU',
  'SNPS','CDNS','PANW','CRWD','NET','DDOG','ZS','ARM','SMCI','IBM','DELL',
  'HPE','ANET','CIEN','ERIC','NOK','GLW','FTNT','OKTA','WDAY','TEAM',
  'TTD','HUBS','SMAR','FIVN','ESTC','MNDY','MDB','TWLO','COHR','LITE',
  // Growth / fintech
  'SHOP','SQ','PYPL','UBER','SE','COIN','HOOD','APP','DASH','SOFI',
  'RBLX','SNAP','PINS','AI','SNOW',
  'UPST','RKT','AFRM','LMND','CVNA','W','DOCU','ZM','PTON',
  'CLOV','VNET','BIDU','YELP','PATH','GTLB','CART','BROS',
  'ENV','BR','TORO','APPF','GDDY','WK',
  // Semis
  'MRVL','NXPI','MCHP','KLAC','LRCX','ASML','ON','STM','TER',
  'AMKR','AEHR','DIODE','WOLF','POWL','KEYS','COHU','FORM',
  // Consumer
  'KO','PEP','WMT','COST','MCD','NKE','DIS','SBUX','CMG','LULU',
  'TJX','ROST','BBY','DG','DLTR','TGT','HD','LOW','BURL','URBN',
  'PG','EL','CL','HSY','MNST','KDP','KHC','GIS','STZ','DEO',
  'SHAK','CAKE','YUM','CHTR','TMUS','ANF','AEO','GPS','HBI',
  'KMB','CLX','SJM','CAG','TPR','RL','VFC','CROX','SKX','BOOT',
  'WING','DIN','JACK','CPRT','FAST','PAYX','CTAS',
  // Financials
  'GS','MS','BAC','JPM','V','MA','AXP','SCHW','BLK','SPGI',
  'ICE','COF','DFS','SYF','ALL','MET','PRU','AON','MMC','CME','CB',
  'PGR','TRV','IBKR','TFC','CFG','KEY','RF','WAL','EWBC',
  'WSBC','SBCF','UMBF','HOMB','BANR','WAFD','COLB','OMF','SLM',
  // Healthcare
  'UNH','ABBV','LLY','MRK','PFE','BMY','GILD','AMGN','MDT',
  'ABT','ISRG','VRTX','REGN','MRNA','ZTS','SYK','BSX','EW','RMD',
  'DXCM','HCA','UHS','CYH','SEM','AMED','ENSG','GMED',
  'IRTC','NVCR','NTRA','CRSP','BEAM','EDIT','NTLA',
  'RARE','SRPT','IONS','NBIX','BBIO','ARWR','ALKS','HALO',
  'ITCI','SAGE','ACAD','PTCT','BMRN','EXEL','RGEN','INSM',
  'DOCS','TDOC','AMWL','HIMS','GDRX','OSCR','MOH','ILMN','VEEV','HOLX','ALGN','TECH','IDXX',
  // Industrial
  'BA','CAT','GE','HON','UPS','FDX','DE','EMR','ETN','ITW',
  'WM','DAL','UAL','LUV','ROK','PH','CMI','XYL','AME','GWW',
  'RSG','J','ACM','FYBR','AAL','JBLU','SKYW',
  // Aerospace / defense
  'LMT','NOC','RTX','GD','TDG','LHX','HII','HWM','CW','KTOS','LDOS','SAIC',
  // Energy
  'XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','DVN','HAL','BKR',
  'PXD','FANG','HES','MRO','OVV','SM','AR','CIVI','MTDR','SWN','EQT','RRC',
  'CHRD','NOG','CEIX','ARCH','AMR','BTU',
  // REITs
  'AMT','PLD','CCI','EQIX','SPG','O','PSA','WELL','DLR',
  'AVB','EQR','VTR','ARE','MAA','UDR','ESS','VICI','EXR','VNO','BXP','KIM','REG','HST',
  // Utilities
  'NEE','DUK','SO','D','AEP','SRE','EXC','XEL',
  'ED','WEC','ES','AWK','DTE','ETR','FE','AES',
  // Materials
  'LIN','APD','SHW','ECL','DD','NEM','FCX','NUE',
  'STLD','CMC','AA','X','CLF','MT','SCCO',
  // Comms
  'T','VZ','CMCSA','WBD','PARA','FOX','LYV','LUMN','DISH','MGNI','PUBM','DV','MAX',
  // Crypto
  'MSTR','MARA','RIOT','MELI','CLSK','IREN','HUT','BITF','CIFR','BTBT','CORZ','WULF',
  // LatAm
  'NU','STNE','PAGS','YPF','BMA','GGAL','SUPV','CRESY','TEO','TGS',
];

async function fetchStock(symbol: string): Promise<StockData | null> {
  try {
    const [qs, quote] = await Promise.all([
      withTimeout(yf.quoteSummary(symbol, {
        modules: ['summaryDetail', 'financialData', 'assetProfile', 'defaultKeyStatistics'],
      }), 8000),
      withTimeout(yf.quote(symbol), 5000),
    ]);

    if (!quote || !qs) return null;

    const sd = (qs as any)?.summaryDetail || {};
    const fd = (qs as any)?.financialData || {};
    const ap = (qs as any)?.assetProfile || {};

    const price = quote.regularMarketPrice || 0;
    const marketCap = getRaw(sd.marketCap) || quote.marketCap || 0;

    const pe = getRaw(sd.trailingPE) ?? null;
    const totalRevenue = getRaw(fd.totalRevenue) || 0;
    const revenueGrowth = getRaw(fd.revenueGrowth);
    const profitMargin = getRaw(fd.profitMargins);
    const freeCashflow = getRaw(fd.freeCashflow) || 0;
    const fcfYield = marketCap > 0 && freeCashflow > 0
      ? (freeCashflow / marketCap) * 100
      : null;

    return {
      symbol,
      name: quote.shortName || quote.longName || symbol,
      price,
      change: quote.regularMarketChange || 0,
      changePct: quote.regularMarketChangePercent || 0,
      marketCap,
      pe,
      fcfYield,
      revenueGrowth: revenueGrowth != null ? revenueGrowth * 100 : null,
      profitMargin: profitMargin != null ? profitMargin * 100 : null,
      sector: ap.sector || '',
      industry: ap.industry || '',
      category: null,
      reasons: [],
      ema200: null,
      ema200Distance: null,
    };
  } catch {
    return null;
  }
}

function classify(s: StockData): StockData {
  const pe = s.pe;
  const fcf = s.fcfYield;
  const revGrowth = s.revenueGrowth;
  const margin = s.profitMargin;
  const reasons: string[] = [];

  // 💎 Joyas Ocultas: FCF >8% + PE bajo + crece + margen sólido
  if (fcf != null && fcf > 8 && pe != null && pe > 0 && pe < 20 && revGrowth != null && revGrowth > 5 && margin != null && margin > 10) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}%`);
    reasons.push(`PE ${pe.toFixed(1)}`);
    reasons.push(`Revenue Growth +${revGrowth.toFixed(1)}%`);
    reasons.push(`Margin ${margin.toFixed(1)}%`);
    return { ...s, category: 'joya', reasons };
  }

  // 🚀 Growth Caro: FCF bajo + PE alto + Revenue >20%
  if (fcf != null && fcf < 5 && pe != null && pe > 30 && revGrowth != null && revGrowth > 20) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}% (bajo)`);
    reasons.push(`PE ${pe.toFixed(1)} (alto)`);
    reasons.push(`Revenue Growth +${revGrowth.toFixed(1)}%`);
    return { ...s, category: 'growth', reasons };
  }

  // 💣 Bomba de Tiempo: FCF negativo + PE alto + no crece
  if (fcf != null && fcf < 0 && pe != null && pe > 25 && revGrowth != null && revGrowth < 5) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}% (negativo)`);
    reasons.push(`PE ${pe.toFixed(1)} (alto)`);
    reasons.push(`Revenue Growth ${revGrowth.toFixed(1)}% (estancado)`);
    return { ...s, category: 'bomba', reasons };
  }

  // ⚠️ Value Trap: FCF alto + PE bajo + revenue estancado
  if (fcf != null && fcf > 8 && pe != null && pe > 0 && pe < 15 && revGrowth != null && revGrowth < 5) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}%`);
    reasons.push(`PE ${pe.toFixed(1)}`);
    reasons.push(`Revenue Growth ${revGrowth.toFixed(1)}% (estancado)`);
    return { ...s, category: 'valueTrap', reasons };
  }

  return s;
}

export async function GET() {
  try {
    const cacheKey = 'screener:classification:v3:' + new Date().toISOString().split('T')[0];
    const cached = await cacheGet<{ stocks: StockData[]; joyas: StockData[]; growths: StockData[]; traps: StockData[]; bombas: StockData[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const results: StockData[] = [];
    const seen = new Set<string>();
    const batchSize = 8;

    for (let i = 0; i < UNIVERSE.length; i += batchSize) {
      const batch = UNIVERSE.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fetchStock));
      for (const r of batchResults) {
        if (r && !seen.has(r.symbol)) {
          seen.add(r.symbol);
          results.push(classify(r));
        }
      }
    }

    const joyas = results.filter(s => s.category === 'joya').sort((a, b) => (b.fcfYield || 0) - (a.fcfYield || 0));
    const growths = results.filter(s => s.category === 'growth').sort((a, b) => (b.revenueGrowth || 0) - (a.revenueGrowth || 0));
    const traps = results.filter(s => s.category === 'valueTrap').sort((a, b) => (b.fcfYield || 0) - (a.fcfYield || 0));
    const bombas = results.filter(s => s.category === 'bomba').sort((a, b) => (b.pe || 0) - (a.pe || 0));

    // Fetch EMA 200 only for classified stocks (saves time)
    const classified = [...joyas, ...growths, ...traps, ...bombas];
    const emaBatchSize = 5;
    for (let i = 0; i < classified.length; i += emaBatchSize) {
      const batch = classified.slice(i, i + emaBatchSize);
      const histResults = await Promise.all(
        batch.map(async (s) => {
          try {
            const hist = await withTimeout(
              yf.historical(s.symbol, {
                period1: new Date(Date.now() - 300 * 86400000),
                period2: new Date(),
                interval: '1d',
              }),
              7000
            );
            if (!hist || hist.length < 200) return null;
            const closes = hist.map(h => h.close);
            const ema200 = calcEMA200(closes);
            if (!ema200) return null;
            const distance = ((s.price - ema200) / ema200) * 100;
            return { symbol: s.symbol, ema200, distance };
          } catch {
            return null;
          }
        })
      );
      for (const r of histResults) {
        if (r) {
          const stock = classified.find(s => s.symbol === r.symbol);
          if (stock) {
            stock.ema200 = r.ema200;
            stock.ema200Distance = r.distance;
          }
        }
      }
    }

    const data = { stocks: results, joyas, growths, traps, bombas, total: results.length, classified: joyas.length + growths.length + traps.length + bombas.length, timestamp: Date.now() };
    await cacheSet(cacheKey, data, 3600);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[Classification] Error:', e?.message);
    return NextResponse.json({ error: e?.message || 'Failed', stocks: [], joyas: [], growths: [], traps: [], bombas: [] }, { status: 500 });
  }
}
