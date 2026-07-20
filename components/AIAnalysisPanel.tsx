'use client';

import { useState, useEffect } from 'react';
import { AnalysisResult } from '@/src/types/ai-analysis';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

interface Props {
  symbol: string;
}

interface AnalysisResponse {
  success: boolean;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  name: string;
  analysis: AnalysisResult;
  timestamp: string;
}

const VERDICT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BUY: { bg: 'rgba(16, 185, 129, 0.15)', border: C.positive, text: C.positive },
  HOLD: { bg: 'rgba(245, 158, 11, 0.15)', border: C.warning, text: C.warning },
  SELL: { bg: 'rgba(239, 68, 68, 0.15)', border: C.negative, text: C.negative },
};

const CONVICTION_COLORS: Record<string, string> = {
  HIGH: C.positive,
  MEDIUM: C.warning,
  LOW: C.negative,
};

const SIGNAL_ICONS: Record<string, string> = {
  bullish: '🟢',
  bearish: '🔴',
  lateral: '🟡',
  mixed: '🟠',
  neutral: '⚪',
  accumulation: '🟢',
  distribution: '🔴',
  confirmed: '🟢',
  imminent: '🟡',
  none: '⚪',
  failed: '🔴',
};

const RISK_COLORS: Record<string, string> = {
  low: C.positive,
  medium: C.warning,
  high: C.negative,
};

