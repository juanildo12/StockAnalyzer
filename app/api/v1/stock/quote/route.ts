import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { cacheAside, CACHE_TTL } from "@/src/lib/cache";
import { getQuote as finnhubQuote } from "@/src/services/finnhubClient";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

const querySchema = z.object({
  symbols: z.string().min(1).transform((s) =>
    s.split(",").map((sym) => sym.trim().toUpperCase()).slice(0, 20)
  ),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols");

  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols parameter required" }, { status: 400 });
  }

  const parsed = querySchema.safeParse({ symbols: symbolsParam });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid symbols", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { symbols } = parsed.data;

  try {
    // Fetch quotes in parallel with caching
    const quotes = await Promise.all(
      symbols.map(async (sym) => {
        return cacheAside(`v1:quote:${sym}`, CACHE_TTL.QUOTE, async () => {
          // Try Finnhub first (faster)
          const fh = await finnhubQuote(sym).catch(() => null);
          if (fh && fh.c > 0) {
            return {
              symbol: sym,
              price: fh.c,
              change: fh.d || 0,
              changePercent: fh.dp || 0,
              open: fh.o,
              high: fh.h,
              low: fh.l,
              prevClose: fh.pc,
              volume: fh.v,
              source: "finnhub",
            };
          }

          // Fallback to Yahoo
          const q = await yf.quote(sym).catch(() => null);
          if (!q || !q.regularMarketPrice) return null;

          return {
            symbol: sym,
            price: q.regularMarketPrice,
            change: q.regularMarketChange || 0,
            changePercent: q.regularMarketChangePercent || 0,
            open: q.regularMarketOpen,
            high: q.regularMarketDayHigh,
            low: q.regularMarketDayLow,
            prevClose: q.regularMarketPreviousClose,
            volume: q.regularMarketVolume,
            source: "yahoo",
          };
        });
      })
    );

    const result: Record<string, any> = {};
    quotes.forEach((q, i) => {
      if (q) result[symbols[i]] = q;
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("Quote API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
