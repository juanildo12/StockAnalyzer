import YahooFinance from "yahoo-finance2";

// yahoo-finance2 validates every response against a schema frozen in v3.15.3.
// Yahoo now returns fields that schema does not know (fulldayPrice,
// impliedSharesOutstanding, twoHundredDayAverage, ...) so screener() throws
// "Failed Yahoo Schema validation" for every single list. Hand-stripping fields
// is fragile because each list has its own schema, so we capture the raw JSON
// through the library's own fetch (which keeps its cookie/crumb/UA handling) and
// read the data directly. The call still throws; we do not care, because we
// already copied what we need.
let _capturedQuotes: any[] = [];

const captureFetch = async (url: any, opts: any) => {
  const res = await fetch(url, opts);
  if (String(url).includes("screener")) {
    try {
      const j = await res.clone().json();
      const q = j?.finance?.result?.[0]?.quotes;
      if (Array.isArray(q)) _capturedQuotes = q;
    } catch { /* respuesta sin el envoltorio esperado */ }
  }
  return res;
};

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
  fetch: captureFetch as any,
});

// Listados de Yahoo que devuelven acciones (los de fondos solo traen MUTUALFUND).
const EQUITY_SCREENERS = [
  "day_gainers",
  "day_losers",
  "most_actives",
  "growth_technology_stocks",
  "undervalued_growth_stocks",
  "undervalued_large_caps",
  "aggressive_small_caps",
  "small_cap_gainers",
  "most_shorted_stocks",
] as const;

const SCREENER_SIZE = 250; // Yahoo corta con "size is too large" a partir de ~300

/** Quotes crudos de un listado de Yahoo, sin pasar por el schema de la librería. */
async function screenerQuotes(scrId: string, count = SCREENER_SIZE): Promise<any[]> {
  _capturedQuotes = [];
  try {
    await yf.screener({ scrIds: scrId, count } as any);
  } catch {
    // esperado: el schema falla, pero _capturedQuotes ya tiene los datos
  }
  return _capturedQuotes;
}

export interface ScreenerRow {
  symbol: string;
  price: number;
  marketCap: number;
  avgVol: number;
  changePercent: number;
}

export async function fetchScreenerEquity(scrIds: readonly string[] = EQUITY_SCREENERS): Promise<ScreenerRow[]> {
  const lists = await Promise.all(
    scrIds.map(async (id) => {
      const q = await screenerQuotes(id).catch(() => [] as any[]);
      return q
        .filter((r) => r && r.symbol && r.quoteType === "EQUITY")
        .map((r) => ({
          symbol: r.symbol.toUpperCase(),
          price: r.regularMarketPrice || 0,
          marketCap: r.marketCap || 0,
          avgVol: r.averageDailyVolume3Month || r.averageDailyVolume10Day || 0,
          changePercent: r.regularMarketChangePercent || 0,
        }));
    })
  );
  const seen = new Map<string, ScreenerRow>();
  for (const row of lists.flat()) {
    const prev = seen.get(row.symbol);
    if (!prev || Math.abs(row.changePercent) > Math.abs(prev.changePercent)) seen.set(row.symbol, row);
  }
  return Array.from(seen.values());
}

