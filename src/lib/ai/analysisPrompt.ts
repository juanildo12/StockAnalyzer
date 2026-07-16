export interface PromptData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name: string;
  sector: string;
  marketCap: number;
  volume: number;
  previousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  pe: number | null;
  forwardPe: number | null;
  pb: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  freeCashFlow: number | null;
  fcfYield: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  analysts: number | null;
  rsi: number | null;
  sma50: number | null;
  sma200: number | null;
  ema8: number | null;
  ema21: number | null;
  macd: number | null;
  macdSignal: number | null;
  atr: number | null;
  support: number;
  resistance: number;
  target1: number;
  target2: number;
  stopLoss: number;
  riskReward: number;
  volumeRatio: number;
  breakoutScore: number;
  socialReddit: number | null;
  socialTwitter: number | null;
  insiderBuyCount: number;
  insiderSellCount: number;
  recommendation: string | null;
}

const SYSTEM_PROMPT = `You are a senior day trader and technical analyst. You analyze stocks with precision and give actionable, professional assessments.

RULES:
- Return ONLY valid JSON, no markdown, no explanation outside the JSON
- Be concise and specific — every word must carry information
- Use price levels from the data provided, do not invent numbers
- If data is missing or null, analyze what you have and note the limitation
- Your analysis must be based on the data provided, not general knowledge
- Always provide entry, stop loss, and take profit levels
- Assess risk realistically — do not be overly bullish or bearish`;

