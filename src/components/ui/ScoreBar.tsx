'use client';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import { CSSProperties } from 'react';

interface ScoreBarProps {
  score: number;
  maxScore?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

function getScoreColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 80) return C.positive;
  if (pct >= 60) return C.warning;
  if (pct >= 40) return C.info;
  return C.textMuted;
}

export default function ScoreBar({
  score,
  maxScore = 100,
  label,
  showValue = true,
  size = 'sm',
  style,
}: ScoreBarProps) {
  const color = getScoreColor(score, maxScore);
  const pct = Math.min(100, (score / maxScore) * 100);
  const barHeight = size === 'sm' ? 4 : 6;

  const container: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: S.sm,
    width: '100%',
    ...style,
  };

  return (
    <div style={container}>
      {label && (
        <span style={{
          fontSize: size === 'sm' ? F.sizeXs : F.sizeSm,
          color: C.textMuted,
          minWidth: label.length > 8 ? 60 : 40,
          flexShrink: 0,
        }}>{label}</span>
      )}
      <div style={{
        flex: 1,
        height: barHeight,
        borderRadius: R.full,
        background: C.bgElevated,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: R.full,
          transition: 'width 0.5s ease-out',
        }} />
      </div>
      {showValue && (
        <span style={{
          fontSize: size === 'sm' ? F.sizeXs : F.sizeSm,
          fontWeight: 700,
          color,
          fontFamily: F.mono,
          minWidth: 24,
          textAlign: 'right',
        }}>{score}</span>
      )}
    </div>
  );
}
