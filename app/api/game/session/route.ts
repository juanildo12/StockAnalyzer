import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

const SYMBOLS = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','V',
  'JNJ','WMT','PG','MA','UNH','HD','DIS','PYPL','ADBE','NFLX',
  'INTC','CRM','KO','PEP','NKE','MRK','ABT','TMO','AVGO','QCOM',
  'ACN','DHR','TXN','HON','LOW','UNP','UPS','IBM','MDT','AMGN',
  'SBUX','BA','MMM','GS','C','BAC','MS','WFC','AXP','CVX',
  'XOM','COP','EOG','SLB','OXY','LMT','RTX','GD','NOC','CAT',
  'DE','GE','T','VZ','TMUS','CMCSA','CHTR',
  'ORCL','SAP','NOW','UBER','ABNB','SNAP','PINS','SQ','SHOP',
  'ZM','DOCU','CRWD','PANW','DDOG','MDB','NET','PLTR','AI','SOFI',
];

const VOLATILE_SYMBOLS = [
  'TSLA','NVDA','MSTR','COIN','RIVN','LCID','MARA','RIOT','GME','AMC',
  'PLTR','SOFI','HOOD','AFRM','UPST','DASH','U','PATH','CFLT','TOST',
];

const OBSCURE_SYMBOLS = [
  'FRO','SBLK','GOGL','HAFN','DAC','TK','NAT','VTOL','MATX','ARCB',
  'AGX','AME','AZZ','BCC','CNXN','DORM','GMS','HDS','KNSL','LMAT',
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

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = [], losses: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computeSignal(price: number, closes: number[], peRatio: number, targetMean: number, fiftyTwoWeekLow: number, fiftyTwoWeekHigh: number): string {
  const rsi = calcRSI(closes);
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  const trend65 = sma50 > sma200 * 1.02 ? 'alcista' : sma50 < sma200 * 0.98 ? 'bajista' : 'lateral';
  const targetUpside = targetMean > 0 ? ((targetMean - price) / price) * 100 : 0;
  const positionInRange = (fiftyTwoWeekHigh - fiftyTwoWeekLow) > 0
    ? ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100 : 50;

  let score = 0;
  if (peRatio > 0 && peRatio < 15) score += 2;
  else if (peRatio > 0 && peRatio < 25) score += 1;
  if (rsi < 30) score += 2;
  else if (rsi < 45) score += 1;
  else if (rsi > 70) score -= 1;
  if (trend65 === 'alcista') score += 2;
  else if (trend65 === 'bajista') score -= 1;
  if (targetUpside > 20) score += 2;
  else if (targetUpside > 10) score += 1;
  else if (targetUpside < -10) score -= 1;
  if (positionInRange < 20) score += 1;
  else if (positionInRange > 90) score -= 1;

  if (score >= 4) return 'COMPRAR';
  if (score >= 1) return 'MANTENER';
  return 'VENDER';
}

const TIER_CONFIGS: Record<string, { hintsRevealed: number; timer: number; sessionSize: number; symbolPool: string[] }> = {
  novato: { hintsRevealed: 4, timer: 0, sessionSize: 5, symbolPool: SYMBOLS },
  bronce: { hintsRevealed: 2, timer: 0, sessionSize: 5, symbolPool: SYMBOLS },
  plata: { hintsRevealed: 1, timer: 75, sessionSize: 7, symbolPool: [...SYMBOLS, ...VOLATILE_SYMBOLS] },
  oro: { hintsRevealed: 0, timer: 55, sessionSize: 7, symbolPool: [...SYMBOLS, ...VOLATILE_SYMBOLS] },
  platino: { hintsRevealed: 0, timer: 35, sessionSize: 10, symbolPool: [...SYMBOLS, ...VOLATILE_SYMBOLS, ...OBSCURE_SYMBOLS] },
  diamante: { hintsRevealed: 0, timer: 20, sessionSize: 10, symbolPool: [...VOLATILE_SYMBOLS, ...OBSCURE_SYMBOLS] },
};

function parseCookies(cookie: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookie) return result;
  cookie.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) result[k] = v.join('=');
  });
  return result;
}

function encodeSignals(signals: string[]): string {
  return Buffer.from(JSON.stringify(signals)).toString('base64');
}

