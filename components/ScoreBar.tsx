'use client';

interface ScoreBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: string;
  barWidth?: number;
}

const DEFAULT_COLOR = '#B64DFF';

function barColor(v: number): string {
  if (v >= 80) return '#1FD18A';
  if (v >= 50) return '#F59E0B';
  return '#EF4444';
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
      gap: '6px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {label && (
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: '#9A9A9A',
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
              background: filled ? c : '#2A2A2A',
              transition: 'background 200ms',
            }}
          />
        ))}
      </div>
      {showValue && (
        <span style={{
          fontSize: '11px',
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
