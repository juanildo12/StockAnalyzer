'use client';

import { useState, useMemo } from 'react';
import { colors as C } from '@/src/utils/webTheme';

interface Props {
  data: { t: number; c: number }[];
  sma50?: number[];
  support?: number;
  resistance?: number;
  trend?: string;
  height?: number;
  interactive?: boolean;
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

export default function MiniChart({ data, sma50, support, resistance, trend, height = 200, interactive = true }: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null);

  const { points, lineColor, min, max, range, smaPoints, supY, resY, areaPath } = useMemo(() => {
    if (data.length < 2) return { points: [], lineColor: '#64748B', min: 0, max: 1, range: 1, smaPoints: [], supY: 0, resY: 0, areaPath: '' };

    const w = 100;
    const h = 100;
    const padTop = 8;
    const padBot = 8;
    const vals = data.map(d => d.c);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rng = mx - mn || 1;
    const extend = rng * 0.08;
    const yMin = mn - extend;
    const yMax = mx + extend;
    const yRng = yMax - yMin || 1;

    const pts = data.map((d, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - padBot - ((d.c - yMin) / yRng) * (h - padTop - padBot),
    }));

    const color = trend === 'alcista' ? '#22C55E' : trend === 'bajista' ? '#EF4444' : '#F59E0B';

    let smaPts: { x: number; y: number }[] = [];
    if (sma50 && sma50.length === data.length) {
      smaPts = sma50.map((v, i) => ({
        x: (i / (data.length - 1)) * w,
        y: h - padBot - ((v - yMin) / yRng) * (h - padTop - padBot),
      }));
    }

    const sY = support != null
      ? h - padBot - ((support - yMin) / yRng) * (h - padTop - padBot)
      : 0;
    const rY = resistance != null
      ? h - padBot - ((resistance - yMin) / yRng) * (h - padTop - padBot)
      : 0;

    const areaD = pts.length > 1
      ? `M${pts[0].x},${pts[0].y} ${smoothPath(pts).slice(1)} L${pts[pts.length - 1].x},${h - padBot} L${pts[0].x},${h - padBot} Z`
      : '';

    return { points: pts, lineColor: color, min: yMin, max: yMax, range: yRng, smaPoints: smaPts, supY: sY, resY: rY, areaPath: areaD };
  }, [data, sma50, support, resistance, trend]);

  if (data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: '13px' }}>
        Datos insuficientes para el gráfico
      </div>
    );
  }

  const viewW = 100;
  const viewH = 100;

  return (
    <div style={{ position: 'relative', width: '100%', height, userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={interactive ? (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * viewW;
          setHoverX(x);
        } : undefined}
        onMouseLeave={interactive ? () => setHoverX(null) : undefined}
      >
        <defs>
          <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={viewW} height={viewH} fill="transparent" />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(frac => (
          <line key={frac} x1="0" y1={viewH * frac} x2={viewW} y2={viewH * frac}
            stroke={C.border} strokeWidth="0.3" strokeDasharray="1,1.5" />
        ))}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#chartArea)" />}

        {/* SMA50 */}
        {smaPoints.length > 1 && (
          <path d={smoothPath(smaPoints)} fill="none" stroke="#6366F1" strokeWidth="0.6" strokeDasharray="1.5,1" opacity="0.7" />
        )}

        {/* Support */}
        {support != null && (
          <line x1="0" y1={supY} x2={viewW} y2={supY}
            stroke="#22C55E" strokeWidth="0.5" strokeDasharray="2,1.5" opacity="0.6" />
        )}
        {support != null && (
          <text x={viewW - 0.5} y={supY - 1} fontSize="2.5" fill="#22C55E" opacity="0.7"
            textAnchor="end" fontWeight="600">
            S ${support.toFixed(2)}
          </text>
        )}

        {/* Resistance */}
        {resistance != null && (
          <line x1="0" y1={resY} x2={viewW} y2={resY}
            stroke="#EF4444" strokeWidth="0.5" strokeDasharray="2,1.5" opacity="0.6" />
        )}
        {resistance != null && (
          <text x={viewW - 0.5} y={resY - 1} fontSize="2.5" fill="#EF4444" opacity="0.7"
            textAnchor="end" fontWeight="600">
            R ${resistance.toFixed(2)}
          </text>
        )}

        {/* Price line */}
        <path d={smoothPath(points)} fill="none" stroke={lineColor} strokeWidth="0.8"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Last price dot */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="1.5"
          fill={lineColor} stroke={C.bgCard} strokeWidth="0.5" />

        {/* Hover crosshair */}
        {hoverX != null && (
          <>
            <line x1={hoverX} y1="0" x2={hoverX} y2={viewH}
              stroke={C.textMuted} strokeWidth="0.3" opacity="0.5" />
            {(() => {
              const idx = Math.round((hoverX / viewW) * (data.length - 1));
              const clamped = Math.max(0, Math.min(data.length - 1, idx));
              const p = points[clamped];
              if (!p) return null;
              return (
                <>
                  <line x1="0" y1={p.y} x2={viewW} y2={p.y}
                    stroke={C.textMuted} strokeWidth="0.3" opacity="0.3" strokeDasharray="1,1" />
                  <rect x={hoverX - 0.5} y={p.y - 3} width="7" height="6" rx="1" fill={C.bgCard} />
                  <text x={hoverX + 1} y={p.y + 0.5} fontSize="2.8" fill={lineColor} fontWeight="600">
                    ${data[clamped].c.toFixed(2)}
                  </text>
                </>
              );
            })()}
          </>
        )}

        {/* Last price label */}
        <rect x={0.5} y={viewH - 8} width="22" height="5" rx="1" fill={`${C.bgCard}CC`} />
        <text x="1.5" y={viewH - 4.5} fontSize="2.5" fill={lineColor} fontWeight="700">
          ${data[data.length - 1].c.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}
