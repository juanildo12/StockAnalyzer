'use client';

import { useRef, useEffect, useState, useMemo } from 'react';

interface Metric {
  label: string;
  value: number;
}

interface RadarChartProps {
  metrics: Metric[];
  size?: number;
  levels?: number;
  color?: string;
}

function polyPoints(values: number[], cx: number, cy: number, R: number): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      const r = (v / 100) * R;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(' ');
}

function levelPoints(level: number, n: number, cx: number, cy: number, R: number): string {
  const r = (level / 100) * R;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function vertexCoords(i: number, n: number, cx: number, cy: number, R: number, scale = 1) {
  const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
  return { x: cx + R * scale * Math.cos(angle), y: cy + R * scale * Math.sin(angle) };
}

const LABEL_RADIUS_SCALE = 1.18;
const LABEL_OFFSET_V = 20;

export default function RadarChart({ metrics, size = 280, levels = 4, color = '#C65BFF' }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const n = metrics.length;

  const [animValues, setAnimValues] = useState<number[]>(metrics.map(() => 0));
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number[]>(animValues);
  const toRef = useRef<number[]>(metrics.map(m => m.value));

  useEffect(() => {
    fromRef.current = animValues;
    toRef.current = metrics.map(m => m.value);
    startRef.current = performance.now();

    const duration = 400;
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      const next = fromRef.current.map((from, i) => {
        const to = toRef.current[i] || 0;
        return from + (to - from) * ease;
      });
      setAnimValues(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.map(m => m.value).join(',')]);

  const gridLevels = useMemo(() => {
    const lvls: number[] = [];
    for (let i = 1; i <= levels; i++) {
      lvls.push((100 / levels) * i);
    }
    return lvls;
  }, [levels]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid levels */}
      {gridLevels.map(level => (
        <polygon
          key={level}
          points={levelPoints(level, n, cx, cy, R)}
          fill="none"
          stroke="#ffffff08"
          strokeWidth={1}
        />
      ))}

      {/* Axes */}
      {Array.from({ length: n }).map((_, i) => {
        const v = vertexCoords(i, n, cx, cy, R);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={v.x}
            y2={v.y}
            stroke="#ffffff08"
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polyPoints(animValues, cx, cy, R)}
        fill={`${color}25`}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {animValues.map((v, i) => {
        const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
        const r = (v / 100) * R;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r={3} fill={color} />
        );
      })}

      {/* Labels — positioned outside the radar using angle-based anchors */}
      {metrics.map((m, i) => {
        const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const labelR = R * LABEL_RADIUS_SCALE;
        const lx = cx + labelR * cosA;
        const ly = cy + labelR * sinA;

        let textAnchor: 'middle' | 'start' | 'end' = 'middle';
        if (cosA > 0.1) textAnchor = 'start';
        else if (cosA < -0.1) textAnchor = 'end';

        let dy = 0;
        if (sinA < -0.1) dy = -LABEL_OFFSET_V;
        else if (sinA > 0.1) dy = LABEL_OFFSET_V;

        return (
          <g key={`label-${i}`}>
            <text
              x={lx}
              y={ly + dy - 8}
              textAnchor={textAnchor}
              fill="#86868B"
              fontSize={10}
              fontWeight={600}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {m.label}
            </text>
            <text
              x={lx}
              y={ly + dy + 6}
              textAnchor={textAnchor}
              fill="#1D1D1F"
              fontSize={13}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {Math.round(m.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
