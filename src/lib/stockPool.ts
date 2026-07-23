import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export const STOCK_POOL = [
  // ── Mega-cap tech ──
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'CRM',
  'ORCL', 'ADBE', 'NFLX', 'INTU', 'NOW', 'AMAT', 'TXN', 'QCOM', 'AVGO',
  'MU', 'SNPS', 'CDNS', 'ANSS', 'FTNT', 'PANW', 'CRWD', 'NET', 'DDOG',
  'ZS', 'OKTA', 'WDAY', 'TEAM', 'TTD', 'HUBS', 'SMAR', 'FIVN', 'ESTC',
  'MNDY', 'MDB', 'TWLO', 'SNOW', 'PLTR', 'ARM', 'SMCI', 'IBM', 'DELL',
  'HPE', 'HPQ', 'ERIC', 'NOK', 'GLW', 'KEYS', 'COHR', 'LITE',
  'ANET', 'CIEN', 'AAOI',
  // ── Growth / mid-cap tech ──
  'SHOP', 'SQ', 'PYPL', 'UBER', 'SE', 'COIN', 'HOOD', 'APP', 'DASH',
  'RBLX', 'U', 'CRDO', 'IONQ', 'RGTI', 'APPF', 'GDDY', 'WK', 'TORO',
  'SOFI', 'UPST', 'RKT', 'LC', 'ENV', 'BR', 'BROS', 'CART',
  'CLOV', 'AFRM', 'LMND', 'VNET', 'BIDU',
  'PINS', 'SNAP', 'YELP', 'ZM', 'DOCU', 'PTON', 'W', 'CVNA',
  'AI', 'PLUG', 'FCEL', 'BE', 'CHPT', 'QS', 'MVST', 'LAZR',
  'LIDR', 'INVZ', 'CARG',
  // ── Semis / hardware ──
  'MRVL', 'ON', 'STM', 'NXPI', 'MCHP', 'DIODE', 'WOLF', 'POWL',
  'AEHR', 'CAMT', 'ICHR', 'TER', 'KLAC', 'LRCX', 'ASML', 'AMKR',
  'BRKS', 'COHU', 'FORM',
  // ── Consumer ──
  'KO', 'PEP', 'WMT', 'COST', 'MCD', 'NKE', 'DIS', 'SBUX', 'CMG',
  'LULU', 'TJX', 'ROST', 'BBY', 'DG', 'DLTR', 'AZO', 'ORLY', 'YUM',
  'CHTR', 'TMUS', 'CPRT', 'FAST', 'PAYX', 'CTAS', 'TGT', 'HD',
  'LOW', 'BURL', 'URBN', 'ANF', 'AEO', 'GPS', 'HBI',
  'KMB', 'CL', 'PG', 'EL', 'CLX', 'HSY', 'MNST', 'KDP',
  'KHC', 'GIS', 'SJM', 'CAG', 'STZ', 'DEO',
  'BUD', 'TPR', 'RL', 'VFC', 'CROX', 'SKX', 'BOOT',
  'SHAK', 'CAKE', 'DIN', 'JACK', 'WING',
  // ── Financials ──
  'GS', 'MS', 'BAC', 'JPM', 'V', 'MA', 'AXP', 'SCHW', 'BLK', 'SPGI',
  'ICE', 'COF', 'DFS', 'SYF', 'ALL', 'MET', 'PRU', 'AON', 'MMC',
  'CME', 'CB', 'PGR', 'TRV', 'ACGL',
  'TFC', 'CFG', 'KEY', 'RF', 'WAL', 'EWBC',
  'WSBC', 'SBCF', 'UMBF', 'HOMB', 'BANR', 'WAFD', 'COLB',
  'IBKR', 'OMF', 'SLM',
  // ── Healthcare ──
  'UNH', 'ABBV', 'LLY', 'MRK', 'PFE', 'BMY', 'GILD', 'AMGN', 'MDT',
  'ABT', 'ISRG', 'VRTX', 'REGN', 'MRNA', 'ILMN', 'VEEV', 'HOLX', 'ALGN', 'TECH',
  'ZTS', 'IDXX', 'SYK', 'BSX', 'EW', 'RMD', 'INSP', 'TNDM',
  'DXCM', 'HCA', 'UHS', 'CYH', 'SEM', 'AMED', 'ENSG', 'GMED',
  'IRTC', 'SILK', 'NVCR', 'NTRA', 'CRSP', 'BEAM', 'EDIT', 'NTLA',
  'RARE', 'SRPT', 'IONS', 'NBIX', 'BBIO', 'ARWR', 'ALKS', 'HALO',
  'ITCI', 'SAGE', 'ACAD', 'PTCT', 'BMRN', 'EXEL', 'RGEN', 'INSM',
  'DOCS', 'TDOC', 'AMWL', 'HIMS', 'GDRX', 'OSCR', 'MOH',
  // ── Industrial ──
  'BA', 'CAT', 'GE', 'HON', 'UPS', 'FDX', 'DE', 'EMR', 'ETN',
  'ITW', 'ROK', 'PH', 'CMI', 'XYL', 'AME', 'GWW',
  'WM', 'RSG', 'J', 'ACM', 'FYBR', 'DAL', 'LUV', 'UAL', 'ALK',
  'AAL', 'JBLU', 'SKYW',
  // ── Aerospace / defense ──
  'LMT', 'NOC', 'RTX', 'GD', 'LHX', 'HII', 'TDG', 'HWM',
  'CW', 'KTOS', 'LDOS', 'SAIC',
  // ── Energy ──
  'XOM', 'CVX', 'COP', 'SLB', 'OXY', 'EOG', 'MPC', 'PSX', 'VLO',
  'PXD', 'FANG', 'HES', 'DVN', 'MRO', 'HAL', 'BKR', 'OVV',
  'SM', 'AR', 'CIVI', 'MTDR', 'SWN', 'EQT', 'RRC', 'AROC',
  'CHRD', 'NOG', 'CEIX', 'ARCH', 'AMR', 'BTU',
  // ── REITs ──
  'AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'O', 'PSA', 'WELL',
  'DLR', 'AVB', 'EQR', 'VTR', 'ARE', 'MAA', 'UDR', 'ESS',
  'VICI', 'EXR', 'VNO', 'BXP', 'KIM', 'REG', 'HST',
  // ── Utilities ──
  'NEE', 'DUK', 'SO', 'D', 'AEP', 'SRE', 'EXC', 'XEL',
  'ED', 'WEC', 'ES', 'AWK', 'DTE', 'ETR', 'FE', 'AES',
  // ── Materials ──
  'LIN', 'APD', 'SHW', 'ECL', 'DD', 'NEM', 'FCX', 'NUE',
  'STLD', 'CMC', 'AA', 'X', 'CLF', 'MT', 'SCCO',
  // ── Comms / media ──
  'T', 'VZ', 'CMCSA', 'WBD',
  'PARA', 'FOXA', 'FOX', 'LYV', 'LUMN', 'DISH',
  'MGNI', 'PUBM', 'DV', 'MAX',
  // ── Crypto / fintech ──
  'MELI', 'MSTR', 'MARA', 'RIOT', 'CLSK', 'IREN', 'HUT', 'BITF',
  'CIFR', 'BTBT', 'CORZ', 'WULF',
  // ── LatAm ──
  'NU', 'STNE', 'PAGS', 'VIV', 'EBR', 'PAM',
  'YPF', 'BMA', 'GGAL', 'SUPV', 'CRESY', 'TEO', 'TGS',
  // ── Additional mid/small-cap growth ──
  'CLOV', 'AFRM', 'LMND', 'VNET', 'BIDU',
  'PINS', 'SNAP', 'YELP', 'ZM', 'DOCU', 'PTON', 'W', 'CVNA',
  'AI', 'PLUG', 'FCEL', 'BE', 'CHPT', 'QS', 'MVST', 'LAZR',
  'LIDR', 'INVZ', 'CARG',
  // ── Additional mid-cap growth / momentum ──
  'IONQ', 'RGTI', 'APPF', 'GDDY', 'WK', 'TORO',
  'SOFI', 'UPST', 'RKT', 'LC', 'ENV', 'BR', 'BROS', 'CART',
  // ── Additional sector leaders ──
  'TTD', 'HUBS', 'SMAR', 'FIVN', 'ESTC', 'MNDY', 'MDB', 'TWLO', 'SNOW', 'PLTR',
  'ARM', 'SMCI', 'DELL', 'HPE',
  // ── More consumer / retail ──
  'LULU', 'TJX', 'ROST', 'BBY', 'DG', 'DLTR', 'AZO', 'ORLY', 'YUM',
  'BURL', 'URBN', 'ANF', 'AEO', 'GPS',
  'SHAK', 'CAKE', 'DIN', 'JACK', 'WING',
  // ── More healthcare ──
  'DXCM', 'HCA', 'UHS', 'CYH', 'SEM', 'AMED', 'ENSG', 'GMED',
  'IRTC', 'SILK', 'NVCR', 'NTRA', 'CRSP', 'BEAM', 'EDIT', 'NTLA',
  'DOCS', 'TDOC', 'AMWL', 'HIMS', 'GDRX', 'OSCR', 'MOH',
  // ── More industrials / defense ──
  'CW', 'KTOS', 'LDOS', 'SAIC',
  'WM', 'RSG', 'J', 'ACM', 'FYBR', 'DAL', 'LUV', 'UAL', 'ALK',
  'AAL', 'JBLU', 'SKYW',
  // ── More energy ──
  'SM', 'AR', 'CIVI', 'MTDR', 'SWN', 'EQT', 'RRC', 'AROC',
  'CHRD', 'NOG', 'CEIX', 'ARCH', 'AMR', 'BTU',
  // ── More REITs ──
  'VICI', 'EXR', 'VNO', 'BXP', 'KIM', 'REG', 'HST',
  // ── More materials / commodities ──
  'STLD', 'CMC', 'AA', 'X', 'CLF', 'MT', 'SCCO',
  // ── High-momentum / recent IPOs ──
  'CRDO', 'IONQ', 'RGTI', 'PLTR', 'ARM', 'SMCI',
];

export async function fetchDynamicUniverse(): Promise<string[]> {
  const [gainers, losers, mostActive, trending] = await Promise.all([
    yf.screener({ scrIds: 'day_gainers', count: 75 }).catch(() => null),
    yf.screener({ scrIds: 'day_losers', count: 75 }).catch(() => null),
    yf.screener({ scrIds: 'most_actives', count: 75 }).catch(() => null),
    yf.trendingSymbols('US', { count: 50 }).catch(() => null),
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
