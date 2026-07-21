import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";
import { runSmartAlerts } from "@/src/lib/alerts/scheduler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Authorized via cron secret
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runSmartAlerts();
    return NextResponse.json({ success: true, job: "smart_alerts", result });
  } catch (error) {
    console.error("[SmartAlerts] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── GET: List alerts or create demo ────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "active";

  // ?demo=true creates a triggered alert for testing
  if (searchParams.get("demo") === "true") {
    const demoAlert = await prisma.smart_alerts.create({
      data: {
        userId: session.user.id,
        symbol: "NVDA",
        score: 87,
        grade: "A",
        entry: 120.50,
        stopLoss: 112.00,
        tp1: 137.61,
        tp2: 152.00,
        riskReward: 2.8,
        confidence: 82,
        riskLevel: "Bajo",
        tradeTime: "Swing corto (1-3 dias)",
        summary: "NVDA genera señal de breakout con score 87/100 (confianza 82%). Zona de entrada: $120.50 | Stop: $112.00 | TP1: $137.61 | TP2: $152.00 | R/R 2.8:1. Riesgo Bajo | Tiempo estimado: Swing corto (1-3 dias).",
        topFactors: ["Breakout: 92", "Trend: 85", "Volume: 78", "Momentum: 74"],
        warnings: [],
        status: "triggered",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ demo: true, alert: demoAlert });
  }

  const alerts = await prisma.smart_alerts.findMany({
    where: {
      userId: session.user.id,
      status,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ alerts });
}
