'use client';
import { colors as C, radius as R, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  padding?: string;
  hover?: boolean;
  active?: boolean;
  glow?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
}

export default function Card({
  children,
  padding = S.lg,
  hover = true,
  active = false,
  glow = false,
  style,
  onClick,
  className,
}: CardProps) {
  const base: CSSProperties = {
    background: C.bgCard,
    border: `1px solid ${active ? C.accentBorder : C.border}`,
    borderRadius: R.lg,
    padding,
    transition: T.fast,
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  return (
    <div
      className={className}
      style={base}
      onClick={onClick}
      onMouseEnter={e => {
        if (!hover) return;
        e.currentTarget.style.borderColor = active ? C.accentBorder : C.borderHover;
        e.currentTarget.style.boxShadow = glow ? shadow.glow : shadow.sm;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        if (!hover) return;
        e.currentTarget.style.borderColor = active ? C.accentBorder : C.border;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onMouseDown={e => {
        if (onClick) e.currentTarget.style.transform = 'scale(0.99)';
      }}
      onMouseUp={e => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-1px)';
      }}
    >
      {children}
    </div>
  );
}
