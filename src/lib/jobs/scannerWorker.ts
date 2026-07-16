import YahooFinance from "yahoo-finance2";
import { prisma } from "@/src/lib/prisma";
import { STOCK_POOL } from "@/src/lib/stockPool";
import { getRaw } from "@/src/lib/technical/analysis";
import {
  calcRSI,
  calcSMA,
  calcATR,
  detectLevels,
  computeBreakoutScore,
} from "@/src/lib/technical/analysis";
import { SCREENER_MODELS, StockRow } from "@/src/lib/technical/screeners";

const yf = new YahooFinance();

async function fetchPoolData(): Promise<StockRow[]> {
  const rows: StockRow[] = [];
  for (let i = 0; i < STOCK_POOL.length; i += 10) {
    const batch = STOCK_POOL.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (sym) => {
        try {
          const [qs, q] = await Promise.all([
            yf.quoteSummary(sym, {
              modules: [
                "summaryDetail",
                "defaultKeyStatistics",
                "financialData",
                "assetProfile",
              ],
            }),
            yf.quote(sym),
          ]).catch(() => [null, null]);
          if (!q || !q.regularMarketPrice) return null;
          const sd = (qs as any)?.summaryDetail || {};
          const dk = (qs as any)?.defaultKeyStatistics || {};
          const fd = (qs as any)?.financialData || {};
          return {
            symbol: sym,
            price: q.regularMarketPrice,
            changePercent: q.regularMarketChangePercent || 0,
            marketCap: getRaw(sd.marketCap) || 0,
            sector: (qs as any)?.assetProfile?.sector || "",
            peRatio: getRaw(sd.trailingPE) || null,
            pbRatio: getRaw(dk.priceToBook) || null,
            psRatio:
              getRaw(sd.priceToSalesTrailing12Months) || null,
            divYield: (getRaw(sd.dividendYield) || 0) * 100,
            roe:
              getRaw(fd.returnOnEquity) != null
                ? getRaw(fd.returnOnEquity) * 100
                : null,
            profitMargin:
              getRaw(fd.profitMargins) != null
                ? getRaw(fd.profitMargins) * 100
                : null,
            revenueGrowth:
              getRaw(fd.revenueGrowth) != null
                ? getRaw(fd.revenueGrowth) * 100
                : null,
            earningsGrowth:
              getRaw(fd.earningsGrowth) != null
                ? getRaw(fd.earningsGrowth) * 100
                : null,
            debtToEquity: getRaw(fd.debtToEquity) || null,
            volume: q.regularMarketVolume || 0,
            avgVolume: getRaw(sd.averageVolume) || 1,
            weekHigh: q.fiftyTwoWeekHigh || q.regularMarketPrice,
            weekLow: q.fiftyTwoWeekLow || q.regularMarketPrice,
          };
        } catch {
          return null;
        }
      })
    );
    rows.push(...(results.filter(Boolean) as StockRow[]));
  }
  return rows;
}

export async function runAllScreeners(): Promise<{
  screenersRun: number;
  totalResults: number;
}> {
  const startTime = Date.now();
  console.log(`[ScannerWorker] Starting scan of ${STOCK_POOL.length} stocks...`);

  const rows = await fetchPoolData();
  console.log(`[ScannerWorker] Fetched data for ${rows.length} stocks`);

  const now = new Date();
  let totalResults = 0;

  // Run each screener model and store results
  for (const model of SCREENER_MODELS) {
    const results = rows
      .map((s) => ({
        symbol: s.symbol,
        ...model.compute(s),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 30);

    // Upsert results for today
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      await prisma.screener_results.upsert({
        where: {
          screenerType_symbol_computedAt: {
            screenerType: model.id,
            symbol: r.symbol,
            computedAt: now,
          },
        },
        update: {
          score: r.total,
          rank: i + 1,
          components: r.scores,
        },
        create: {
          screenerType: model.id,
          symbol: r.symbol,
          score: r.total,
          rank: i + 1,
          components: r.scores,
        },
      });
    }

    totalResults += results.length;
    console.log(
      `[ScannerWorker] ${model.name}: ${results.length} results (top: ${results[0]?.symbol} ${results[0]?.total})`
    );
  }

  // Log the job run
  await prisma.job_runs.create({
    data: {
      jobType: "run-all-screeners",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        stocksScanned: rows.length,
        screenersRun: SCREENER_MODELS.length,
        totalResults,
        durationMs: Date.now() - startTime,
      },
    },
  });

  console.log(
    `[ScannerWorker] Completed in ${Date.now() - startTime}ms — ${totalResults} total results`
  );

  return { screenersRun: SCREENER_MODELS.length, totalResults };
}

