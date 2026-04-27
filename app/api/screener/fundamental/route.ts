import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

const UNIVERSE_500 = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'JPM',
  'BAC', 'WMT', 'HD', 'DIS', 'NFLX', 'PYPL', 'SQ', 'COIN', 'UBER', 'COST',
  'MCD', 'NKE', 'CRM', 'V', 'MA', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK',
  'AVGO', 'QCOM', 'MU', 'TXN', 'NOW', 'ORCL', 'ADBE', 'SNOW', 'DDOG', 'CRWD',
  'ZS', 'WDAY', 'TEAM', 'NET', 'OKTA', 'SNAP', 'ROKU', 'PLTR', 'RBLX', 'U',
  'BKNG', 'SBUX', 'LULU', 'ROST', 'TJX', 'DG', 'DLTR', 'ETSY', 'GM', 'F',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'DVN', 'FANG', 'MPC', 'HAL', 'OXY',
  'CAT', 'DE', 'BA', 'HON', 'GE', 'UPS', 'FDX', 'LMT', 'RTX', 'NOC',
  'LLY', 'BMY', 'AMGN', 'GILD', 'REGN', 'VRTX', 'MRNA', 'CNC', 'HUM',
  'SPOT', 'DASH', 'LYFT', 'HOOD', 'AFRM', 'OPEN', 'SE', 'PATH',
  'BABA', 'JD', 'PDD', 'BIDU', 'MELI', 'AYX', 'DOCU', 'ZM', 'TWLO',
  'RIVN', 'LCID', 'STLA', 'TM', 'RACE', 'PAG',
  'MSTR', 'MARA', 'RIOT', 'GME', 'AMC',
  'AAL', 'DAL', 'UAL', 'LUV', 'RCL', 'CCL', 'MGM', 'WYNN', 'LVS',
  'PARA', 'WBD', 'CMCSA', 'FOX', 'NWSA',
  'GOLD', 'NEM', 'AEM', 'FNV',
  'KLAC', 'LRCX', 'AMAT', 'ASML', 'SMCI', 'MRVL', 'MPWR', 'TER',
  'GS', 'MS', 'C', 'WFC', 'SCHW', 'BLK', 'AXP', 'DFS', 'SYF',
  'AMZN', 'WFC', 'T', 'VZ', 'TMUS', 'DIS', 'CHTR', 'CMCSA',
  'BA', 'LMT', 'RTX', 'NOC', 'GD', 'LHX', 'TXT', 'HII',
  'AIG', 'Met', 'PRU', 'AFL', 'MFC', 'GL', 'TRV', 'CBO',
  'HON', 'UPS', 'FDX', 'RTX', 'CAT', 'DE', 'CMI', 'EMR',
  'LRCX', 'AMAT', 'ASML', 'KLAC', 'MXIM', 'INFN', 'JNPR',
  'ADBE', 'CRM', 'NOW', 'TEAM', 'PLAN', 'SPLK', 'DBOK',
  'PANW', 'FTNT', 'CHKP', 'ZS', 'CRWD', 'SANS', 'OKTA',
  'COST', 'WMT', 'HD', 'LOW', 'TGT', 'BBY', 'DG', 'DLTR',
  'JNJ', 'UNH', 'PFE', 'MRK', 'ABBV', 'BMY', 'LLY', 'AMGN',
  'CVX', 'XOM', 'COP', 'EOG', 'PSX', 'VLO', 'MPC', 'HAL',
  'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'AXP',
  'V', 'MA', 'PYPL', 'SQ', 'FIS', 'FISV', 'GPN', 'ADP',
  'NKE', 'SBUX', 'MCD', 'YUM', 'CMG', 'DPZ', 'QSR',
];

const GROWTH_STOCKS = [
  'NVDA', 'META', 'AMD', 'PLTR', 'SNOW', 'CRWD', 'DDOG', 'NET', 'OKTA',
  'ZS', 'WDAY', 'TEAM', 'DOCU', 'ZM', 'TWLO', 'ROKU', 'DASH', 'ABNB',
  'RBLX', 'U', 'PATH', 'SE', 'AI', 'APP', 'SOFI', 'HOOD',
  'SMCI', 'ARM', 'MRVL', 'INTC', 'QCOM', 'TXN', 'ON',
  'TSLA', 'RIVN', 'LCID', 'F', 'GM', 'NIO', 'XPEV', 'LI',
  'AYX', 'CFLT', 'ESTC', 'MDB', 'GTLB', 'FROG', 'SUMO',
  'ESTC', 'DUOL', 'ALRM', 'NCNO', 'EVBG', 'BRZE', 'FLT',
  'GOOGL', 'AMZN', 'META', 'SNAP', 'PINS', 'MTCH', 'BUMZ',
  'AAPL', 'MSFT', 'COIN', 'MARA', 'RIOT', 'BTBT', 'MSTR',
  'ASTS', 'LDK', 'RKLB', 'QS', 'SNAP', 'VLDR', 'LIDAR',
];

