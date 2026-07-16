import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { cacheAside, CACHE_TTL } from "@/src/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await cacheAside("v1:briefing:today", CACHE_TTL.BRIEFING, async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const briefing = await prisma.morning_briefings.findUnique({
        where: { date: today },
      });

      if (!briefing) {
        return {
          date: today.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          time: "",
          market: { spy: null, vix: null },
          summary: {
            totalScanned: 0,
            totalBreakouts: 0,
            highConfidence: 0,
            avgRiskReward: 0,
          },
          picks: [],
          message: "Briefing not yet computed.",
        };
      }

      return {
        date: briefing.date.toLocaleDateString("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: briefing.computedAt.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        market: briefing.marketContext,
        summary: briefing.summary,
        picks: briefing.picks,
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Morning briefing API error:", error);
    return NextResponse.json(
      {
        date: "",
        time: "",
        market: { spy: null, vix: null },
        summary: {
          totalScanned: 0,
          totalBreakouts: 0,
          highConfidence: 0,
          avgRiskReward: 0,
        },
        picks: [],
      },
      { status: 500 }
    );
  }
}
