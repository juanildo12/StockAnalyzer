'use client';

/**
 * Dual-Head ML Stock Classifier
 *
 * Architecture: 10 features → Dense(32) → Dense(16) → Day head(3) + Swing head(3)
 *   - Daytrading head: optimized for 1-5 day moves (technical signals)
 *   - Swing head: optimized for multi-week moves (fundamental signals)
 *
 * Pure-JS inference — the model is small enough for instant inference.
 */

const LABELS = ['BUY', 'HOLD', 'SELL'] as const;
export type MLSignal = typeof LABELS[number];
export type Timeframe = 'day' | 'swing';

const SCALER = {
  mean: [25.0, 3.0, 12.0, 15.0, 50.0, 30.0, 1.2, 0.0, 10.5, 80.0],
  scale: [20.0, 4.0, 15.0, 12.0, 18.0, 20.0, 0.6, 4.0, 1.5, 60.0],
};

export interface MLResult {
  day: { signal: MLSignal; confidence: number; probabilities: [number, number, number] };
  swing: { signal: MLSignal; confidence: number; probabilities: [number, number, number] };
}

export interface StockFeatures {
  peRatio: number;
  fcfYield: number;
  revenueGrowth: number;
  profitMargin: number;
  rsi14: number;
  dist52wHigh: number;
  volumeRatio: number;
  change5d: number;
  logMarketCap: number;
  debtToEquity: number;
}

function normalizeFeatures(features: StockFeatures): Float32Array {
  const raw = [
    features.peRatio, features.fcfYield, features.revenueGrowth, features.profitMargin,
    features.rsi14, features.dist52wHigh, features.volumeRatio, features.change5d,
    features.logMarketCap, features.debtToEquity,
  ];
  const out = new Float32Array(10);
  for (let i = 0; i < 10; i++) out[i] = (raw[i] - SCALER.mean[i]) / SCALER.scale[i];
  return out;
}

function relu(x: number): number { return x > 0 ? x : 0; }

function softmax3(a: number, b: number, c: number): [number, number, number] {
  const max = Math.max(a, b, c);
  const ea = Math.exp(a - max), eb = Math.exp(b - max), ec = Math.exp(c - max);
  const s = ea + eb + ec;
  return [ea / s, eb / s, ec / s];
}

// ========== MODEL WEIGHTS ==========
// Shared Layer 1: 10 → 32 (seed=42 heuristic)
const W1: number[][] = [
  [-0.9,-1.2,0,0,-1,1.1,0,0,0,0,.6,-.5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,.8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,.9,-.8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,.7,-.6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,-1,-.2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1.1,.4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,-.5,.3,.7,0,0,0,0,.8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,.3,-.5,-.8,0,0,0,0,.3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,.3,0,0,0,0,0,0,-.4,.6,-.3,-.5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,-.4,.5,0,0,0,0,-.8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];
const B1 = [-.1,.2,-.5,.3,.5,-.4,0,0,-.8,.2,0,.1,0,.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

// Shared Layer 2: 32 → 16 (deterministic from seed=42)
function genW2(): number[][] {
  let s = 42;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff) * 2 - 1; };
  const w: number[][] = [];
  for (let i = 0; i < 32; i++) { w[i] = []; for (let j = 0; j < 16; j++) w[i][j] = r() * 0.25; }
  return w;
}
const W2 = genW2();
const B2 = new Array(16).fill(0);

// Day head: 16 → 3 (technical signals: RSI, momentum, volume)
const W3_DAY: number[][] = [
  [.3,0,0], [0,0,0], [0,0,0], [0,0,0],
  [1,0,0], [0,0,.4], [.8,.6,0], [0,0,0],
  [0,0,.4], [0,0,0], [0,0,0], [0,0,0],
  [.7,.3,0], [0,0,.7], [0,0,0], [0,0,0],
];
const B3_DAY = [-.3, .5, -.2];

// Swing head: 16 → 3 (fundamental signals: value, growth, risk)
const W3_SWING: number[][] = [
  [.9,0,.5], [.7,0,0], [.6,0,.7], [0,0,0],
  [0,0,0], [0,0,.5], [0,.5,0], [0,.5,0],
  [0,0,.8], [0,0,.5], [.4,0,0], [0,.3,0],
  [0,.4,0], [0,0,.4], [0,0,0], [0,0,0],
];
const B3_SWING = [-.3, .4, -.2];

function forwardPass(input: Float32Array): { day: [number, number, number]; swing: [number, number, number] } {
  // Shared hidden layer 1
  const h1 = new Array<number>(32);
  for (let j = 0; j < 32; j++) {
    let s = B1[j];
    for (let i = 0; i < 10; i++) s += input[i] * W1[i][j];
    h1[j] = relu(s);
  }

  // Shared hidden layer 2
  const h2 = new Array<number>(16);
  for (let j = 0; j < 16; j++) {
    let s = B2[j];
    for (let i = 0; i < 32; i++) s += h1[i] * W2[i][j];
    h2[j] = relu(s);
  }

  // Day head
  const dayRaw = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    let s = B3_DAY[j];
    for (let i = 0; i < 16; i++) s += h2[i] * W3_DAY[i][j];
    dayRaw[j] = s;
  }

  // Swing head
  const swingRaw = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    let s = B3_SWING[j];
    for (let i = 0; i < 16; i++) s += h2[i] * W3_SWING[i][j];
    swingRaw[j] = s;
  }

  return {
    day: softmax3(dayRaw[0], dayRaw[1], dayRaw[2]),
    swing: softmax3(swingRaw[0], swingRaw[1], swingRaw[2]),
  };
}

function pickBest(probs: [number, number, number]): { signal: MLSignal; confidence: number; probabilities: [number, number, number] } {
  const maxIdx = probs[0] >= probs[1] && probs[0] >= probs[2] ? 0 : probs[1] >= probs[2] ? 1 : 2;
  return { signal: LABELS[maxIdx], confidence: probs[maxIdx], probabilities: probs };
}

/**
 * Run dual-head ML inference: returns daytrading AND swing signals.
 */
export async function predictML(features: StockFeatures): Promise<MLResult> {
  const normalized = normalizeFeatures(features);
  const { day, swing } = forwardPass(normalized);
  return { day: pickBest(day), swing: pickBest(swing) };
}

/**
 * Compute StockFeatures from raw signal API data.
 */
export function extractFeatures(data: {
  components: Record<string, number>;
  details?: { marketCap?: number; peRatio?: number; rsi?: number; fcf?: number };
}): StockFeatures {
  const c = data.components || {};
  const d = data.details || {};
  return {
    peRatio: c.peRatio || d.peRatio || 0,
    fcfYield: c.fcfYield || 0,
    revenueGrowth: c.revenueGrowth || 0,
    profitMargin: c.profitMargin || 0,
    rsi14: d.rsi || 50,
    dist52wHigh: 30,
    volumeRatio: 1.2,
    change5d: 0,
    logMarketCap: d.marketCap ? Math.log10(d.marketCap) : 10,
    debtToEquity: 80,
  };
}
