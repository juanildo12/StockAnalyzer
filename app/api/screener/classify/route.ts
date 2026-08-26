import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';

function getRaw(v: any): number | undefined {
  if (v && typeof v === 'object' && 'raw' in v) return v.raw;
  if (typeof v === 'number') return v;
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<T | null>((r) => setTimeout(() => r(null), ms))]);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });

  try {
    const [qs, quote] = await Promise.all([
      withTimeout(yf.quoteSummary(symbol.toUpperCase(), {
        modules: ['summaryDetail', 'financialData', 'assetProfile'],
      }), 8000),
      withTimeout(yf.quote(symbol.toUpperCase()), 5000),
    ]);

    if (!quote || !qs) return NextResponse.json({ category: null });

    const sd = (qs as any)?.summaryDetail || {};
    const fd = (qs as any)?.financialData || {};

    const pe = getRaw(sd.trailingPE) ?? null;
    const marketCap = getRaw(sd.marketCap) || quote.marketCap || 0;
    const revenueGrowth = getRaw(fd.revenueGrowth);
    const profitMargin = getRaw(fd.profitMargins);
    const operatingCashFlow = getRaw(fd.operatingCashflow) || 0;
    const fcfYield = marketCap > 0 && operatingCashFlow > 0
      ? (operatingCashFlow / marketCap) * 100
      : null;

    const revGrowth = revenueGrowth != null ? revenueGrowth * 100 : null;
    const margin = profitMargin != null ? profitMargin * 100 : null;

    // Same logic as classification/route.ts
    if (fcfYield != null && fcfYield > 8 && pe != null && pe > 0 && pe < 20 && revGrowth != null && revGrowth > 5 && margin != null && margin > 10) {
      return NextResponse.json({ category: 'joya', label: 'Joyas Ocultas', emoji: '\uD83D\uDC8E', color: '#2DD4BF', fcfYield, pe, revenueGrowth: revGrowth, margin });
    }
    if (fcfYield != null && fcfYield < 5 && pe != null && pe > 30 && revGrowth != null && revGrowth > 20) {
      return NextResponse.json({ category: 'growth', label: 'Growth Caro', emoji: '\uD83D\uDE80', color: '#A78BFA', fcfYield, pe, revenueGrowth: revGrowth, margin });
    }
    if (fcfYield != null && fcfYield < 0 && pe != null && pe > 25 && revGrowth != null && revGrowth < 5) {
      return NextResponse.json({ category: 'bomba', label: 'Bomba de Tiempo', emoji: '\uD83D\uDCA3', color: '#F87171', fcfYield, pe, revenueGrowth: revGrowth, margin });
    }
    if (fcfYield != null && fcfYield > 8 && pe != null && pe > 0 && pe < 15 && revGrowth != null && revGrowth < 5) {
      return NextResponse.json({ category: 'valueTrap', label: 'Value Trap', emoji: '\u26A0\uFE0F', color: '#FBBF24', fcfYield, pe, revenueGrowth: revGrowth, margin });
    }

    return NextResponse.json({ category: null });
  } catch {
    return NextResponse.json({ category: null });
  }
}
