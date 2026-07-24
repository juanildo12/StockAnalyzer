import { NextResponse } from 'next/server';
import { cacheGet } from '@/src/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cached = await cacheGet<any>('briefing:live:current');
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    return NextResponse.json({
      date: '',
      time: '',
      market: { spy: null, vix: null },
      summary: { totalScanned: 0, totalBreakouts: 0, highConfidence: 0, avgRiskReward: 0, topSectors: [] },
      picks: [],
      loading: true,
      message: 'Briefing se está generando. Intenta en unos minutos.',
    }, { headers: { 'Cache-Control': 'no-cache' } });
  } catch (error) {
    return NextResponse.json({
      date: '', time: '', market: { spy: null, vix: null },
      summary: { totalScanned: 0, totalBreakouts: 0, highConfidence: 0, avgRiskReward: 0, topSectors: [] },
      picks: [],
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
