import { NextRequest, NextResponse } from 'next/server';
import { getMassiveFloat, getMassiveShortInterest, hasMassive } from '@/src/services/massiveClient';
import { getHistoricalData } from '@/src/services/yahooFinance';
import { cacheAside } from '@/src/lib/cache';
import { avgVolume, computeSqueeze } from '@/src/lib/tradePicks/squeeze';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 1800; // 30 min — short interest es quincenal, float diario

interface SqueezeResponse {
  symbol: string;
  price: number;
  asOf: number;
  shortInterest: { shares: number; settlementDate: string } | null;
  float: { shares: number; percent: number; effectiveDate: string } | null;
  squeeze: ReturnType<typeof computeSqueeze> | null;
  source: 'massive' | 'unavailable';
  note?: string;
}

async function build(sym: string): Promise<SqueezeResponse> {
  const [si, fl, bars] = await Promise.all([
    getMassiveShortInterest(sym).catch(() => null),
    getMassiveFloat(sym).catch(() => null),
    getHistoricalData(sym).catch(() => []),
  ]);

  const volumes = bars.map((b) => b.volume).filter((v) => v > 0);
  const price = [...bars].reverse().find((b) => b.close > 0)?.close ?? 0;
  const adv = avgVolume(volumes, 20);
  const recentVolume = volumes[volumes.length - 1];

  if (!si || si.shortInterest <= 0) {
    return {
      symbol: sym,
      price,
      asOf: Date.now(),
      shortInterest: si ? { shares: si.shortInterest, settlementDate: si.settlementDate } : null,
      float: fl ? { shares: fl.freeFloat, percent: fl.freeFloatPercent, effectiveDate: fl.effectiveDate } : null,
      squeeze: null,
      source: hasMassive() ? 'massive' : 'unavailable',
      note: hasMassive()
        ? 'Sin reporte de interés corto reciente para este símbolo.'
        : 'MASSIVE_API_KEY/POLYGON_API_KEY no configurada.',
    };
  }

  const squeeze = computeSqueeze({
    shortInterest: si.shortInterest,
    avgDailyVolume: adv,
    freeFloat: fl?.freeFloat ?? 0,
    price,
    recentVolume,
  });

  return {
    symbol: sym,
    price,
    asOf: Date.now(),
    shortInterest: { shares: si.shortInterest, settlementDate: si.settlementDate },
    float: fl ? { shares: fl.freeFloat, percent: fl.freeFloatPercent, effectiveDate: fl.effectiveDate } : null,
    squeeze,
    source: 'massive',
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol || !symbol.trim()) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  }
  const sym = symbol.trim().toUpperCase();

  try {
    const data = await cacheAside(`squeeze:${sym}`, CACHE_TTL, () => build(sym));
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