export async function computeBreakoutScores(): Promise<{
  qualified: number;
  stored: number;
}> {
  const startTime = Date.now();
  console.log(`[ScannerWorker] Computing breakout scores for ${STOCK_POOL.length} stocks...`);

  const rows = await fetchPoolData();
  const now = new Date();
  let qualified = 0;
  let stored = 0;

  for (let i = 0; i < rows.length; i += 5) {
    const batch = rows.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (row) => {
        try {
          const hist: any = await yf
            .historical(row.symbol, {
              period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
              period2: new Date(),
              interval: "1d",
            })
            .catch(() => []);

          const bars = (hist || []) as any[];
          const closes = bars
            .map((b: any) => b.close)
            .filter((c: number) => c > 0);
          const highs = bars
            .map((b: any) => b.high)
            .filter((h: number) => h > 0);
          const lows = bars
            .map((b: any) => b.low)
            .filter((l: number) => l > 0);

          if (closes.length < 20) return null;

          const rsi = calcRSI(closes);
          const sma50 = calcSMA(closes, 50);
          const sma200 = calcSMA(closes, 200);
          const volRatio = row.volume / Math.max(row.avgVolume, 1);

          const levels = detectLevels(closes, highs, lows, row.price);

          const { score, components, reasons } = computeBreakoutScore(
            row.price,
            row.changePercent,
            rsi,
            sma50,
            sma200,
            volRatio,
            row.peRatio,
            row.revenueGrowth,
            levels,
            row.marketCap
          );

          if (score < 55) return null;
          qualified++;

          await prisma.screener_results.upsert({
            where: {
              screenerType_symbol_computedAt: {
                screenerType: "breakout-score",
                symbol: row.symbol,
                computedAt: now,
              },
            },
            update: {
              score,
              rank: 0,
              components: {
                trend: components.trend,
                volume: components.volume,
                structure: components.structure,
                safety: components.safety,
                rsi,
                sma50,
                sma200,
                volRatio: Math.round(volRatio * 100) / 100,
              },
              levels: levels,
              reasons: reasons.slice(0, 4),
            },
            create: {
              screenerType: "breakout-score",
              symbol: row.symbol,
              score,
              rank: 0,
              components: {
                trend: components.trend,
                volume: components.volume,
                structure: components.structure,
                safety: components.safety,
                rsi,
                sma50,
                sma200,
                volRatio: Math.round(volRatio * 100) / 100,
              },
              levels: levels,
              reasons: reasons.slice(0, 4),
            },
          });

          stored++;
          return { symbol: row.symbol, score };
        } catch {
          return null;
        }
      })
    );
  }

  // Log the job run
  await prisma.job_runs.create({
    data: {
      jobType: "compute-breakout-scores",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        stocksScanned: rows.length,
        qualified,
        stored,
        durationMs: Date.now() - startTime,
      },
    },
  });

  console.log(
    `[ScannerWorker] Breakout scores: ${qualified} qualified, ${stored} stored (${Date.now() - startTime}ms)`
  );

  return { qualified, stored };
}

export async function computeMorningBriefing(): Promise<boolean> {
  const startTime = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`[ScannerWorker] Computing morning briefing...`);

  // Get today's breakout scores from DB
  const breakoutResults = await prisma.screener_results.findMany({
    where: {
      screenerType: "breakout-score",
      computedAt: {
        gte: today,
      },
    },
    orderBy: { score: "desc" },
    take: 5,
  });

  if (breakoutResults.length === 0) {
    console.log(`[ScannerWorker] No breakout scores found for today`);
    return false;
  }

  // Get market context (SPY + VIX)
  let marketContext: any = null;
  try {
    const [spy, vix] = await Promise.all([
      yf.quote("SPY").catch(() => null),
      yf.quote("^VIX").catch(() => null),
    ]);

    marketContext = {
      spy: spy
        ? {
            price: spy.regularMarketPrice,
            change: spy.regularMarketChangePercent || 0,
          }
        : null,
      vix: vix
        ? {
            level: vix.regularMarketPrice,
            label:
              vix.regularMarketPrice < 15
                ? "BAJA"
                : vix.regularMarketPrice < 25
                ? "MEDIA"
                : "ALTA",
          }
        : null,
    };
  } catch {}

  // Get stock names for picks
  const symbols = breakoutResults.map((r) => r.symbol);
  const quotes = await Promise.all(
    symbols.map((sym) => yf.quote(sym).catch(() => null))
  );

  const picks = breakoutResults.map((result, i) => {
    const quote = quotes[i];
    const components = result.components as any;
    const levels = result.levels as any;
    const reasons = (result.reasons as string[]) || [];

    return {
      rank: i + 1,
      symbol: result.symbol,
      name: quote?.shortName || result.symbol,
      price: quote?.regularMarketPrice || 0,
      changePercent: quote?.regularMarketChangePercent || 0,
      score: result.score,
      confidence:
        result.score >= 80 ? "HIGH" : result.score >= 65 ? "MEDIUM" : "MODERATE",
      levels: {
        entry: levels?.resistance || 0,
        resistance: levels?.resistance || 0,
        support: levels?.support || 0,
        target1: levels?.target1 || 0,
        target2: levels?.target2 || 0,
        stopLoss: levels?.stopLoss || 0,
        riskReward: levels?.riskReward || 0,
      },
      technicals: {
        rsi: components?.rsi || null,
        sma50: components?.sma50 || null,
        sma200: components?.sma200 || null,
        volRatio: components?.volRatio || 1,
      },
      reasons,
    };
  });

  // Summary stats
  const avgRiskReward =
    picks.reduce((sum, p) => sum + (p.levels.riskReward || 0), 0) /
    Math.max(picks.length, 1);

  const summary = {
    totalScanned: STOCK_POOL.length,
    totalBreakouts: breakoutResults.length,
    highConfidence: picks.filter((p) => p.confidence === "HIGH").length,
    avgRiskReward: Math.round(avgRiskReward * 100) / 100,
  };

  // Store briefing
  await prisma.morning_briefings.upsert({
    where: { date: today },
    update: {
      picks,
      marketContext,
      summary,
      computedAt: new Date(),
    },
    create: {
      date: today,
      picks,
      marketContext,
      summary,
    },
  });

  // Log the job run
  await prisma.job_runs.create({
    data: {
      jobType: "compute-morning-briefing",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        picksCount: picks.length,
        summary,
        durationMs: Date.now() - startTime,
      },
    },
  });

  console.log(
    `[ScannerWorker] Morning briefing: ${picks.length} picks (${Date.now() - startTime}ms)`
  );

  return true;
}
