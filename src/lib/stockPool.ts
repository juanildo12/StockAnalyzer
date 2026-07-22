import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export const STOCK_POOL = [
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

export async function fetchDynamicUniverse(): Promise<string[]> {
  const [gainers, losers, mostActive, trending] = await Promise.all([
    yf.screener({ scrIds: 'day_gainers', count: 30 }).catch(() => null),
    yf.screener({ scrIds: 'day_losers', count: 30 }).catch(() => null),
    yf.screener({ scrIds: 'most_actives', count: 30 }).catch(() => null),
    yf.trendingSymbols('US', { count: 20 }).catch(() => null),
  ]);

  const dynamic: string[] = [];

  if (gainers?.quotes) {
    for (const q of gainers.quotes) {
      if (q.symbol && q.regularMarketChangePercent > 1.5) dynamic.push(q.symbol);
    }
  }
  if (losers?.quotes) {
    for (const q of losers.quotes) {
      if (q.symbol && q.regularMarketChangePercent < -1.5) dynamic.push(q.symbol);
    }
  }
  if (mostActive?.quotes) {
    for (const q of mostActive.quotes) {
      if (q.symbol && q.regularMarketVolume && q.averageDailyVolume3Month && q.regularMarketVolume > q.averageDailyVolume3Month * 1.5) {
        dynamic.push(q.symbol);
      }
    }
  }
  if (trending?.quotes) {
    for (const q of trending.quotes) {
      if (q.symbol) dynamic.push(q.symbol);
    }
  }

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