export default function AIAnalysisPanel({ symbol }: Props) {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/v1/ai/analysis?symbol=${symbol}`)
      .then(async res => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || `Server error ${res.status}`);
        }
        return json;
      })
      .then(json => {
        if (active && json?.success) setData(json);
        else if (active) setError(json?.error || 'Analysis failed');
      })
      .catch(err => {
        if (active) setError(err.message || 'Failed to load analysis');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [symbol]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState symbol={symbol} error={error} onRetry={() => setLoading(true)} />;
  if (!data) return null;

  const a = data.analysis;
  const vc = VERDICT_COLORS[a.verdict] || VERDICT_COLORS.HOLD;

  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: `${S.lg} ${S.lg}`,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: R.md,
            background: C.gradientPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🧠</div>
          <div>
            <div style={{ fontSize: F.sizeBase, fontWeight: 700, color: C.textPrimary }}>
              AI Analysis — {data.symbol}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>
              {data.name} | ${data.price.toFixed(2)} ({data.change >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%)
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: R.md,
            background: vc.bg,
            border: `1px solid ${vc.border}`,
            color: vc.text,
            fontWeight: 700,
            fontSize: F.sizeBase,
            letterSpacing: '0.05em',
          }}>{a.verdict}</div>
          <div style={{
            padding: '4px 10px',
            borderRadius: R.full,
            background: `${C.textSecondary}08`,
            border: `1px solid ${CONVICTION_COLORS[a.conviction]}40`,
            color: CONVICTION_COLORS[a.conviction],
            fontSize: F.sizeXs,
            fontWeight: 600,
          }}>{a.conviction}</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: `${S.md} ${S.lg}`,
        borderBottom: `1px solid ${C.border}`,
        background: C.accentGlow,
      }}>
        <p style={{
          margin: 0,
          color: C.textPrimary,
          fontSize: F.sizeBase,
          lineHeight: 1.6,
          fontStyle: 'italic',
        }}>"{a.summary}"</p>
      </div>

      {/* Analysis Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: C.border,
      }}>
        <AnalysisCard title="Trend" signal={a.analysis.trend.signal} detail={a.analysis.trend.detail} strength={a.analysis.trend.strength} />
        <AnalysisCard title="EMAs" signal={a.analysis.ema.signal} detail={a.analysis.ema.detail} extra={a.analysis.ema.alignment} />
        <AnalysisCard title="Breakout" signal={a.analysis.breakout.status || a.analysis.breakout.signal} detail={a.analysis.breakout.detail} level={a.analysis.breakout.level} />
        <AnalysisCard title="Volume" signal={a.analysis.volume.signal} detail={a.analysis.volume.detail} ratio={a.analysis.volume.vsAverage} />
        <AnalysisCard title="Momentum" signal={a.analysis.momentum.signal || 'neutral'} detail={a.analysis.momentum.detail} rsi={a.analysis.momentum.rsi} macd={a.analysis.momentum.macd} />
        <AnalysisCard title="Risk" signal={a.analysis.risk.level || a.analysis.risk.signal} detail={a.analysis.risk.detail} atr={a.analysis.risk.atr} />
      </div>

      {/* Entry Zone */}
      {a.entry.ideal > 0 && (
        <div style={{
          padding: `${S.md} ${S.lg}`,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm }}>
            🎯 Entry Zone
          </div>
          <div style={{ display: 'flex', gap: S.lg, flexWrap: 'wrap' }}>
            <MetricChip label="Entry" value={`$${a.entry.ideal.toFixed(2)}`} color={C.accent} />
            <MetricChip label="SL" value={`$${a.entry.stopLoss.toFixed(2)}`} color={C.negative} />
            <MetricChip label="TP1" value={`$${a.entry.tp1.toFixed(2)}`} color={C.positive} />
            <MetricChip label="TP2" value={`$${a.entry.tp2.toFixed(2)}`} color={C.positive} />
            {a.entry.ideal > 0 && a.entry.stopLoss > 0 && (
              <MetricChip
                label="R:R"
                value={`${((a.entry.tp1 - a.entry.ideal) / (a.entry.ideal - a.entry.stopLoss)).toFixed(1)}:1`}
                color={C.accent}
              />
            )}
          </div>
        </div>
      )}

      {/* Supports & Resistances */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
        background: C.border,
      }}>
        <LevelList title="📌 Supports" items={a.support} color={C.positive} />
        <LevelList title="📌 Resistances" items={a.resistance} color={C.negative} />
      </div>

      {/* Catalysts & Warnings */}
      {(a.catalysts.length > 0 || a.warnings.length > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: a.catalysts.length > 0 && a.warnings.length > 0 ? '1fr 1fr' : '1fr',
          gap: 1,
          background: C.border,
        }}>
          {a.catalysts.length > 0 && (
            <div style={{ background: C.bgCard, padding: `${S.md} ${S.lg}` }}>
              <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.positive, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm }}>
                ⚡ Catalysts
              </div>
              {a.catalysts.map((c, i) => (
                <div key={i} style={{ fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: C.positive }}>•</span>
                  {c}
                </div>
              ))}
            </div>
          )}
          {a.warnings.length > 0 && (
            <div style={{ background: C.bgCard, padding: `${S.md} ${S.lg}` }}>
              <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.negative, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm }}>
                ⚠️ Warnings
              </div>
              {a.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: C.negative }}>•</span>
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div style={{
        padding: `${S.xs} ${S.lg}`,
        borderTop: `1px solid ${C.border}`,
        fontSize: F.sizeXs,
        color: C.textMuted,
      }}>
        Generated at {new Date(data.timestamp).toLocaleTimeString()} • Powered by AI
      </div>
    </div>
  );
}

function AnalysisCard({
  title, signal, detail, strength, level, ratio, rsi, macd, extra,
}: {
  title: string;
  signal: string;
  detail: string;
  strength?: string;
  level?: number;
  ratio?: number;
  rsi?: number;
  macd?: string;
  extra?: string;
}) {
  const icon = SIGNAL_ICONS[signal] || '⚪';
  const isPositive = ['bullish', 'accumulation', 'confirmed', 'imminent', 'low'].includes(signal);
  const isNegative = ['bearish', 'distribution', 'failed', 'high'].includes(signal);

  const accentColor = isPositive ? C.positive : isNegative ? C.negative : C.textMuted;

  return (
    <div style={{
      background: C.bgCard,
      padding: `${S.md} ${S.md}`,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xs }}>
        <span style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{ fontSize: 14 }}>{icon}</span>
      </div>
      <div style={{
        fontSize: F.sizeBase,
        fontWeight: 700,
        color: accentColor,
        textTransform: 'uppercase',
        marginBottom: 2,
      }}>
        {signal}
      </div>
      {strength && (
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>
          {strength}
        </div>
      )}
      {extra && (
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>
          {extra}
        </div>
      )}
      {level != null && level > 0 && (
        <div style={{ fontSize: F.sizeXs, color: C.accent, marginBottom: 2 }}>
          @ ${level.toFixed(2)}
        </div>
      )}
      {ratio != null && (
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>
          {ratio.toFixed(1)}x avg
        </div>
      )}
      {rsi != null && (
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>
          RSI: {rsi.toFixed(0)}
        </div>
      )}
      {macd && (
        <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>
          MACD: {macd}
        </div>
      )}
      <div style={{ fontSize: F.sizeXs, color: C.textSecondary, lineHeight: 1.4 }}>
        {detail}
      </div>
    </div>
  );
}

function MetricChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: S.xs }}>
      <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: F.sizeSm, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function LevelList({ title, items, color }: { title: string; items: { price: number; type: string }[]; color: string }) {
  return (
    <div style={{ background: C.bgCard, padding: `${S.md} ${S.lg}` }}>
      <div style={{ fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: S.sm }}>
        {title}
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: F.sizeSm, color: C.textMuted }}>None detected</div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 0',
          borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
        }}>
          <span style={{ fontSize: F.sizeSm, fontWeight: 600, color }}>${item.price.toFixed(2)}</span>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{item.type}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      padding: S.xl,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: R.md,
          background: C.accentGlow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>🧠</div>
        <div>
          <div style={{ height: 14, width: 160, background: `${C.textSecondary}08`, borderRadius: 4, marginBottom: 4 }} />
          <div style={{ height: 10, width: 120, background: `${C.textMuted}08`, borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ height: 40, background: `${C.textMuted}08`, borderRadius: R.md, marginBottom: S.lg }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ background: `${C.border}`, padding: S.md }}>
            <div style={{ height: 10, width: 50, background: `${C.textSecondary}08`, borderRadius: 4, marginBottom: 6 }} />
            <div style={{ height: 14, width: 60, background: `${C.textSecondary}08`, borderRadius: 4, marginBottom: 4 }} />
            <div style={{ height: 10, width: '80%', background: `${C.textMuted}08`, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ symbol, error, onRetry }: { symbol: string; error: string; onRetry: () => void }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: R.lg,
      padding: S.xl,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, marginBottom: S.sm }}>⚠️</div>
      <div style={{ color: C.textMuted, fontSize: F.sizeSm, marginBottom: S.md }}>
        Failed to analyze {symbol}: {error}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: `${S.sm} ${S.lg}`,
          borderRadius: R.md,
          border: `1px solid ${C.accent}`,
          background: 'transparent',
          color: C.accent,
          cursor: 'pointer',
          fontSize: F.sizeSm,
          fontWeight: 600,
        }}
      >
        Retry
      </button>
    </div>
  );
}
