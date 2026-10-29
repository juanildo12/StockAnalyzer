import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
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

    const trades = await prisma.trade_journal.findMany({ where: { userId } });
    const closed = trades.filter((t: any) => t.status === 'CLOSED');

    let wins = 0, losses = 0, be = 0;
    let totalPnl = 0;
    let sumWin = 0, sumLoss = 0;
    let winCount = 0, lossCount = 0;
    let grossWin = 0, grossLoss = 0;

    for (const t of closed) {
      if (t.outcome === 'WIN') { wins++; winCount++; }
      else if (t.outcome === 'LOSS') { losses++; lossCount++; }
      else if (t.outcome === 'BE') { be++; }

      const qty = Number((t as any).qty || 1);
      const entry = (t as any).entryPrice != null ? Number((t as any).entryPrice) : null;
      const exit = (t as any).exitPrice != null ? Number((t as any).exitPrice) : null;
      if (entry != null && exit != null) {
        const pnl = (exit - entry) * qty * 100;
        totalPnl += pnl;
        if (pnl > 0) { sumWin += pnl; grossWin += pnl; }
        if (pnl < 0) { sumLoss += Math.abs(pnl); grossLoss += Math.abs(pnl); }
      }
    }

    const denom = wins + losses;
    const winRate = denom > 0 ? (wins / denom) * 100 : 0;
    const avgWin = winCount > 0 ? sumWin / winCount : 0;
    const avgLoss = lossCount > 0 ? sumLoss / lossCount : 0;
    const expectancy = (wins + losses + be) > 0 ? (winRate / 100) * avgWin - (losses / (wins + losses + be)) * avgLoss : 0;
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : 0;

    const byMonth: Record<string, any> = {};
    for (const t of closed) {
      const d: any = (t as any).exitDate || (t as any).entryDate;
      const key = new Date(d).toISOString().slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { month: key, trades: 0, wins: 0, pnl: 0 };
      byMonth[key].trades++;
      if (t.outcome === 'WIN') byMonth[key].wins++;
      const qty = Number((t as any).qty || 1);
      const entry = (t as any).entryPrice != null ? Number((t as any).entryPrice) : null;
      const exit = (t as any).exitPrice != null ? Number((t as any).exitPrice) : null;
      if (entry != null && exit != null) byMonth[key].pnl += (exit - entry) * qty * 100;
    }

    const bySymbol: Record<string, any> = {};
    for (const t of closed) {
      const k = t.symbol;
      if (!bySymbol[k]) bySymbol[k] = { symbol: k, trades: 0, wins: 0, pnl: 0 };
      bySymbol[k].trades++;
      if (t.outcome === 'WIN') bySymbol[k].wins++;
      const qty = Number((t as any).qty || 1);
      const entry = (t as any).entryPrice != null ? Number((t as any).entryPrice) : null;
      const exit = (t as any).exitPrice != null ? Number((t as any).exitPrice) : null;
      if (entry != null && exit != null) bySymbol[k].pnl += (exit - entry) * qty * 100;
    }

    return NextResponse.json({
      totalTrades: trades.length,
      open: trades.filter((t: any) => t.status === 'OPEN').length,
      closed: closed.length,
      wins,
      losses,
      be,
      winRate: Number(winRate.toFixed(2)),
      totalPnl: Number(totalPnl.toFixed(2)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      expectancy: Number(expectancy.toFixed(2)),
      profitFactor: profitFactor === null ? null : Number(profitFactor.toFixed(2)),
      byMonth: Object.values(byMonth).sort((a: any, b: any) => a.month.localeCompare(b.month)),
      bySymbol: Object.values(bySymbol).sort((a: any, b: any) => b.pnl - a.pnl).slice(0, 15),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server_error' }, { status: 500 });
  }
}