export function buildAnalysisPrompt(data: PromptData): string {
  const weekPos = data.fiftyTwoWeekHigh > data.fiftyTwoWeekLow
    ? Math.round(((data.price - data.fiftyTwoWeekLow) / (data.fiftyTwoWeekHigh - data.fiftyTwoWeekLow)) * 100)
    : 50;

  const emaAlignment = getEmaAlignment(data.ema8, data.ema21, data.sma50, data.sma200);
  const macdSignal = data.macd !== null && data.macdSignal !== null
    ? data.macd > data.macdSignal ? "bullish" : data.macd < data.macdSignal ? "bearish" : "neutral"
    : "unknown";

  const prompt = `Analyze ${data.symbol} (${data.name}) and return a JSON analysis.

=== PRICE ===
Price: $${data.price.toFixed(2)} | Change: ${data.change >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%
52wk: $${data.fiftyTwoWeekLow.toFixed(2)} - $${data.fiftyTwoWeekHigh.toFixed(2)} (${weekPos}% of range)
Volume: ${(data.volume / 1e6).toFixed(1)}M | Vol Ratio vs 20d: ${data.volumeRatio.toFixed(2)}x
Previous Close: $${data.previousClose.toFixed(2)}

=== FUNDAMENTALS ===
Sector: ${data.sector || 'N/A'} | Market Cap: $${(data.marketCap / 1e9).toFixed(1)}B
PE: ${data.pe ?? 'N/A'} | Forward PE: ${data.forwardPe ?? 'N/A'} | P/B: ${data.pb ?? 'N/A'}
EPS: ${data.eps != null ? '$' + data.eps.toFixed(2) : 'N/A'} | Beta: ${data.beta ?? 'N/A'}
Profit Margin: ${data.profitMargin != null ? (data.profitMargin * 100).toFixed(1) + '%' : 'N/A'}
Revenue Growth: ${data.revenueGrowth != null ? (data.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}
FCF: ${data.freeCashFlow != null ? '$' + (data.freeCashFlow / 1e9).toFixed(2) + 'B' : 'N/A'} | FCF Yield: ${data.fcfYield != null ? data.fcfYield.toFixed(1) + '%' : 'N/A'}
Cash: ${data.totalCash != null ? '$' + (data.totalCash / 1e9).toFixed(1) + 'B' : 'N/A'} | Debt: ${data.totalDebt != null ? '$' + (data.totalDebt / 1e9).toFixed(1) + 'B' : 'N/A'}
Dividend Yield: ${data.dividendYield != null ? (data.dividendYield * 100).toFixed(2) + '%' : 'N/A'}

=== TECHNICAL ===
RSI(14): ${data.rsi?.toFixed(1) ?? 'N/A'}
EMA(8): ${data.ema8?.toFixed(2) ?? 'N/A'} | EMA(21): ${data.ema21?.toFixed(2) ?? 'N/A'}
SMA(50): ${data.sma50?.toFixed(2) ?? 'N/A'} | SMA(200): ${data.sma200?.toFixed(2) ?? 'N/A'}
EMA Alignment: ${emaAlignment}
MACD: ${data.macd?.toFixed(3) ?? 'N/A'} | Signal: ${data.macdSignal?.toFixed(3) ?? 'N/A'} → ${macdSignal}
ATR(14): ${data.atr?.toFixed(2) ?? 'N/A'}

=== LEVELS (computed) ===
Support: $${data.support.toFixed(2)} | Resistance: $${data.resistance.toFixed(2)}
Target 1: $${data.target1.toFixed(2)} | Target 2: $${data.target2.toFixed(2)}
Stop Loss: $${data.stopLoss.toFixed(2)} | R/R: ${data.riskReward.toFixed(1)}:1
Breakout Score: ${data.breakoutScore}/100

=== ANALYSTS ===
Target Mean: ${data.targetMean != null ? '$' + data.targetMean.toFixed(2) : 'N/A'} (range: $${data.targetLow?.toFixed(2) ?? 'N/A'} - $${data.targetHigh?.toFixed(2) ?? 'N/A'})
Analysts: ${data.analysts ?? 'N/A'} | Consensus: ${data.recommendation ?? 'N/A'}

=== SENTIMENT ===
Reddit Score: ${data.socialReddit ?? 'N/A'} | Twitter Score: ${data.socialTwitter ?? 'N/A'}
Insider: ${data.insiderBuyCount} buys / ${data.insiderSellCount} sells

=== RETURN THIS JSON ===
{
  "verdict": "BUY or HOLD or SELL",
  "conviction": "HIGH or MEDIUM or LOW",
  "summary": "1-2 sentences: the single most important thing about this stock right now",
  "analysis": {
    "trend": { "signal": "bullish/bearish/lateral", "strength": "strong/moderate/weak", "detail": "1 sentence on trend direction and quality" },
    "ema": { "signal": "bullish/bearish/mixed", "alignment": "describe the EMA stack", "detail": "1 sentence on what EMAs are telling" },
    "breakout": { "status": "confirmed/imminent/none/failed", "level": <price level or 0>, "detail": "1 sentence on breakout setup" },
    "volume": { "signal": "accumulation/distribution/neutral", "vsAverage": <number>, "detail": "1 sentence on volume behavior" },
    "momentum": { "rsi": <number>, "macd": "bullish/bearish/neutral", "detail": "1 sentence on momentum state" },
    "risk": { "level": "low/medium/high", "atr": <number>, "detail": "1 sentence on risk profile" }
  },
  "support": [{ "price": <number>, "type": "EMA21/SMA50/SMA200/horizontal" }],
  "resistance": [{ "price": <number>, "type": "52wk_high/horizontal/target" }],
  "entry": { "ideal": <ideal entry price>, "currentOk": <true if current price is a valid entry>, "stopLoss": <price>, "tp1": <price>, "tp2": <price> },
  "catalysts": ["up to 3 positive factors"],
  "warnings": ["up to 3 risk factors"]
}`;

  return prompt;
}

function getEmaAlignment(ema8: number | null, ema21: number | null, sma50: number | null, sma200: number | null): string {
  const vals = [ema8, ema21, sma50, sma200].filter(v => v !== null);
  if (vals.length < 3) return "insufficient data";

  const labels = ["EMA8", "EMA21", "SMA50", "SMA200"];
  const present = [ema8, ema21, sma50, sma200]
    .map((v, i) => v !== null ? { label: labels[i], value: v } : null)
    .filter(Boolean) as { label: string; value: number }[];

  const descending = present.every((v, i) => i === 0 || v.value <= present[i - 1].value);
  const ascending = present.every((v, i) => i === 0 || v.value >= present[i - 1].value);

  if (descending) return present.map(v => v.label).join(" > ") + " (bullish stack)";
  if (ascending) return present.map(v => v.label).join(" < ") + " (bearish stack)";
  return present.map(v => `${v.label}=$${v.value.toFixed(1)}`).join(", ") + " (mixed)";
}
