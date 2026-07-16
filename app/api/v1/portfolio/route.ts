import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  removePortfolioItem,
} from "@/src/lib/db/portfolio";
import { cacheGet, cacheSet, cacheDel, CACHE_TTL } from "@/src/lib/cache";

export const dynamic = "force-dynamic";

const addPortfolioSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  shares: z.number().positive(),
  purchasePrice: z.number().positive(),
  purchaseDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

const updatePortfolioSchema = z.object({
  id: z.string().min(1),
  shares: z.number().positive().optional(),
  purchasePrice: z.number().positive().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const cacheKey = `v1:portfolio:${userId}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return NextResponse.json(cached);

  const portfolio = await getPortfolio(userId);
  await cacheSet(cacheKey, portfolio, CACHE_TTL.USER_PORTFOLIO);
  return NextResponse.json(portfolio);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addPortfolioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { symbol, shares, purchasePrice, purchaseDate, notes } = parsed.data;
  const item = await addPortfolioItem(session.user.id, {
    symbol,
    shares,
    purchasePrice,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
    notes,
  });

  await cacheDel(`v1:portfolio:${session.user.id}`);
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updatePortfolioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, ...data } = parsed.data;
  await updatePortfolioItem(session.user.id, id, data);

  await cacheDel(`v1:portfolio:${session.user.id}`);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await removePortfolioItem(session.user.id, id);

  await cacheDel(`v1:portfolio:${session.user.id}`);
  return NextResponse.json({ success: true });
}
