'use client';
import { colors as C, radius as R, font as F, spacing as S, transition as T } from '@/src/utils/webTheme';
import { CSSProperties, ReactNode } from 'react';

type Variant = 'positive' | 'negative' | 'warning' | 'info' | 'accent' | 'neutral';

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<Variant, { bg: string; border: string; color: string }> = {
  positive: { bg: C.positiveBg, border: C.positiveBorder, color: C.positive },
  negative: { bg: C.negativeBg, border: C.negativeBorder, color: C.negative },
  warning: { bg: C.warningBg, border: C.warningBorder, color: C.warning },
  info: { bg: C.infoBg, border: C.infoBorder, color: C.info },
  accent: { bg: C.accentGlow, border: C.accentBorder, color: C.accentLight },
  neutral: { bg: C.bgElevated, border: C.border, color: C.textSecondary },
};

const DOT_PULSE: Record<string, string> = {
  positive: 'glowPulse',
  negative: 'glowPulse',
  warning: 'glowPulse',
  info: 'glowPulse',
  accent: 'glowPulse',
  neutral: 'none',
};

export default function Badge({ children, variant = 'neutral', size = 'sm', dot = false, pulse = false, style }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  const isSmall = size === 'sm';

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isSmall ? 4 : 6,
    padding: isSmall ? '2px 8px' : '3px 10px',
    borderRadius: R.full,
    background: v.bg,
    border: `1px solid ${v.border}`,
    color: v.color,
    fontSize: isSmall ? F.sizeXs : F.sizeSm,
    fontWeight: 600,
    fontFamily: F.family,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    transition: T.fast,
    ...style,
  };

  return (
    <span
      style={base}
      onMouseEnter={e => {
        if (variant !== 'neutral') {
          e.currentTarget.style.filter = 'brightness(1.15)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: v.color, flexShrink: 0,
          animation: pulse && DOT_PULSE[variant] !== 'none' ? `${DOT_PULSE[variant]} 2s ease-in-out infinite` : undefined,
        }} />
      )}
      {children}
    </span>
  );
}
