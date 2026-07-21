import { NextRequest } from 'next/server';
import { getStockData, getStockNews } from '@/src/services/yahooFinance';
import { getQuote, getCompanyProfile, getInsiderTransactions, getSocialSentiment, getPeerGroups, getRecommendationTrends } from '@/src/services/finnhubClient';
import { getTipRanksData } from '@/src/services/dataSources';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type RequestType = 'full' | 'stats' | 'trend' | 'news' | 'company';

const SYSTEM_PROMPT = `Eres un analista financiero senior que habla español. Tu personalidad: directo, sin rodeos, con criterio propio.

REGLAS:
- Tus datos vienen de MÚLTIPLES fuentes en tiempo real (Yahoo Finance, Finnhub, Polygon, TipRanks).
- Combínalos con tu conocimiento general del mercado para dar una visión completa.
- Sé crítico, no estés de acuerdo automáticamente. Pero tampoco fuerces ser negativo.
- Si un dato no está disponible, dilo normal ("no disponible") sin darle importancia.
- Nada de etiquetas [Seguro]/[Probable]. Habla natural.
- Sin disclaimer legales.
- Markdown plano.

ESTRUCTURA:
1. **Riesgo Clave:** El mayor riesgo que muchos pasan por alto
2. **Análisis:** Paso a paso con los datos de múltiples fuentes
3. **Oportunidad:** De qué depende el potencial
4. **Veredicto:** Compra/Mantiene/Vende + contexto de precio + confianza`;

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

