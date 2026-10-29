import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getToken } from 'next-auth/jwt';

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
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    let token: any = null;
    const cookie = req.headers.get('cookie') || '';
    // Try to get token like middleware does
    for (const secure of [true, false]) {
      try {
        token = await getToken({ req, secret, secureCookie: secure } as any);
        if (token) break;
      } catch {}
    }
    // Also try reading from cookies directly
    if (!token && cookie) {
      for (const name of ['__Secure-next-auth.session-token', 'next-auth.session-token']) {
        const m = cookie.match(new RegExp(name + '=([^;]+)'));
        if (m) {
          try {
            const { decode } = require('next-auth/jwt');
            token = await decode({ token: decodeURIComponent(m[1]), secret } as any);
            if (token) break;
          } catch {}
        }
      }
    }
    const userId = (token as any)?.id || (token as any)?.sub || (token as any)?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

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
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    let token: any = null;
    const cookie = req.headers.get('cookie') || '';
    // Try to get token like middleware does
    for (const secure of [true, false]) {
      try {
        token = await getToken({ req, secret, secureCookie: secure } as any);
        if (token) break;
      } catch {}
    }
    // Also try reading from cookies directly
    if (!token && cookie) {
      for (const name of ['__Secure-next-auth.session-token', 'next-auth.session-token']) {
        const m = cookie.match(new RegExp(name + '=([^;]+)'));
        if (m) {
          try {
            const { decode } = require('next-auth/jwt');
            token = await decode({ token: decodeURIComponent(m[1]), secret } as any);
            if (token) break;
          } catch {}
        }
      }
    }
    const userId = (token as any)?.id || (token as any)?.sub || (token as any)?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const existing = await prisma.trade_journal.findFirst({ where: { id: params.id, userId } });
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await prisma.trade_journal.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
