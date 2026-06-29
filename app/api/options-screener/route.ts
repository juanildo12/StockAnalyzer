import { NextRequest, NextResponse } from 'next/server';
import { getStockData } from '@/src/services/yahooFinance';
import { enrichStockData, extractFinnhubMetrics } from '@/src/services/polygonFinnhubEnrichment';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SAMPLE_STOCKS = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','JNJ',
  'V','PG','UNH','HD','MA','DIS','NFLX','INTC','AMD','CRM',
  'ORCL','ADBE','XOM','CVX','KO','PEP','WMT','COST','ABBV',
  'BA','CAT','IBM','CSCO','QCOM','TXN','AVGO','NKE','MCD',
  'SBUX','BAC','WFC','C','GS','MS','GE','HON','LIN','TMO',
  'DHR','ISRG','UNP','NEE','SPGI','LOW','BLK','BKNG','UBER',
  'DOW','MMM','AXP','AMGN','GILD','VRTX','REGN','MDT','SYK',
  'MU','PYPL','SNAP','PLTR','MRNA','ABNB','RIVN','LCID',
];

interface OptionsScore {
  symbol: string;
  name: string;
  price: number;
  signal: string;
  trend: string;
  rsi: number;
  volume: number;
  callScore: number;
  putScore: number;
  bias: 'CALL' | 'PUT' | 'NEUTRAL';
  reason: string;
  iv?: number;
  marketCap?: number;
}

function scoreForOptions(sym: string, data: any): OptionsScore | null {
  try {
    const q = data.quote;
    const t = data.technical;
    if (!q || !q.regularMarketPrice) return null;
    if (!t || !t.rsi || !t.trend) return null;

    const price = q.regularMarketPrice;
    const rsi = t.rsi;
    const trend = (t.trend || 'lateral').toLowerCase();
    const volume = q.regularMarketVolume || 0;
    const signalData = data.signalData || null;

    // Compute signal from framework (same logic as signal route)
    const s = data.summary;
    const fcf = s?.freeCashflow || 0;
    const fcfYield = q.marketCap ? (fcf / q.marketCap) * 100 : 0;
    const pe = q.peRatio || 0;
    const revGrowth = (s?.revenueGrowth || 0) * 100;
    const margin = (s?.profitMargins || 0) * 100;
    const isFCFPositive = fcf >= 0;

    let frameworkScore = 0;
    if (isFCFPositive) frameworkScore += 2;
    if (fcfYield > 5) frameworkScore += 2;
    if (revGrowth > 15) frameworkScore += 2;
    if (margin > 15) frameworkScore += 2;
    if (pe > 0 && pe < 25) frameworkScore += 2;

    let signal: 'BUY' | 'HOLD' | 'SELL';
    if (frameworkScore >= 8) signal = 'BUY';
    else if (frameworkScore >= 5) signal = 'HOLD';
    else signal = 'SELL';

    // ---- CALL Score ----
    let callScore = 50;
    if (signal === 'BUY') callScore += 25;
    else if (signal === 'HOLD') callScore += 5;
    else callScore -= 15;

    if (trend === 'alcista') callScore += 25;
    else if (trend === 'lateral') callScore += 5;
    else callScore -= 15;

    if (rsi >= 40 && rsi <= 60) callScore += 20;
    else if (rsi >= 30 && rsi < 40) callScore += 10;
    else if (rsi > 60 && rsi <= 70) callScore += 5;
    else callScore -= 10;

    if (volume > 10_000_000) callScore += 10;
    else if (volume > 1_000_000) callScore += 5;
    if (isFCFPositive) callScore += 5;

    callScore = Math.max(0, Math.min(100, callScore));

    // ---- PUT Score ----
    let putScore = 50;
    if (signal === 'SELL') putScore += 25;
    else if (signal === 'HOLD') putScore += 5;
    else putScore -= 15;

    if (trend === 'bajista') putScore += 25;
    else if (trend === 'lateral') putScore += 5;
    else putScore -= 15;

    if (rsi >= 40 && rsi <= 60) putScore += 20;
    else if (rsi > 60 && rsi <= 70) putScore += 10;
    else if (rsi >= 30 && rsi < 40) putScore += 5;
    else putScore -= 10;

    if (volume > 10_000_000) putScore += 10;
    else if (volume > 1_000_000) putScore += 5;
    if (!isFCFPositive) putScore += 5;

    putScore = Math.max(0, Math.min(100, putScore));

    // Bias & reason
    let bias: 'CALL' | 'PUT' | 'NEUTRAL';
    let reason: string;

    if (callScore >= putScore + 10 && callScore >= 60) {
      bias = 'CALL';
      const parts: string[] = [];
      if (signal === 'BUY') parts.push('señal de compra');
      if (trend === 'alcista') parts.push('tendencia alcista');
      if (rsi >= 40 && rsi <= 60) parts.push(`RSI ${rsi.toFixed(0)} en rango óptimo`);
      else if (rsi < 40) parts.push(`RSI ${rsi.toFixed(0)} — posible rebote`);
      else parts.push(`RSI ${rsi.toFixed(0)} — momento alcista`);
      reason = parts.join(', ');
    } else if (putScore >= callScore + 10 && putScore >= 60) {
      bias = 'PUT';
      const parts: string[] = [];
      if (signal === 'SELL') parts.push('señal de venta');
      if (trend === 'bajista') parts.push('tendencia bajista');
      if (rsi >= 40 && rsi <= 60) parts.push(`RSI ${rsi.toFixed(0)} en rango óptimo`);
      else if (rsi > 60) parts.push(`RSI ${rsi.toFixed(0)} — posible caída`);
      else parts.push(`RSI ${rsi.toFixed(0)} — momento bajista`);
      reason = parts.join(', ');
    } else {
      bias = 'NEUTRAL';
      reason = `CALL ${callScore} vs PUT ${putScore} — señales mixtas, esperar dirección clara`;
    }

    return {
      symbol: sym,
      name: q.shortName || q.longName || sym,
      price,
      signal,
      trend,
      rsi,
      volume,
      callScore: Math.round(callScore),
      putScore: Math.round(putScore),
      bias,
      reason,
      marketCap: q.marketCap,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get('symbols');
  const symbols = symbolsParam
    ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 30)
    : SAMPLE_STOCKS;

  const results: OptionsScore[] = [];

  for (const sym of symbols) {
    try {
      const data = await getStockData(sym);
      if (!data.quote || !data.quote.regularMarketPrice) continue;
      const scored = scoreForOptions(sym, data);
      if (scored) results.push(scored);
    } catch {
      // skip
    }
  }

  const sortedCalls = [...results].sort((a, b) => b.callScore - a.callScore);
  const sortedPuts = [...results].sort((a, b) => b.putScore - a.putScore);

  return NextResponse.json({
    generated: new Date().toISOString(),
    total: results.length,
    bestCalls: sortedCalls.filter(s => s.bias === 'CALL').slice(0, 10),
    bestPuts: sortedPuts.filter(s => s.bias === 'PUT').slice(0, 10),
    neutral: sortedCalls.filter(s => s.bias === 'NEUTRAL').slice(0, 10),
    all: results.sort((a, b) => {
      const aMax = Math.max(a.callScore, a.putScore);
      const bMax = Math.max(b.callScore, b.putScore);
      return bMax - aMax;
    }),
  });
}
