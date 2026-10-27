import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    let token = await getToken({ req, secret, secureCookie: true });
    if (!token) token = await getToken({ req, secret, secureCookie: false });
    const userId = (token as any)?.id || (token as any)?.sub || (token as any)?.userId;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const symbol = searchParams.get('symbol');
    const direction = searchParams.get('direction');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    const where: any = { userId };
    if (status && status !== 'ALL') where.status = status;
    if (direction && direction !== 'ALL') where.direction = direction;
    if (symbol) where.symbol = String(symbol).toUpperCase();
    if (from || to) {
      where.entryDate = {};
      if (from) where.entryDate.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        where.entryDate.lte = d;
      }
    }

    const trades = await prisma.trade_journal.findMany({
      where,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return NextResponse.json({ trades });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    let token = await getToken({ req, secret, secureCookie: true });
    if (!token) token = await getToken({ req, secret, secureCookie: false });
    const userId = (token as any)?.id || (token as any)?.sub || (token as any)?.userId;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.symbol || !body.direction) {
      return NextResponse.json({ error: 'symbol and direction required' }, { status: 400 });
    }

    const trade = await prisma.trade_journal.create({
      data: {
        userId,
        source: body.source || 'trade-picks',
        symbol: String(body.symbol).toUpperCase(),
        direction: String(body.direction).toUpperCase(),
        status: body.status || 'OPEN',
        outcome: body.outcome || null,
        entryDate: body.entryDate ? new Date(body.entryDate) : new Date(),
        entryPrice: body.entryPrice ?? null,
        qty: body.qty ?? 1,
        contractStrike: body.contractStrike ?? null,
        contractExpiry: body.contractExpiry ? new Date(body.contractExpiry) : null,
        contractType: body.contractType || String(body.direction).toUpperCase(),
        premium: body.premium ?? null,
        target: body.target ?? null,
        stop: body.stop ?? null,
        riskReward: body.riskReward ?? null,
        notes: body.notes || null,
        tags: body.tags || null,
        pickSnapshot: body.pickSnapshot || null,
      },
    });
    return NextResponse.json({ trade }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