function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dateToSeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

interface StockFundamental {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  pbRatio: number;
  psRatio: number;
  dividendYield: number;
  epsTrailing: number;
  epsForward: number;
  peForward: number;
  profitMargin: number;
  roe: number;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  revenueGrowth: number;
earningsGrowth: number;
  '52WeekHigh': number;
  '52WeekLow': number;
  priceToFairValue: number;
  recommendation: string;
  score: number;
  reasons: string[];
}

function calculateScore(stock: any): number {
  let score = 50;

  if (stock.peRatio > 0 && stock.peRatio < 15) score += 15;
  else if (stock.peRatio > 0 && stock.peRatio < 20) score += 10;
  else if (stock.peRatio > 0 && stock.peRatio < 25) score += 5;
  else if (stock.peRatio > 0 && stock.peRatio > 40) score -= 10;

  if (stock.pegRatio > 0 && stock.pegRatio < 1) score += 15;
  else if (stock.pegRatio > 0 && stock.pegRatio < 1.5) score += 10;
  else if (stock.pegRatio > 0 && stock.pegRatio > 2.5) score -= 10;

  if (stock.dividendYield > 0.03) score += 10;
  else if (stock.dividendYield > 0.02) score += 5;

  if (stock.profitMargin > 0.2) score += 10;
  else if (stock.profitMargin > 0.1) score += 5;
  else if (stock.profitMargin < 0) score -= 10;

  if (stock.roe > 0.2) score += 10;
  else if (stock.roe > 0.15) score += 5;
  else if (stock.roe < 0) score -= 10;

  if (stock.debtToEquity > 0 && stock.debtToEquity < 0.5) score += 10;
  else if (stock.debtToEquity > 0 && stock.debtToEquity < 1) score += 5;
  else if (stock.debtToEquity > 2) score -= 10;

  if (stock.revenueGrowth > 0.2) score += 10;
  else if (stock.revenueGrowth > 0.1) score += 5;
  else if (stock.revenueGrowth < 0) score -= 10;

  if (stock.earningsGrowth > 0.2) score += 10;
  else if (stock.earningsGrowth > 0.1) score += 5;
  else if (stock.earningsGrowth < 0) score -= 5;

  const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
  if (priceDiff > -10) score += 5;
  else if (priceDiff > -20) score += 10;
  else if (priceDiff > -30) score += 15;

  return Math.min(100, Math.max(0, score));
}

function getRecommendation(score: number): string {
  if (score >= 75) return 'excelente';
  if (score >= 60) return 'buena';
  if (score >= 40) return 'regular';
  return 'sobrevalorada';
}

