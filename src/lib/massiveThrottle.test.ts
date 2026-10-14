import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  THROTTLE_WINDOW_MS,
  acquireMassiveSlot,
  getMassiveRateLimit,
  nextSlotDelay,
  resetMassiveThrottle,
  tryAcquireMassiveSlot,
} from './massiveThrottle';

const ORIGINAL = process.env.MASSIVE_REQUESTS_PER_MINUTE;

beforeEach(() => {
  resetMassiveThrottle();
  process.env.MASSIVE_REQUESTS_PER_MINUTE = '5';
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MASSIVE_REQUESTS_PER_MINUTE;
  else process.env.MASSIVE_REQUESTS_PER_MINUTE = ORIGINAL;
});

describe('getMassiveRateLimit', () => {
  it('usa 5 por defecto (free tier)', () => {
    delete process.env.MASSIVE_REQUESTS_PER_MINUTE;
    expect(getMassiveRateLimit()).toBe(5);
  });

  it('respeta la env', () => {
    process.env.MASSIVE_REQUESTS_PER_MINUTE = '500';
    expect(getMassiveRateLimit()).toBe(500);
  });

  it('ignora valores inválidos', () => {
    process.env.MASSIVE_REQUESTS_PER_MINUTE = '-3';
    expect(getMassiveRateLimit()).toBe(5);
  });
});

describe('nextSlotDelay', () => {
  const now = 1_000_000;

  it('sin historial → sin espera', () => {
    expect(nextSlotDelay([], 5, now)).toBe(0);
  });

  it('por debajo del límite → sin espera', () => {
    expect(nextSlotDelay([now - 1000, now - 2000], 5, now)).toBe(0);
  });

  it('en el límite → espera hasta que el más viejo salga de la ventana', () => {
    const stamps = [now - 3000, now - 2000, now - 1500, now - 1000, now - 500];
    const delay = nextSlotDelay(stamps, 5, now);
    expect(delay).toBe(THROTTLE_WINDOW_MS - 3000 + 1);
  });

  it('ignora requests fuera de la ventana', () => {
    const stale = [now - THROTTLE_WINDOW_MS - 10];
    expect(nextSlotDelay(stale, 1, now)).toBe(0);
  });

  it('limit <= 0 espera una ventana completa', () => {
    expect(nextSlotDelay([], 0, now)).toBe(THROTTLE_WINDOW_MS);
  });
});

describe('acquireMassiveSlot', () => {
  it('adquiere el primer slot al instante', async () => {
    expect(await acquireMassiveSlot(100)).toBe(true);
  });

  it('devuelve false cuando la espera excede maxWaitMs', async () => {
    process.env.MASSIVE_REQUESTS_PER_MINUTE = '1';
    expect(await acquireMassiveSlot(100)).toBe(true);
    expect(await acquireMassiveSlot(50)).toBe(false);
  });
});

describe('tryAcquireMassiveSlot', () => {
  it('es no bloqueante y respeta el límite', () => {
    process.env.MASSIVE_REQUESTS_PER_MINUTE = '1';
    expect(tryAcquireMassiveSlot()).toBe(true);
    expect(tryAcquireMassiveSlot()).toBe(false);
  });
});
