import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { default: YahooFinance } = await import('yahoo-finance2');
    const yf = new YahooFinance();
    const result = await yf.search(q, { quotesCount: 8, newsCount: 0 });

    const results = (result.quotes || [])
      .filter((q: any) => q.symbol && (q.exchange === 'NAS' || q.exchange === 'NYQ' || q.exchange === 'NMS'))
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [] });
  }
}
