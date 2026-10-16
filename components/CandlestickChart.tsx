'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { colors as C, font as F } from '@/src/utils/webTheme';

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
  gammaFlip?: number;
  gammaWallUp?: number;
  gammaWallDown?: number;
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

function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || fallback);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

/** A dashed horizontal level line with a readable label pill (native-px text). */
function LevelLine({ y, width, color, text, side }: { y: number; width: number; color: string; text: string; side: 'left' | 'right' }) {
  const padX = 8;
  const labelW = text.length * 6.6 + 12;
  const lx = side === 'left' ? padX : width - labelW - padX;
  return (
    <g>
      <line x1={0} y1={y} x2={width} y2={y} stroke={color} strokeWidth={1.4} strokeDasharray="5,4" opacity={0.85} />
      <rect x={lx} y={y - 9} width={labelW} height={18} rx={4} fill={C.bgCard} stroke={color} strokeWidth={1} opacity={0.96} />
      <text x={lx + labelW / 2} y={y + 4} fontSize={11} fill={color} fontWeight={700} textAnchor="middle" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
        {text}
      </text>
    </g>
  );
}

export default function CandlestickChart({ data, sma50, support, resistance, gammaFlip, gammaWallUp, gammaWallDown, trend, height = 280, animate = true }: Props) {
  const [animIdx, setAnimIdx] = useState(animate ? 1 : data.length);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wrapRef, measuredW] = useElementWidth<HTMLDivElement>();

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

  const W = Math.max(220, Math.round(measuredW));
  const H = height;
  const padL = 8, padR = 8, padT = 12, padB = 10;
  const plotTop = padT;
  const plotBottom = H - padB;
  const plotH = plotBottom - plotTop;
  const plotW = W - padL - padR;

  const {
    candleWidth, yMin, yMax,
    candlesRendered, smaPoints, supY, resY, flipY, wallUpY, wallDownY, volMax,
  } = useMemo(() => {
    const visibleData = data.slice(0, animIdx);
    if (visibleData.length < 2) {
      return { candleWidth: 0, yMin: 0, yMax: 1, candlesRendered: [], smaPoints: [],
        supY: 0, resY: 0, flipY: 0, wallUpY: 0, wallDownY: 0, volMax: 1 };
    }

    const vals = visibleData.flatMap(d => [d.h, d.l]);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rng = mx - mn || 1;
    const ext = rng * 0.1;
    const yMn = mn - ext;
    const yMx = mx + ext;
    const yR = yMx - yMn || 1;

    const step = plotW / (visibleData.length - 1);
    const cw = Math.max(1, (plotW / visibleData.length) * 0.66);

    const cRendered = visibleData.map((d, i) => {
      const cx = padL + i * step;
      const isUp = d.c >= d.o;
      const top = Math.max(d.c, d.o);
      const bot = Math.min(d.c, d.o);
      const bodyH = Math.max(1, ((top - bot) / yR) * plotH);
      const bodyY = plotBottom - ((top - yMn) / yR) * plotH;
      const wickH = ((d.h - d.l) / yR) * plotH;
      const wickY = plotBottom - ((d.h - yMn) / yR) * plotH;
      return { cx, isUp, bodyH, bodyY, wickH, wickY, highY: wickY, lowY: wickY + wickH, o: d.o, h: d.h, l: d.l, c: d.c, v: d.v };
    });

    let smaPts: { x: number; y: number }[] = [];
    if (sma50 && sma50.length >= visibleData.length) {
      const smaSlice = sma50.slice(sma50.length - visibleData.length);
      smaPts = smaSlice.map((v, i) => {
        if (v == null || v === 0) return null;
        const cx = padL + i * step;
        return { x: cx, y: plotBottom - ((v - yMn) / yR) * plotH };
      }).filter(p => p !== null) as { x: number; y: number }[];
    }

    const levelY = (v?: number) => (v != null && v > yMn && v < yMx
      ? plotBottom - ((v - yMn) / yR) * plotH : 0);

    const vMax = Math.max(...visibleData.map(d => d.v), 1);

    return {
      candleWidth: cw, yMin: yMn, yMax: yMx,
      candlesRendered: cRendered,
      smaPoints: smaPts,
      supY: support != null ? levelY(support) : 0,
      resY: resistance != null ? levelY(resistance) : 0,
      flipY: levelY(gammaFlip),
      wallUpY: levelY(gammaWallUp),
      wallDownY: levelY(gammaWallDown),
      volMax: vMax,
    };
  }, [data, animIdx, sma50, support, resistance, gammaFlip, gammaWallUp, gammaWallDown, plotW, plotH, plotBottom, padL]);

  if (candlesRendered.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: F.sizeMd }}>
        Cargando gráfico de velas...
      </div>
    );
  }

  const hoverCandle = hoverIdx != null ? candlesRendered[hoverIdx] : null;
  const animProgress = data.length > 0 ? Math.round((animIdx / data.length) * 100) : 0;
  const step = plotW / Math.max(1, candlesRendered.length - 1);

  const tipW = 150, tipH = 104;
  const tipX = hoverCandle ? Math.min(Math.max(hoverCandle.cx + 10, 2), W - tipW - 2) : 0;
  const tipY = 6;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height, userSelect: 'none' }}>
      {animate && animIdx < data.length && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: C.border, borderRadius: '1px', overflow: 'hidden', zIndex: 5 }}>
          <div style={{ width: `${animProgress}%`, height: '100%', background: C.gradientPrimary, borderRadius: '1px', transition: 'width 0.1s linear' }} />
        </div>
      )}
      {animate && animIdx >= data.length && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: C.positive, borderRadius: '1px', zIndex: 5, animation: 'fadeOut 1.5s ease forwards' }} />
      )}

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round((x - padL) / step);
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

        <rect x="0" y="0" width={W} height={H} fill="transparent" />

        {/* Grid */}
        {[0.25, 0.5, 0.75].map(frac => (
          <line key={frac} x1="0" y1={plotTop + plotH * frac} x2={W} y2={plotTop + plotH * frac}
            stroke={C.border} strokeWidth="1" strokeDasharray="2,4" opacity="0.7" />
        ))}

        {/* Volume bars */}
        {candlesRendered.map((c, i) => {
          const barH = (c.v / volMax) * (plotH * 0.14);
          return (
            <rect key={`v${i}`} x={c.cx - candleWidth * 0.3} y={plotBottom - barH}
              width={candleWidth * 0.6} height={barH}
              fill={c.isUp ? C.positive35 : C.negative35} rx="1" />
          );
        })}

        {/* SMA50 */}
        {smaPoints.length > 1 && (
          <path d={smoothPath(smaPoints)} fill="none" stroke={C.accent} strokeWidth="1.6"
            strokeDasharray="4,3" opacity="0.9" />
        )}

        {/* Candles */}
        {candlesRendered.map((c, i) => (
          <g key={`c${i}`}>
            <line x1={c.cx} y1={c.highY} x2={c.cx} y2={c.lowY}
              stroke={c.isUp ? C.positive : C.negative} strokeWidth="1.2" />
            <rect x={c.cx - candleWidth / 2} y={c.bodyY}
              width={candleWidth} height={c.bodyH}
              fill={c.isUp ? C.positive : C.negative} rx="1" />
          </g>
        ))}

        {/* Gamma levels (dashed + labeled pills) */}
        {gammaFlip != null && flipY > 0 && (
          <LevelLine y={flipY} width={W} color={C.warning} text={`γFLIP $${gammaFlip.toFixed(2)}`} side="left" />
        )}
        {gammaWallUp != null && wallUpY > 0 && (
          <LevelLine y={wallUpY} width={W} color="#A78BFA" text={`γWALL↑ $${gammaWallUp.toFixed(2)}`} side="right" />
        )}
        {gammaWallDown != null && wallDownY > 0 && (
          <LevelLine y={wallDownY} width={W} color="#A78BFA" text={`γWALL↓ $${gammaWallDown.toFixed(2)}`} side="right" />
        )}

        {/* Structural support / resistance */}
        {support != null && supY > 0 && (
          <LevelLine y={supY} width={W} color={C.positive} text={`S $${support.toFixed(2)}`} side="right" />
        )}
        {resistance != null && resY > 0 && (
          <LevelLine y={resY} width={W} color={C.negative} text={`R $${resistance.toFixed(2)}`} side="right" />
        )}

        {/* Hover crosshair + tooltip */}
        {hoverCandle && (
          <>
            <line x1={hoverCandle.cx} y1="0" x2={hoverCandle.cx} y2={H}
              stroke={C.textMuted} strokeWidth="1" opacity="0.7" />
            <line x1="0" y1={hoverCandle.highY} x2={W} y2={hoverCandle.highY}
              stroke={C.textMuted} strokeWidth="1" opacity="0.5" strokeDasharray="2,2" />

            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8}
              fill={C.bgCard} stroke={C.borderLight} strokeWidth="1" opacity="0.98" />
            <text x={tipX + 12} y={tipY + 22} fontSize="13" fill={hoverCandle.isUp ? C.positive : C.negative} fontWeight="700">
              {hoverCandle.isUp ? '▲' : '▼'} ${hoverCandle.c.toFixed(2)}
            </text>
            <text x={tipX + 12} y={tipY + 44} fontSize="11.5" fill={C.textSecondary}>
              Apertura <tspan fill={C.textPrimary} fontWeight="600">${hoverCandle.o.toFixed(2)}</tspan>
            </text>
            <text x={tipX + 12} y={tipY + 62} fontSize="11.5" fill={C.textSecondary}>
              Máx <tspan fill={C.textPrimary} fontWeight="600">${hoverCandle.h.toFixed(2)}</tspan>
            </text>
            <text x={tipX + 12} y={tipY + 80} fontSize="11.5" fill={C.textSecondary}>
              Mín <tspan fill={C.textPrimary} fontWeight="600">${hoverCandle.l.toFixed(2)}</tspan>
            </text>
            <text x={tipX + 12} y={tipY + 98} fontSize="11.5" fill={C.textSecondary}>
              Vol <tspan fill={C.textPrimary} fontWeight="600">{hoverCandle.v >= 1e6 ? (hoverCandle.v / 1e6).toFixed(1) + 'M' : (hoverCandle.v / 1e3).toFixed(0) + 'K'}</tspan>
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
