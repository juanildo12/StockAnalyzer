import { NextRequest, NextResponse } from 'next/server';
import { getStockData } from '@/src/services/yahooFinance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const symbols = request.nextUrl.searchParams.get('symbols');

  if (symbols) {
    const list = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
    const results = await Promise.allSettled(list.map(sym => computeSignal(sym)));
    const signals = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value);
    return NextResponse.json({ signals });
  }

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  const signal = await computeSignal(symbol.toUpperCase());
  if (!signal) {
    return NextResponse.json({ error: 'No data' }, { status: 404 });
  }
  return NextResponse.json(signal);
}

async function computeSignal(sym: string) {
  try {
    const data = await getStockData(sym);
    if (!data.quote || !data.quote.regularMarketPrice) return null;

    const s = data.summary;
    const q = data.quote;
    const t = data.technical;

    const fcf = s?.freeCashflow || 0;
    const fcfYield = q.marketCap ? (fcf / q.marketCap) * 100 : 0;
    const pe = q.peRatio || 0;
    const revGrowth = (s?.revenueGrowth || 0) * 100;
    const margin = (s?.profitMargins || 0) * 100;
    const isFCFPositive = fcf >= 0;

    let frameworkScore = 0;
    if (isFCFPositive) frameworkScore += 2;
    if (fcfYield > 5) frameworkScore += 2;
    if (revGrowth > 15) frameworkScore += 2;
    if (margin > 15) frameworkScore += 2;
    if (pe > 0 && pe < 25) frameworkScore += 2;

    const isJoyas = fcfYield > 8 && pe > 0 && pe < 25 && revGrowth > 5 && margin > 10;
    const isGrowth = fcfYield < 3 && pe > 25 && revGrowth > 20 && margin > 0;
    const isValueTrap = fcfYield > 8 && pe > 0 && pe < 15 && revGrowth < 5 && margin < 10;
    const isBomba = fcfYield < 0 && pe > 25 && revGrowth < 0 && margin < 0;

    const activeScenarios: string[] = [];
    if (isJoyas) activeScenarios.push('joyas');
    if (isGrowth) activeScenarios.push('growth');
    if (isValueTrap) activeScenarios.push('value_trap');
    if (isBomba) activeScenarios.push('bomba');

    let signal: 'BUY' | 'HOLD' | 'SELL';
    if (frameworkScore >= 8) signal = 'BUY';
    else if (frameworkScore >= 5) signal = 'HOLD';
    else signal = 'SELL';

    const overallScore = Math.round((frameworkScore / 10) * 100);

    let conviction: 'HIGH' | 'MEDIUM' | 'LOW';
    if (overallScore >= 80 || overallScore <= 20) conviction = 'HIGH';
    else if (overallScore >= 60 || overallScore <= 35) conviction = 'MEDIUM';
    else conviction = 'LOW';

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (isBomba) riskLevel = 'HIGH';
    else if (isValueTrap) riskLevel = 'MEDIUM';
    else if (!isFCFPositive) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    return {
      symbol: sym,
      name: q.shortName || q.longName || sym,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      signal,
      score: overallScore,
      conviction,
      riskLevel,
      components: {
        fcfYield: Math.round(fcfYield * 10) / 10,
        peRatio: pe,
        revenueGrowth: Math.round(revGrowth * 10) / 10,
        profitMargin: Math.round(margin * 10) / 10,
        fcfPositive: isFCFPositive ? 100 : 0,
        frameworkScore,
        analystTarget: data.priceTarget?.targetMean && q.regularMarketPrice
          ? Math.round(((data.priceTarget.targetMean - q.regularMarketPrice) / q.regularMarketPrice) * 100)
          : 0,
      },
      framework: {
        fcfYield: Math.round(fcfYield * 10) / 10,
        fcfPositive: isFCFPositive,
        score: frameworkScore,
        activeScenarios,
        scenarios: [
          { id: 'joyas', name: 'Joyas Ocultas', icon: '💎', match: isJoyas,
            desc: 'FCF Yield >8% + PE <25 + Revenue >5% + Margen >10%',
            verdict: isJoyas ? '✓ ACCIÓN BARATA + GENERA CASH + CRECE' : null },
          { id: 'growth', name: 'Growth Caro', icon: '🚀', match: isGrowth,
            desc: 'FCF bajo + PE alto + Revenue >20% + Margen >0%',
            verdict: isGrowth ? '✓ CARA HOY, PERO PUEDE SER GANADORA' : null },
          { id: 'value_trap', name: 'Value Trap', icon: '⚠️', match: isValueTrap,
            desc: 'FCF Yield alto + PE bajo + Revenue estancado + Margen débil',
            verdict: isValueTrap ? '✗ PARECE BARATA... PERO ESTÁ MUERIENDO' : null },
          { id: 'bomba', name: 'Bomba de Tiempo', icon: '💣', match: isBomba,
            desc: 'FCF negativo + PE alto + No crece + Margen bajo',
            verdict: isBomba ? '✗ SOBREVALORADA + SIN FUNDAMENTOS' : null },
        ],
      },
      details: {
        marketCap: q.marketCap,
        peRatio: q.peRatio,
        volume: q.regularMarketVolume,
        sector: q.sector,
        trend: t?.trend,
        rsi: t?.rsi,
        fcf,
      },
    };
  } catch {
    return null;
  }
}
