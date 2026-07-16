import { NextResponse } from "next/server";
import { cacheAside, CACHE_TTL } from "@/src/lib/cache";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await cacheAside("v1:market:overview", CACHE_TTL.MARKET, async () => {
      const [spy, vix,qqq,iwm] = await Promise.all([
        yf.quote("SPY").catch(() => null),
        yf.quote("^VIX").catch(() => null),
        yf.quote("QQQ").catch(() => null),
        yf.quote("IWM").catch(() => null),
      ]);

      return {
        indices: {
          spy: spy
            ? {
                price: spy.regularMarketPrice,
                change: spy.regularMarketChange || 0,
                changePercent: spy.regularMarketChangePercent || 0,
              }
            : null,
          qqq: qqq
            ? {
                price: qqq.regularMarketPrice,
                change: qqq.regularMarketChange || 0,
                changePercent: qqq.regularMarketChangePercent || 0,
              }
            : null,
          iwm: iwm
            ? {
                price: iwm.regularMarketPrice,
                change: iwm.regularMarketChange || 0,
                changePercent: iwm.regularMarketChangePercent || 0,
              }
            : null,
        },
        vix: vix
          ? {
              level: vix.regularMarketPrice,
              label:
                vix.regularMarketPrice < 15
                  ? "BAJA"
                  : vix.regularMarketPrice < 25
                  ? "MEDIA"
                  : "ALTA",
              change: vix.regularMarketChange || 0,
            }
          : null,
        updatedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Market API error:", error);
    return NextResponse.json(
      { indices: { spy: null, qqq: null, iwm: null }, vix: null },
      { status: 500 }
    );
  }
}
