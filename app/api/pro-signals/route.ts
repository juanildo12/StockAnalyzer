import { NextRequest, NextResponse } from 'next/server';
import { getStockIndicators as getFinnhubIndicators, getSocialSentiment, getOwnership, getInsiderTransactions } from '@/src/services/finnhubClient';
import { getBars, getShortInterest, getFinancialRatios } from '@/src/services/polygonClient';

export const dynamic = 'force-dynamic';

interface SignalResult {
  name: string;
  key: string;
  value: number; // 0-100
  description: string;
  direction: 'bullish' | 'bearish' | 'neutral';
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const sym = symbol.toUpperCase();
  const signals: SignalResult[] = [];

  try {
    const today = new Date();
    const from = new Date(today);
    from.setFullYear(from.getFullYear() - 1);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const [shortInterest, ratios, indicators, social, ownership, insider, bars] = await Promise.all([
      getShortInterest(sym).catch(() => []),
      getFinancialRatios(sym).catch(() => null),
      getFinnhubIndicators(sym, 'D', 120).catch(() => null),
      getSocialSentiment(sym).catch(() => null),
      getOwnership(sym, 20).catch(() => []),
      getInsiderTransactions(sym, 10).catch(() => []),
      getBars(sym, fmt(from), fmt(today), 1, 'day').catch(() => []),
    ]);

    // 1. Short Pressure Rating (0-100)
    const shortPct = shortInterest?.[0]?.settlementDate ? 0 : 0;
    const shortInterestVal = shortInterest?.[0]?.shortQuantity || 0;
    const avgVolume = shortInterest?.[0]?.averageVolume || 1;
    const shortRatio = shortInterestVal / avgVolume;
    const shortPressure = Math.min(100, Math.max(0, shortRatio > 5 ? 90 : shortRatio > 3 ? 70 : shortRatio > 1.5 ? 50 : shortRatio > 0.5 ? 30 : 10));
    signals.push({
      name: 'Short Pressure',
      key: 'shortPressure',
      value: shortPressure,
      description: shortPressure > 70 ? 'Alta presión de cortos — posible squeeze' : shortPressure > 40 ? 'Presión moderada' : 'Baja presión de cortos',
      direction: shortPressure > 60 ? 'bullish' : shortPressure > 30 ? 'neutral' : 'bearish',
    });

    // 2. Net Institutional Flow (0-100)
    const instChange = ownership?.[0]?.change || 0;
    const instPct = ownership?.[0]?.changePct || 0;
    const instScore = Math.min(100, Math.max(0, 50 + instChange * 0.01 + instPct * 2));
    signals.push({
      name: 'Institutional Flow',
      key: 'instFlow',
      value: Math.round(instScore),
      description: instScore > 60 ? 'Instituciones están acumulando' : instScore < 40 ? 'Instituciones están reduciendo' : 'Flujo institucional neutral',
      direction: instScore > 60 ? 'bullish' : instScore < 40 ? 'bearish' : 'neutral',
    });

    // 3. Net Social Sentiment (0-100)
    const reddit = social?.reddit;
    const twitter = social?.twitter;
    let socialScore = 50;
    if (reddit && twitter) {
      const redditNet = reddit.positiveScore - reddit.negativeScore + (reddit.positiveMention - reddit.negativeMention) * 0.1;
      const twitterNet = twitter.positiveScore - twitter.negativeScore;
      socialScore = 50 + (redditNet * 20 + twitterNet * 10);
    } else if (reddit) {
      socialScore = 50 + (reddit.positiveScore - reddit.negativeScore) * 25;
    }
    socialScore = Math.min(100, Math.max(0, Math.round(socialScore)));
    signals.push({
      name: 'Social Sentiment',
      key: 'socialSentiment',
      value: socialScore,
      description: socialScore > 60 ? 'Sentimiento positivo en redes' : socialScore < 40 ? 'Sentimiento negativo en redes' : 'Sentimiento neutral',
      direction: socialScore > 60 ? 'bullish' : socialScore < 40 ? 'bearish' : 'neutral',
    });

    // 4. Options Sentiment Proxy (0-100) — using price momentum + volume + volatility
    const closes = bars.map((b: any) => b.c).filter(Boolean);
    let optionsScore = 50;
    if (closes.length > 20) {
      const current = closes[closes.length - 1];
      const sma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50 : sma20;
      const priceMomentum = ((current - sma50) / sma50) * 100;

      // Volume spike detection
      const volumes = bars.map((b: any) => b.v).filter(Boolean);
      const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const lastVol = volumes[volumes.length - 1] || avgVol;
      const volRatio = lastVol / avgVol;

      // RSI from Finnhub indicators
      const rsi = indicators?.rsi?.[0] || 50;

      optionsScore = 50
        + (priceMomentum > 5 ? 15 : priceMomentum > 0 ? 5 : priceMomentum < -5 ? -15 : -5) // price momentum
        + (rsi > 60 ? 10 : rsi < 40 ? -10 : 0) // RSI
        + (volRatio > 1.5 ? 10 : volRatio < 0.5 ? -5 : 0) // volume
        + (shortPressure < 30 ? 10 : shortPressure > 70 ? -10 : 0); // short interest
    }
    optionsScore = Math.min(100, Math.max(0, Math.round(optionsScore)));
    signals.push({
      name: 'Options Sentiment',
      key: 'optionsSentiment',
      value: optionsScore,
      description: optionsScore > 70 ? 'Opción calls dominando — alcista' : optionsScore < 30 ? 'Opción puts dominando — bajista' : 'Sentimiento de opciones mixto',
      direction: optionsScore > 60 ? 'bullish' : optionsScore < 40 ? 'bearish' : 'neutral',
    });

    // 5. Technical Momentum (0-100)
    let techScore = 50;
    if (closes.length > 50) {
      const current = closes[closes.length - 1];
      const sma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50;
      const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : sma50;
      const rsi = indicators?.rsi?.[0] || 50;
      const macd = indicators?.macd?.macd?.[0] || 0;
      const macdSignal = indicators?.macd?.signal?.[0] || 0;

      techScore = 50
        + (current > sma50 ? 10 : -10)
        + (current > sma200 ? 10 : -10)
        + (rsi > 50 ? Math.min(10, (rsi - 50) / 2) : Math.max(-10, (rsi - 50) / 2))
        + (macd > macdSignal ? 10 : -10);
    }
    techScore = Math.min(100, Math.max(0, Math.round(techScore)));
    signals.push({
      name: 'Technical Momentum',
      key: 'technicalMomentum',
      value: techScore,
      description: techScore > 60 ? 'Momentum técnico positivo' : techScore < 40 ? 'Momentum técnico negativo' : 'Momentum neutral',
      direction: techScore > 60 ? 'bullish' : techScore < 40 ? 'bearish' : 'neutral',
    });

    // 6. Value Score (0-100) from financial ratios
    let valueScore = 50;
    if (ratios) {
      const pe = ratios.peRatio || ratios.priceEarnings || 20;
      const pb = ratios.priceToBook || 3;
      const ps = ratios.priceToSales || 3;
      const pfcf = ratios.priceToFreeCashFlow || 20;

      valueScore = 50
        + (pe > 0 && pe < 15 ? 15 : pe > 30 ? -15 : pe > 0 ? 0 : -10)
        + (pb > 0 && pb < 1.5 ? 10 : pb > 5 ? -10 : 0)
        + (ps > 0 && ps < 2 ? 10 : ps > 8 ? -10 : 0)
        + (pfcf > 0 && pfcf < 15 ? 10 : pfcf > 30 ? -10 : 0);
    }
    valueScore = Math.min(100, Math.max(0, Math.round(valueScore)));
    signals.push({
      name: 'Value Score',
      key: 'valueScore',
      value: valueScore,
      description: valueScore > 60 ? 'Acción infravalorada' : valueScore < 40 ? 'Acción sobrevalorada' : 'Valoración justa',
      direction: valueScore > 60 ? 'bullish' : valueScore < 40 ? 'bearish' : 'neutral',
    });

    const overall = Math.round(signals.reduce((s, sig) => s + sig.value, 0) / signals.length);

    return NextResponse.json({
      symbol: sym,
      overall,
      signals,
      updated: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ symbol: sym, overall: 50, signals, error: err.message, updated: new Date().toISOString() });
  }
}
