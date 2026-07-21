import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

const SCREENER_SYMBOLS = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK-B','JPM','V',
  'JNJ','WMT','PG','MA','UNH','HD','DIS','PYPL','ADBE','NFLX',
  'INTC','CRM','KO','PEP','NKE','MRK','ABT','TMO','AVGO','QCOM',
  'ACN','DHR','TXN','HON','LOW','UNP','UPS','IBM','MDT','AMGN',
  'SBUX','BA','MMM','GS','C','BAC','MS','WFC','AXP','CVX',
  'XOM','COP','EOG','SLB','OXY','LMT','RTX','GD','NOC','CAT',
  'DE','GE','F','GM','T','VZ','TMUS','CMCSA','CHTR',
  'ORCL','SAP','NOW','UBER','ABNB','SNAP','PINS','SQ','SHOP','SPOT',
  'ZM','DOCU','CRWD','PANW','DDOG','MDB','NET','PLTR','AI','SOFI',
];

function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  let m = arr.length;
  while (m) {
    m--;
    const i = Math.floor(((seed * 16807) % 2147483647) / 2147483647 * (m + 1));
    [arr[m], arr[i]] = [arr[i], arr[m]];
    seed = (seed * 16807 + 1) % 2147483647;
  }
  return arr;
}

function getTodaySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) return closes[closes.length - 1];
  const slice = closes.slice(closes.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const seed = getTodaySeed();
    const shuffled = seededShuffle(SCREENER_SYMBOLS, seed);
    const todaySymbol = shuffled[0];

    const quote = await yf.quote(todaySymbol);

    if (!quote || !quote.regularMarketPrice) {
      return NextResponse.json({ error: 'Could not fetch quote' }, { status: 500 });
    }

    let candles: { t: number; o: number; h: number; l: number; c: number; v: number }[] = [];
    let closes: number[] = [];
    try {
      const history = await yf.historical(todaySymbol, { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), period2: new Date() });
      candles = history
        .filter(h => h.close != null && h.open != null && h.high != null && h.low != null)
        .slice(-60)
        .map((h, i) => ({
          t: i,
          o: h.open!,
          h: h.high!,
          l: h.low!,
          c: h.close!,
          v: h.volume || 0,
        }));
      closes = candles.map(c => c.c);
    } catch {
      console.warn(`No historical data for ${todaySymbol}, using defaults`);
    }
    const rsi = calcRSI(closes);
    const sma50 = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);
    const trend = sma50 > sma200 * 1.02 ? 'alcista' : sma50 < sma200 * 0.98 ? 'bajista' : 'lateral';

    const price = quote.regularMarketPrice;
    const peRatio = (quote as any).summaryDetail?.trailingPE || (quote as any).trailingPE || quote.priceEarnings?.trailingPE || 0;
    const targetMean = (quote as any).summaryDetail?.targetMeanPrice || (quote as any).targetMeanPrice || 0;
    const targetUpside = targetMean > 0 ? ((targetMean - price) / price) * 100 : 0;
    const fiftyTwoWeekLow = (quote as any).summaryDetail?.fiftyTwoWeekLow || quote.fiftyTwoWeekLow || 0;
    const fiftyTwoWeekHigh = (quote as any).summaryDetail?.fiftyTwoWeekHigh || quote.fiftyTwoWeekHigh || 0;
    const positionInRange = (fiftyTwoWeekHigh - fiftyTwoWeekLow) > 0
      ? ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100 : 50;

    let signal: string;
    let score = 0;

    if (peRatio > 0 && peRatio < 15) score += 2;
    else if (peRatio > 0 && peRatio < 25) score += 1;

    if (rsi < 30) score += 2;
    else if (rsi < 45) score += 1;
    else if (rsi > 70) score -= 1;

    if (trend === 'alcista') score += 2;
    else if (trend === 'bajista') score -= 1;

    if (targetUpside > 20) score += 2;
    else if (targetUpside > 10) score += 1;
    else if (targetUpside < -10) score -= 1;

    if (positionInRange < 20) score += 1;
    else if (positionInRange > 90) score -= 1;

    if (score >= 4) signal = 'COMPRAR';
    else if (score >= 1) signal = 'MANTENER';
    else signal = 'VENDER';

    const name = quote.shortName || quote.longName || todaySymbol;

    const lastCandles = candles.slice(-5);
    const avgBody = lastCandles.reduce((a, c) => a + Math.abs(c.c - c.o), 0) / lastCandles.length;
    const avgUpperWick = lastCandles.reduce((a, c) => a + (c.h - Math.max(c.c, c.o)), 0) / lastCandles.length;
    const avgLowerWick = lastCandles.reduce((a, c) => a + (Math.min(c.c, c.o) - c.l), 0) / lastCandles.length;
    const greenCount = lastCandles.filter(c => c.c >= c.o).length;

    let candlePattern = 'neutral';
    if (greenCount >= 4) candlePattern = 'alcista-fuerte';
    else if (greenCount <= 1) candlePattern = 'bajista-fuerte';
    else if (avgLowerWick > avgBody * 0.7 && greenCount >= 3) candlePattern = 'compression-alcista';
    else if (avgUpperWick > avgBody * 0.7 && greenCount <= 2) candlePattern = 'compression-bajista';

    const hints = [
      { label: 'Precio', key: 'price', value: `$${price.toFixed(2)}`, revealed: true },
      { label: 'RSI (14)', key: 'rsi', value: rsi.toFixed(1), revealed: false },
      { label: 'Tendencia', key: 'trend', value: trend.charAt(0).toUpperCase() + trend.slice(1), revealed: false },
      { label: 'Patrón Velas', key: 'pattern', value: candlePattern.replace('-', ' ').toUpperCase(), revealed: false },
      { label: 'PE Ratio', key: 'peRatio', value: peRatio > 0 ? peRatio.toFixed(1) : 'N/A', revealed: false },
      { label: 'Target Upside', key: 'targetUpside', value: targetUpside !== 0 ? `${targetUpside.toFixed(1)}%` : 'N/A', revealed: false },
    ];

    const chartData = candles;

    const sma50Series = candles.length >= 50
      ? candles.map((_, i) => {
          const start = Math.max(0, i - 49);
          const slice = closes.slice(closes.length - candles.length + start, closes.length - candles.length + i + 1);
          return slice.reduce((a, b) => a + b, 0) / slice.length;
        })
      : [];

    const support = closes.length > 20 ? Math.min(...closes.slice(-50)) : price * 0.95;
    const resistance = closes.length > 20 ? Math.max(...closes.slice(-50)) : price * 1.05;

    const challenge = {
      id: `${seed}-${todaySymbol}`.toLowerCase(),
      symbol: todaySymbol,
      name,
      price,
      hints,
      maxScore: 100,
      chartData,
      sma50: sma50Series,
      support,
      resistance,
      trend,
    };

    const response = NextResponse.json(challenge, { status: 200 });
    response.headers.set('Set-Cookie', `daily_signal=${signal}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