async function scrapeGoogleFinancePrice(symbol: string): Promise<number | null> {
  const exchanges = ['NASDAQ', 'NYSE'];
  for (const exchange of exchanges) {
    try {
      const url = `https://www.google.com/finance/quote/${symbol}:${exchange}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const match = html.match(/data-last-price="([\d.]+)"/);
      if (match) return parseFloat(match[1]);
    } catch { continue; }
  }
  return null;
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
      // Fetch ALL sources in parallel — each catches its own errors
      const [yahooData, finnhubQuote, finnhubProfile, insiderTxns, sentiment, peers, recTrends, tipranks, googlePrice] = await Promise.all([
        getStockData(ticker),
        getQuote(ticker).catch(() => null),
        getCompanyProfile(ticker).catch(() => null),
        getInsiderTransactions(ticker, 15).catch(() => []),
        getSocialSentiment(ticker).catch(() => null),
        getPeerGroups(ticker).catch(() => []),
        getRecommendationTrends(ticker).catch(() => []),
        getTipRanksData(ticker).catch(() => null),
        scrapeGoogleFinancePrice(ticker),
      ]);

      const q = yahooData.quote;
      const s = yahooData.summary;
      const t = yahooData.technical;

      if (q && q.regularMarketPrice) {
        const shortName = q.shortName || q.longName || ticker;

        // ---- REAL-TIME PRICE from multiple sources ----
        // Finnhub and Google are uncached — freshest possible
        const yahooPrice = q.regularMarketPrice || 0;
        const finnhubPrice = finnhubQuote?.c || 0;
        const googleRtPrice = googlePrice ?? 0;

        // Use the median of available prices as the "best estimate"
        const availablePrices = [yahooPrice, finnhubPrice, googleRtPrice].filter(p => p > 0);
        const sorted = [...availablePrices].sort((a, b) => a - b);
        const bestPrice = sorted.length >= 3 ? sorted[1] : (sorted[0] || yahooPrice);
        const bestChange = finnhubQuote?.d || (q.regularMarketChange || 0);
        const bestChangePct = finnhubQuote?.dp ?? (q.regularMarketChangePercent || 0);

        const forwardPE = s?.epsForward && s?.epsForward > 0 ? bestPrice / s.epsForward : null;
        const fcfYield = (q.marketCap && s?.freeCashflow) ? (s.freeCashflow / q.marketCap) * 100 : null;
        const netCash = (s?.totalCash != null && s?.totalDebt != null) ? s.totalCash - s.totalDebt : null;
        const currentRatio = (s?.currentAssets && s?.currentLiabilities) ? s.currentAssets / s.currentLiabilities : null;
        const earningsGrowth = s?.earningsGrowth ? s.earningsGrowth * 100 : null;
        const high52w = q.fiftyTwoWeekHigh;
        const low52w = q.fiftyTwoWeekLow;
        const pctFromLow = high52w > low52w ? ((bestPrice - low52w) / (high52w - low52w)) * 100 : 50;

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

        // ----- All real-time prices side by side -----
        let pricesSection = `\n[PRICES] Yahoo:$${fmt(yahooPrice)}`;
        if (finnhubPrice > 0) pricesSection += ` | Finnhub:$${fmt(finnhubPrice)}`;
        if (googleRtPrice > 0) pricesSection += ` | Google:$${fmt(googleRtPrice)}`;
        pricesSection += ` | Best:$${fmt(bestPrice)} | Change:${fmt(bestChange)}(${fmt(bestChangePct)}%) | Vol:${(q.regularMarketVolume || 0).toLocaleString()}`;

        // ----- Finnhub profile & real-time quote detail -----
        let finnhubSection = '';
        if (finnhubQuote && finnhubQuote.c) {
          finnhubSection = `\n[FINNHUB_RT] O:$${fmt(finnhubQuote.o)} | H:$${fmt(finnhubQuote.h)} | L:$${fmt(finnhubQuote.l)} | PrevClose:$${fmt(finnhubQuote.pc)}`;
        }
        if (finnhubProfile) {
          finnhubSection += ` | Exchange:${finnhubProfile.exchange || ''} | Industry:${finnhubProfile.finnhubIndustry || ''}`;
        }

        // ----- Insider summary -----
        let insiderSection = '';
        if (insiderTxns.length > 0) {
          const buys = insiderTxns.filter(t => t.transactionCode === 'P').length;
          const sells = insiderTxns.filter(t => t.transactionCode === 'S').length;
          const totalShares = insiderTxns.reduce((sum, t) => sum + (t.change || 0), 0);
          insiderSection = `\n[INSIDERS] Buys:${buys} | Sells:${sells} | NetShares:${totalShares.toLocaleString()} | Latest:${insiderTxns[0]?.name || ''} at $${fmt(insiderTxns[0]?.transactionPrice)}`;
        }

        // ----- Social sentiment -----
        let sentimentSection = '';
        if (sentiment?.reddit) {
          sentimentSection = `\n[SENTIMENT] Reddit:${sentiment.reddit.score} (${sentiment.reddit.mention} mentions) | Twitter:${sentiment.twitter?.score || 'N/A'}`;
        }

        // ----- Peer groups -----
        let peersSection = '';
        if (peers.length > 0) {
          peersSection = `\n[PEERS] ${peers.slice(0, 6).join(', ')}`;
        }

        // ----- Recommendation trends -----
        let recSection = '';
        if (recTrends.length > 0) {
          const latest = recTrends[0];
          recSection = `\n[RECOMMENDATIONS] StrongBuy:${latest.strongBuy || 0} | Buy:${latest.buy || 0} | Hold:${latest.hold || 0} | Sell:${latest.sell || 0} | StrongSell:${latest.strongSell || 0}`;
        }

        // ----- TipRanks -----
        let tipranksSection = '';
        if (tipranks) {
          const trConsensus = tipranks.analystConsensus || 'N/A';
          const trTarget = tipranks.priceTarget || 0;
          const trScore = tipranks.smartScore ?? null;
          tipranksSection = `\n[TIPRANKS] Consensus:${trConsensus} | Target:$${fmt(trTarget)} | SmartScore:${trScore !== null ? fmt(trScore) : 'N/A'} | Buys:${tipranks.buyCount || 0} | Holds:${tipranks.holdCount || 0} | Sells:${tipranks.sellCount || 0}`;
        }

        let newsBlock = '';
        if (requestType === 'news') {
          const newsItems = await getStockNews(ticker).catch(() => []);
          newsBlock = newsItems.length > 0
            ? '\n[NEWS] ' + newsItems.slice(0, 5).map(n => `"${n.title}"`).join(' | ')
            : '\n[NEWS] No recent news.';
        }

        dataBlock = `== ${shortName} (${ticker}) — FinRobot Multi-Source Analysis ==`
          + pricesSection
          + `\n[YAHOO_SUMMARY] 52W:$${fmt(low52w)}-$${fmt(high52w)} | 52W_Pos:${fmt(pctFromLow)}% | MktCap:${fmtUSD(q.marketCap)} | PE:${pe ? fmt(pe) : 'N/A'} | FwdPE:${forwardPE ? fmt(forwardPE) : 'N/A'} | PB:${s?.priceToBook ? fmt(s.priceToBook, 2) : 'N/A'}`
          + `\n[FUNDAMENTALS] Rev:${fmtUSD(s?.totalRevenue)} | RevGrowth:${revGrowth > 0 ? '+' : ''}${fmt(revGrowth)}% | Margin:${fmt(margin)}% | EPS:$${s?.epsTrailingTwelveMonths ? fmt(s.epsTrailingTwelveMonths) : 'N/A'} | FCF:${fmtUSD(fcf)} | FCF_Yield:${fcfYield != null ? fmt(fcfYield) + '%' : 'N/A'}`
          + `\n[BALANCE] Cash:${fmtUSD(s?.totalCash)} | Debt:${fmtUSD(s?.totalDebt)} | NetCash:${netCash != null ? fmtUSD(netCash) : 'N/A'} | CurrentRatio:${currentRatio ? fmt(currentRatio, 2) : 'N/A'}`
          + `\n[TECHNICAL] RSI(14):${t?.rsi ? fmt(t.rsi) : 'N/A'} | Trend:${t?.trend || 'N/A'} | SMA50:$${fmt(t?.sma50)} | SMA200:$${fmt(t?.sma200)} | Support:$${fmt(t?.support)} | Resistance:$${fmt(t?.resistance)}`
          + `\n[ANALYST] Target:$${fmt(yahooData.priceTarget?.targetMean)} | High:$${fmt(yahooData.priceTarget?.targetHigh)} | Low:$${fmt(yahooData.priceTarget?.targetLow)} | Analysts:${yahooData.priceTarget?.numberOfAnalysts || 'N/A'}`
          + `\n[FRAMEWORK] Score:${frameworkScore}/10 | FCF+:${isFCFPositive ? 'YES' : 'NO'} | Joyas:${isJoyas ? 'YES' : 'NO'} | Growth:${isGrowth ? 'YES' : 'NO'} | ValueTrap:${isValueTrap ? 'YES' : 'NO'} | Bomba:${isBomba ? 'YES' : 'NO'}`
          + `\n[SECTOR] ${q.sector || ''}`
          + `${finnhubSection}${insiderSection}${sentimentSection}${peersSection}${recSection}${tipranksSection}${newsBlock}`;
      } else {
        dataBlock = `[ERROR] No data for ticker: ${ticker}`;
      }
    }

    const userContent = ticker
      ? `DATOS_EN_VIVO:\n${dataBlock}\n\nCONSULTA: "${lastMsg}"\n\nAnaliza usando los datos y tu conocimiento del mercado.`
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
