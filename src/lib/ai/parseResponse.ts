import { AnalysisResult } from "@/src/types/ai-analysis";

export function parseAnalysisResponse(raw: string): AnalysisResult | null {
  try {
    const cleaned = extractJson(raw);
    if (!cleaned) return null;

    const parsed = JSON.parse(cleaned);
    return validateAnalysis(parsed);
  } catch {
    return null;
  }
}

function extractJson(text: string): string | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  return null;
}

function validateAnalysis(data: any): AnalysisResult | null {
  if (!data || typeof data !== "object") return null;

  const verdict = validateVerdict(data.verdict);
  const conviction = validateConviction(data.conviction);
  const summary = typeof data.summary === "string" ? data.summary : "Analysis unavailable";

  const analysis = validateSections(data.analysis);
  if (!analysis) return null;

  const support = Array.isArray(data.support)
    ? data.support
        .filter((s: any) => s && typeof s.price === "number")
        .map((s: any) => ({ price: s.price, type: String(s.type || "horizontal") }))
    : [];

  const resistance = Array.isArray(data.resistance)
    ? data.resistance
        .filter((r: any) => r && typeof r.price === "number")
        .map((r: any) => ({ price: r.price, type: String(r.type || "horizontal") }))
    : [];

  const entry = validateEntry(data.entry);

  const catalysts = Array.isArray(data.catalysts)
    ? data.catalysts.filter((c: any) => typeof c === "string").slice(0, 3)
    : [];

  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((w: any) => typeof w === "string").slice(0, 3)
    : [];

  return {
    verdict,
    conviction,
    summary,
    analysis,
    support,
    resistance,
    entry,
    catalysts,
    warnings,
  };
}

function validateVerdict(v: any): "BUY" | "HOLD" | "SELL" {
  const s = String(v || "").toUpperCase();
  if (s === "BUY" || s === "SELL") return s;
  return "HOLD";
}

function validateConviction(c: any): "HIGH" | "MEDIUM" | "LOW" {
  const s = String(c || "").toUpperCase();
  if (s === "HIGH" || s === "LOW") return s;
  return "MEDIUM";
}

function validateSections(a: any): AnalysisResult["analysis"] | null {
  if (!a || typeof a !== "object") return null;

  const makeSection = (s: any, fallbackSignal: string) => ({
    signal: typeof s?.signal === "string" ? s.signal : fallbackSignal,
    strength: s?.strength,
    status: s?.status,
    alignment: s?.alignment,
    level: typeof s?.level === "number" ? s.level : undefined,
    vsAverage: typeof s?.vsAverage === "number" ? s.vsAverage : undefined,
    rsi: typeof s?.rsi === "number" ? s.rsi : undefined,
    macd: s?.macd,
    detail: typeof s?.detail === "string" ? s.detail : "No data available",
  });

  return {
    trend: makeSection(a.trend, "lateral"),
    ema: makeSection(a.ema, "mixed"),
    breakout: makeSection(a.breakout, "none"),
    volume: makeSection(a.volume, "neutral"),
    momentum: makeSection(a.momentum, "neutral"),
    risk: makeSection(a.risk, "medium"),
  };
}

function validateEntry(e: any): AnalysisResult["entry"] {
  if (!e || typeof e !== "object") {
    return { ideal: 0, currentOk: false, stopLoss: 0, tp1: 0, tp2: 0 };
  }

  return {
    ideal: typeof e.ideal === "number" ? e.ideal : 0,
    currentOk: Boolean(e.currentOk),
    stopLoss: typeof e.stopLoss === "number" ? e.stopLoss : 0,
    tp1: typeof e.tp1 === "number" ? e.tp1 : 0,
    tp2: typeof e.tp2 === "number" ? e.tp2 : 0,
  };
}
