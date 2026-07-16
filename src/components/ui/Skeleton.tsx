'use client';
import { colors as C, radius as R, spacing as S } from '@/src/utils/webTheme';
import { CSSProperties } from 'react';

// ─── Pulse animation (injected once) ────────────────────────────────────────
const ANIM_ID = 'skeleton-pulse';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `@keyframes skeleton-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`;
  document.head.appendChild(style);
}

// ─── Skeleton Line ──────────────────────────────────────────────────────────

interface SkeletonLineProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: CSSProperties;
}

function SkeletonLine({ width = '100%', height = '12px', borderRadius = R.sm, style }: SkeletonLineProps) {
  return (
    <div style={{
      width, height, borderRadius,
      background: C.bgCardHover,
      animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}

// ─── Text Skeleton (3 lines) ────────────────────────────────────────────────

export function SkeletonText({ lines = 3, style }: { lines?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '60%' : `${70 + Math.random() * 25}%`}
          height="10px"
        />
      ))}
    </div>
  );
}

// ─── Card Skeleton ──────────────────────────────────────────────────────────

export function SkeletonCard({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      padding: S.lg,
      ...style,
    }}>
      {/* Header: symbol + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: S.md }}>
        <SkeletonLine width="80px" height="18px" />
        <SkeletonLine width="50px" height="16px" borderRadius={R.full} />
      </div>
      {/* Name */}
      <SkeletonLine width="140px" height="12px" style={{ marginBottom: S.md }} />
      {/* Price */}
      <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md }}>
        <SkeletonLine width="100px" height="22px" />
        <SkeletonLine width="60px" height="22px" />
      </div>
      {/* Score bar */}
      <SkeletonLine width="100%" height="6px" style={{ marginBottom: S.md }} />
      {/* Level boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: S.sm }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            padding: S.sm, background: C.bgInput, borderRadius: R.sm, textAlign: 'center',
          }}>
            <SkeletonLine width="40px" height="8px" style={{ margin: '0 auto S.xs' }} />
            <SkeletonLine width="60px" height="14px" style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Briefing Skeleton (full page) ──────────────────────────────────────────

export function SkeletonBriefing() {
  return (
    <div style={{ padding: `0 ${S.lg}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: S.lg }}>
        <div>
          <SkeletonLine width="200px" height="24px" style={{ marginBottom: S.sm }} />
          <SkeletonLine width="160px" height="12px" />
        </div>
        <SkeletonLine width="80px" height="30px" borderRadius={R.sm} />
      </div>
      {/* Market bar */}
      <div style={{
        display: 'flex', gap: S.xl, padding: `${S.sm} ${S.lg}`,
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: R.md, marginBottom: S.lg,
      }}>
        <SkeletonLine width="140px" height="16px" />
        <SkeletonLine width="100px" height="16px" />
      </div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: S.sm, marginBottom: S.xxl }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            padding: S.sm, background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: R.md, textAlign: 'center',
          }}>
            <SkeletonLine width="60px" height="8px" style={{ margin: '0 auto S.xs' }} />
            <SkeletonLine width="40px" height="18px" style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
      {/* Pick cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}

// ─── Row Skeleton ───────────────────────────────────────────────────────────

export function SkeletonRow({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: S.md,
      padding: `${S.sm} ${S.md}`,
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: R.md, ...style,
    }}>
      <SkeletonLine width="48px" height="14px" />
      <SkeletonLine width="100px" height="14px" />
      <div style={{ flex: 1 }} />
      <SkeletonLine width="70px" height="14px" />
      <SkeletonLine width="50px" height="14px" />
    </div>
  );
}
