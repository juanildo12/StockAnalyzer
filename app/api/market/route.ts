import { NextRequest, NextResponse } from 'next/server';
import { getMarketMovers, getMarketStatus, getMarketNews } from '@/src/services/polygonClient';
import { getEconomicCalendar, getMarketNews as getFinNews } from '@/src/services/finnhubClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const [gainers, losers, status, polygonNews, economic] = await Promise.all([
      getMarketMovers('gainers').catch(() => []),
      getMarketMovers('losers').catch(() => []),
      getMarketStatus().catch(() => null),
      getMarketNews(10).catch(() => []),
      getEconomicCalendar().catch(() => []),
    ]);

    return NextResponse.json({
      gainers,
      losers,
      marketStatus: status,
      news: polygonNews,
      economicCalendar: economic.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
  }
}
