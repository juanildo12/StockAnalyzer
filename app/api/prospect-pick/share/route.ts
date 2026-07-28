import { NextRequest, NextResponse } from 'next/server';
import { ProspectPickTrigger } from '@/src/lib/shares/types';
import { generateProspectPickCard, generateProspectPickCaption } from '@/src/lib/shares/cardGenerator';
import { shareOnTwitter } from '@/src/lib/shares/platforms/twitter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { data, platforms } = await request.json() as {
      data: ProspectPickTrigger;
      platforms: string[];
    };

    if (!data || !data.symbol) {
      return NextResponse.json({ error: 'Prospect Pick data required' }, { status: 400 });
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json({ error: 'At least one platform required' }, { status: 400 });
    }

    // Generate card image
    let imageBuffer: Buffer;
    try {
      imageBuffer = await generateProspectPickCard(data);
    } catch (e: any) {
      console.error('[ProspectPick:Share] Card generation error:', e?.message || e);
      return NextResponse.json({ error: 'Failed to generate card image' }, { status: 500 });
    }

    const results = [];

    // Share to each platform
    for (const platform of platforms) {
      if (platform === 'twitter') {
        try {
          const result = await shareOnTwitter(
            {
              alertId: `prospect-${data.symbol}-${Date.now()}`,
              symbol: data.symbol,
              userId: 'ai-coach',
              score: data.score,
              grade: data.direction,
              entryPrice: data.entry,
              targetPrice: data.target,
              stopPrice: data.stop,
              hitPrice: data.target,
              hitType: 'TP1' as const,
              returnPct: data.entry > 0 ? ((data.target - data.entry) / data.entry) * 100 : 0,
              heldDays: 0,
              riskReward: data.riskReward,
            },
            imageBuffer
          );
          results.push(result);
        } catch (e: any) {
          results.push({
            platform: 'twitter' as const,
            success: false,
            error: e?.message || 'Twitter share failed',
          });
        }
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('[ProspectPick:Share] Error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
