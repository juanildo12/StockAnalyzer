export interface GrahamInput {
  cash: number;
  totalDebt: number;
  currentAssets: number;
  currentLiabilities: number;
  totalLiabilities: number;
  marketCap: number;
  priceToBook?: number;
  bookValue?: number;
}

export interface GrahamMetric {
  name: string;
  formula: string;
  value: number;
  threshold: string;
  passes: boolean;
  detail: string;
}

export interface GrahamScoreResult {
  ncav: GrahamMetric;
  netCash: GrahamMetric;
  ev: GrahamMetric;
  currentRatio: GrahamMetric;
  priceToBook: GrahamMetric;
  passingCount: number;
  totalCount: number;
  scorePercent: number;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-$' : '$';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString()}`;
}

export function analyzeGraham(input: GrahamInput): GrahamScoreResult {
  const {
    cash,
    totalDebt,
    currentAssets,
    currentLiabilities,
    totalLiabilities,
    marketCap,
    priceToBook,
    bookValue,
  } = input;

  // 1. NCAV (Net Current Asset Value)
  const ncav = currentAssets - totalLiabilities;
  const ncavRatio = ncav > 0 ? marketCap / ncav : Infinity;
  const ncavPass = ncav > 0 && marketCap < ncav;
  const ncavMetric: GrahamMetric = {
    name: 'NCAV (Valor Activo Neto Corriente)',
    formula: 'Current Assets − Total Liabilities',
    value: ncav,
    threshold: 'MarketCap < NCAV',
    passes: ncavPass,
    detail: ncav > 0
      ? `NCAV ${fmt(ncav)} | MarketCap ${fmt(marketCap)} | Ratio ${(ncavRatio).toFixed(2)}x`
      : 'NCAV negativo — no califica',
  };

  // 2. Net Cash
  const netCash = cash - totalDebt;
  const netCashPass = netCash > 0 && marketCap < netCash;
  const netCashMetric: GrahamMetric = {
    name: 'Net Cash (Efectivo Neto)',
    formula: 'Cash − Total Debt',
    value: netCash,
    threshold: 'MarketCap < Net Cash',
    passes: netCashPass,
    detail: netCash > 0
      ? `Net Cash ${fmt(netCash)} | MarketCap ${fmt(marketCap)} | Ratio ${(marketCap / netCash).toFixed(2)}x`
      : 'Deuda supera al efectivo',
  };

  // 3. Enterprise Value
  const ev = marketCap + totalDebt - cash;
  const evPass = ev < 0;
  const evMetric: GrahamMetric = {
    name: 'EV (Enterprise Value)',
    formula: 'MarketCap + Debt − Cash',
    value: ev,
    threshold: 'EV < 0 (Enterprise Value negativo)',
    passes: evPass,
    detail: ev < 0
      ? `EV ${fmt(ev)} — ¡Valor de empresa negativo!`
      : `EV ${fmt(ev)} — positivo`,
  };

  // 4. Current Ratio
  const cr = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const crPass = cr >= 1.5;
  const crMetric: GrahamMetric = {
    name: 'Current Ratio (Liquidez)',
    formula: 'Current Assets / Current Liabilities',
    value: cr,
    threshold: '≥ 1.5 (saludable)',
    passes: crPass,
    detail: cr >= 1.5
      ? `${cr.toFixed(2)} — Salud financiera adecuada`
      : cr >= 1
        ? `${cr.toFixed(2)} — Aceptable pero ajustado`
        : `${cr.toFixed(2)} — Problemas de liquidez`,
  };

  // 5. Price to Book
  const pbPass = priceToBook !== undefined && priceToBook > 0 && priceToBook < 1.2;
  const pbMetric: GrahamMetric = {
    name: 'P/B (Price to Book)',
    formula: 'Price / Book Value per Share',
    value: priceToBook ?? 0,
    threshold: '< 1.2 (Graham: < 1.0 ideal)',
    passes: pbPass,
    detail: priceToBook && priceToBook > 0
      ? priceToBook < 1
        ? `${priceToBook.toFixed(2)} — Por debajo del valor en libros`
        : `${priceToBook.toFixed(2)} — ${priceToBook < 1.2 ? 'Cerca del valor en libros' : 'Sobrevalorado vs libros'}`
      : 'Dato no disponible',
  };

  const metrics = [ncavMetric, netCashMetric, evMetric, crMetric, pbMetric];
  const passingCount = metrics.filter(m => m.passes).length;
  const totalCount = metrics.filter(m => m.value !== 0 || m.name === 'Current Ratio (Liquidez)').length;

  return {
    ncav: ncavMetric,
    netCash: netCashMetric,
    ev: evMetric,
    currentRatio: crMetric,
    priceToBook: pbMetric,
    passingCount,
    totalCount,
    scorePercent: totalCount > 0 ? Math.round((passingCount / totalCount) * 100) : 0,
  };
}