function getReasons(stock: any, score: number): string[] {
  const reasons: string[] = [];

  if (stock.peRatio > 0 && stock.peRatio < 20) {
    reasons.push(`P/E: ${stock.peRatio.toFixed(1)} - ${stock.peRatio < 15 ? 'muy bueno' : 'aceptable'}`);
  }
  if (stock.pegRatio > 0 && stock.pegRatio < 2) {
    reasons.push(`PEG: ${stock.pegRatio.toFixed(1)} - ${stock.pegRatio < 1 ? 'barato' : 'razonable'}`);
  }
  if (stock.dividendYield > 0.01) {
    reasons.push(`Dividendo: ${(stock.dividendYield * 100).toFixed(1)}%`);
  }
  if (stock.profitMargin > 0.2) {
    reasons.push(`Margen: ${(stock.profitMargin * 100).toFixed(0)}%`);
  }
  if (stock.roe > 0.2) {
    reasons.push(`ROE: ${(stock.roe * 100).toFixed(0)}%`);
  }
  if (stock.revenueGrowth > 0.15) {
    reasons.push(`Crecimiento: ${(stock.revenueGrowth * 100).toFixed(0)}%`);
  }

  const priceDiff = ((stock.regularMarketPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100;
  if (priceDiff < -20) {
    reasons.push(`Precio: ${priceDiff.toFixed(0)}% bajo máximo 52s`);
  }

  return reasons;
}

export async function GET(request: NextRequest) {
  try {
    const today = new Date();
    const combinedUniverse = Array.from(new Set([...UNIVERSE_500, ...GROWTH_STOCKS]));
    const dailySeed = dateToSeed(today);
    const shuffledUniverse = seededShuffle(combinedUniverse, dailySeed);
    const dailyStocks = shuffledUniverse.slice(0, 50);

    const results = await Promise.all(
      dailyStocks.map(async (sym) => {
        try {
          const quoteResult = await yf.quote(sym).catch(() => null);
          const quote = quoteResult as any;
          if (!quote || !quote.regularMarketPrice) return null;

          const stats = await yf.quoteSummary(sym, { modules: ['assetProfile', 'defaultKeyStatistics', 'financialData', 'earnings', 'price'] }).catch(() => null);

          const peRatio = quote.trailingPE || 0;
          const pegRatio = (stats?.defaultKeyStatistics as any)?.pegRatio || (stats?.defaultKeyStatistics as any)?.pegTrailingRatio || 0;
          const pbRatio = (stats?.defaultKeyStatistics as any)?.priceToBook || 0;
          const psRatio = (stats?.defaultKeyStatistics as any)?.priceToSalesTrailing12Months || 0;
          const dividendYield = quote.dividendYield || 0;
          const epsTrailing = (stats?.defaultKeyStatistics as any)?.epsTrailing12Months || 0;
          const epsForward = (stats?.defaultKeyStatistics as any)?.epsForward || 0;
          const beta = (stats?.defaultKeyStatistics as any)?.beta || 1;

          const profitMargin = (stats?.financialData as any)?.profitMargins || 0;
          const roe = (stats?.financialData as any)?.returnOnEquity || 0;
          const debtToEquity = (stats?.financialData as any)?.debtToEquity || 0;
          const currentRatio = (stats?.financialData as any)?.currentRatio || 0;
          const quickRatio = (stats?.financialData as any)?.quickRatio || 0;
          const revenueGrowth = (stats?.financialData as any)?.revenueGrowth || 0;
          const earningsGrowth = (stats?.financialData as any)?.earningsGrowth || 0;

          const peForward = epsForward > 0 ? quote.regularMarketPrice / epsForward : 0;

          const score = calculateScore({
            peRatio,
            pegRatio,
            dividendYield,
            profitMargin,
            roe,
            debtToEquity,
            revenueGrowth,
            earningsGrowth,
            regularMarketPrice: quote.regularMarketPrice as number,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh as number,
          });

          const stock: StockFundamental = {
            symbol: sym,
            name: (quote.shortName as string) || sym,
            price: quote.regularMarketPrice as number,
            change: (quote.regularMarketChange as number) || 0,
            changePercent: (quote.regularMarketChangePercent as number) || 0,
            sector: (quote.sector as string) || 'Unknown',
            industry: (stats?.assetProfile as any)?.industry || 'Unknown',
            marketCap: (quote.marketCap as number) || 0,
            peRatio,
            pegRatio,
            pbRatio,
            psRatio,
            dividendYield,
            epsTrailing,
            epsForward,
            peForward,
            profitMargin,
            roe,
            debtToEquity,
            currentRatio,
            quickRatio,
            revenueGrowth,
            earningsGrowth,
            '52WeekHigh': (quote.fiftyTwoWeekHigh as number) || 0,
            '52WeekLow': (quote.fiftyTwoWeekLow as number) || 0,
            priceToFairValue: 0,
            recommendation: getRecommendation(score),
            score,
            reasons: getReasons({
              peRatio,
              pegRatio,
              dividendYield,
              profitMargin,
              roe,
              revenueGrowth,
              earningsGrowth,
              regularMarketPrice: quote.regularMarketPrice as number,
              '52WeekHigh': quote.fiftyTwoWeekHigh as number,
            }, score),
          };

          return stock;
        } catch {
          return null;
        }
      })
    );

    const validStocks = results.filter((r): r is NonNullable<typeof r> => r !== null && r.price > 0);
    validStocks.sort((a, b) => b.score - a.score);

    const excelente = validStocks.filter((r) => r.score >= 75);
    const buena = validStocks.filter((r) => r.score >= 60 && r.score < 75);
    const regular = validStocks.filter((r) => r.score >= 40 && r.score < 60);

    const dateStr = today.toISOString().split('T')[0];
    const totalAnalyzed = validStocks.length;

    return NextResponse.json({
      stocks: validStocks.slice(0, 30),
      count: 30,
      totalAnalyzed: totalAnalyzed,
      date: dateStr,
      summary: {
        excelente: excelente.length,
        buena: buena.length,
        regular: regular.length,
        sobrevalorada: validStocks.length - excelente.length - buena.length - regular.length,
      },
      topPicks: validStocks.slice(0, 10),
      undervalued: validStocks.filter((r) => r.recommendation === 'excelente' || r.recommendation === 'buena').slice(0, 10),
      highYield: validStocks.filter((r) => r.dividendYield > 0.02).slice(0, 10),
      growth: validStocks.filter((r) => r.revenueGrowth > 0.15).slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fundamental screener error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}