import { StockFeatures, Portfolio, Position, Order, PortfolioSnapshot, TradeRecord, BacktestConfig, BacktestResult } from './types';
import { calcMetrics } from './metrics';
import { getBars } from '../polygonClient';
import { getNews, getBasicFinancials, getStockIndicators } from '../finnhubClient';
import { FILTER_AGENT_PROMPT, DECISION_AGENT_PROMPT } from './prompts';

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function buildFeatures(symbol: string, date: Date): Promise<StockFeatures | null> {
  const from = new Date(date);
  from.setDate(from.getDate() - 250);
  const bars = await getBars(symbol, fmtDate(from), fmtDate(date)).catch(() => [] as any);
  if (bars.length === 0) return null;

  const last = bars[bars.length - 1];
  const prev = bars.length > 1 ? bars[bars.length - 2] : last;
  const closes = bars.map((b: any) => b.c);

  const rsi = calcRSI(closes, 14);
  const sma50 = calcSMA(closes, Math.min(50, closes.length));
  const sma200 = calcSMA(closes, Math.min(200, closes.length));

  const newsFrom = new Date(date);
  newsFrom.setDate(newsFrom.getDate() - 2);
  const newsItems = await getNews(symbol, fmtDate(newsFrom), fmtDate(date)).catch(() => []);

  const fin = await getBasicFinancials(symbol).catch(() => null);
  const metrics = fin?.metric || {};

  const high52w = Math.max(...closes.slice(-252));
  const low52w = Math.min(...closes.slice(-252));

  return {
    symbol,
    date: fmtDate(date),
    open: last.o,
    high: last.h,
    low: last.l,
    close: last.c,
    volume: last.v,
    marketCap: (metrics as any)['marketCapitalization'] || undefined,
    peRatio: (metrics as any)['peRatio'] || undefined,
    dividendYield: (metrics as any)['dividendYieldIndicated'] || undefined,
    week52High: high52w,
    week52Low: low52w,
    news: newsItems.slice(0, 5).map((n: any) => ({ headline: n.headline || '', summary: n.summary || '' })),
    rsi,
    sma50: sma50 ?? undefined,
    sma200: sma200 ?? undefined,
  };
}

function calcRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i <= period; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function formatFeaturesForPrompt(features: StockFeatures[], portfolio: Portfolio): string {
  return features.map(f => {
    const pos = portfolio.positions[f.symbol];
    const currentValue = pos ? pos.shares * f.open : 0;
    const posStr = pos
      ? `[POSICIÓN] ${pos.shares} accs @ $${f.open} = $${currentValue.toFixed(0)}`
      : '[POSICIÓN] No tienes esta acción';
    return `
${f.symbol} — $${f.open} | Día: ${f.date}
${posStr}
[TÉCNICOS] RSI:${f.rsi?.toFixed(0) || 'N/A'} SMA50:$${f.sma50?.toFixed(2) || 'N/A'} SMA200:$${f.sma200?.toFixed(2) || 'N/A'}
[VALORACIÓN] MktCap:${f.marketCap ? '$' + (f.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'} P/E:${f.peRatio?.toFixed(1) || 'N/A'} Div:${f.dividendYield != null ? (f.dividendYield * 100).toFixed(2) + '%' : 'N/A'}
[RANGO] 52W: $${f.week52Low?.toFixed(2) || '?'} - $${f.week52High?.toFixed(2) || '?'}
[NOTICIAS] ${f.news.map(n => n.headline).join(' | ') || 'Sin noticias'}
`;
  }).join('---\n');
}

