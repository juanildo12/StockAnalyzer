import { prisma } from "@/src/lib/prisma";
import { computeScore } from "@/src/lib/scoring/engine";
import { detectLevels, calcATR } from "@/src/lib/technical/analysis";
import { getStockData } from "@/src/services/yahooFinance";
import { generateAlert, generateAlertSummary } from "./alertGenerator";
import { canSendAlert, isMarketOpen } from "./rateLimiter";
import { wasRecentlyAlerted, expireOldAlerts } from "./deduplicator";
import { sendAlertEmail } from "./delivery";
import { EvalContext } from "./types";
import { StockInput } from "@/src/lib/scoring/types";

interface SchedulerResult {
  scanned: number;
  evaluated: number;
  alerted: number;
  sent: number;
  errors: string[];
}

export async function runSmartAlerts(): Promise<SchedulerResult> {
  const result: SchedulerResult = { scanned: 0, evaluated: 0, alerted: 0, sent: 0, errors: [] };

  // Expire old alerts first
  await expireOldAlerts();

  // Check market hours (skip on weekends/holidays for cron safety)
  const marketOpen = await isMarketOpen();
  if (!marketOpen) {
    console.log("[SmartAlerts] Market closed, skipping");
    return result;
  }

  // Get all active watchlist users
  const watchlistItems = await prisma.watchlists.findMany({
    where: { alertPrice: { not: null } },
    select: { userId: true, symbol: true },
  });

  if (watchlistItems.length === 0) {
    console.log("[SmartAlerts] No watchlist items with alerts");
    return result;
  }

  // Group by unique symbols
  const symbolUsers = new Map<string, string[]>();
  for (const item of watchlistItems) {
    const users = symbolUsers.get(item.symbol) || [];
    users.push(item.userId);
    symbolUsers.set(item.symbol, users);
  }

  const uniqueSymbols = Array.from(symbolUsers.keys());
  console.log(`[SmartAlerts] Scanning ${uniqueSymbols.length} symbols across ${watchlistItems.length} watchlist items`);

  // Process each symbol
  for (const symbol of uniqueSymbols) {
    try {
      result.scanned++;

      // Fetch data
      const [stockData] = await Promise.allSettled([getStockData(symbol)]);
      const data = stockData.status === "fulfilled" ? stockData.value : null;
      if (!data?.quote) continue;

      const q = data.quote;
      const closes = data.historical?.map((h: any) => h.close) || [];
      const highs = data.historical?.map((h: any) => h.high) || [];
      const lows = data.historical?.map((h: any) => h.low) || [];

      const levels = closes.length >= 20
        ? detectLevels(closes, highs, lows, q.regularMarketPrice)
        : null;
      if (!levels) continue;

      const atr = calcATR(highs, lows, closes);

      // Build StockInput for scoring
      const volumes = data.historical?.map((h: any) => h.volume) || [];
      const avgVol = volumes.length >= 20
        ? volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
        : q.regularMarketVolume;

      const stockInput: StockInput = {
        symbol,
        price: q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent,
        sma50: data.technical?.sma50 ?? null,
        sma200: data.technical?.sma200 ?? null,
        ema8: null,
        ema21: null,
        rsi: data.technical?.rsi ?? null,
        macd: null,
        macdSignal: null,
        atr,
        volume: q.regularMarketVolume || 0,
        avgVolume20d: avgVol || 0,
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
        hv20: null,
        bbWidth: null,
      };

      const scoreResult = computeScore(stockInput);

      // Build eval context
      const ctx: EvalContext = {
        symbol,
        price: q.regularMarketPrice,
        totalScore: scoreResult.totalScore,
        grade: scoreResult.grade,
        factors: scoreResult.factors,
        levels: {
          entry: levels.support,
          stopLoss: levels.stopLoss,
          tp1: levels.target1,
          tp2: levels.target2,
          riskReward: levels.riskReward,
        },
        atr,
        changePercent: q.regularMarketChangePercent,
      };

      result.evaluated++;

      // Try to generate alert for each user on this symbol
      const users = symbolUsers.get(symbol) || [];
      for (const userId of users) {
        // Check dedup
        const recent = await wasRecentlyAlerted(symbol, userId);
        if (recent) continue;

        // Check rate limit
        const canSend = await canSendAlert(userId, symbol);
        if (!canSend.allowed) continue;

        // Generate alert
        const alert = generateAlert(ctx, userId);
        if (!alert) continue;

        alert.summary = generateAlertSummary(alert);

        // Save to DB
        const saved = await prisma.smart_alerts.create({
          data: {
            userId: alert.userId,
            symbol: alert.symbol,
            score: alert.score,
            grade: alert.grade,
            entry: alert.entry,
            stopLoss: alert.stopLoss,
            tp1: alert.tp1,
            tp2: alert.tp2,
            riskReward: alert.riskReward,
            confidence: alert.confidence,
            riskLevel: alert.riskLevel,
            tradeTime: alert.tradeTime,
            summary: alert.summary,
            topFactors: alert.topFactors,
            warnings: alert.warnings,
            status: "active",
            expiresAt: alert.expiresAt,
          },
        });

        result.alerted++;

        // Send email
        alert.id = saved.id;
        const sent = await sendAlertEmail(alert);
        if (sent) result.sent++;
      }
    } catch (error) {
      result.errors.push(`${symbol}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  console.log(
    `[SmartAlerts] Done: scanned=${result.scanned} evaluated=${result.evaluated} alerted=${result.alerted} sent=${result.sent}`
  );

  return result;
}
