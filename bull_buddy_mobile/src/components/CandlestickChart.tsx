import { View } from 'react-native';
import Svg, { Line, Rect, G } from 'react-native-svg';
import { theme } from '../constants/theme';
import type { CandleData } from '../types';

interface Props {
  data: CandleData[];
  width?: number;
  height?: number;
}

export function CandlestickChart({ data, width = 340, height = 220 }: Props) {
  if (!data.length) return null;

  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const high = Math.max(...data.map(d => d.high));
  const low = Math.min(...data.map(d => d.low));
  const range = high - low || 1;

  const candleW = Math.max(2, chartW / data.length - 2);
  const halfW = Math.max(1, candleW * 0.35);

  return (
    <View style={{ width, height, backgroundColor: theme.bgAlt, borderRadius: 12, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <G x={padding.left} y={padding.top}>
          {data.map((c, i) => {
            const x = (i / data.length) * chartW + candleW / 2;
            const yHigh = ((high - c.high) / range) * chartH;
            const yLow = ((high - c.low) / range) * chartH;
            const yOpen = ((high - c.open) / range) * chartH;
            const yClose = ((high - c.close) / range) * chartH;
            const up = c.close >= c.open;

            return (
              <G key={i}>
                <Line
                  x1={x - 0.5} y1={yHigh} x2={x - 0.5} y2={yLow}
                  stroke={up ? theme.gain : theme.loss}
                  strokeWidth={1}
                />
                <Rect
                  x={x - halfW}
                  y={up ? yClose : yOpen}
                  width={halfW * 2}
                  height={Math.max(1, Math.abs(yClose - yOpen))}
                  fill={up ? theme.gain : theme.loss}
                />
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
