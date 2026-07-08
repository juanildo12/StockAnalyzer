'use client';

import { useState, useEffect } from 'react';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

interface MarketMover {
  ticker: string;
  day: { o: number; h: number; l: number; c: number; v: number };
  todaysChange: number;
  todaysChangePerc: number;
}

interface MarketData {
  gainers: MarketMover[];
  losers: MarketMover[];
  marketStatus: { market: string; serverTime: string; exchanges: Record<string, string> } | null;
  news: any[];
  economicCalendar: any[];
}

export default function MarketOverviewPanel({ onStockClick }: { onStockClick?: (symbol: string) => void }) {
  const [data, setData] = useState<MarketData | null>(null);

  useEffect(() => {
    fetch('/api/market')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const marketOpen = data.marketStatus?.market === 'open';

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: C.gradientHero, padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: F.sizeLg, fontWeight: 600, background: C.gradientPrimary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Market Overview
        </span>
        <span style={{
          fontSize: F.sizeXs, padding: '4px 10px', borderRadius: R.full,
          background: marketOpen ? C.positiveBg : C.negativeBg,
          color: marketOpen ? C.positive : C.negative,
          fontWeight: 600,
        }}>
          {marketOpen ? '● Open' : '● Closed'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
        {/* Gainers */}
        <div style={{ padding: 12, borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.positive, marginBottom: 8 }}>
            ▲ Top Gainers
          </div>
          {data.gainers.slice(0, 5).map(m => (
            <MoverRow key={m.ticker} mover={m} onClick={onStockClick} />
          ))}
        </div>

        {/* Losers */}
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.negative, marginBottom: 8 }}>
            ▼ Top Losers
          </div>
          {data.losers.slice(0, 5).map(m => (
            <MoverRow key={m.ticker} mover={m} onClick={onStockClick} />
          ))}
        </div>
      </div>

      {/* News */}
      {data.news.length > 0 && (
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>
            📰 Latest News
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.news.slice(0, 4).map((n, i) => (
              <a key={i} href={n.article_url || n.url} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: F.sizeXs, color: C.textSecondary, textDecoration: 'none',
                  padding: '4px 0', borderBottom: i < 3 ? `1px solid ${C.divider}` : 'none',
                  lineHeight: 1.4,
                }}>
                {n.title || n.headline}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Economic Calendar */}
      {data.economicCalendar.length > 0 && (
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>
            📅 Economic Calendar
          </div>
          {data.economicCalendar.slice(0, 4).map((e: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 0', fontSize: F.sizeXs, color: C.textMuted,
            }}>
              <span>{e.event || e.title || '—'}</span>
              <span style={{ color: C.textSecondary }}>{e.time || e.date || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoverRow({ mover, onClick }: { mover: MarketMover; onClick?: (s: string) => void }) {
  const change = mover.todaysChangePerc;
  const isPositive = change >= 0;
  return (
    <div
      onClick={() => onClick?.(mover.ticker)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 4px', cursor: onClick ? 'pointer' : 'default',
        borderRadius: R.sm, ...(onClick ? { ':hover': { background: C.bgCardHover } } : {}),
      }}>
      <span style={{ fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary }}>{mover.ticker}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: F.sizeXs, color: isPositive ? C.positive : C.negative, fontWeight: 500 }}>
          {isPositive ? '+' : ''}{change?.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
