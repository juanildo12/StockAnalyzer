import { NextRequest, NextResponse } from 'next/server';
import { getEarningsCalendar, getIPOCalendar, getEconomicCalendar } from '@/src/services/finnhubClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    const to = new Date(today);
    to.setDate(to.getDate() + 30);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const [earnings, ipo, economic] = await Promise.all([
      getEarningsCalendar(fmt(from), fmt(to)).catch(() => []),
      getIPOCalendar(fmt(from), fmt(to)).catch(() => []),
      getEconomicCalendar().catch(() => []),
    ]);

    return NextResponse.json({
      earnings,
      ipo,
      economic: economic.slice(0, 20),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
