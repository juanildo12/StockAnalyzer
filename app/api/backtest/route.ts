import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { runBacktest } from '@/src/services/backtest';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { symbols, startDate, endDate, initialCash } = body;

    if (!symbols || !startDate || !endDate) {
      return NextResponse.json({ error: 'symbols, startDate, endDate required' }, { status: 400 });
    }

    const result = await runBacktest({
      symbols: symbols as string[],
      startDate: startDate as string,
      endDate: endDate as string,
      initialCash: initialCash || 100000,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Backtest error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
