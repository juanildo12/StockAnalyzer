import { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { colors, fonts, radius, shadows } from '../constants/theme';
import type { CandleData } from '../types';

interface Props {
  data: CandleData[];
  height?: number;
}

function calcSMA(data: CandleData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    return sum / period;
  });
}

export default function CandlestickChart({ data, height = 240 }: Props) {
  const [crosshairX, setCrosshairX] = useState<number | null>(null);
  const chartWidthRef = useRef(0);

  const {
    candleWidth, padL, padR, padT, padB,
    yMin, yMax, yRange, candles, smaPoints,
    yScale,
  } = useMemo(() => {
    if (data.length < 2) return { candleWidth: 0, padL: 0, padR: 0, padT: 0, padB: 0, yMin: 0, yMax: 1, yRange: 1, candles: [], smaPoints: [], yScale: 0 };

    const pL = 8, pR = 8, pT = 16, pB = 16;
    const w = 360;
    const h = height;

    const vals = data.flatMap(d => [d.high, d.low]);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rng = mx - mn || 1;
    const ext = rng * 0.08;
    const yMn = mn - ext;
    const yMx = mx + ext;
    const yR = yMx - yMn || 1;

    const totalW = w - pL - pR;
    const cw = Math.max(2, totalW / data.length * 0.7);

    const sma = calcSMA(data, 9);

    const cRendered = data.map((d, i) => {
      const cx = pL + (i / (data.length - 1)) * totalW;
      const isUp = d.close >= d.open;
      const top = Math.max(d.close, d.open);
      const bot = Math.min(d.close, d.open);
      const bodyH = Math.max(1.5, ((top - bot) / yR) * (h - pT - pB));
      const bodyY = (h - pB) - ((top - yMn) / yR) * (h - pT - pB);
      const wickTopY = (h - pB) - ((d.high - yMn) / yR) * (h - pT - pB);
      const wickBotY = (h - pB) - ((d.low - yMn) / yR) * (h - pT - pB);
      return { cx, isUp, bodyH, bodyY, wickTopY, wickBotY, d };
    });

    const smaPts = sma.map((v, i) => {
      if (v == null) return null;
      const cx = pL + (i / (data.length - 1)) * totalW;
      return { x: cx, y: (h - pB) - ((v - yMn) / yR) * (h - pT - pB) };
    }).filter(p => p !== null) as { x: number; y: number }[];

    return {
      candleWidth: cw, padL: pL, padR: pR, padT: pT, padB: pB,
      yMin: yMn, yMax: yMx, yRange: yR,
      candles: cRendered, smaPoints: smaPts,
      yScale: (h - pT - pB) / yR,
    };
  }, [data, height]);

  const handleTouch = useCallback((pageX: number, containerX: number) => {
    if (data.length < 2) return;
    const relX = pageX - containerX;
    const totalW = (chartWidthRef.current || 360) - padL - padR;
    const frac = Math.max(0, Math.min(1, (relX - padL) / totalW));
    const idx = Math.round(frac * (data.length - 1));
    setCrosshairX(Math.max(0, Math.min(data.length - 1, idx)));
  }, [data.length, padL, padR]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        handleTouch(e.nativeEvent.pageX, 0);
      },
      onPanResponderMove: (e) => {
        handleTouch(e.nativeEvent.pageX, 0);
      },
      onPanResponderRelease: () => {
        setCrosshairX(null);
      },
    })
  ).current;

  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.loadingText}>Esperando datos...</Text>
      </View>
    );
  }

  const svgW = 360;
  const svgH = height;
  const hoverCandle = crosshairX != null ? candles[crosshairX] : null;

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(e) => { chartWidthRef.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(frac => {
          const y = svgH * frac;
          return (
            <Line key={frac} x1="0" y1={y} x2={svgW} y2={y}
              stroke={colors.border} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
          );
        })}

        {/* SMA9 line */}
        {smaPoints.length > 1 && smaPoints.map((pt, i) => {
          if (i === 0) return null;
          const prev = smaPoints[i - 1];
          return (
            <Line key={`sma${i}`} x1={prev.x} y1={prev.y} x2={pt.x} y2={pt.y}
              stroke={colors.blue} strokeWidth="1" opacity="0.6" />
          );
        })}

        {/* Candles */}
        {candles.map((c, i) => (
          <G key={`c${i}`}>
            <Line x1={c.cx} y1={c.wickTopY} x2={c.cx} y2={c.wickBotY}
              stroke={c.isUp ? colors.green : colors.coral} strokeWidth="1" />
            <Rect x={c.cx - candleWidth / 2} y={c.bodyY}
              width={candleWidth} height={Math.max(1.5, c.bodyH)}
              fill={c.isUp ? colors.green : colors.coral}
              rx="1" />
          </G>
        ))}

        {/* Crosshair */}
        {hoverCandle && (
          <>
            <Line x1={hoverCandle.cx} y1="0" x2={hoverCandle.cx} y2={svgH}
              stroke={colors.textMuted} strokeWidth="0.5" opacity="0.5" />
            <Line x1="0" y1={hoverCandle.wickTopY} x2={svgW} y2={hoverCandle.wickTopY}
              stroke={colors.textMuted} strokeWidth="0.3" opacity="0.3" strokeDasharray="2,2" />
          </>
        )}
      </Svg>

      {/* Tooltip overlay */}
      {hoverCandle && (
        <View style={[styles.tooltip, { left: Math.min(hoverCandle.cx * (chartWidthRef.current / svgW) + 8, (chartWidthRef.current || svgW) - 130) }]}>
          <View style={styles.tooltipRow}>
            <Text style={[styles.tooltipPrice, { color: hoverCandle.isUp ? colors.green : colors.coral }]}>
              {hoverCandle.isUp ? '▲' : '▼'} ${hoverCandle.d.close.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.tooltipDetail}>O: ${hoverCandle.d.open.toFixed(2)}</Text>
          <Text style={styles.tooltipDetail}>H: ${hoverCandle.d.high.toFixed(2)}  L: ${hoverCandle.d.low.toFixed(2)}</Text>
          <Text style={styles.tooltipDetail}>Vol: {(hoverCandle.d.volume / 1000).toFixed(0)}K</Text>
        </View>
      )}

      {/* Price labels (y-axis) */}
      <View style={styles.priceLabels}>
        <Text style={styles.priceLabel}>${yMax.toFixed(2)}</Text>
        <Text style={styles.priceLabel}>${((yMin + yMax) / 2).toFixed(2)}</Text>
        <Text style={styles.priceLabel}>${yMin.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.card,
  },
  loadingText: {
    textAlign: 'center',
    paddingTop: 80,
    color: colors.textMuted,
    fontSize: fonts.sizes.sm,
  },
  tooltip: {
    position: 'absolute',
    top: 4,
    backgroundColor: `${colors.text}F0`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    minWidth: 110,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tooltipPrice: {
    fontSize: fonts.sizes.md,
    fontWeight: '700',
  },
  tooltipDetail: {
    color: colors.white,
    fontSize: fonts.sizes.xs,
    opacity: 0.8,
    marginTop: 1,
  },
  priceLabels: {
    position: 'absolute',
    right: 4,
    top: 16,
    bottom: 16,
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
