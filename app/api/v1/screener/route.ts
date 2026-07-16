import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { cacheAside, CACHE_TTL } from "@/src/lib/cache";

const querySchema = z.object({
  model: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    model: searchParams.get("model"),
    limit: searchParams.get("limit"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { model, limit } = parsed.data;

  try {
    const cacheKey = `v1:screener:${model || "all"}:${limit}`;

    const data = await cacheAside(cacheKey, CACHE_TTL.SCREENER, async () => {
      const latestRun = await prisma.screener_results.findFirst({
        orderBy: { computedAt: "desc" },
        select: { computedAt: true },
      });

      if (!latestRun) {
        return {
          lastUpdated: null,
          screeners: [],
          message: "No data available. Run background jobs first.",
        };
      }

      const computedAt = latestRun.computedAt;

      if (model) {
        const results = await prisma.screener_results.findMany({
          where: { screenerType: model, computedAt },
          orderBy: { rank: "asc" },
          take: limit,
        });

        return {
          lastUpdated: computedAt.toISOString(),
          model,
          count: results.length,
          rankings: results.map((r) => ({
            symbol: r.symbol,
            score: r.score,
            rank: r.rank,
            components: r.components,
            levels: r.levels,
            reasons: r.reasons,
          })),
        };
      }

      const allResults = await prisma.screener_results.findMany({
        where: { computedAt },
        orderBy: { rank: "asc" },
      });

      const grouped = new Map<string, typeof allResults>();
      for (const result of allResults) {
        const existing = grouped.get(result.screenerType) || [];
        existing.push(result);
        grouped.set(result.screenerType, existing);
      }

      return {
        lastUpdated: computedAt.toISOString(),
        screeners: Array.from(grouped.entries()).map(([type, results]) => ({
          id: type,
          count: results.length,
          rankings: results.slice(0, limit).map((r) => ({
            symbol: r.symbol,
            score: r.score,
            rank: r.rank,
            components: r.components,
          })),
        })),
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Screener API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
