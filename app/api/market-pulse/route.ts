// Market Pulse — índice tipo Fear & Greed + probabilidad histórica condicional.
//
// Construido solo con precios diarios de ETFs/índices líquidos (Yahoo). La
// ruta es pública (misma familia que gamma-levels / put-call-ratio): no
// requiere sesión y no expone datos de usuario. Cache 10 min.

import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet } from '@/src/lib/cache';
import { buildMarketPulsePayload } from '@/src/services/marketPulseService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_KEY = 'market-pulse:v1';
const CACHE_TTL = 600; // 10 min

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === '1';

  if (!force) {
    const cached = await cacheGet<Awaited<ReturnType<typeof buildMarketPulsePayload>>>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  try {
    const payload = await buildMarketPulsePayload();
    await cacheSet(CACHE_KEY, payload, CACHE_TTL);
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error('[market-pulse] error:', err);
    return NextResponse.json(
      { error: 'No se pudo construir el Market Pulse', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 502 }
    );
  }
}
