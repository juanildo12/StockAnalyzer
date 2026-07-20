'use client';

import { colors as C, font as F } from '@/src/utils/webTheme';
import { useRef, useEffect, useState } from 'react';

interface LineChartProps {
  data: number[];
  data2: number[];
  height?: number;
  color?: string;
  color2?: string;
  leftLabels?: number[];
  rightLabels?: number[];
  dateStart?: string;
  dateEnd?: string;
  animated?: boolean;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LineChart({
  data, data2, height = 200,
  color = C.accent, color2 = C.accentLight,
  leftLabels, rightLabels,
  dateStart, dateEnd,
  animated = true,
}: LineChartProps) {
  const pad = { top: 12, right: 48, bottom: 24, left: 36 };
  const w = 600;
  const h = height;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const [animData, setAnimData] = useState<number[]>(data);
  const [animData2, setAnimData2] = useState<number[]>(data2);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!animated) { setAnimData(data); setAnimData2(data2); return; }
    const from = animData;
    const from2 = animData2;
    const to = data;
    const to2 = data2;
    const startTime = performance.now();
    const duration = 400;

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimData(from.map((f, i) => f + (to[i] - f) * ease));
      setAnimData2(from2.map((f, i) => f + (to2[i] - f) * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.join(','), data2.join(',')]);

  const fixedMin = 0, fixedMax = 100, fixedRange = fixedMax - fixedMin;

  const allData2 = animData2.filter(v => v != null && isFinite(v));
  if (allData2.length === 0) return null;
  const minVal2 = Math.min(...allData2);
  const maxVal2 = Math.max(...allData2);
  const range2 = maxVal2 - minVal2 || 1;

  const toX = (i: number) => pad.left + (i / Math.max(animData.length - 1, 1)) * chartW;
  const toY = (v: number) => pad.top + chartH - ((v - fixedMin) / fixedRange) * chartH;
  const toY2 = (v: number) => pad.top + chartH - ((v - minVal2) / range2) * chartH;

  const points = animData.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const points2 = animData2.map((v, i) => ({ x: toX(i), y: toY2(v) }));

  const stripeH = chartH / 5;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', overflow: 'visible' }}>
      {/* Horizontal stripes */}
      {[0, 1, 2, 3, 4].map(i => (
        <rect
          key={`stripe-${i}`}
          x={pad.left}
          y={pad.top + i * stripeH}
          width={chartW}
          height={stripeH}
          fill={i % 2 === 0 ? `${C.textPrimary}08` : 'transparent'}
        />
      ))}

      {/* Baseline */}
      <line x1={pad.left} y1={pad.top + chartH} x2={pad.left + chartW} y2={pad.top + chartH} stroke={C.border} strokeWidth={1} />

      {/* Left axis labels */}
      {leftLabels && leftLabels.map((v, i) => (
        <text
          key={`l-${i}`}
          x={pad.left - 8}
          y={pad.top + chartH - ((v - fixedMin) / fixedRange) * chartH + 4}
          textAnchor="end"
          fill={C.textMuted}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {v}
        </text>
      ))}

      {/* Right axis labels */}
      {rightLabels && rightLabels.map((v, i) => (
        <text
          key={`r-${i}`}
          x={pad.left + chartW + 8}
          y={pad.top + chartH - ((v - minVal2) / range2) * chartH + 4}
          textAnchor="start"
          fill={C.textMuted}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {typeof v === 'number' ? `$${v}` : v}
        </text>
      ))}

      {/* Date labels */}
      {dateStart && (
        <text x={pad.left} y={h - 4} textAnchor="start" fill={C.textMuted} fontSize={10} fontFamily="Inter, system-ui, sans-serif">
          {fmtDate(dateStart)}
        </text>
      )}
      {dateEnd && (
        <text x={pad.left + chartW} y={h - 4} textAnchor="end" fill={C.textMuted} fontSize={10} fontFamily="Inter, system-ui, sans-serif">
          {fmtDate(dateEnd)}
        </text>
      )}

      {/* Data line 2 (price) — drawn first so it's behind */}
      <path
        d={smoothPath(points2)}
        fill="none"
        stroke={color2}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: animated ? 'none' : undefined }}
      />

      {/* Data line 1 (indicator) */}
      <path
        d={smoothPath(points)}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: animated ? 'none' : undefined }}
      />
    </svg>
  );
}
