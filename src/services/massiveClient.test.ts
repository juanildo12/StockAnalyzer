import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getMassiveCapabilities,
  getMassiveKey,
  getMassiveNews,
  getOptionsChainSnapshot,
  getQuotesBatch,
  getTopMovers,
  hasMassive,
  normalizeDividend,
  normalizeFloat,
  normalizeIndicatorValues,
  normalizeIPO,
  normalizeMassiveNews,
  normalizeShortInterest,
  normalizeSplit,
  normalizeTickerDetails,
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

describe('normalizeIndicatorValues', () => {
  it('mapea values[] y parsea números', () => {
    const points = normalizeIndicatorValues([
      { timestamp: 1700000000000, value: 12.5 },
      { timestamp: 1700086400000, value: '13.2', signal: 12.1, histogram: 1.1 },
    ]);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ timestamp: 1700000000000, value: 12.5 });
    expect(points[1].value).toBe(13.2);
    expect(points[1].signal).toBe(12.1);
    expect(points[1].histogram).toBe(1.1);
  });

  it('tolera entradas no-array / basura', () => {
    expect(normalizeIndicatorValues(undefined)).toEqual([]);
    expect(normalizeIndicatorValues([null, 'x'])).toEqual([]);
  });
});

describe('normalizeShortInterest', () => {
  it('mapea snake_case y calcula tipos', () => {
    const s = normalizeShortInterest({
      ticker: 'GME',
      settlement_date: '2026-09-30',
      short_interest: 30000000,
      avg_daily_volume: 5000000,
      days_to_cover: 6,
    });
    expect(s).toEqual({
      ticker: 'GME',
      settlementDate: '2026-09-30',
      shortInterest: 30000000,
      avgDailyVolume: 5000000,
      daysToCover: 6,
    });
  });

  it('fila vacía → null', () => {
    expect(normalizeShortInterest(null)).toBeNull();
    expect(normalizeShortInterest(undefined)).toBeNull();
  });
});

describe('normalizeFloat / normalizeTickerDetails / normalizeIPO', () => {
  it('float', () => {
    expect(normalizeFloat({ ticker: 'X', free_float: 100, free_float_percent: 42.5, effective_date: '2026-01-01' }))
      .toEqual({ ticker: 'X', freeFloat: 100, freeFloatPercent: 42.5, effectiveDate: '2026-01-01' });
    expect(normalizeFloat(null)).toBeNull();
  });

  it('ticker details con branding', () => {
    const d = normalizeTickerDetails({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      market_cap: 3e12,
      sic_description: 'Electronic Computers',
      description: 'desc',
      homepage_url: 'https://apple.com',
      list_date: '1980-12-12',
      primary_exchange: 'XNAS',
      branding: { logo_url: 'https://logo', icon_url: 'https://icon' },
    });
    expect(d?.ticker).toBe('AAPL');
    expect(d?.logoUrl).toBe('https://logo');
    expect(d?.sicDescription).toBe('Electronic Computers');
  });

  it('ipo', () => {
    const i = normalizeIPO({
      ticker: 'RAPP',
      issuer_name: 'Rapport Therapeutics Inc.',
      listing_date: '2024-06-07',
      ipo_status: 'history',
      final_issue_price: 17,
      primary_exchange: 'XNAS',
    });
    expect(i?.ticker).toBe('RAPP');
    expect(i?.finalIssuePrice).toBe(17);
    expect(i?.highestOfferPrice).toBeNull();
  });
});

describe('normalizeDividend / normalizeSplit', () => {
  it('dividend', () => {
    const d = normalizeDividend({
      ticker: 'KO',
      cash_amount: 0.485,
      currency: 'USD',
      ex_dividend_date: '2026-09-14',
      pay_date: '2026-10-01',
      declaration_date: '2026-07-16',
      frequency: 4,
      distribution_type: 'recurring',
    });
    expect(d?.cashAmount).toBe(0.485);
    expect(d?.frequency).toBe(4);
  });

  it('split', () => {
    const s = normalizeSplit({ ticker: 'NVDA', execution_date: '2024-06-10', split_from: 1, split_to: 10, adjustment_type: 'forward_split' });
    expect(s?.splitTo).toBe(10);
    expect(s?.adjustmentType).toBe('forward_split');
  });
});
