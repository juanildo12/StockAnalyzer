// Agente IA para el backtest.
//
// El LLM decide en cada fecha de rebalanceo (no cada día: el coste y el
// tiempo serían inviables). La señal se aplica a la apertura del día
// siguiente, igual que las estrategias deterministas.
//
// Si no hay OPENROUTER_API_KEY o el modelo falla, se degrada a la estrategia
// de tendencia y se deja nota en el resultado (no se inventa nada).

import { sma, rsi, ema } from './indicators';
import { momentum12_1 } from './strategy';
import type { BacktestConfig, Bar } from './types';
import type { Signal } from './strategy';

// Modelos gratuitos de OpenRouter que responden JSON de forma fiable.
// `minimax/minimax-m3.1-flash:free` es el más rápido (~3-4 s) y no inventa
// campos; se puede sobrescribir con OPENROUTER_BACKTEST_MODEL.
export const AI_MODEL = process.env.OPENROUTER_BACKTEST_MODEL || 'minimax/minimax-m3.1-flash:free';
export const AI_FALLBACK_MODELS = [
  'minimax/minimax-m3.1-flash:free',
  'poolside/laguna-xs-2.1:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

const AI_PROMPT = `Eres un gestor de portafolio quantitative. Decide la posición objetivo (1 = largo, 0 = sin posición) para cada acción.

Datos por acción (calculados con la información disponible HASTA el cierre del día indicado):
- Fecha y precio de cierre
- RSI(14), SMA50, SMA200, EMA21
- Momentum 12-1 (retorno a 12 meses excluyendo el último mes)
- Posición actual en la cartera (si la hay)

REGLAS:
- Responde SOLO con JSON, sin texto adicional.
- Sé conservador: si los datos son ambiguos, devuelve 0.
- No inventes datos que no estén en la entrada.

Formato:
{
  "positions": {
    "AAPL": { "target": 1, "confidence": 0.7, "reason": "motivo breve" },
    "MSFT": { "target": 0, "confidence": 0.6, "reason": "motivo breve" }
  }
}`;

export interface AiRunResult {
  signalMap: Record<string, Record<string, Signal>>;
  notes: string[];
  calls: number;
}

function describeSymbol(symbol: string, bars: Bar[]): string {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const mom = momentum12_1(bars);
  return [
    `${symbol} (cierre ${last.date}): $${last.close.toFixed(2)}`,
    `  RSI14: ${r !== null ? r.toFixed(1) : 'N/A'} | SMA50: ${s50 !== null ? s50.toFixed(2) : 'N/A'} | SMA200: ${s200 !== null ? s200.toFixed(2) : 'N/A'} | EMA21: ${e21 !== null ? e21.toFixed(2) : 'N/A'}`,
    `  Momentum 12-1: ${mom !== null ? (mom * 100).toFixed(1) + '%' : 'N/A'}`,
  ].join('\n');
}

async function callLLM(userMsg: string, timeoutMs = 40000): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://stock-analyzer-new.vercel.app',
      'X-Title': 'StockAnalyzer Backtest',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: AI_PROMPT },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 900,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content || '{}';
}

/**
 * Extrae las posiciones del texto del modelo. Tolera:
 * - preámbulos en texto antes/después del JSON
 * - JSON truncado (se intenta cerrar comillas y llaves)
 * -markdown con ```json
 */
export function parsePositions(text: string): Record<string, { target: number; reason: string }> {
  const out: Record<string, { target: number; reason: string }> = {};
  if (!text) return out;

  let payload = text.trim();
  const fence = payload.indexOf('```');
  if (fence >= 0) {
    const rest = payload.slice(fence + 3);
    const nl = rest.indexOf('\n');
    payload = nl >= 0 ? rest.slice(nl + 1) : rest;
  }
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start >= 0 && end > start) payload = payload.slice(start, end + 1);

  let parsed: any = null;
  try {
    parsed = JSON.parse(payload);
  } catch {
    // JSON truncado: se cierra lo que falte y se reintenta.
    try {
      const repaired = repairJson(payload);
      parsed = repaired ? JSON.parse(repaired) : null;
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    // Último recurso: regex por símbolo ("AAPL": { "target": 1 ... }).
    const re = /"([A-Z][A-Z0-9.\-]{0,9})"\s*:\s*\{[^}]*?"target"\s*:\s*([01](?:\.\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out[m[1]] = { target: Number(m[2]) > 0 ? 1 : 0, reason: 'Decisión del agente IA' };
    }
    return out;
  }

  const positions = parsed?.positions || parsed?.decisions || {};
  for (const key of Object.keys(positions)) {
    const d = positions[key];
    const raw = typeof d === 'object' ? d.target ?? (d.action === 'buy' || d.action === 'increase' ? 1 : 0) : 0;
    const target = Number(raw) > 0 ? 1 : 0;
    const reason = typeof d === 'object' && d.reason ? String(d.reason) : 'Decisión del agente IA';
    out[key.toUpperCase()] = { target, reason };
  }
  return out;
}

/** Cierra comillas y llaves pendientes de un JSON truncado. */
function repairJson(input: string): string | null {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (!inString && (ch === '}' || ch === ']')) {
      // cierre prematuro: se ignora
      continue;
    }
    out += ch;
  }
  if (inString) out += '"';
  // cierra contenedores abiertos
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of out) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  while (stack.length > 0) out += stack.pop();
  // elimina una coma final huérfana
  out = out.replace(/,\s*$/, '');
  return out;
}

