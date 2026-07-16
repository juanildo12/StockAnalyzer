import { NextRequest, NextResponse } from "next/server";
import { getStockData } from "@/src/services/yahooFinance";
import * as finnhub from "@/src/services/finnhubClient";
import { getIndicator } from "@/src/services/polygonClient";
import { calcRSI, calcATR, calcVolumeMA, calcSMA, detectLevels, computeBreakoutScore } from "@/src/lib/technical/analysis";
import { computeScore } from "@/src/lib/scoring/engine";
import { formatScoreReport } from "@/src/lib/scoring/explain";
import { StockInput } from "@/src/lib/scoring/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const verbose = req.nextUrl.searchParams.get("verbose") === "true";

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const sym = symbol.toUpperCase();

  try {
    const [stockData, fhQuote, sentiment, insiders] = await Promise.allSettled([
      getStockData(sym),
      finnhub.getQuote(sym),
      finnhub.getSocialSentiment(sym),
      finnhub.getInsiderTransactions(sym, 10),
    ]);

    const data = stockData.status === "fulfilled" ? stockData.value : null;
    if (!data?.quote) {
      return NextResponse.json({ error: "No data found for symbol" }, { status: 404 });
    }

    const q = data.quote;
    const s = data.summary;
    const t = data.technical;

    const fh = fhQuote.status === "fulfilled" ? fhQuote.value : null;

    // Polygon indicators (optional)
    let ema8: number | null = null;
    let ema21: number | null = null;
    let macd: number | null = null;
    let macdSignal: number | null = null;

    try {
      const [ema8Data, ema21Data, macdData] = await Promise.allSettled([
        getIndicator(sym, "ema", { timestamp: Math.floor(Date.now() / 1000), timespan: "day", limit: 21, adjusted: "true" }),
        getIndicator(sym, "ema", { timestamp: Math.floor(Date.now() / 1000), timespan: "day", limit: 50, adjusted: "true" }),
        getIndicator(sym, "macd", { timestamp: Math.floor(Date.now() / 1000), timespan: "day", limit: 30, adjusted: "true" }),
      ]);

      if (ema8Data.status === "fulfilled" && ema8Data.value?.results) {
        ema8 = ema8Data.value.results[ema8Data.value.results.length - 1]?.ema ?? null;
      }
      if (ema21Data.status === "fulfilled" && ema21Data.value?.results) {
        ema21 = ema21Data.value.results[ema21Data.value.results.length - 1]?.ema ?? null;
      }
      if (macdData.status === "fulfilled" && macdData.value?.results) {
        const last = macdData.value.results[macdData.value.results.length - 1];
        macd = last?.macd ?? null;
        macdSignal = last?.signal ?? null;
      }
    } catch {
      // Polygon indicators optional
    }

    const closes = data.historical?.map((h: any) => h.close) || [];
    const highs = data.historical?.map((h: any) => h.high) || [];
    const lows = data.historical?.map((h: any) => h.low) || [];
    const volumes = data.historical?.map((h: any) => h.volume) || [];

    const rsi = t?.rsi ?? calcRSI(closes);
    const atr = t?.atr ?? calcATR(highs, lows, closes);
    const volumeMA = calcVolumeMA(volumes, 20);
    const volumeRatio = volumeMA && volumeMA > 0 ? q.regularMarketVolume / volumeMA : 1;

    const levels = closes.length >= 20
      ? detectLevels(closes, highs, lows, q.regularMarketPrice)
      : { resistance: q.fiftyTwoWeekHigh, support: q.fiftyTwoWeekLow, target1: 0, target2: 0, stopLoss: 0, riskReward: 0, consolidationHigh: 0, consolidationLow: 0, atr: null };

    const breakoutScore = computeBreakoutScore(
      q.regularMarketPrice,
      q.regularMarketChangePercent,
      rsi,
      t?.sma50 ?? null,
      t?.sma200 ?? null,
      volumeRatio,
      q.peRatio ?? null,
      s?.revenueGrowth ?? null,
      levels,
      q.marketCap
    );

    // Compute Historical Volatility (20d)
    let hv20: number | null = null;
    if (closes.length >= 21) {
      const returns: number[] = [];
      for (let i = closes.length - 20; i < closes.length; i++) {
        if (closes[i - 1] > 0) {
          returns.push(Math.log(closes[i] / closes[i - 1]));
        }
      }
      if (returns.length > 1) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
        hv20 = Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
      }
    }

    // Compute Bollinger Band width
    let bbWidth: number | null = null;
    if (closes.length >= 20 && t?.sma50) {
      const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const variance = closes.slice(-20).reduce((a, b) => a + (b - sma20) ** 2, 0) / 20;
      const stdDev = Math.sqrt(variance);
      bbWidth = sma20 > 0 ? ((2 * stdDev) / sma20) * 100 : null;
    }

    const input: StockInput = {
      symbol: sym,
      price: q.regularMarketPrice,
      changePercent: q.regularMarketChangePercent,

      sma50: t?.sma50 ?? null,
      sma200: t?.sma200 ?? null,
      ema8,
      ema21,
      rsi,
      macd,
      macdSignal,
      atr,

      volume: q.regularMarketVolume || 0,
      avgVolume20d: volumeMA || q.regularMarketVolume || 0,

      high60d: highs.length > 0 ? Math.max(...highs.slice(-60)) : q.fiftyTwoWeekHigh,
      low60d: lows.length > 0 ? Math.min(...lows.slice(-60)) : q.fiftyTwoWeekLow,
      weekHigh52: q.fiftyTwoWeekHigh || 0,
      weekLow52: q.fiftyTwoWeekLow || 0,
      closes60d: closes.slice(-60),

      resistance: levels.resistance,
      support: levels.support,
      riskReward: levels.riskReward,
      consolidationHigh: levels.consolidationHigh,
      consolidationLow: levels.consolidationLow,

      marketCap: q.marketCap || 0,
      pe: q.peRatio ?? null,

      return1m: null,
      return3m: null,

      hv20,
      bbWidth,
    };

    const result = computeScore(input);

    return NextResponse.json({
      success: true,
      ...result,
      report: formatScoreReport(result),
      breakoutScore: breakoutScore.score,
      breakoutComponents: breakoutScore.components,
    });
  } catch (error) {
    console.error(`[Score] Error for ${sym}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scoring failed" },
      { status: 500 }
    );
  }
}
