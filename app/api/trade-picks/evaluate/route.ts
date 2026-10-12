import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<T | null>((r) => setTimeout(() => r(null), ms))]);
}

interface EvalPick {
  id: string;
  symbol: string;
  direction: 'CALL' | 'PUT';
  entry: number;
  stop: number;
  target: number;
  createdAt: string;
  contract?: { strike: number; expiration: string; premium: number } | null;
}

/**
 * Evalúa el histórico con datos reales (velas diarias) desde la fecha del pick:
 * gana si el precio TOCA el target, pierde si toca el stop — aunque luego
 * retroceda. Si nunca toca ninguno y la opción ya expiró, liquida por
 * intrínseco del último cierre. Así el win rate es estable y verificable.
 */
export async function POST(request: NextRequest) {
  let picks: EvalPick[] = [];
  try {
    const body = await request.json();
    picks = Array.isArray(body?.picks) ? body.picks : [];
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (picks.length === 0) return NextResponse.json({ results: {} });

  const results: Record<string, { status: 'win' | 'loss'; price: number; at: string }> = {};

  await Promise.all(
    picks.slice(0, 100).map(async (p) => {
      try {
        if (!(p.target > 0) || !(p.stop > 0) || !p.symbol) return;
        const start = Math.max(new Date(p.createdAt).getTime(), Date.now() - 90 * 86400000);
        const hist = await withTimeout(
          yf.chart(p.symbol, {
            period1: new Date(start - 86400000),
            period2: new Date(),
            interval: '1d',
          }),
          8000
        );
        const pickDay = new Date(p.createdAt).toISOString().slice(0, 10);
        const barDay = (b: any) => new Date(b.date).toISOString().slice(0, 10);
        const bars = (hist?.quotes || []).filter(
          (b: any) =>
            b.high != null && b.low != null && b.close != null && barDay(b) >= pickDay
        );
        if (bars.length === 0) return;

        const isCall = p.direction === 'CALL';
        for (const b of bars) {
          const high = b.high as number;
          const low = b.low as number;
          const close = b.close as number;
          const at = new Date(b.date as any).toISOString();
          const hitTarget = isCall ? high >= p.target : low <= p.target;
          const hitStop = isCall ? low <= p.stop : high >= p.stop;
          if (hitTarget && hitStop) {
            // Ambos en la misma vela: se decide por el cierre vs la entrada
            const win = isCall ? close >= p.entry : close <= p.entry;
            results[p.id] = { status: win ? 'win' : 'loss', price: close, at };
            return;
          }
          if (hitTarget) {
            results[p.id] = { status: 'win', price: p.target, at };
            return;
          }
          if (hitStop) {
            results[p.id] = { status: 'loss', price: p.stop, at };
            return;
          }
        }

        // Sin toque: si la opción ya expiró, liquidación por intrínseco
        const exp = p.contract?.expiration
          ? new Date(p.contract.expiration + 'T23:59:59').getTime()
          : null;
        if (exp && exp < Date.now() && p.contract) {
          // Cierre de la fecha de expiración (no el último disponible)
          const upto = bars.filter((b: any) => new Date(b.date).getTime() <= exp);
          const last = upto.length > 0 ? upto[upto.length - 1] : bars[bars.length - 1];
          const intrinsic = isCall
            ? Math.max(0, (last.close as number) - p.contract.strike)
            : Math.max(0, p.contract.strike - (last.close as number));
          const pnl = intrinsic - (p.contract.premium || 0);
          results[p.id] = {
            status: pnl > 0 ? 'win' : 'loss',
            price: last.close as number,
            at: new Date(last.date as any).toISOString(),
          };
        }
      } catch {
        /* sin datos → se queda pendiente */
      }
    })
  );

  return NextResponse.json({ results });
}