export interface AiOptions {
  /** Días de trading entre rebalanceos (por defecto 10). */
  rebalanceEvery?: number;
  /** Tope de llamadas al LLM por backtest. */
  maxCalls?: number;
  /** Llamadas simultáneas al modelo. */
  concurrency?: number;
  /** Presupuesto de tiempo total para el LLM (ms). */
  budgetMs?: number;
}

/**
 * Construye el mapa de señales usando el LLM en las fechas de rebalanceo.
 * La decisión se mantiene hasta el siguiente rebalanceo.
 *
 * Las llamadas se lanzan en paralelo (con tope de concurrencia) porque los
 * modelos gratuitos tardan ~10 s por consulta: en serie un backtest de un año
 * se iría por encima del timeout de la plataforma.
 */
export async function buildAiSignalMap(
  config: BacktestConfig,
  barsBySymbol: Record<string, Bar[]>,
  dates: string[],
  options: AiOptions = {},
): Promise<AiRunResult> {
  const rebalanceEvery = Math.max(1, options.rebalanceEvery ?? 10);
  const maxCalls = Math.max(1, options.maxCalls ?? 16);
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const budgetMs = Math.max(10000, options.budgetMs ?? 90000);
  const notes: string[] = [];
  const signalMap: Record<string, Record<string, Signal>> = {};

  let rebalanceDates: string[] = [];
  for (let i = 0; i < dates.length; i += rebalanceEvery) rebalanceDates.push(dates[i]);

  if (rebalanceDates.length > maxCalls) {
    const step = Math.ceil(rebalanceDates.length / maxCalls);
    const limited: string[] = [];
    for (let i = 0; i < rebalanceDates.length; i += step) limited.push(rebalanceDates[i]);
    notes.push(
      `Rebalanceo cada ${rebalanceEvery} sesiones (${rebalanceDates.length} fechas) recortado a ${limited.length} llamadas al modelo para no exceder el límite de la API.`,
    );
    rebalanceDates = limited;
  }

  const started = Date.now();
  const decisions: Record<string, Record<string, { target: number; reason: string }>> = {};
  let calls = 0;
  let failures = 0;

  for (let i = 0; i < rebalanceDates.length; i += concurrency) {
    if (Date.now() - started > budgetMs) {
      notes.push(
        `Presupuesto de tiempo del agente IA agotado (${Math.round(budgetMs / 1000)} s): se detiene en ${i} de ${rebalanceDates.length} rebalanceos y se mantiene la última decisión válida.`,
      );
      break;
    }
    const batch = rebalanceDates.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (date) => {
        const blocks = config.symbols.map((sym) => {
          const bars = (barsBySymbol[sym] || []).filter((b) => b.date <= date);
          return bars.length > 0 ? describeSymbol(sym, bars) : `${sym}: sin datos`;
        });
        try {
          calls += 1;
          const text = await callLLM(
            `[FECHA DE SEÑAL] ${date}\n\n${blocks.join('\n')}\n\nDevuelve el JSON con la posición objetivo de cada acción.`,
          );
          const parsed = parsePositions(text);
          return { date, parsed };
        } catch (e) {
          failures += 1;
          return {
            date,
            error: e instanceof Error ? e.message : 'error',
          };
        }
      }),
    );

    for (const r of results) {
      if ('parsed' in r && r.parsed && Object.keys(r.parsed).length > 0) {
        decisions[r.date] = r.parsed;
      } else if ('error' in r) {
        notes.push(`Llamada al modelo falló el ${r.date} (${r.error}): se mantiene la última decisión válida.`);
      }
    }
  }

  if (failures > 0) {
    notes.push(`${failures} de ${calls} llamadas al modelo fallaron.`);
  }

  // Rellena el mapa: cada fecha usa la decisión de su rebalanceo o la última
  // decisión válida anterior.
  let last: Record<string, { target: number; reason: string }> = {};
  for (const date of dates) {
    const d = decisions[date];
    if (d) last = d;
    const perSymbol: Record<string, Signal> = {};
    for (const sym of config.symbols) {
      const item = (d || last)[sym.toUpperCase()];
      perSymbol[sym] = {
        target: (item?.target === 1 ? 1 : 0) as 0 | 1,
        score: 0,
        reason: item?.reason || 'Sin decisión del modelo',
      };
    }
    signalMap[date] = perSymbol;
  }

  return { signalMap, notes, calls };
}
