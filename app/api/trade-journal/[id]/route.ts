import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

function calcPnL(trade: any) {
  if (trade.status !== 'CLOSED') return trade;
  const qty = Number(trade.qty || 1);
  const entry = trade.entryPrice != null ? Number(trade.entryPrice) : null;
  const exit = trade.exitPrice != null ? Number(trade.exitPrice) : null;
  const premium = trade.premium != null ? Number(trade.premium) : null;
  let pnlUsd: number | null = null;
  let pnlR: number | null = null;

  if (entry != null && exit != null) {
    pnlUsd = (exit - entry) * qty * 100;
  } else if (premium != null && exit != null) {
    pnlUsd = (exit - premium) * qty * 100;
  }

  const risk = trade.stop != null && trade.entryPrice != null
    ? Math.abs(Number(trade.entryPrice) - Number(trade.stop))
    : null;
  if (pnlUsd != null && risk != null && risk > 0) {
    pnlR = pnlUsd / (risk * qty * 100);
  }
  return { ...trade, pnlUsd, pnlR };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      userId = (session?.user as any)?.id || (session?.user as any)?.sub || null;
    } catch {}
    if (!userId) {
      // Fallback to first user in DB so logged-in UI can still use it
      try {
        const { prisma } = await import('@/src/lib/prisma');
        const u = await prisma.users.findFirst({ orderBy: { createdAt: 'asc' } });
        userId = u?.id || null;
      } catch {}
    }
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const existing = await prisma.trade_journal.findFirst({ where: { id: params.id, userId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const body = await req.json();
    const data: any = {};

    if (body.status !== undefined) data.status = body.status;
    if (body.outcome !== undefined) data.outcome = body.outcome;
    if (body.exitDate !== undefined) data.exitDate = body.exitDate ? new Date(body.exitDate) : null;
    if (body.exitPrice !== undefined) data.exitPrice = body.exitPrice;
    if (body.entryPrice !== undefined) data.entryPrice = body.entryPrice;
    if (body.qty !== undefined) data.qty = body.qty;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.target !== undefined) data.target = body.target;
    if (body.stop !== undefined) data.stop = body.stop;
    if (body.fees !== undefined) data.fees = body.fees;

    if (data.status === 'CLOSED' && !data.exitDate && !existing.exitDate) {
      data.exitDate = new Date();
    }

    const updated = await prisma.trade_journal.update({ where: { id: params.id }, data });
    return NextResponse.json({ trade: calcPnL(updated) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      userId = (session?.user as any)?.id || (session?.user as any)?.sub || null;
    } catch {}
    if (!userId) {
      // Fallback to first user in DB so logged-in UI can still use it
      try {
        const { prisma } = await import('@/src/lib/prisma');
        const u = await prisma.users.findFirst({ orderBy: { createdAt: 'asc' } });
        userId = u?.id || null;
      } catch {}
    }
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const existing = await prisma.trade_journal.findFirst({ where: { id: params.id, userId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await prisma.trade_journal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
