import { NextRequest, NextResponse } from 'next/server';
import { searchSymbols } from '@/src/services/finnhubClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Try Finnhub search first
    const finnResults = await searchSymbols(q).catch(() => []);
    if (finnResults.length > 0) {
      const results = finnResults
        .filter((r: any) => r.type === 'Common Stock' || r.type === 'ETF')
        .slice(0, 10)
        .map((r: any) => ({
          symbol: r.symbol,
          name: r.description || r.symbol,
        }));
      return NextResponse.json({ results });
    }

    // Fallback to Yahoo
    const { default: YahooFinance } = await import('yahoo-finance2');
    const yf = new YahooFinance();
    const yfResult = await yf.search(q, { quotesCount: 8, newsCount: 0 });

    const yfResults = (yfResult.quotes || [])
      .filter((q: any) => q.symbol && (q.exchange === 'NAS' || q.exchange === 'NYQ' || q.exchange === 'NMS'))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
      }));

    return NextResponse.json({ results: yfResults });
  } catch (error) {
    return NextResponse.json({ results: [] });
  }
}
