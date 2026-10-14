// Outbound throttle for the Massive (ex-Polygon) REST API.
//
// The free tier allows ~5 requests/minute, so a per-instance sliding-window
// limiter keeps us under quota and lets callers fall back to Yahoo/Finnhub
// instead of hammering the provider (which would return 429s).
//
// On paid plans set MASSIVE_REQUESTS_PER_MINUTE to a high value (e.g. 500) to
// effectively disable the throttle.

export const THROTTLE_WINDOW_MS = 60_000;
const DEFAULT_FREE_LIMIT = 5;

export function getMassiveRateLimit(): number {
  const raw = Number(process.env.MASSIVE_REQUESTS_PER_MINUTE);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_FREE_LIMIT;
}

/**
 * Milliseconds to wait before a new request fits inside the sliding window.
 * Pure helper (unit-tested): `timestamps` are the last request times (ms).
 */
export function nextSlotDelay(
  timestamps: number[],
  limit: number,
  now: number,
  windowMs: number = THROTTLE_WINDOW_MS
): number {
  if (limit <= 0) return windowMs;
  const recent = timestamps.filter((t) => now - t < windowMs).sort((a, b) => a - b);
  if (recent.length < limit) return 0;
  const oldestOfWindow = recent[recent.length - limit];
  return Math.max(0, oldestOfWindow + windowMs - now + 1);
}

const stamps: number[] = [];
let queue: Promise<unknown> = Promise.resolve();

export class MassiveThrottledError extends Error {
  constructor(message = 'Massive throttle: no slot available in time') {
    super(message);
    this.name = 'MassiveThrottledError';
  }
}

/**
 * Wait for a free slot (up to `maxWaitMs`). Returns true when a slot was
 * acquired, false when the caller should skip/fall back.
 */
export async function acquireMassiveSlot(maxWaitMs = 15_000): Promise<boolean> {
  const limit = getMassiveRateLimit();
  const run = queue.then(async () => {
    const now = Date.now();
    const delay = nextSlotDelay(stamps, limit, now);
    if (delay > 0) {
      if (delay > maxWaitMs) return false;
      await new Promise((r) => setTimeout(r, delay));
    }
    stamps.push(Date.now());
    return true;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Non-blocking variant: true only if a slot is available right now. */
export function tryAcquireMassiveSlot(): boolean {
  const limit = getMassiveRateLimit();
  const now = Date.now();
  if (nextSlotDelay(stamps, limit, now) > 0) return false;
  stamps.push(now);
  return true;
}

/** Test helper: clears recorded request timestamps. */
export function resetMassiveThrottle(): void {
  stamps.length = 0;
}
