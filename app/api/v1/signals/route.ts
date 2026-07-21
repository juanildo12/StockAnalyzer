import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";
import { getSignalStats, logSignal } from "@/src/lib/notifications/signalTracker";

export const dynamic = "force-dynamic";

const logSignalSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  signalType: z.enum(["BUY", "SELL", "BREAKOUT"]),
  score: z.number().int().min(0).max(100),
  entryPrice: z.number().positive(),
  targetPrice: z.number().positive(),
  stopPrice: z.number().positive(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "stats") {
    const stats = await getSignalStats();
    return NextResponse.json(stats);
  }

  // Get user's signal history
  // NOTE: signal_history lacks userId column — all users see all signals.
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const signals = await prisma.signal_history.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(signals);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = logSignalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await logSignal(parsed.data);

  return NextResponse.json({ success: true }, { status: 201 });
}