function decodeSignals(encoded: string): string[] {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString());
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, difficulty, challengeIndex, userGuess, confidence } = body;

    if (action === 'start') {
      const tier = TIER_CONFIGS[difficulty] || TIER_CONFIGS.novato;
      const seed = Math.floor(Date.now() / 1000);
      const shuffled = seededShuffle(tier.symbolPool, seed);
      const selected = shuffled.slice(0, tier.sessionSize);
      const challenges: any[] = [];
      const signals: string[] = [];

      for (let i = 0; i < selected.length; i++) {
        const sym = selected[i];
        let quote: any = null;
        try { quote = await yf.quote(sym); } catch {}
        if (!quote || !quote.regularMarketPrice) continue;

        const price = quote.regularMarketPrice;
        let closes: number[] = [];
        try {
          const history = await yf.historical(sym, { period1: new Date(Date.now() - 365 * 86400000), period2: new Date() });
          closes = history.map(h => h.close).filter(c => c != null) as number[];
        } catch {}

        const peRatio = quote.summaryDetail?.trailingPE || quote.trailingPE || quote.priceEarnings?.trailingPE || 0;
        const targetMean = quote.summaryDetail?.targetMeanPrice || quote.targetMeanPrice || 0;
        const fiftyTwoWeekLow = quote.summaryDetail?.fiftyTwoWeekLow || quote.fiftyTwoWeekLow || 0;
        const fiftyTwoWeekHigh = quote.summaryDetail?.fiftyTwoWeekHigh || quote.fiftyTwoWeekHigh || 0;

        const rsi = calcRSI(closes);
        const sma50 = calcSMA(closes, 50);
        const sma200 = calcSMA(closes, 200);
        const trend = sma50 > sma200 * 1.02 ? 'alcista' : sma50 < sma200 * 0.98 ? 'bajista' : 'lateral';
        const targetUpside = targetMean > 0 ? ((targetMean - price) / price) * 100 : 0;
        const positionInRange = (fiftyTwoWeekHigh - fiftyTwoWeekLow) > 0
          ? ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100 : 50;

        const signal = computeSignal(price, closes, peRatio, targetMean, fiftyTwoWeekLow, fiftyTwoWeekHigh);
        signals.push(signal);

        const name = quote.shortName || quote.longName || sym;

        let candles: any[] = [];
        try {
          const history = await yf.historical(sym, { period1: new Date(Date.now() - 120 * 86400000), period2: new Date() });
          candles = history
            .filter(h => h.close != null && h.open != null && h.high != null && h.low != null)
            .slice(-40)
            .map(h => ({
              t: i,
              o: h.open!,
              h: h.high!,
              l: h.low!,
              c: h.close!,
              v: h.volume || 0,
            }));
        } catch {}

        const candleCloses = candles.map(c => c.c);
        const sma50Series = candleCloses.length >= 50
          ? [] : candleCloses.map((_, ci) => {
            const start = Math.max(0, ci - 49);
            const slice = candleCloses.slice(start, ci + 1);
            return slice.reduce((a, b) => a + b, 0) / slice.length;
          });

        const hintCount = tier.hintsRevealed;
        const hints = [
          { label: 'Precio', key: 'price', value: `$${price.toFixed(2)}`, revealed: hintCount >= 1 },
          { label: 'RSI (14)', key: 'rsi', value: rsi.toFixed(1), revealed: hintCount >= 2 },
          { label: 'Tendencia', key: 'trend', value: trend.charAt(0).toUpperCase() + trend.slice(1), revealed: hintCount >= 3 },
          { label: 'PE Ratio', key: 'peRatio', value: peRatio > 0 ? peRatio.toFixed(1) : 'N/A', revealed: hintCount >= 4 },
          { label: 'Posición 52sem', key: 'range', value: `${positionInRange.toFixed(0)}%`, revealed: false },
          { label: 'Target Upside', key: 'target', value: targetUpside !== 0 ? `${targetUpside.toFixed(1)}%` : 'N/A', revealed: false },
        ];

        challenges.push({
          index: i,
          symbol: sym,
          name,
          price,
          hints,
          chartData: candles,
          sma50: sma50Series,
          support: closes.length > 20 ? Math.min(...closes.slice(-50)) : price * 0.95,
          resistance: closes.length > 20 ? Math.max(...closes.slice(-50)) : price * 1.05,
          trend,
        });
      }

      const response = NextResponse.json({ challenges, config: tier, totalChallenges: challenges.length }, { status: 200 });
      response.headers.set('Set-Cookie', `session_signals=${encodeSignals(signals.slice(0, challenges.length))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`);
      return response;
    }

    if (action === 'verify') {
      const cookies = parseCookies(req.headers.get('Cookie') || '');
      const encoded = cookies['session_signals'];
      if (!encoded) {
        return NextResponse.json({ error: 'No active session' }, { status: 400 });
      }
      const signals = decodeSignals(encoded);
      if (challengeIndex < 0 || challengeIndex >= signals.length) {
        return NextResponse.json({ error: 'Invalid challenge index' }, { status: 400 });
      }

      const correctSignal = signals[challengeIndex];
      const isCorrect = userGuess === correctSignal;
      const confidenceMult = confidence === 'alta' ? 1 : confidence === 'media' ? 0.8 : 0.6;
      const baseScore = isCorrect ? 100 : 0;
      const score = Math.round(baseScore * confidenceMult);

      const explanation = isCorrect
        ? `¡Correcto! La señal real era ${correctSignal}. Tu análisis va por buen camino.`
        : `La señal real era ${correctSignal}. Revisa los indicadores clave para la próxima.`;

      return NextResponse.json({
        correct: isCorrect,
        userGuess,
        correctSignal,
        score,
        explanation,
        confidence,
        challengeIndex,
      }, { status: 200 });
    }

    if (action === 'end') {
      const response = NextResponse.json({ ended: true }, { status: 200 });
      response.headers.set('Set-Cookie', `session_signals=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
      return response;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
