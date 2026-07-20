'use client';

import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface ScoreBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: string;
  barWidth?: number;
}

const DEFAULT_COLOR = C.accent;

function barColor(v: number): string {
  if (v >= 80) return C.positive;
  if (v >= 50) return C.warning;
  return C.negative;
}

function barBlocks(value: number, totalBlocks = 5): boolean[] {
  const filled = Math.round((value / 100) * totalBlocks);
  return Array.from({ length: totalBlocks }, (_, i) => i < filled);
}

export default function ScoreBar({ value, label, showValue = true, color, barWidth = 120 }: ScoreBarProps) {
  const blocks = barBlocks(value);
  const c = color || barColor(value);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: S.sm,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {label && (
        <span style={{
          fontSize: F.sizeXs,
          fontWeight: 500,
          color: C.textMuted,
          whiteSpace: 'nowrap',
          minWidth: '70px',
        }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: '3px' }}>
        {blocks.map((filled, i) => (
          <span
            key={i}
            style={{
              width: '14px',
              height: '8px',
              borderRadius: '2px',
              background: filled ? c : C.border,
              transition: 'background 200ms',
            }}
          />
        ))}
      </div>
      {showValue && (
        <span style={{
          fontSize: F.sizeXs,
          fontWeight: 700,
          color: c,
          minWidth: '20px',
        }}>
          {value}
        </span>
      )}
    </div>
  );
}