export const STOCK_POOL = [
  // ── Mega-cap tech ──
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','AMD','CRM',
  'ORCL','ADBE','NFLX','INTU','NOW','AMAT','TXN','QCOM','AVGO',
  'MU','SNPS','CDNS','ANSS','FTNT','PANW','CRWD','NET','DDOG',
  'ZS','OKTA','WDAY','TEAM','TTD','HUBS','SMAR','FIVN','ESTC',
  'MNDY','MDB','TWLO','SNOW','PLTR','ARM','SMCI','IBM','DELL',
  'HPE','HPQ','ERIC','NOK','GLW','KEYS','COHR','LITE',
  'ANET','CIEN','AAOI',
  // ── Growth / mid-cap tech ──
  'SHOP','SQ','PYPL','UBER','SE','COIN','HOOD','APP','DASH',
  'RBLX','U','CRDO','IONQ','RGTI','APPF','GDDY','WK','TORO',
  'SOFI','UPST','RKT','LC','ENV','BR','BROS','CART',
  'CLOV','AFRM','LMND','VNET','BIDU',
  'PINS','SNAP','YELP','ZM','DOCU','PTON','W','CVNA',
  'AI','PLUG','FCEL','BE','CHPT','QS','MVST','LAZR','LIDR','INVZ','CARG',
  // ── Semis / hardware ──
  'MRVL','ON','STM','NXPI','MCHP','DIODE','WOLF','POWL',
  'AEHR','CAMT','ICHR','TER','KLAC','LRCX','ASML','AMKR','BRKS','COHU','FORM',
  // ── Consumer ──
  'KO','PEP','WMT','COST','MCD','NKE','DIS','SBUX','CMG',
  'LULU','TJX','ROST','BBY','DG','DLTR','AZO','ORLY','YUM',
  'CHTR','TMUS','CPRT','FAST','PAYX','CTAS','TGT','HD','LOW',
  'BURL','URBN','ANF','AEO','GPS','HBI',
  'KMB','CL','PG','EL','CLX','HSY','MNST','KDP','KHC','GIS','SJM','CAG','STZ','DEO',
  'BUD','TPR','RL','VFC','CROX','SKX','BOOT',
  'SHAK','CAKE','DIN','JACK','WING',
  // ── Financials ──
  'GS','MS','BAC','JPM','V','MA','AXP','SCHW','BLK','SPGI',
  'ICE','COF','DFS','SYF','ALL','MET','PRU','AON','MMC',
  'CME','CB','PGR','TRV','ACGL',
  'TFC','CFG','KEY','RF','WAL','EWBC',
  'WSBC','SBCF','UMBF','HOMB','BANR','WAFD','COLB',
  'IBKR','OMF','SLM',
  // ── Healthcare ──
  'UNH','ABBV','LLY','MRK','PFE','BMY','GILD','AMGN','MDT',
  'ABT','ISRG','VRTX','REGN','MRNA','ILMN','VEEV','HOLX','ALGN','TECH',
  'ZTS','IDXX','SYK','BSX','EW','RMD','INSP','TNDM',
  'DXCM','HCA','UHS','CYH','SEM','AMED','ENSG','GMED',
  'IRTC','SILK','NVCR','NTRA','CRSP','BEAM','EDIT','NTLA',
  'RARE','SRPT','IONS','NBIX','BBIO','ARWR','ALKS','HALO',
  'ITCI','SAGE','ACAD','PTCT','BMRN','EXEL','RGEN','INSM',
  'DOCS','TDOC','AMWL','HIMS','GDRX','OSCR','MOH',
  // ── Industrial ──
  'BA','CAT','GE','HON','UPS','FDX','DE','EMR','ETN',
  'ITW','ROK','PH','CMI','XYL','AME','GWW',
  'WM','RSG','J','ACM','FYBR','DAL','LUV','UAL','ALK',
  'AAL','JBLU','SKYW',
  // ── Aerospace / defense ──
  'LMT','NOC','RTX','GD','LHX','HII','TDG','HWM','CW','KTOS','LDOS','SAIC',
  // ── Energy ──
  'XOM','CVX','COP','SLB','OXY','EOG','MPC','PSX','VLO',
  'PXD','FANG','HES','DVN','MRO','HAL','BKR','OVV',
  'SM','AR','CIVI','MTDR','SWN','EQT','RRC','AROC',
  'CHRD','NOG','CEIX','ARCH','AMR','BTU',
  // ── REITs ──
  'AMT','PLD','CCI','EQIX','SPG','O','PSA','WELL',
  'DLR','AVB','EQR','VTR','ARE','MAA','UDR','ESS',
  'VICI','EXR','VNO','BXP','KIM','REG','HST',
  // ── Utilities ──
  'NEE','DUK','SO','D','AEP','SRE','EXC','XEL',
  'ED','WEC','ES','AWK','DTE','ETR','FE','AES',
  // ── Materials ──
  'LIN','APD','SHW','ECL','DD','NEM','FCX','NUE',
  'STLD','CMC','AA','X','CLF','MT','SCCO',
  // ── Comms / media ──
  'T','VZ','CMCSA','WBD',
  'PARA','FOXA','FOX','LYV','LUMN','DISH',
  'MGNI','PUBM','DV','MAX',
  // ── Crypto / fintech ──
  'MELI','MSTR','MARA','RIOT','CLSK','IREN','HUT','BITF',
  'CIFR','BTBT','CORZ','WULF',
  // ── LatAm ──
  'NU','STNE','PAGS','VIV','EBR','PAM',
  'YPF','BMA','GGAL','SUPV','CRESY','TEO','TGS',
];

