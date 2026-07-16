'use client';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import { CSSProperties, ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  iconColor?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: CSSProperties;
}

export default function EmptyState({
  icon,
  iconColor = C.accent,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${S.xxxxl} ${S.xl}`,
      textAlign: 'center',
      ...style,
    }}>
      {/* Icon with glow */}
      {icon && (
        <div style={{
          width: 64, height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: R.xl,
          background: `${iconColor}10`,
          boxShadow: `0 0 32px ${iconColor}15`,
          marginBottom: S.xl,
          fontSize: 28,
          color: iconColor,
        }}>
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 style={{
        margin: 0,
        fontSize: F.sizeLg,
        fontWeight: 700,
        color: C.textPrimary,
        fontFamily: F.family,
        marginBottom: description || actionLabel ? S.sm : 0,
      }}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p style={{
          margin: 0,
          fontSize: F.sizeMd,
          color: C.textMuted,
          fontFamily: F.family,
          lineHeight: 1.5,
          maxWidth: 360,
          marginBottom: actionLabel ? S.xl : 0,
        }}>
          {description}
        </p>
      )}

      {/* Action */}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
