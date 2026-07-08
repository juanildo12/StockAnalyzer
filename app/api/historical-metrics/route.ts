import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalData } from '@/src/services/yahooFinance';

export const dynamic = 'force-dynamic';

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j];
    result.push(sum / period);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  const sym = symbol.toUpperCase();

  try {
    const bars = await getHistoricalData(sym, undefined, undefined, true);
    if (!bars || bars.length < 30) {
      return NextResponse.json({ symbol: sym, dates: [], price: [], upsideBreakout: [], downsideBreakout: [], volumePressure: [], trendQuality: [], entryConfidence: [], riskReward: [] });
    }

    const closes = bars.map((b: any) => b.close);
    const highs = bars.map((b: any) => b.high);
    const lows = bars.map((b: any) => b.low);
    const volumes = bars.map((b: any) => b.volume);
    const dates = bars.map((b: any) => b.date);

    const volSMA = sma(volumes, 20);
    const volSMAPadded = [...Array(volumes.length - volSMA.length).fill(1), ...volSMA];

    const upsideBreakout: number[] = [];
    const downsideBreakout: number[] = [];
    const volumePressure: number[] = [];
    const trendQuality: number[] = [];
    const entryConfidence: number[] = [];
    const riskReward: number[] = [];

    for (let i = 0; i < bars.length; i++) {
      // Upside Breakout: qué tan cerca/fuera del techo del rango 20d
      if (i >= 19) {
        const high20 = Math.max(...highs.slice(i - 19, i + 1));
        const low20 = Math.min(...lows.slice(i - 19, i + 1));
        const range = high20 - low20 || 1;
        const pos = ((closes[i] - low20) / range) * 100;

        const volSlice = volumes.slice(Math.max(0, i - 19), i + 1);
        const avgVol = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
        const vr = volumes[i] / (avgVol || 1);
        const volBoost = vr > 1.5 ? 15 : vr > 1.2 ? 8 : 0;

        const rawUp = Math.max(0, (pos - 50) * 2);
        upsideBreakout.push(Math.min(100, Math.round(rawUp + volBoost)));

        const rawDown = Math.max(0, (50 - pos) * 2);
        downsideBreakout.push(Math.min(100, Math.round(rawDown + volBoost)));
      } else {
        upsideBreakout.push(0);
        downsideBreakout.push(0);
      }

      // Volume Pressure: volume / SMA(volume, 20)
      const vp = volSMAPadded[i] > 0 ? volumes[i] / volSMAPadded[i] : 1;
      volumePressure.push(Math.round(Math.min(vp, 3) / 3 * 100));

      // Trend Quality: price vs SMA50/SMA200 proxy
      if (i >= 49) {
        const sma50Arr = sma(closes.slice(0, i + 1), 50);
        const sma50 = sma50Arr[sma50Arr.length - 1] || closes[i];
        const above50 = closes[i] > sma50 ? 1 : 0;

        let score = 50 + above50 * 30;
        if (i >= 5) {
          const momentum = (closes[i] / closes[i - 5] - 1) * 100;
          score += Math.min(20, Math.max(-20, momentum * 2));
        }
        trendQuality.push(Math.min(100, Math.max(0, Math.round(score))));
      } else {
        trendQuality.push(50);
      }

      // Entry Confidence: combina RSI proxy + volumen + soporte
      if (i >= 19) {
        const gains: number[] = [];
        const losses: number[] = [];
        for (let j = i - 13; j <= i; j++) {
          if (j > 0) {
            const diff = closes[j] - closes[j - 1];
            if (diff > 0) gains.push(diff);
            else losses.push(-diff);
          }
        }
        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 1;
        const rs = avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);

        const low20 = Math.min(...lows.slice(i - 19, i + 1));
        const high20 = Math.max(...highs.slice(i - 19, i + 1));
        const range20 = high20 - low20 || 1;
        const nearSupport = ((closes[i] - low20) / range20) * 100;

        const rsiScore = rsi >= 30 && rsi <= 70 ? 40 : rsi < 30 ? 60 : 20;
        const supportScore = nearSupport < 30 ? 35 : nearSupport < 50 ? 25 : 15;
        const volSlice = volumes.slice(Math.max(0, i - 19), i + 1);
        const avgVol = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
        const volScore = volumes[i] > avgVol * 1.2 ? 25 : 15;

        entryConfidence.push(Math.min(100, Math.max(0, Math.round(rsiScore + supportScore + volScore))));
      } else {
        entryConfidence.push(50);
      }

      // Risk / Reward
      if (i >= 19) {
        const high20 = Math.max(...highs.slice(i - 19, i + 1));
        const low20 = Math.min(...lows.slice(i - 19, i + 1));
        const upside = high20 - closes[i];
        const downside = closes[i] - low20 || 1;
        const rr = upside / downside;

        const rrScore = rr >= 3 ? 90 : rr >= 2 ? 75 : rr >= 1.5 ? 60 : rr >= 1 ? 45 : rr >= 0.5 ? 30 : 15;
        riskReward.push(rrScore);
      } else {
        riskReward.push(50);
      }
    }

    const TRIM = 14;
    const idx = Math.max(0, bars.length - TRIM);

    const lastDate = dates[dates.length - 1];
    return NextResponse.json({
      symbol: sym,
      price: closes.slice(idx),
      dates: dates.slice(idx),
      upsideBreakout: upsideBreakout.slice(idx),
      downsideBreakout: downsideBreakout.slice(idx),
      volumePressure: volumePressure.slice(idx),
      trendQuality: trendQuality.slice(idx),
      entryConfidence: entryConfidence.slice(idx),
      riskReward: riskReward.slice(idx),
      lastDate,
    });
  } catch {
    return NextResponse.json({ symbol: sym, dates: [], price: [], upsideBreakout: [], downsideBreakout: [], volumePressure: [], trendQuality: [], entryConfidence: [], riskReward: [] });
  }
}
