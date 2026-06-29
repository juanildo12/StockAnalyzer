'use client';

import { useState, useEffect } from 'react';
import ScreenerCard from './ScreenerCard';

interface RankingRow {
  symbol: string;
  scores: Record<string, number>;
  total: number;
}

interface ScreenerData {
  id: string;
  name: string;
  icon: string;
  description: string;
  updatedAt: string;
  formulas: string[];
  rankings: RankingRow[];
}

interface RankingsResponse {
  lastUpdated: string;
  screeners: ScreenerData[];
}

const DARK = {
  bg: '#0B0B0B',
  card: '#1B1B1B',
  text: '#FFFFFF',
  muted: '#9A9A9A',
  primary: '#B64DFF',
  divider: '#343434',
};

const SCREENER_IDS = [
  'small-mid-rotation',
  'momentum',
  'swing',
  'breakout',
  'dark-pool',
  'gamma-squeeze',
  'bull-trades',
];

export default function ScreenerRankingsPanel() {
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(3);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/screener/rankings')
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (error) {
    return (
      <div style={{
        background: DARK.card,
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center',
        border: '1px solid #2A2A2A',
      }}>
        <div style={{ color: '#EF4444', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data || data.screeners.length === 0) {
    return (
      <div style={{
        background: DARK.card,
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center',
        border: '1px solid #2A2A2A',
      }}>
        <div style={{ color: DARK.muted, fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
          No screener data available
        </div>
      </div>
    );
  }

  const sortedScreeners = SCREENER_IDS
    .map(id => data.screeners.find(s => s.id === id))
    .filter(Boolean) as ScreenerData[];

  const showMore = sortedScreeners.length > visible;

  return (
    <div style={{
      background: DARK.bg,
      borderRadius: '24px',
      padding: '32px',
      border: '1px solid #1F1F1F',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '28px',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            color: DARK.text,
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.02em',
          }}>
            Screener
          </h2>
          <p style={{
            margin: '4px 0 0',
            color: DARK.muted,
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {data.lastUpdated ? `Last updated: ${data.lastUpdated}` : ''}
          </p>
        </div>
        {showMore && (
          <button
            onClick={() => setVisible(prev => Math.min(prev + 3, sortedScreeners.length))}
            style={{
              background: 'transparent',
              border: `1px solid ${DARK.divider}`,
              borderRadius: '10px',
              padding: '8px 16px',
              color: DARK.primary,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Show more
          </button>
        )}
      </div>

      {/* Cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px',
      }}>
        {sortedScreeners.slice(0, visible).map((s, i) => (
          <div key={s.id} style={{ animation: `fadeIn 400ms ${i * 80}ms ease-out both` }}>
            <ScreenerCard
              icon={s.icon}
              name={s.name}
              description={s.description}
              updatedAt={s.updatedAt}
              formulas={s.formulas}
              rankings={s.rankings}
            />
          </div>
        ))}
      </div>

      {showMore && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => setVisible(sortedScreeners.length)}
            style={{
              background: 'transparent',
              border: `1px solid ${DARK.divider}`,
              borderRadius: '10px',
              padding: '10px 24px',
              color: DARK.muted,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            View all {sortedScreeners.length} screeners
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{
      background: '#0B0B0B',
      borderRadius: '24px',
      padding: '32px',
      border: '1px solid #1F1F1F',
    }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          width: '140px',
          height: '28px',
          background: '#1B1B1B',
          borderRadius: '6px',
          marginBottom: '6px',
        }} />
        <div style={{
          width: '200px',
          height: '14px',
          background: '#1B1B1B',
          borderRadius: '6px',
        }} />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px',
      }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: '#1B1B1B',
            borderRadius: '20px',
            padding: '28px',
            height: '320px',
          }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#252525',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  width: '100px',
                  height: '12px',
                  background: '#252525',
                  borderRadius: '6px',
                  marginBottom: '8px',
                }} />
                <div style={{
                  width: '180px',
                  height: '18px',
                  background: '#252525',
                  borderRadius: '6px',
                  marginBottom: '6px',
                }} />
                <div style={{
                  width: '280px',
                  height: '12px',
                  background: '#252525',
                  borderRadius: '6px',
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
