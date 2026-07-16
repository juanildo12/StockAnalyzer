import YahooFinance from "yahoo-finance2";
import { prisma } from "@/src/lib/prisma";
import { STOCK_POOL } from "@/src/lib/stockPool";
import { getRaw } from "@/src/lib/technical/analysis";

const yf = new YahooFinance();

export async function warmPopularStocks(): Promise<{
  fundamentalsUpdated: number;
}> {
  const startTime = Date.now();
  console.log(`[CacheWorker] Warming ${STOCK_POOL.length} stocks...`);

  let fundamentalsUpdated = 0;

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

          await prisma.stock_fundamentals.upsert({
            where: { symbol: sym },
            update: {
              name: q.shortName || q.longName || sym,
              sector: (qs as any)?.assetProfile?.sector || null,
              industry: (qs as any)?.assetProfile?.industry || null,
              marketCap: getRaw(sd.marketCap) || null,
              peRatio: getRaw(sd.trailingPE) || null,
              pegRatio: getRaw(dk.pegRatio) || null,
              priceToBook: getRaw(dk.priceToBook) || null,
              dividendYield: getRaw(sd.dividendYield) || null,
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
              fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || null,
              fiftyTwoWeekLow: q.fiftyTwoWeekLow || null,
              avgVolume: getRaw(sd.averageVolume) || null,
              currentPrice: q.regularMarketPrice,
              changePct: q.regularMarketChangePercent || 0,
              updatedAt: new Date(),
            },
            create: {
              symbol: sym,
              name: q.shortName || q.longName || sym,
              sector: (qs as any)?.assetProfile?.sector || null,
              industry: (qs as any)?.assetProfile?.industry || null,
              marketCap: getRaw(sd.marketCap) || null,
              peRatio: getRaw(sd.trailingPE) || null,
              pegRatio: getRaw(dk.pegRatio) || null,
              priceToBook: getRaw(dk.priceToBook) || null,
              dividendYield: getRaw(sd.dividendYield) || null,
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
              fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || null,
              fiftyTwoWeekLow: q.fiftyTwoWeekLow || null,
              avgVolume: getRaw(sd.averageVolume) || null,
              currentPrice: q.regularMarketPrice,
              changePct: q.regularMarketChangePercent || 0,
            },
          });

          return true;
        } catch {
          return null;
        }
      })
    );

    fundamentalsUpdated += results.filter(Boolean).length;
  }

  await prisma.job_runs.create({
    data: {
      jobType: "warm-popular-stocks",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        stocksUpdated: fundamentalsUpdated,
        durationMs: Date.now() - startTime,
      },
    },
  });

  console.log(
    `[CacheWorker] Warmed ${fundamentalsUpdated} stocks (${Date.now() - startTime}ms)`
  );

  return { fundamentalsUpdated };
}
