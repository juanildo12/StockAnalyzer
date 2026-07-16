'use client';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import { CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

const SIZE_STYLES: Record<Size, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: `${S.xs} ${S.md}`, fontSize: F.sizeSm, height: '32px' },
  md: { padding: `${S.sm} ${S.lg}`, fontSize: F.sizeBase, height: '36px' },
  lg: { padding: `${S.sm} ${S.xl}`, fontSize: F.sizeMd, height: '40px' },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  style,
}: ButtonProps) {
  const sizeStyle = SIZE_STYLES[size];

  const variantStyles: Record<Variant, CSSProperties> = {
    primary: {
      background: C.gradientPrimary,
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: C.bgElevated,
      color: C.textSecondary,
      border: `1px solid ${C.border}`,
    },
    ghost: {
      background: 'transparent',
      color: C.textSecondary,
      border: '1px solid transparent',
    },
    danger: {
      background: C.negativeBg,
      color: C.negative,
      border: `1px solid ${C.negativeBorder}`,
    },
  };

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    padding: sizeStyle.padding,
    height: sizeStyle.height,
    borderRadius: R.md,
    fontSize: sizeStyle.fontSize,
    fontWeight: 600,
    fontFamily: F.family,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
    transition: T.fast,
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      style={base}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={e => {
        if (disabled || loading) return;
        e.currentTarget.style.opacity = '0.85';
        if (variant === 'secondary' || variant === 'ghost') {
          e.currentTarget.style.borderColor = C.borderHover;
          e.currentTarget.style.background = C.bgCardHover;
        }
      }}
      onMouseLeave={e => {
        if (disabled || loading) return;
        e.currentTarget.style.opacity = '1';
        if (variant === 'secondary' || variant === 'ghost') {
          e.currentTarget.style.borderColor = variant === 'ghost' ? 'transparent' : C.border;
          e.currentTarget.style.background = variant === 'ghost' ? 'transparent' : C.bgElevated;
        }
      }}
      onMouseDown={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {loading ? (
        <span style={{
          width: 14, height: 14, border: `2px solid rgba(255,255,255,0.3)`,
          borderTopColor: '#fff', borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      ) : icon}
      {children}
    </button>
  );
}
