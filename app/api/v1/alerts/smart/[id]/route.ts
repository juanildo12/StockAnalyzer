import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";
import { generateShareCard } from "@/src/lib/shares/cardGenerator";
import { shareResult } from "@/src/lib/shares/orchestrator";
import { ShareTrigger } from "@/src/lib/shares/types";

// ── GET: Generate + return share card PNG ──────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alert = await prisma.smart_alerts.findUnique({
    where: { id: params.id },
  });

  if (!alert) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (alert.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = Number(alert.entry);
  const hitPrice = Number(alert.tp1);
  const returnPct = ((hitPrice - entry) / entry) * 100;
  const heldDays = Math.max(1, Math.ceil(
    (Date.now() - alert.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  ));

  const trigger: ShareTrigger = {
    alertId: alert.id,
    symbol: alert.symbol,
    userId: alert.userId,
    score: alert.score,
    grade: alert.grade,
    entryPrice: entry,
    targetPrice: hitPrice,
    stopPrice: Number(alert.stopLoss),
    hitPrice,
    hitType: "TP1",
    returnPct,
    heldDays,
    riskReward: Number(alert.riskReward),
  };

  try {
    const png = await generateShareCard(trigger);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Card] Generation failed:", error);
    return NextResponse.json({ error: "Failed to generate card" }, { status: 500 });
  }
}

// ── POST: Share to platforms ───────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alert = await prisma.smart_alerts.findUnique({
    where: { id: params.id },
  });

  if (!alert) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (alert.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const platforms = body.platforms as ("twitter" | "linkedin" | "discord")[];

  if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: "platforms array required" }, { status: 400 });
  }

  const entry = Number(alert.entry);
  const hitPrice = Number(alert.tp1);
  const returnPct = ((hitPrice - entry) / entry) * 100;
  const heldDays = Math.max(1, Math.ceil(
    (Date.now() - alert.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  ));

  const trigger: ShareTrigger = {
    alertId: alert.id,
    symbol: alert.symbol,
    userId: alert.userId,
    score: alert.score,
    grade: alert.grade,
    entryPrice: entry,
    targetPrice: hitPrice,
    stopPrice: Number(alert.stopLoss),
    hitPrice,
    hitType: "TP1",
    returnPct,
    heldDays,
    riskReward: Number(alert.riskReward),
  };

  const results = await shareResult(trigger, platforms);

  return NextResponse.json({ results });
}
