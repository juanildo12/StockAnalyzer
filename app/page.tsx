'use client';

import { useState } from 'react';

export default function Home() {
  const [symbol, setSymbol] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchStock = async () => {
    if (!symbol.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const sym = symbol.toUpperCase();
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Error fetching data');
      }

      const json = await res.json();
      const result = json?.chart?.result?.[0];

      if (!result) {
        throw new Error('Symbol not found');
      }

      const meta = result.meta || {};

      setData({
        quote: {
          symbol: meta.symbol || sym,
          shortName: meta.shortName || sym,
          longName: meta.longName || sym,
          regularMarketPrice: meta.regularMarketPrice || 0,
          regularMarketChange: meta.regularMarketChange || 0,
          regularMarketChangePercent: meta.regularMarketChangePercent || 0,
          regularMarketDayHigh: meta.regularMarketDayHigh || 0,
          regularMarketDayLow: meta.regularMarketDayLow || 0,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
        },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const quote = data?.quote;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d1117',
        color: '#c9d1d9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', color: '#58a6ff' }}>
          📈 Stock Analyzer
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: '#8b949e',
            marginBottom: '24px',
          }}
        >
          Analiza acciones de EE.UU.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            placeholder="Ej: AAPL, MSFT, GOOGL..."
            onKeyDown={e => {
              if (e.key === 'Enter') searchStock();
            }}
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: '8px',
              border: '1px solid #30363d',
              background: '#161b22',
              color: '#c9d1d9',
              fontSize: '16px',
              outline: 'none',
            }}
          />
          <button
            onClick={searchStock}
            disabled={loading}
            style={{
              padding: '14px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#238636',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '...' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#f8514920',
              color: '#f85149',
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {quote && (
          <div
            style={{
              background: '#161b22',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, color: '#f0f6fc' }}>{quote.symbol}</h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    color: '#8b949e',
                    fontSize: '14px',
                  }}
                >
                  {quote.shortName || quote.longName || quote.symbol}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#f0f6fc',
                  }}
                >
                  ${quote.regularMarketPrice?.toFixed(2)}
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    color:
                      quote.regularMarketChangePercent >= 0
                        ? '#3fb950'
                        : '#f85149',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {quote.regularMarketChangePercent >= 0 ? '+' : ''}
                  {quote.regularMarketChangePercent?.toFixed(2)}%
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <div
                style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  Market Cap
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#f0f6fc',
                  }}
                >
                  {quote.marketCap
                    ? `$${(quote.marketCap / 1e9).toFixed(1)}B`
                    : 'N/A'}
                </p>
              </div>
              <div
                style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  P/E Ratio
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#f0f6fc',
                  }}
                >
                  {quote.peRatio ? quote.peRatio.toFixed(2) : 'N/A'}
                </p>
              </div>
              <div
                style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  52W High
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#f0f6fc',
                  }}
                >
                  ${quote.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div
                style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  52W Low
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#f0f6fc',
                  }}
                >
                  ${quote.fiftyTwoWeekLow?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div
                style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  Volume
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#f0f6fc',
                  }}
                >
                  {quote.regularMarketVolume
                    ? `${(quote.regularMarketVolume / 1e6).toFixed(1)}M`
                    : 'N/A'}
                </p>
              </div>
              <div
                style={{
                  background: '#0d1117',
                  padding: '12px',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  Target Price
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#58a6ff',
                  }}
                >
                  ${quote.targetMeanPrice?.toFixed(2) || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!data && !loading && !error && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#8b949e',
            }}
          >
            <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📈</p>
            <p>Ingresa un ticker para analizar</p>
          </div>
        )}
      </div>
    </div>
  );
}
