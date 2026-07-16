import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { cacheAside, CACHE_TTL } from "@/src/lib/cache";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

const paramsSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
});

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid symbol", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { symbol } = parsed.data;

  try {
    const data = await cacheAside(
      `v1:stock:${symbol}`,
      CACHE_TTL.FUNDAMENTALS,
      async () => {
        // Try DB first
        const dbFund = await prisma.stock_fundamentals.findUnique({
          where: { symbol },
        });

        // Get historical from DB or fetch
        const dbDaily = await prisma.stock_daily.findMany({
          where: { symbol },
          orderBy: { date: "desc" },
          take: 200,
        });

        if (dbFund && dbDaily.length > 20) {
          return {
            symbol,
            fundamentals: dbFund,
            history: dbDaily,
            source: "cache",
          };
        }

        // Fallback to Yahoo
        const [qs, q] = await Promise.all([
          yf.quoteSummary(symbol, {
            modules: [
              "summaryDetail",
              "defaultKeyStatistics",
              "financialData",
              "assetProfile",
            ],
          }).catch(() => null),
          yf.quote(symbol).catch(() => null),
        ]);

        if (!q || !q.regularMarketPrice) {
          return null;
        }

        return {
          symbol,
          fundamentals: {
            symbol,
            name: q.shortName || q.longName || symbol,
            sector: (qs as any)?.assetProfile?.sector || null,
            industry: (qs as any)?.assetProfile?.industry || null,
            currentPrice: q.regularMarketPrice,
            changePct: q.regularMarketChangePercent || 0,
          },
          history: [],
          source: "live",
        };
      }
    );

    if (!data) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error(`Stock API error for ${symbol}:`, error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
