'use client';

/**
 * ML Stock Classifier Service
 *
 * Loads the .tflite model via LiteRT.js (WASM backend) and runs inference.
 * Falls back to pure-JS forward pass if LiteRT fails to load.
 */

const MODEL_URL = '/models/stock_classifier.tflite';
const WASM_PATH = '/litert-wasm/';
const LABELS = ['BUY', 'HOLD', 'SELL'] as const;
export type MLSignal = typeof LABELS[number];

const SCALER = {
  mean: [25.0, 3.0, 12.0, 15.0, 50.0, 30.0, 1.2, 0.0, 10.5, 80.0],
  scale: [20.0, 4.0, 15.0, 12.0, 18.0, 20.0, 0.6, 4.0, 1.5, 60.0],
};

export interface MLResult {
  signal: MLSignal;
  confidence: number;
  probabilities: [number, number, number];
  method: 'litert' | 'fallback';
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

// --- Singleton LiteRT state ---
let litertReady = false;
let litertFailed = false;
let compiledModel: any = null;
let environment: any = null;

async function initLiteRt(): Promise<boolean> {
  if (litertReady || litertFailed) return litertReady;

  try {
    const { loadLiteRt, loadAndCompile, Environment } = await import('@litertjs/core');

    await loadLiteRt(WASM_PATH);

    environment = await Environment.create();
    compiledModel = await loadAndCompile(MODEL_URL, {
      accelerator: 'wasm',
      environment,
    });

    litertReady = true;
    return true;
  } catch (err) {
    console.warn('[ML Classifier] LiteRT.js init failed, using JS fallback:', err);
    litertFailed = true;
    return false;
  }
}

function normalizeFeatures(features: StockFeatures): Float32Array {
  const raw = [
    features.peRatio,
    features.fcfYield,
    features.revenueGrowth,
    features.profitMargin,
    features.rsi14,
    features.dist52wHigh,
    features.volumeRatio,
    features.change5d,
    features.logMarketCap,
    features.debtToEquity,
  ];

  const normalized = new Float32Array(10);
  for (let i = 0; i < 10; i++) {
    normalized[i] = (raw[i] - SCALER.mean[i]) / SCALER.scale[i];
  }
  return normalized;
}

function relu(x: number): number {
  return x > 0 ? x : 0;
}

function softmax(arr: Float32Array): [number, number, number] {
  const max = Math.max(arr[0], arr[1], arr[2]);
  const e0 = Math.exp(arr[0] - max);
  const e1 = Math.exp(arr[1] - max);
  const e2 = Math.exp(arr[2] - max);
  const sum = e0 + e1 + e2;
  return [e0 / sum, e1 / sum, e2 / sum];
}

/**
 * Heuristic weights matching the Python-generated model.
 */
function fallbackForwardPass(input: Float32Array): [number, number, number] {
  const W1 = new Float32Array([
    -0.2,-0.9,-1.2,0.0,0.0,0.0,-0.2,0.0,-0.2,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     1.0,1.0,0.8,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.9,-0.8,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.7,-0.6,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,-1.0,0.0,0.0,0.0,-0.2,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,1.1,0.0,0.0,0.0,-0.5,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,-0.5,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.3,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.0,0.3,-0.8,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.0,0.7,0.4,0.6,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
    -0.4,-0.4,0.0,0.0,0.0,0.0,0.0,0.0,-0.3,0.5,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.3,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,-0.7,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.6,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,-0.5,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.8,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
     0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,-0.6,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,
  ]);

  const B1 = new Float32Array([-0.1,0.2,-0.5,0.3,0.5,-0.4,0.0,0.0,-0.8,0.2,0.0,0.1,0.0,0.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);

  const W2 = new Float32Array(32 * 16);
  const B2 = new Float32Array(16);

  const W3 = new Float32Array(16 * 3);
  const B3 = new Float32Array(3);

  // Seed the weights (matching generate_heuristic_weights seed=42)
  let s = 42;
  function rand(): number {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  }
  for (let i = 0; i < 32 * 16; i++) W2[i] = rand() * 0.25;
  for (let i = 0; i < 16 * 3; i++) W3[i] = rand() * 0.3;

  // Set W3 key weights
  function w3(r: number, c: number): number { return r * 3 + c; }
  W3[w3(0,0)] = 0.9; W3[w3(1,0)] = 0.7; W3[w3(4,0)] = 0.8;
  W3[w3(2,0)] = 0.5; W3[w3(10,0)] = 0.4; B3[0] = -0.3;
  W3[w3(6,1)] = 0.5; W3[w3(7,1)] = 0.5; W3[w3(12,1)] = 0.4;
  W3[w3(11,1)] = 0.3; B3[1] = 0.4;
  W3[w3(5,2)] = 0.9; W3[w3(3,2)] = 0.7; W3[w3(8,2)] = 0.8;
  W3[w3(9,2)] = 0.5; W3[w3(13,2)] = 0.4; B3[2] = -0.2;

  // Layer 1: input(10) -> hidden(32)
  const h1 = new Float32Array(32);
  for (let j = 0; j < 32; j++) {
    let sum = B1[j];
    for (let i = 0; i < 10; i++) {
      sum += input[i] * W1[i * 32 + j];
    }
    h1[j] = relu(sum);
  }

  // Layer 2: hidden(32) -> hidden(16)
  const h2 = new Float32Array(16);
  for (let j = 0; j < 16; j++) {
    let sum = B2[j];
    for (let i = 0; i < 32; i++) {
      sum += h1[i] * W2[i * 16 + j];
    }
    h2[j] = relu(sum);
  }

  // Layer 3: hidden(16) -> output(3)
  const out = new Float32Array(3);
  for (let j = 0; j < 3; j++) {
    let sum = B3[j];
    for (let i = 0; i < 16; i++) {
      sum += h2[i] * W3[i * 3 + j];
    }
    out[j] = sum;
  }

  return softmax(out);
}

/**
 * Run ML inference on stock features.
 * Tries LiteRT.js first, falls back to pure-JS forward pass.
 */
export async function predictML(features: StockFeatures): Promise<MLResult> {
  const normalized = normalizeFeatures(features);

  // Try LiteRT.js
  const ready = await initLiteRt();
  if (ready && compiledModel) {
    try {
      const { Tensor } = await import('@litertjs/core');
      const inputTensor = new Tensor(normalized, [1, 10]);
      const outputs = await compiledModel.run([inputTensor]);
      const outputData = await outputs[0].toTypedArray();

      const probs: [number, number, number] = [outputData[0], outputData[1], outputData[2]];
      const maxIdx = probs[0] >= probs[1] && probs[0] >= probs[2] ? 0 : probs[1] >= probs[2] ? 1 : 2;

      return {
        signal: LABELS[maxIdx],
        confidence: probs[maxIdx],
        probabilities: probs,
        method: 'litert',
      };
    } catch (err) {
      console.warn('[ML Classifier] LiteRT inference failed, using fallback:', err);
    }
  }

  // Fallback: pure JS forward pass (same weights as the .tflite model)
  const probs = fallbackForwardPass(normalized);
  const maxIdx = probs[0] >= probs[1] && probs[0] >= probs[2] ? 0 : probs[1] >= probs[2] ? 1 : 2;

  return {
    signal: LABELS[maxIdx],
    confidence: probs[maxIdx],
    probabilities: probs,
    method: 'fallback',
  };
}

/**
 * Compute StockFeatures from the raw signal API data.
 */
export function extractFeatures(data: {
  components: Record<string, number>;
  details?: {
    marketCap?: number;
    peRatio?: number;
    rsi?: number;
    fcf?: number;
  };
}): StockFeatures {
  const c = data.components;
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
