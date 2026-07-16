import { NextRequest, NextResponse } from "next/server";
import { getStockData } from "@/src/services/yahooFinance";
import * as finnhub from "@/src/services/finnhubClient";
import { getIndicator } from "@/src/services/polygonClient";
import { calcRSI, calcATR, calcVolumeMA, detectLevels, computeBreakoutScore } from "@/src/lib/technical/analysis";
import { buildAnalysisPrompt, PromptData } from "@/src/lib/ai/analysisPrompt";
import { parseAnalysisResponse } from "@/src/lib/ai/parseResponse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const sym = symbol.toUpperCase();

  try {
    const [stockData, finnhubQuote, socialSentiment, insiders, recommendations] =
      await Promise.allSettled([
        getStockData(sym),
        finnhub.getQuote(sym),
        finnhub.getSocialSentiment(sym),
        finnhub.getInsiderTransactions(sym, 10),
        finnhub.getRecommendationTrends(sym),
      ]);

    const data = stockData.status === "fulfilled" ? stockData.value : null;
    if (!data?.quote) {
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    const q = data.quote;
    const s = data.summary;
    const t = data.technical;

    const fhQuote = finnhubQuote.status === "fulfilled" ? finnhubQuote.value : null;
    const sentiment = socialSentiment.status === "fulfilled" ? socialSentiment.value : null;
    const insiderData = insiders.status === "fulfilled" ? insiders.value : [];
    const recs = recommendations.status === "fulfilled" ? recommendations.value : [];

    const insiderBuys = insiderData.filter((i: any) => i.transaction === "Purchase").length;
    const insiderSells = insiderData.filter((i: any) => i.transaction === "Sale").length;

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
      // Polygon indicators are optional — fall back to Yahoo data
    }

    const closes = data.historical?.map((h: any) => h.close) || [];
    const highs = data.historical?.map((h: any) => h.high) || [];
    const lows = data.historical?.map((h: any) => h.low) || [];
    const volumes = data.historical?.map((h: any) => h.volume) || [];

    const rsi = t?.rsi ?? calcRSI(closes);
    const atr = calcATR(highs, lows, closes);
    const volumeMA = calcVolumeMA(volumes, 20);
    const volumeRatio = volumeMA && volumeMA > 0 ? q.regularMarketVolume / volumeMA : 1;

    const levels = closes.length >= 20
      ? detectLevels(closes, highs, lows, q.regularMarketPrice)
      : { resistance: q.fiftyTwoWeekHigh, support: q.fiftyTwoWeekLow, target1: 0, target2: 0, stopLoss: 0, riskReward: 0, consolidationHigh: 0, consolidationLow: 0, atr: null };

    const fcfYield = q.marketCap && s?.freeCashflow
      ? (s.freeCashflow / q.marketCap) * 100
      : null;

    const pe = q.peRatio ?? null;
    const forwardPe = s?.pegRatio ? null : null;

    const breakoutScore = computeBreakoutScore(
      q.regularMarketPrice,
      q.regularMarketChangePercent,
      rsi,
      t?.sma50 ?? null,
      t?.sma200 ?? null,
      volumeRatio,
      pe,
      s?.revenueGrowth ?? null,
      levels,
      q.marketCap
    );

    const latestRec = recs.length > 0 ? recs[0] : null;
    const recommendation = latestRec
      ? `StrongBuy:${latestRec.strongBuy} Buy:${latestRec.buy} Hold:${latestRec.hold} Sell:${latestRec.sell} StrongSell:${latestRec.strongSell}`
      : null;

    const promptData: PromptData = {
      symbol: sym,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      name: q.shortName || q.longName || sym,
      sector: q.sector || "",
      marketCap: q.marketCap || 0,
      volume: q.regularMarketVolume || 0,
      previousClose: fhQuote?.pc || q.regularMarketPreviousClose || 0,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow || 0,
      pe,
      forwardPe,
      pb: s?.priceToBook ?? null,
      eps: s?.epsTrailingTwelveMonths ?? null,
      dividendYield: s?.dividendYield ?? null,
      beta: s?.beta ?? null,
      profitMargin: s?.profitMargins ?? null,
      revenueGrowth: s?.revenueGrowth ?? null,
      freeCashFlow: s?.freeCashflow ?? null,
      fcfYield,
      totalCash: s?.totalCash ?? null,
      totalDebt: s?.totalDebt ?? null,
      targetMean: q.targetMeanPrice || null,
      targetHigh: q.targetHighPrice || null,
      targetLow: q.targetLowPrice || null,
      analysts: q.numberOfAnalystOpinions || null,
      rsi,
      sma50: t?.sma50 ?? null,
      sma200: t?.sma200 ?? null,
      ema8,
      ema21,
      macd,
      macdSignal,
      atr,
      support: levels.support,
      resistance: levels.resistance,
      target1: levels.target1,
      target2: levels.target2,
      stopLoss: levels.stopLoss,
      riskReward: levels.riskReward,
      volumeRatio,
      breakoutScore: breakoutScore.score,
      socialReddit: sentiment?.reddit?.score ?? null,
      socialTwitter: sentiment?.twitter?.score ?? null,
      insiderBuyCount: insiderBuys,
      insiderSellCount: insiderSells,
      recommendation,
    };

    const userPrompt = buildAnalysisPrompt(promptData);

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const models = [
      "tencent/hy3:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
    ];

    let rawContent = "";
    let lastError = "";

    for (const model of models) {
      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://stock-analyzer-new.vercel.app",
          "X-Title": "BreakoutFinder AI Analysis",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You are a senior day trader and technical analyst. Analyze stocks with precision. Return ONLY valid JSON — no markdown, no explanation outside the JSON. Every field must use the data provided. Be concise and specific.",
            },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!aiRes.ok) {
        lastError = await aiRes.text().catch(() => "");
        console.error(`[AI Analysis] Model ${model} error ${aiRes.status}:`, lastError);
        continue;
      }

      const aiJson = await aiRes.json();
      const msg = aiJson.choices?.[0]?.message;
      // Standard models put content in .content; reasoning models put it in .reasoning
      rawContent = msg?.content || msg?.reasoning || "";
      if (rawContent) {
        console.log(`[AI Analysis] Model ${model} succeeded`);
        break;
      }
    }

    if (!rawContent) {
      console.error(`[AI Analysis] All models failed for ${sym}:`, lastError);
      return NextResponse.json({ error: "AI analysis failed — all models unavailable" }, { status: 502 });
    }

    const analysis = parseAnalysisResponse(rawContent);
    if (!analysis) {
      console.error("[AI Analysis] Failed to parse AI response:", rawContent.slice(0, 500));
      return NextResponse.json({ error: "Failed to parse AI response", raw: rawContent.slice(0, 500) }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      symbol: sym,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      name: q.shortName || q.longName || sym,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[AI Analysis] Error for ${sym}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