export function formatPortfolioOverview(portfolio: Portfolio, totalValue: number): string {
  const lines = Object.entries(portfolio.positions).map(([sym, p]) => {
    const val = p.shares * (p.avgPrice || 0);
    const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
    return `${sym}: ${p.shares} accs @ $${p.avgPrice.toFixed(2)} = $${val.toFixed(0)} (${pct.toFixed(1)}%)`;
  });
  return `Efectivo: $${portfolio.cash.toFixed(0)}
Total Activos: $${totalValue.toFixed(0)}
Posiciones:
${lines.join('\n') || 'Vacío'}`;
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const start = new Date(config.startDate);
  const end = new Date(config.endDate);
  const portfolio: Portfolio = { cash: config.initialCash, positions: {} };
  const nav: { date: string; value: number }[] = [];
  const trades: TradeRecord[] = [];
  const benchmark: { date: string; value: number }[] = [];

  let currentDate = new Date(start);
  const dayCount = Math.ceil((end.getTime() - start.getTime()) / (86400000));

  const lastPrices: Record<string, number> = {};

  for (let d = 0; d <= dayCount; d++) {
    const dateStr = fmtDate(currentDate);
    const features: StockFeatures[] = [];

    for (const sym of config.symbols) {
      const f = await buildFeatures(sym, currentDate);
      if (f) {
        features.push(f);
        lastPrices[sym] = f.open;
      }
    }

    const totalEquity = portfolio.cash + Object.entries(portfolio.positions).reduce((sum, [sym, p]) => {
      return sum + (p.shares * (lastPrices[sym] || p.avgPrice));
    }, 0);

    nav.push({ date: dateStr, value: totalEquity });

    const bmFeature = features[0];
    if (bmFeature) {
      benchmark.push({ date: dateStr, value: bmFeature.open });
    }

    if (features.length === 0 || d < 5) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    const overview = formatPortfolioOverview(portfolio, totalEquity);
    const featureData = formatFeaturesForPrompt(features, portfolio);

    const filterMsg = `[FECHA] ${dateStr}\n\n[PORTAFOLIO]\n${overview}\n\n[DATOS ACCIONES]\n${featureData}\n\nSelecciona las acciones que necesitan análisis fundamental detallado.`;

    const filterRes = await callLLM(FILTER_AGENT_PROMPT, filterMsg);
    let stocksNeedFund: string[] = [];
    try {
      const parsed = JSON.parse(filterRes);
      stocksNeedFund = parsed.stocks_need_fundamental || [];
    } catch { stocksNeedFund = []; }

    const enrichedFeatures = features.map(f => ({
      ...f,
      hasFundamental: stocksNeedFund.includes(f.symbol),
    }));

    const enrichedStr = enrichedFeatures.map(f => {
      const str = formatFeaturesForPrompt([f], portfolio);
      return f.hasFundamental ? str + '\n[INCLUYE DATOS FUNDAMENTALES COMPLETOS]\n' : str + '\n[solo datos técnicos]\n';
    }).join('---\n');

    const decisionMsg = `[FECHA] ${dateStr}\n\n[PORTAFOLIO]\n${overview}\n\n[DATOS DEL MERCADO]\n${enrichedStr}\n\nGenera las decisiones de trading para hoy.`;

    const decisionRes = await callLLM(DECISION_AGENT_PROMPT, decisionMsg);

    interface Decision {
      action: string;
      target_cash_amount: number | null;
      reasons: string[];
      confidence: number;
    }
    interface DecisionsJSON {
      decisions: Record<string, Decision>;
      portfolio_reasoning?: string;
    }

    let decisions: DecisionsJSON = { decisions: {} };
    try {
      decisions = JSON.parse(decisionRes);
    } catch {}

    for (const sym of config.symbols) {
      const dec = decisions.decisions?.[sym];
      if (!dec) continue;
      const feat = features.find(f => f.symbol === sym);
      if (!feat) continue;
      const price = feat.open;
      const pos = portfolio.positions[sym];
      const currentVal = pos ? pos.shares * price : 0;

      if (dec.action === 'increase' && dec.target_cash_amount) {
        const target = Math.min(dec.target_cash_amount, totalEquity * 0.15);
        const addVal = Math.min(target - currentVal, portfolio.cash * 0.95);
        if (addVal > 10) {
          const shares = Math.floor(addVal / price);
          const cost = shares * price;
          portfolio.cash -= cost;
          if (pos) {
            pos.totalCost += cost;
            pos.shares += shares;
            pos.avgPrice = pos.totalCost / pos.shares;
          } else {
            portfolio.positions[sym] = { shares, avgPrice: price, totalCost: cost };
          }
          trades.push({ date: dateStr, symbol: sym, side: 'buy', shares, price, value: cost });
        }
      } else if (dec.action === 'decrease' || dec.action === 'close') {
        if (!pos || pos.shares <= 0) continue;
        const sellPct = dec.action === 'close' ? 1 : 0.5;
        const shares = Math.floor(pos.shares * sellPct);
        if (shares > 0) {
          const val = shares * price;
          portfolio.cash += val;
          pos.shares -= shares;
          pos.totalCost = pos.shares > 0 ? pos.totalCost * (pos.shares / (pos.shares + shares)) : 0;
          if (pos.shares <= 0) delete portfolio.positions[sym];
          trades.push({ date: dateStr, symbol: sym, side: 'sell', shares, price, value: val });
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const metrics = calcMetrics(nav);
  const benchmarkReturn = benchmark.length > 1
    ? (benchmark[benchmark.length - 1].value - benchmark[0].value) / benchmark[0].value
    : 0;

  return {
    config,
    ...metrics,
    totalTrades: trades.length,
    nav,
    trades,
    benchmarkReturn,
  };
}

async function callLLM(systemPrompt: string, userMsg: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return '{}';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://stock-analyzer-new.vercel.app',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '{}';
}
