import { NextRequest, NextResponse } from "next/server";
import { runAllScreeners, computeBreakoutScores, computeMorningBriefing } from "@/src/lib/jobs/scannerWorker";
import { warmPopularStocks } from "@/src/lib/jobs/cacheWorker";
import { checkPriceAlerts, checkBreakoutAlerts } from "@/src/lib/notifications/alertEngine";
import { evaluatePendingSignals } from "@/src/lib/notifications/signalTracker";
import { runSmartAlerts } from "@/src/lib/alerts/scheduler";
import { detectTPHits } from "@/src/lib/shares/tpDetector";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const job = searchParams.get("job") || "all";

  try {
    switch (job) {
      case "screeners": {
        const result = await runAllScreeners();
        return NextResponse.json({ success: true, job: "screeners", result });
      }
      case "breakout": {
        const result = await computeBreakoutScores();
        return NextResponse.json({ success: true, job: "breakout", result });
      }
      case "briefing": {
        const result = await computeMorningBriefing();
        return NextResponse.json({ success: true, job: "briefing", result });
      }
      case "cache": {
        const result = await warmPopularStocks();
        return NextResponse.json({ success: true, job: "cache", result });
      }
      case "alerts": {
        const priceResult = await checkPriceAlerts();
        const breakoutResult = await checkBreakoutAlerts();
        return NextResponse.json({
          success: true,
          job: "alerts",
          result: { price: priceResult, breakout: breakoutResult },
        });
      }
      case "smart_alerts": {
        const result = await runSmartAlerts();
        return NextResponse.json({ success: true, job: "smart_alerts", result });
      }
      case "tp_hits": {
        const result = await detectTPHits();
        return NextResponse.json({ success: true, job: "tp_hits", result });
      }
      case "signals": {
        const result = await evaluatePendingSignals();
        return NextResponse.json({ success: true, job: "signals", result });
      }
      case "all":
      default: {
        const cacheResult = await warmPopularStocks();
        const screenersResult = await runAllScreeners();
        const breakoutResult = await computeBreakoutScores();
        const briefingResult = await computeMorningBriefing();
        const priceAlerts = await checkPriceAlerts();
        const breakoutAlerts = await checkBreakoutAlerts();
        const smartAlerts = await runSmartAlerts();
        const tpHits = await detectTPHits();
        const signalsResult = await evaluatePendingSignals();

        return NextResponse.json({
          success: true,
          job: "all",
          results: {
            cache: cacheResult,
            screeners: screenersResult,
            breakout: breakoutResult,
            briefing: briefingResult,
            alerts: { price: priceAlerts, breakout: breakoutAlerts },
            smartAlerts,
            tpHits,
            signals: signalsResult,
          },
        });
      }
    }
  } catch (error) {
    console.error(`[Jobs] Error running ${job}:`, error);

    await prisma.job_runs.create({
      data: {
        jobType: job,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const runs = await prisma.job_runs.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ runs });
}
