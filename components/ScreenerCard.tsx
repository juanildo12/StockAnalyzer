'use client';

import { useState } from 'react';
import FormulaChip from './FormulaChip';
import ScoreBar from './ScoreBar';

interface RankingRow {
  symbol: string;
  scores: Record<string, number>;
  total: number;
}

interface ScreenerCardProps {
  icon: string;
  name: string;
  description: string;
  updatedAt: string;
  formulas: string[];
  rankings: RankingRow[];
}

const DARK = {
  card: '#1B1B1B',
  text: '#FFFFFF',
  muted: '#9A9A9A',
  divider: '#343434',
  primary: '#B64DFF',
};

function totalBadgeColor(total: number): string {
  if (total >= 220) return '#1FD18A';
  if (total >= 160) return '#F59E0B';
  return '#EF4444';
}

const formulaColors = ['#B64DFF', '#1FD18A', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4'];

export default function ScreenerCard({ icon, name, description, updatedAt, formulas, rankings }: ScreenerCardProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div style={{
      background: DARK.card,
      borderRadius: '20px',
      padding: '28px',
      border: '1px solid #2A2A2A',
      fontFamily: 'Inter, system-ui, sans-serif',
      animation: 'fadeIn 400ms ease-out',
    }}>
      {/* Header row: icon + info */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: `${DARK.primary}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: DARK.muted, fontSize: '12px', fontWeight: 500, marginBottom: '2px' }}>
            {updatedAt}
          </div>
          <h3 style={{
            margin: 0,
            color: DARK.text,
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}>
            {name}
          </h3>
          <p style={{
            margin: '6px 0 0',
            color: DARK.muted,
            fontSize: '13px',
            lineHeight: 1.5,
            maxWidth: '500px',
          }}>
            {description}
          </p>
        </div>
      </div>

      {/* Formula chips */}
      {formulas.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: DARK.muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Formula
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {formulas.map((f, i) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && <span style={{ color: DARK.muted, fontSize: '14px', fontWeight: 300 }}>+</span>}
                <FormulaChip label={f} color={formulaColors[i % formulaColors.length]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: '1px', background: DARK.divider, marginBottom: '16px' }} />

      {/* Rankings table */}
      {rankings.length > 0 ? (
        <div style={{
          overflowY: 'auto',
          maxHeight: '400px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: DARK.muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ textAlign: 'left', padding: '8px 8px 8px 0', position: 'sticky', top: 0, background: DARK.card, zIndex: 1 }}>Stock</th>
                {formulas.map(f => (
                  <th key={f} style={{ textAlign: 'right', padding: '8px 8px', position: 'sticky', top: 0, background: DARK.card, zIndex: 1 }}>{f}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '8px 0 8px 8px', position: 'sticky', top: 0, background: DARK.card, zIndex: 1 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row, idx) => (
                <tr
                  key={row.symbol}
                  onMouseEnter={() => setHoveredRow(row.symbol)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderBottom: idx < rankings.length - 1 ? `1px solid ${DARK.divider}` : 'none',
                    transition: 'background 150ms, transform 100ms',
                    background: hoveredRow === row.symbol ? '#252525' : 'transparent',
                    cursor: 'pointer',
                    transform: hoveredRow === row.symbol ? 'scale(1)' : 'scale(1)',
                  }}
                  onPointerDown={(e) => {
                    const target = e.currentTarget;
                    target.style.transform = 'scale(0.98)';
                    setTimeout(() => { target.style.transform = 'scale(1)'; }, 100);
                  }}
                >
                  <td style={{ padding: '10px 8px 10px 0' }}>
                    <span style={{
                      color: DARK.primary,
                      fontWeight: 700,
                      fontSize: '14px',
                    }}>
                      {row.symbol}
                    </span>
                  </td>
                  {formulas.map(f => (
                    <td key={f} style={{ padding: '10px 8px' }}>
                      <ScoreBar
                        value={row.scores[f] || 0}
                        label=""
                        barWidth={80}
                        showValue={false}
                      />
                    </td>
                  ))}
                  <td style={{
                    padding: '10px 0 10px 8px',
                    textAlign: 'right',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      background: `${totalBadgeColor(row.total)}20`,
                      color: totalBadgeColor(row.total),
                      fontWeight: 700,
                      fontSize: '14px',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      minWidth: '52px',
                      textAlign: 'center',
                    }}>
                      {row.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: DARK.muted, fontSize: '13px', textAlign: 'center', padding: '24px' }}>
          No data available
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
