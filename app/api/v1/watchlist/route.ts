import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistItem,
} from "@/src/lib/db/watchlist";
import { cacheGet, cacheSet, CACHE_TTL } from "@/src/lib/cache";

export const dynamic = "force-dynamic";

const addToWatchlistSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  alertPrice: z.number().positive().optional(),
  alertType: z.enum(["above", "below"]).default("above"),
});

const updateWatchlistSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  alertPrice: z.number().positive().nullable().optional(),
  alertType: z.enum(["above", "below"]).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const cacheKey = `v1:watchlist:${userId}`;

  // Try cache
  const cached = await cacheGet(cacheKey);
  if (cached) return NextResponse.json(cached);

  const watchlist = await getWatchlist(userId);
  await cacheSet(cacheKey, watchlist, CACHE_TTL.USER_WATCHLIST);
  return NextResponse.json(watchlist);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addToWatchlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { symbol, alertPrice, alertType } = parsed.data;
  const item = await addToWatchlist(session.user.id, symbol, alertPrice, alertType);

  // Invalidate cache
  const { cacheDel } = await import("@/src/lib/cache");
  await cacheDel(`v1:watchlist:${session.user.id}`);

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateWatchlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { symbol, ...data } = parsed.data;
  await updateWatchlistItem(session.user.id, symbol, data);

  const { cacheDel } = await import("@/src/lib/cache");
  await cacheDel(`v1:watchlist:${session.user.id}`);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  await removeFromWatchlist(session.user.id, symbol);

  const { cacheDel } = await import("@/src/lib/cache");
  await cacheDel(`v1:watchlist:${session.user.id}`);

  return NextResponse.json({ success: true });
}
