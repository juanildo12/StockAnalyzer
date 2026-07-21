'use client';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import { CSSProperties, useEffect, useState } from 'react';

interface ScoreBarProps {
  score: number;
  maxScore?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  animate?: boolean;
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
  animate = true,
  style,
}: ScoreBarProps) {
  const color = getScoreColor(score, maxScore);
  const pct = Math.min(100, (score / maxScore) * 100);
  const barHeight = size === 'sm' ? 4 : 6;
  const [mounted, setMounted] = useState(!animate);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => {
        setMounted(true);
        if (showValue) {
          const duration = 600;
          const startTime = performance.now();
          const animateCount = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayScore(Math.round(eased * score));
            if (progress < 1) requestAnimationFrame(animateCount);
          };
          requestAnimationFrame(animateCount);
        }
      }, 50);
      return () => clearTimeout(t);
    } else {
      setDisplayScore(score);
    }
  }, [animate, score, showValue]);

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
          width: mounted ? `${pct}%` : '0%',
          height: '100%',
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          borderRadius: R.full,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
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
          transition: 'color 0.3s ease',
        }}>{displayScore}</span>
      )}
    </div>
  );
}
