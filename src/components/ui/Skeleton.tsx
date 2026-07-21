'use client';
import { colors as C, radius as R, spacing as S } from '@/src/utils/webTheme';
import { CSSProperties } from 'react';

const SHIMMER_BG = `linear-gradient(90deg, ${C.bgElevated} 25%, ${C.bgCardHover} 50%, ${C.bgElevated} 75%)`;

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
      background: SHIMMER_BG,
      backgroundSize: '200% 100%',
      animation: 'shimmerModern 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}

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

export function SkeletonCard({ style, delay = 0 }: { style?: CSSProperties; delay?: number }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      padding: S.lg,
      animation: `fadeInUp 0.3s ease ${delay}s both`,
      ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: S.md }}>
        <SkeletonLine width="80px" height="18px" />
        <SkeletonLine width="50px" height="16px" borderRadius={R.full} />
      </div>
      <SkeletonLine width="140px" height="12px" style={{ marginBottom: S.md }} />
      <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md }}>
        <SkeletonLine width="100px" height="22px" />
        <SkeletonLine width="60px" height="22px" />
      </div>
      <SkeletonLine width="100%" height="6px" style={{ marginBottom: S.md }} />
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

export function SkeletonBriefing() {
  return (
    <div style={{ padding: `0 ${S.lg}`, animation: 'fadeIn 0.2s ease forwards' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: S.lg }}>
        <div>
          <SkeletonLine width="200px" height="24px" style={{ marginBottom: S.sm }} />
          <SkeletonLine width="160px" height="12px" />
        </div>
        <SkeletonLine width="80px" height="30px" borderRadius={R.sm} />
      </div>
      <div style={{
        display: 'flex', gap: S.xl, padding: `${S.sm} ${S.lg}`,
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: R.md, marginBottom: S.lg,
      }}>
        <SkeletonLine width="140px" height="16px" />
        <SkeletonLine width="100px" height="16px" />
      </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {[0, 1, 2].map(i => <SkeletonCard key={i} delay={i * 0.06} />)}
      </div>
    </div>
  );
}

export function SkeletonRow({ style, delay = 0 }: { style?: CSSProperties; delay?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: S.md,
      padding: `${S.sm} ${S.md}`,
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: R.md,
      animation: `slideUp 0.2s ease ${delay}s both`,
      ...style,
    }}>
      <SkeletonLine width="48px" height="14px" />
      <SkeletonLine width="100px" height="14px" />
      <div style={{ flex: 1 }} />
      <SkeletonLine width="70px" height="14px" />
      <SkeletonLine width="50px" height="14px" />
    </div>
  );
}

export function SkeletonScore({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: S.md,
      padding: S.lg,
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      animation: 'fadeIn 0.2s ease forwards',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: SHIMMER_BG, backgroundSize: '200% 100%',
          animation: 'shimmerModern 1.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <SkeletonLine width="120px" height="16px" style={{ marginBottom: S.xs }} />
          <SkeletonLine width="80px" height="12px" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.sm }}>
        {[1, 2, 3, 4].map(i => (
          <SkeletonLine key={i} height="32px" borderRadius={R.md} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard({ style }: { style?: CSSProperties }) {
  return (
    <div style={{
      padding: S.lg,
      animation: 'fadeIn 0.2s ease forwards',
      ...style,
    }}>
      <div style={{ display: 'flex', gap: S.md, marginBottom: S.xl }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, padding: S.lg,
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: R.lg,
            animation: `fadeInUp 0.2s ease ${i * 0.05}s both`,
          }}>
            <SkeletonLine width="60%" height="12px" style={{ marginBottom: S.sm }} />
            <SkeletonLine width="40%" height="24px" />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: S.md }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{
            padding: S.md,
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: R.md,
            animation: `fadeInUp 0.2s ease ${0.1 + i * 0.03}s both`,
          }}>
            <SkeletonLine width="50%" height="10px" style={{ marginBottom: S.xs }} />
            <SkeletonLine width="70%" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
