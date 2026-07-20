'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Props {
  data: Candle[];
  sma50?: number[];
  support?: number;
  resistance?: number;
  trend?: string;
  height?: number;
  animate?: boolean;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function CandlestickChart({ data, sma50, support, resistance, trend, height = 280, animate = true }: Props) {
  const [animIdx, setAnimIdx] = useState(animate ? 1 : data.length);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!animate || data.length < 2) {
      setAnimIdx(data.length);
      return;
    }
    setAnimIdx(1);
    timerRef.current = setInterval(() => {
      setAnimIdx(prev => {
        if (prev >= data.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          return data.length;
        }
        return prev + 1;
      });
    }, 30);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [data.length, animate]);

  const {
    candleWidth, viewW, viewH, padL, padR, padT, padB,
    yMin, yMax, yRange, xScale, yScale,
    candlesRendered, smaPoints, supY, resY,
  } = useMemo(() => {
    const visibleData = data.slice(0, animIdx);
    if (visibleData.length < 2) {
      return { candleWidth: 0, viewW: 0, viewH: 0, padL: 0, padR: 0, padT: 0, padB: 0,
        yMin: 0, yMax: 1, yRange: 1, xScale: 0, yScale: 0, candlesRendered: [],
        smaPoints: [], supY: 0, resY: 0 };
    }

    const pL = 8, pR = 8, pT = 8, pB = 8;
    const w = 100;
    const h = 100;

    const vals = visibleData.flatMap(d => [d.h, d.l]);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rng = mx - mn || 1;
    const ext = rng * 0.1;
    const yMn = mn - ext;
    const yMx = mx + ext;
    const yR = yMx - yMn || 1;

    const totalCandleW = (w - pL - pR) / visibleData.length;
    const cw = Math.max(0.3, totalCandleW * 0.7);

    const cRendered = visibleData.map((d, i) => {
      const cx = pL + (i / (visibleData.length - 1)) * (w - pL - pR);
      const isUp = d.c >= d.o;
      const top = Math.max(d.c, d.o);
      const bot = Math.min(d.c, d.o);
      const bodyH = Math.max(0.3, ((top - bot) / yR) * (h - pT - pB));
      const bodyY = h - pB - ((top - yMn) / yR) * (h - pT - pB);
      const wickH = ((d.h - d.l) / yR) * (h - pT - pB);
      const wickY = h - pB - ((d.h - yMn) / yR) * (h - pT - pB);
      return { cx, isUp, bodyH, bodyY, wickH, wickY, highY: wickY, lowY: wickY + wickH, o: d.o, h: d.h, l: d.l, c: d.c, v: d.v };
    });

    let smaPts: { x: number; y: number }[] = [];
    if (sma50 && sma50.length >= visibleData.length) {
      const smaSlice = sma50.slice(sma50.length - visibleData.length);
      smaPts = smaSlice.map((v, i) => {
        if (v == null || v === 0) return null;
        const cx = pL + (i / (visibleData.length - 1)) * (w - pL - pR);
        return { x: cx, y: h - pB - ((v - yMn) / yR) * (h - pT - pB) };
      }).filter(p => p !== null) as { x: number; y: number }[];
    }

    const sY = support != null
      ? h - pB - ((support - yMn) / yR) * (h - pT - pB) : 0;
    const rY = resistance != null
      ? h - pB - ((resistance - yMn) / yR) * (h - pT - pB) : 0;

    return {
      candleWidth: cw, viewW: w, viewH: h, padL: pL, padR: pR, padT: pT, padB: pB,
      yMin: yMn, yMax: yMx, yRange: yR,
      xScale: (w - pL - pR) / (visibleData.length - 1),
      yScale: (h - pT - pB) / yR,
      candlesRendered: cRendered,
      smaPoints: smaPts,
      supY: sY, resY: rY,
    };
  }, [data, animIdx, sma50, support, resistance]);

  if (candlesRendered.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: F.sizeMd }}>
        Cargando gráfico de velas...
      </div>
    );
  }

  const hoverCandle = hoverIdx != null ? candlesRendered[hoverIdx] : null;
  const animProgress = data.length > 0 ? Math.round((animIdx / data.length) * 100) : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height, userSelect: 'none' }}>
      {/* Animation progress bar */}
      {animate && animIdx < data.length && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: C.border, borderRadius: '1px', overflow: 'hidden', zIndex: 5,
        }}>
          <div style={{
            width: `${animProgress}%`, height: '100%',
            background: C.gradientPrimary, borderRadius: '1px',
            transition: 'width 0.1s linear',
          }} />
        </div>
      )}

      {/* Last candle flash when animation completes */}
      {animate && animIdx >= data.length && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: C.positive, borderRadius: '1px', zIndex: 5,
          animation: 'fadeOut 1.5s ease forwards',
        }} />
      )}

      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * viewW;
          const idx = Math.round((x - padL) / xScale);
          setHoverIdx(Math.max(0, Math.min(candlesRendered.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="volGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={viewW} height={viewH} fill="transparent" />

        {/* Grid */}
        {[0.25, 0.5, 0.75].map(frac => (
          <line key={frac} x1="0" y1={viewH * frac} x2={viewW} y2={viewH * frac}
            stroke={C.border} strokeWidth="0.25" strokeDasharray="1,1.5" />
        ))}

        {/* SMA50 */}
        {smaPoints.length > 1 && (
          <path d={smoothPath(smaPoints)} fill="none" stroke={C.accent} strokeWidth="0.5"
            strokeDasharray="1.5,1.5" opacity="0.85" />
        )}

        {/* Support */}
        {support != null && (
          <>
            <line x1="0" y1={supY} x2={viewW} y2={supY}
              stroke={C.positive} strokeWidth="0.4" strokeDasharray="2,1.5" opacity="0.75" />
            <text x={viewW - 0.5} y={supY - 0.5} fontSize="2.2" fill={C.positive}
              textAnchor="end" fontWeight="600" opacity="0.85">S ${support.toFixed(2)}</text>
          </>
        )}

        {/* Resistance */}
        {resistance != null && (
          <>
            <line x1="0" y1={resY} x2={viewW} y2={resY}
              stroke={C.negative} strokeWidth="0.4" strokeDasharray="2,1.5" opacity="0.75" />
            <text x={viewW - 0.5} y={resY - 0.5} fontSize="2.2" fill={C.negative}
              textAnchor="end" fontWeight="600" opacity="0.85">R ${resistance.toFixed(2)}</text>
          </>
        )}

        {/* Volume bars */}
        {candlesRendered.map((c, i) => {
          const barH = (c.v / Math.max(...candlesRendered.map(x => x.v))) * 8;
          return (
            <rect key={`v${i}`} x={c.cx - candleWidth * 0.3} y={viewH - padB - barH}
              width={candleWidth * 0.6} height={barH}
              fill={c.isUp ? `${C.positive}35` : `${C.negative}35`} rx="0.2" />
          );
        })}

        {/* Candles */}
        {candlesRendered.map((c, i) => (
          <g key={`c${i}`}>
            <line x1={c.cx} y1={c.highY} x2={c.cx} y2={c.lowY}
              stroke={c.isUp ? C.positive : C.negative} strokeWidth="0.4" />
            <rect x={c.cx - candleWidth / 2} y={c.bodyY}
              width={candleWidth} height={c.bodyH}
              fill={c.isUp ? C.positive : C.negative}
              rx="0.2" />
          </g>
        ))}

        {/* Hover crosshair */}
        {hoverCandle && (
          <>
            <line x1={hoverCandle.cx} y1="0" x2={hoverCandle.cx} y2={viewH}
              stroke={C.textMuted} strokeWidth="0.25" opacity="0.6" />
            <line x1="0" y1={hoverCandle.highY} x2={viewW} y2={hoverCandle.highY}
              stroke={C.textMuted} strokeWidth="0.2" opacity="0.5" strokeDasharray="1,1" />

            {/* Hover tooltip */}
            <rect x={Math.min(hoverCandle.cx + 1, viewW - 18)} y="0.5"
              width="17" height="12" rx="0.8" fill={`${C.bgCard}F0`}
              stroke={C.borderLight} strokeWidth="0.3" />
            <text x={Math.min(hoverCandle.cx + 1.5, viewW - 17)} y="2.3"
              fontSize="2.2" fill={hoverCandle.isUp ? C.positive : C.negative} fontWeight="700">
              {hoverCandle.isUp ? '▲' : '▼'} ${hoverCandle.c.toFixed(2)}
            </text>
            <text x={Math.min(hoverCandle.cx + 1.5, viewW - 17)} y="4.5"
              fontSize="1.8" fill={C.textMuted}>
              A:${hoverCandle.h.toFixed(2)} B:${hoverCandle.l.toFixed(2)}
            </text>
            <text x={Math.min(hoverCandle.cx + 1.5, viewW - 17)} y="6.7"
              fontSize="1.8" fill={C.textMuted}>
              O:${hoverCandle.o.toFixed(2)} C:${hoverCandle.c.toFixed(2)}
            </text>
            <text x={Math.min(hoverCandle.cx + 1.5, viewW - 17)} y="8.9"
              fontSize="1.8" fill={C.textMuted}>
              Vol:{(hoverCandle.v / 1000000).toFixed(1)}M
            </text>
            <text x={Math.min(hoverCandle.cx + 1.5, viewW - 17)} y="11.1"
              fontSize="1.8" fill={C.textMuted}>
              Vela #{hoverIdx! + 1}/{candlesRendered.length}
            </text>
          </>
        )}

        {/* Animation overlay - draw effect */}
        {animate && animIdx < data.length && (
          <rect x={padL + (animIdx / data.length) * (viewW - padL - padR)} y="0"
            width={viewW} height={viewH}
            fill={`${C.bgCard}CC`} />
        )}
      </svg>
    </div>
  );
}