export async function fetchDynamicUniverse(): Promise<string[]> {
  const [screened, trending] = await Promise.all([
    fetchScreenerEquity(["day_gainers", "day_losers", "most_actives"]).catch((e) => {
      console.warn('[Universe] screeners failed:', e?.message);
      return [] as ScreenerRow[];
    }),
    yf.trendingSymbols('US', { count: 100 })
      .then((t) => (t?.quotes || []).map((q: any) => q.symbol).filter(Boolean) as string[])
      .catch((e) => { console.warn('[Universe] trending failed:', e?.message); return [] as string[]; }),
  ]);

  const dynamic: string[] = [];

  for (const row of screened) {
    if (row.symbol && Math.abs(row.changePercent) > 1.5) dynamic.push(row.symbol);
  }
  for (const sym of trending) dynamic.push(sym);

  const seen = new Set<string>();
  const merged: string[] = [];

  for (const sym of [...dynamic, ...STOCK_POOL]) {
    const upper = sym.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      merged.push(upper);
    }
  }

  return merged;
}

// ── Universe for trade picks ───────────────────────────────────────────────
// Options trading needs names that can actually be traded, so we apply the same
// hard gates scoreStock() uses (price, market cap, average volume) here, before
// spending a 440-day chart request on them. Pre-filtering is not an extra rule:
// anything dropped below would have been rejected by scoreStock() anyway, it
// just costs us two Yahoo round-trips per symbol to find out.

export const TRADE_PICK_MIN_PRICE = 5;
export const TRADE_PICK_MIN_MARKET_CAP = 300_000_000;
export const TRADE_PICK_MIN_AVG_VOLUME = 500_000;

export async function fetchTradePickUniverse(): Promise<string[]> {
  const [screened, trending] = await Promise.all([
    fetchScreenerEquity().catch((e) => {
      console.warn('[Universe] trade pick screeners failed:', e?.message);
      return [] as ScreenerRow[];
    }),
    yf.trendingSymbols('US', { count: 100 })
      .then((t) => (t?.quotes || []).map((q: any) => q.symbol).filter(Boolean) as string[])
      .catch(() => [] as string[]),
  ]);

  const eligible = new Set<string>();
  for (const row of screened) {
    if (row.price < TRADE_PICK_MIN_PRICE) continue;
    if (row.marketCap < TRADE_PICK_MIN_MARKET_CAP) continue;
    if (row.avgVol < TRADE_PICK_MIN_AVG_VOLUME) continue;
    eligible.add(row.symbol);
  }
  // Trending has no screener metadata; let the scan's own gates judge it.
  for (const sym of trending) eligible.add(sym.toUpperCase());
  // The static pool is curated, so it is always scanned.
  for (const sym of STOCK_POOL) eligible.add(sym.toUpperCase());

  return Array.from(eligible);
}
