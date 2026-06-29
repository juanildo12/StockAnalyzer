import { NextRequest, NextResponse } from 'next/server';
import { runBacktest } from '@/src/services/backtest';

export async function POST(req: NextRequest) {
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
