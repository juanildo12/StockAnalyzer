import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getMassiveCapabilities,
  getMassiveKey,
  getMassiveNews,
  getOptionsChainSnapshot,
  getQuotesBatch,
  getTopMovers,
  hasMassive,
  normalizeMassiveNews,
} from './massiveClient';

const KEYS = ['MASSIVE_API_KEY', 'POLYGON_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k] as string;
  }
});

describe('getMassiveKey / hasMassive', () => {
  it('sin keys → null', () => {
    expect(getMassiveKey()).toBeNull();
    expect(hasMassive()).toBe(false);
  });

  it('prefiere MASSIVE_API_KEY', () => {
    process.env.MASSIVE_API_KEY = 'massive';
    process.env.POLYGON_API_KEY = 'polygon';
    expect(getMassiveKey()).toBe('massive');
  });

  it('usa POLYGON_API_KEY como fallback', () => {
    process.env.POLYGON_API_KEY = 'polygon';
    expect(getMassiveKey()).toBe('polygon');
  });
});

describe('normalizeMassiveNews', () => {
  it('mapea al shape legacy (Finnhub-like)', () => {
    const n = normalizeMassiveNews({
      id: 'abc',
      title: 'ACME beats earnings',
      description: 'Strong quarter with record revenue and upbeat guidance for next year.',
      publisher: { name: 'Benzinga' },
      published_utc: '2026-10-13T12:00:00Z',
      article_url: 'https://example.com/a',
      tickers: ['ACME'],
      insights: [{ ticker: 'ACME', sentiment: 'positive', sentiment_reasoning: 'Beat' }],
    });
    expect(n.headline).toBe('ACME beats earnings');
    expect(n.source).toBe('Benzinga');
    expect(n.url).toBe('https://example.com/a');
    expect(n.related).toBe('ACME');
    expect(n.sentiment).toBe('positive');
    expect(n.datetime).toBe(Math.floor(new Date('2026-10-13T12:00:00Z').getTime() / 1000));
  });

  it('sobrevive a datos faltantes', () => {
    const n = normalizeMassiveNews({});
    expect(n.headline).toBe('');
    expect(n.summary).toBe('');
    expect(typeof n.datetime).toBe('number');
  });
});

describe('paid snapshot endpoints degrade to null without key', () => {
  it('options chain → null', async () => {
    expect(await getOptionsChainSnapshot('AAPL')).toBeNull();
  });

  it('quotes batch → null (input no vacío)', async () => {
    expect(await getQuotesBatch(['AAPL', 'MSFT'])).toBeNull();
  });

  it('quotes batch con input vacío → []', async () => {
    expect(await getQuotesBatch([])).toEqual([]);
  });

  it('top movers → null', async () => {
    expect(await getTopMovers('gainers')).toBeNull();
  });

  it('news → [] sin key', async () => {
    expect(await getMassiveNews({ limit: 5 })).toEqual([]);
  });
});

describe('getMassiveCapabilities', () => {
  it('sin key → no configurado y sin snapshots', async () => {
    const caps = await getMassiveCapabilities(true);
    expect(caps.configured).toBe(false);
    expect(caps.snapshots).toBe(false);
    expect(caps.optionsSnapshot).toBe(false);
  });
});
