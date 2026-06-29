'use client';

import { useState, useEffect } from 'react';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

interface EarningsEvent {
  symbol: string;
  date: string;
  hour: string;
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
}

interface CalendarData {
  earnings: EarningsEvent[];
  ipo: any[];
  economic: any[];
}

export default function EarningsCalendarPanel() {
  const [data, setData] = useState<CalendarData | null>(null);

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const upcoming = data.earnings.filter((e: any) => new Date(e.date) >= new Date()).slice(0, 15);
  const thisWeek = data.earnings.filter((e: any) => {
    const d = new Date(e.date);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return d >= weekStart && d <= weekEnd;
  });

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden',
    }}>
      <div style={{
        background: C.gradientHero, padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: F.sizeLg, fontWeight: 600, background: C.gradientPrimary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          📅 Earnings Calendar
        </span>
      </div>

      {thisWeek.length > 0 && (
        <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.accent, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            This Week
          </div>
          {thisWeek.map((e: any, i: number) => (
            <EarningsRow key={i} event={e} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.accent, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Upcoming
          </div>
          {upcoming.map((e: any, i: number) => (
            <EarningsRow key={i} event={e} />
          ))}
        </div>
      )}

      {data.economic.length > 0 && (
        <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.accent, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Economic Events
          </div>
          {data.economic.slice(0, 5).map((e: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '4px 0',
              fontSize: F.sizeXs, borderBottom: i < 4 ? `1px solid ${C.divider}` : 'none',
            }}>
              <span style={{ color: C.textSecondary }}>{e.event || e.title || '—'}</span>
              <span style={{ color: C.textMuted }}>{e.date || e.time || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EarningsRow({ event }: { event: EarningsEvent }) {
  const epsBeat = event.epsActual != null && event.epsEstimate != null
    ? event.epsActual > event.epsEstimate : null;
  const date = new Date(event.date);
  const dayStr = date.toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 4px', fontSize: F.sizeSm,
      borderBottom: `1px solid ${C.divider}`,
    }}>
      <div>
        <span style={{ fontWeight: 600, color: C.textPrimary }}>{event.symbol}</span>
        <span style={{ color: C.textMuted, marginLeft: 8, fontSize: F.sizeXs }}>
          {dayStr} {event.hour === 'amc' ? '🌙' : '☀️'}
        </span>
      </div>
      <div style={{ textAlign: 'right', fontSize: F.sizeXs }}>
        {event.epsEstimate != null && (
          <span style={{ color: C.textSecondary }}>Est: ${event.epsEstimate.toFixed(2)}</span>
        )}
        {epsBeat != null && (
          <span style={{ marginLeft: 6, color: epsBeat ? C.positive : C.negative }}>
            {epsBeat ? '▲' : '▼'}
          </span>
        )}
      </div>
    </div>
  );
}
