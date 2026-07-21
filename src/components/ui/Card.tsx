'use client';
import { colors as C, radius as R, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import { CSSProperties, ReactNode, useState } from 'react';

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
  const [isHovered, setIsHovered] = useState(false);

  const base: CSSProperties = {
    background: active ? `linear-gradient(135deg, ${C.bgCard}, ${C.accentGlow})` : C.bgCard,
    border: `1px solid ${active ? C.accentBorder : isHovered ? C.borderHover : C.border}`,
    borderRadius: R.lg,
    padding,
    transition: T.springSnap,
    cursor: onClick ? 'pointer' : 'default',
    transform: isHovered && hover ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: isHovered && hover
      ? glow
        ? `0 8px 32px rgba(124, 58, 237, 0.15), 0 2px 8px rgba(124, 58, 237, 0.1)`
        : `0 8px 24px rgba(0, 0, 0, 0.3)`
      : '0 0 0 rgba(0,0,0,0)',
    ...style,
  };

  return (
    <div
      className={className}
      style={base}
      onClick={onClick}
      onMouseEnter={() => { if (hover) setIsHovered(true); }}
      onMouseLeave={() => { if (hover) setIsHovered(false); }}
      onMouseDown={e => {
        if (onClick) e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={e => {
        if (onClick && hover) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
    >
      {children}
    </div>
  );
}
