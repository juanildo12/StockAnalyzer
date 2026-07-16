import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { cacheAside, CACHE_TTL } from "@/src/lib/cache";

const querySchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100).default(55),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    minScore: searchParams.get("minScore"),
    limit: searchParams.get("limit"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { minScore, limit } = parsed.data;

  try {
    const cacheKey = `v1:breakout:${minScore}:${limit}`;

    const data = await cacheAside(cacheKey, CACHE_TTL.BREAKOUT, async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const results = await prisma.screener_results.findMany({
        where: {
          screenerType: "breakout-score",
          computedAt: { gte: today },
          score: { gte: minScore },
        },
        orderBy: { score: "desc" },
        take: limit,
      });

      return {
        updatedAt: results[0]?.computedAt?.toISOString() || null,
        totalScanned: 120,
        totalQualified: results.length,
        picks: results.map((r) => {
          const components = r.components as any;
          const levels = r.levels as any;
          const reasons = (r.reasons as string[]) || [];

          return {
            symbol: r.symbol,
            breakoutScore: r.score,
            components: {
              trend: components?.trend || 0,
              volume: components?.volume || 0,
              structure: components?.structure || 0,
              safety: components?.safety || 0,
            },
            technicals: {
              rsi: components?.rsi || null,
              sma50: components?.sma50 || null,
              sma200: components?.sma200 || null,
              volRatio: components?.volRatio || 1,
            },
            levels: {
              resistance: levels?.resistance || 0,
              support: levels?.support || 0,
              target1: levels?.target1 || 0,
              target2: levels?.target2 || 0,
              stopLoss: levels?.stopLoss || 0,
              riskReward: levels?.riskReward || 0,
            },
            reasons,
          };
        }),
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Breakout API error:", error);
    return NextResponse.json(
      { updatedAt: "", totalScanned: 0, totalQualified: 0, picks: [] },
      { status: 500 }
    );
  }
}
