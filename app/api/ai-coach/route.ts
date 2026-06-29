import { NextRequest } from 'next/server';
import { getStockData, getStockNews } from '@/src/services/yahooFinance';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type RequestType = 'full' | 'stats' | 'trend' | 'news' | 'company';

const SYSTEM_PROMPT = `You are a FinRobot AI Agent — multi-perspective financial analyst using Chain-of-Thought reasoning (AI4Finance Foundation methodology).

RULES (follow strictly):
- Every claim MUST be tagged: [Seguro] (proven), [Probable] (strong inference), [Suponiendo] (educated guess)
- NEVER start with agreement. Challenge assumptions first.
- NEVER say you lack real-time data — it's in the data block above
- If a field says N/A, DO NOT use it or mention it
- NO legal disclaimers
- Output in Spanish, plain markdown

PROCESS (execute in order):
1. **Riesgo Clave:** The biggest risk being overlooked
2. **Análisis:** Step-by-step walkthrough of the data, tagged with confidence levels
3. **Oportunidad:** What the upside depends on
4. **Veredicto:** Buy/Hold/Sell + price context + confidence`;

function extractTicker(text: string): string | null {
  const match = text.match(/\b[A-Z]{1,5}\b/);
  return match ? match[0] : null;
}

function detectRequestType(text: string): RequestType {
  const lower = text.toLowerCase();
  if (lower.includes('stats') || lower.includes('fundamental') || lower.includes('métrica') || lower.includes('metric') || lower.includes('explícame') || lower.includes('explain')) return 'stats';
  if (lower.includes('trend') || lower.includes('tendencia') || lower.includes('técnico') || lower.includes('technical') || lower.includes('muéstrame') || lower.includes('rsi') || lower.includes('sma')) return 'trend';
  if (lower.includes('news') || lower.includes('noticia') || lower.includes('resume') || lower.includes('summarize')) return 'news';
  if (lower.includes('company') || lower.includes('compañía') || lower.includes('compañia') || lower.includes('tell me') || lower.includes('dime sobre') || lower.includes('descripción') || lower.includes('description') || lower.includes('quién es') || lower.includes('who is')) return 'company';
  return 'full';
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return 'N/A';
  return n.toFixed(decimals);
}

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), { status: 400 });
    }

    const lastMsg = messages[messages.length - 1]?.content || '';
    const ticker = extractTicker(lastMsg);
    const requestType = ticker ? detectRequestType(lastMsg) : 'full';

    let dataBlock = '';

    if (ticker) {
      console.log(`[FinRobot] ${requestType} for ${ticker}...`);

      const stockData = await getStockData(ticker);
      const q = stockData.quote;
      const s = stockData.summary;
      const t = stockData.technical;

      if (q && q.regularMarketPrice) {
        const usePostMarket = q.postMarketPrice && q.postMarketPrice !== 0;
        const currPrice = usePostMarket ? q.postMarketPrice : q.regularMarketPrice;
        const change = usePostMarket ? (q.postMarketChange || 0) : (q.regularMarketChange || 0);
        const changePct = usePostMarket ? ((q as any).postMarketChangePercent || 0) : (q.regularMarketChangePercent || 0);
        const shortName = q.shortName || q.longName || ticker;

        const forwardPE = s?.epsForward && s?.epsForward > 0 ? currPrice / s.epsForward : null;
        const fcfYield = (q.marketCap && s?.freeCashflow) ? (s.freeCashflow / q.marketCap) * 100 : null;
        const netCash = (s?.totalCash != null && s?.totalDebt != null) ? s.totalCash - s.totalDebt : null;
        const currentRatio = (s?.currentAssets && s?.currentLiabilities) ? s.currentAssets / s.currentLiabilities : null;
        const earningsGrowth = s?.earningsGrowth ? s.earningsGrowth * 100 : null;
        const high52w = q.fiftyTwoWeekHigh;
        const low52w = q.fiftyTwoWeekLow;
        const pctFromLow = high52w > low52w ? ((currPrice - low52w) / (high52w - low52w)) * 100 : 50;

        const fcf = s?.freeCashflow || 0;
        const isFCFPositive = fcf >= 0;
        const revGrowth = (s?.revenueGrowth || 0) * 100;
        const margin = (s?.profitMargins || 0) * 100;
        const pe = q.peRatio || 0;

        let frameworkScore = 0;
        if (isFCFPositive) frameworkScore += 2;
        if (fcfYield && fcfYield > 5) frameworkScore += 2;
        if (revGrowth > 15) frameworkScore += 2;
        if (margin > 15) frameworkScore += 2;
        if (pe > 0 && pe < 25) frameworkScore += 2;

        const isJoyas = (fcfYield && fcfYield > 8) && pe > 0 && pe < 25 && revGrowth > 5 && margin > 10;
        const isGrowth = (fcfYield && fcfYield < 3) && pe > 25 && revGrowth > 20 && margin > 0;
        const isValueTrap = (fcfYield && fcfYield > 8) && pe > 0 && pe < 15 && revGrowth < 5 && margin < 10;
        const isBomba = (fcfYield && fcfYield < 0) && pe > 25 && revGrowth < 0 && margin < 0;

        let newsBlock = '';
        if (requestType === 'news') {
          const newsItems = await getStockNews(ticker).catch(() => []);
          newsBlock = newsItems.length > 0
            ? '\n[NEWS] ' + newsItems.slice(0, 5).map(n => `"${n.title}"`).join(' | ')
            : '\n[NEWS] No recent news.';
        }

        dataBlock = `== ${shortName} (${ticker}) — FinRobot Analysis ==`
          + `\n[MARKET] Price:$${fmt(currPrice)} | Change:${fmt(change)}(${fmt(changePct)}%) | Vol:${(q.regularMarketVolume || 0).toLocaleString()} | 52W:$${fmt(low52w)}-$${fmt(high52w)} | 52W_Pos:${fmt(pctFromLow)}%`
          + `\n[VALUATION] MktCap:${fmtUSD(q.marketCap)} | PE:${pe ? fmt(pe) : 'N/A'} | FwdPE:${forwardPE ? fmt(forwardPE) : 'N/A'} | PB:${s?.priceToBook ? fmt(s.priceToBook, 2) : 'N/A'}`
          + `\n[FUNDAMENTALS] Rev:${fmtUSD(s?.totalRevenue)} | RevGrowth:${revGrowth > 0 ? '+' : ''}${fmt(revGrowth)}% | Margin:${fmt(margin)}% | EPS:$${s?.epsTrailingTwelveMonths ? fmt(s.epsTrailingTwelveMonths) : 'N/A'} | FCF:${fmtUSD(fcf)} | FCF_Yield:${fcfYield != null ? fmt(fcfYield) + '%' : 'N/A'}`
          + `\n[BALANCE] Cash:${fmtUSD(s?.totalCash)} | Debt:${fmtUSD(s?.totalDebt)} | NetCash:${netCash != null ? fmtUSD(netCash) : 'N/A'} | CurrentRatio:${currentRatio ? fmt(currentRatio, 2) : 'N/A'}`
          + `\n[TECHNICAL] RSI(14):${t?.rsi ? fmt(t.rsi) : 'N/A'} | Trend:${t?.trend || 'N/A'} | SMA50:$${fmt(t?.sma50)} | SMA200:$${fmt(t?.sma200)} | Support:$${fmt(t?.support)} | Resistance:$${fmt(t?.resistance)}`
          + `\n[ANALYST] Target:$${fmt(stockData.priceTarget?.targetMean)} | High:$${fmt(stockData.priceTarget?.targetHigh)} | Low:$${fmt(stockData.priceTarget?.targetLow)} | Analysts:${stockData.priceTarget?.numberOfAnalysts || 'N/A'}`
          + `\n[FRAMEWORK] Score:${frameworkScore}/10 | FCF+:${isFCFPositive ? 'YES' : 'NO'} | Joyas:${isJoyas ? 'YES' : 'NO'} | Growth:${isGrowth ? 'YES' : 'NO'} | ValueTrap:${isValueTrap ? 'YES' : 'NO'} | Bomba:${isBomba ? 'YES' : 'NO'}`
          + `\n[SECTOR] ${q.sector || ''}${newsBlock}`;
      } else {
        dataBlock = `[ERROR] No data for ticker: ${ticker}`;
      }
    }

    const userContent = ticker
      ? `DATOS_EN_VIVO:\n${dataBlock}\n\nCONSULTA: "${lastMsg}"\n\nEjecuta el proceso FinRobot: IDENTIFY → ANALYZE → SYNTHESIS → VERDICT`
      : lastMsg;

    const history = messages.slice(0, -1).slice(-4);

    const selectedModel = model || 'nvidia/nemotron-3-ultra-550b-a55b:free';

    const openRouterBody = {
      model: selectedModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userContent },
      ],
      stream: false,
      max_tokens: 2048,
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
        'HTTP-Referer': 'https://stock-analyzer-new.vercel.app',
        'X-Title': 'StockAnalyzer FinRobot Coach',
      },
      body: JSON.stringify(openRouterBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('[FinRobot] OpenRouter error:', response.status, errText);
      return new Response(JSON.stringify({ error: `OpenRouter error: ${response.status}` }), { status: 502 });
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content || 'No se generó respuesta.';
    const encoder = new TextEncoder();

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';
    console.error('[FinRobot] Error:', message);
    console.error('[FinRobot] Stack:', stack);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
