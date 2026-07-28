'use client';
import { colors as C, radius as R, font as F, spacing as S, transition as T } from '@/src/utils/webTheme';
import { useState, useEffect, useCallback } from 'react';
import Card from '@/src/components/ui/Card';
import Badge from '@/src/components/ui/Badge';
import Button from '@/src/components/ui/Button';
import ScoreBar from '@/src/components/ui/ScoreBar';
import ThinkingOrbLoader from '@/src/components/ThinkingOrbLoader';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AlgoAlert {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  pattern: 'volume_spike' | 'breakout' | 'momentum_reversal' | 'accumulation' | 'squeeze';
  patternLabel: string;
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'MODERATE';
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  reasons: string[];
  volumeRatio: number;
  rsi: number | null;
  sector: string;
  marketCap: number;
  detectedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtMarketCap(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const PATTERN_CONFIG: Record<string, { icon: string; color: string; bgGlow: string }> = {
  volume_spike:        { icon: '📊', color: C.info,    bgGlow: 'rgba(103, 232, 249, 0.06)' },
  breakout:            { icon: '🚀', color: C.accentLight, bgGlow: 'rgba(94, 234, 212, 0.06)' },
  momentum_reversal:   { icon: '⚡', color: C.warning, bgGlow: 'rgba(251, 191, 36, 0.06)' },
  accumulation:        { icon: '🏦', color: C.positive, bgGlow: 'rgba(52, 211, 153, 0.06)' },
  squeeze:             { icon: '💥', color: C.negative, bgGlow: 'rgba(251, 113, 133, 0.06)' },
};

const CONFIDENCE_VARIANT: Record<string, 'positive' | 'warning' | 'info'> = {
  HIGH: 'positive',
  MEDIUM: 'warning',
  MODERATE: 'info',
};

function getScoreColor(score: number): string {
  if (score >= 80) return C.positive;
  if (score >= 65) return C.info;
  if (score >= 55) return C.warning;
  return C.textMuted;
}

// ─── Alert Card ──────────────────────────────────────────────────────────────

function AlertCard({ alert, rank, onSelect }: { alert: AlgoAlert; rank: number; onSelect: (sym: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = PATTERN_CONFIG[alert.pattern] || PATTERN_CONFIG.volume_spike;

  return (
    <Card padding="0" hover glow={alert.confidence === 'HIGH'}>
      <div style={{ padding: `${S.lg} ${S.xl}` }}>
        {/* Row 1: Rank + Symbol + Pattern + Score */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.md, marginBottom: S.md }}>
          <div style={{
            width: 32, height: 32, borderRadius: R.sm,
            background: rank <= 3 ? C.gradientPrimary : C.bgElevated,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: F.sizeMd, fontWeight: 800, color: rank <= 3 ? '#fff' : C.textSecondary,
            fontFamily: F.mono, flexShrink: 0,
          }}>
            {rank}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' }}>
              <span style={{ fontSize: F.sizeXl, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                {alert.symbol}
              </span>
              <Badge variant={CONFIDENCE_VARIANT[alert.confidence]} size="sm" dot>{alert.confidence}</Badge>
              <span style={{
                fontSize: F.sizeXs, padding: '1px 6px', borderRadius: R.sm,
                background: cfg.bgGlow, color: cfg.color, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {cfg.icon} {alert.patternLabel}
              </span>
            </div>
            <div style={{ fontSize: F.sizeSm, color: C.textMuted, marginTop: 1 }}>
              {alert.name}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: getScoreColor(alert.score), fontFamily: F.mono, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {alert.score}
            </div>
            <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 2 }}>/100</div>
          </div>
        </div>

        {/* Row 2: Price + Change + Sector */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: S.sm, marginBottom: S.md }}>
          <span style={{ fontSize: F.sizeHero, fontWeight: 700, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.01em' }}>
            {fmtPrice(alert.price)}
          </span>
          <span style={{
            fontSize: F.sizeMd, fontWeight: 600,
            color: alert.changePercent >= 0 ? C.positive : C.negative,
            fontFamily: F.mono,
          }}>
            {alert.changePercent >= 0 ? '+' : ''}{alert.changePercent.toFixed(2)}%
          </span>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted, marginLeft: 'auto' }}>
            {alert.sector} &middot; {fmtMarketCap(alert.marketCap)}
          </span>
        </div>

        {/* Row 3: Score Bar */}
        <div style={{ marginBottom: S.md }}>
          <ScoreBar score={alert.score} label="Algo Score" />
        </div>

        {/* Row 4: Key Levels */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: S.xs, marginBottom: S.md,
        }}>
          <LevelCell label="ENTRY" value={fmtPrice(alert.entry)} color={C.accentLight} />
          <LevelCell label="TARGET 1" value={fmtPrice(alert.target1)} color={C.positive} />
          <LevelCell label="STOP LOSS" value={fmtPrice(alert.stopLoss)} color={C.negative} />
          <LevelCell label="R/R" value={`${alert.riskReward.toFixed(1)}:1`} color={alert.riskReward >= 2 ? C.positive : C.warning} />
        </div>

        {/* Row 5: Volume + RSI */}
        <div style={{ display: 'flex', gap: S.md, marginBottom: S.md }}>
          <MiniStat label="Vol Ratio" value={`${alert.volumeRatio}x`} color={alert.volumeRatio > 2 ? C.info : C.textSecondary} />
          <MiniStat label="RSI" value={alert.rsi !== null ? `${alert.rsi}` : '—'} color={alert.rsi !== null && alert.rsi > 70 ? C.negative : alert.rsi !== null && alert.rsi < 30 ? C.positive : C.textSecondary} />
        </div>

        {/* Row 6: Reasons (collapsible) */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: S.md }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none', border: 'none', color: C.accentLight, cursor: 'pointer',
              fontSize: F.sizeSm, padding: 0, display: 'flex', alignItems: 'center', gap: S.xs,
              fontFamily: F.family, fontWeight: 500, transition: T.fast,
            }}
          >
            {expanded ? '▾' : '▸'} {alert.reasons.length} razones detectadas
          </button>
          {expanded && (
            <ul style={{
              margin: `${S.sm} 0 0`, paddingLeft: '18px',
              listStyleType: 'disc',
            }}>
              {alert.reasons.map((r, i) => (
                <li key={i} style={{ fontSize: F.sizeSm, color: C.textSecondary, marginBottom: 2, lineHeight: 1.4 }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Row 7: Actions */}
        <div style={{ display: 'flex', gap: S.sm, marginTop: S.md }}>
          <Button variant="primary" size="sm" onClick={() => onSelect(alert.symbol)}>
            Analizar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>
            Detalles
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Small Components ────────────────────────────────────────────────────────

function LevelCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 10px', background: C.bgCardHover, borderRadius: R.sm,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: F.sizeSm, fontWeight: 700, color, fontFamily: F.mono }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: S.xs }}>
      <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: F.sizeSm, fontWeight: 600, color, fontFamily: F.mono }}>{value}</span>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export default function AlgoAlertsPanel({ onSelectStock }: { onSelectStock: (symbol: string) => void }) {
  const [alerts, setAlerts] = useState<AlgoAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadAlerts = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/algo-alerts');
      if (res.status === 429) {
        setError('Rate limit — espera un momento');
        return;
      }
      const data = await res.json();
      setAlerts(data.alerts || []);
      setScanned(data.scanned || 0);
      setGeneratedAt(data.generatedAt || null);
    } catch {
      setError('Error cargando alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(() => loadAlerts(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.pattern === filter);

  const patternCounts = alerts.reduce((acc, a) => {
    acc[a.pattern] = (acc[a.pattern] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ animation: 'fadeIn 0.2s ease forwards' }}>
      {/* Header */}
      <div style={{
        background: C.bgCard, borderRadius: R.xl, padding: S.xl,
        border: `1px solid ${C.border}`, marginBottom: S.lg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
            <div style={{
              width: 36, height: 36, borderRadius: R.sm,
              background: 'linear-gradient(135deg, rgba(103,232,249,0.15), rgba(94,234,212,0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              🎯
            </div>
            <div>
              <h2 style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeLg, fontWeight: 800 }}>
                Algo Alerts
              </h2>
              <p style={{ margin: 0, color: C.textMuted, fontSize: F.sizeXs, marginTop: 2 }}>
                Patrones de actividad inusual detectados por algoritmo
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadAlerts(false)}>
            {loading ? '...' : '↻ Refresh'}
          </Button>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: S.xs, flexWrap: 'wrap' }}>
          {[
            ['all', 'Todos', C.textPrimary],
            ['volume_spike', '📊 Volumen', C.info],
            ['breakout', '🚀 Breakout', C.accentLight],
            ['momentum_reversal', '⚡ Momentum', C.warning],
            ['accumulation', '🏦 Acumulación', C.positive],
            ['squeeze', '💥 Squeeze', C.negative],
          ].map(([key, label, color]) => (
            <button
              key={key}
              onClick={() => setFilter(key as string)}
              style={{
                padding: `${S.xs} ${S.md}`, borderRadius: R.sm,
                border: 'none', cursor: 'pointer',
                background: filter === key ? C.bgElevated : 'transparent',
                color: filter === key ? (color as string) : C.textMuted,
                fontWeight: filter === key ? 600 : 400,
                fontSize: F.sizeXs, fontFamily: F.family,
                transition: T.fast,
                borderBottom: filter === key ? `2px solid ${color as string}` : '2px solid transparent',
              }}
            >
              {label as string}
              {key !== 'all' && patternCounts[key as string] ? (
                <span style={{
                  marginLeft: 4, fontSize: 10, background: C.bgElevated,
                  padding: '1px 5px', borderRadius: 10, fontWeight: 700,
                }}>
                  {patternCounts[key as string]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: S.lg, marginTop: S.md,
          fontSize: F.sizeXs, color: C.textMuted,
        }}>
          <span>{filtered.length} alertas</span>
          <span>{scanned} stocks escaneados</span>
          {generatedAt && <span>Hace {timeAgo(generatedAt)}</span>}
        </div>
      </div>

      {/* Loading */}
      {loading && alerts.length === 0 && (
        <ThinkingOrbLoader state="working" size={64} label="Escaneando mercado..." />
      )}

      {/* Error */}
      {error && (
        <div style={{
          textAlign: 'center', padding: S.xl, color: C.negative,
          background: C.negativeBg, borderRadius: R.lg,
          border: `1px solid ${C.negativeBorder}`,
        }}>
          <div style={{ fontSize: 24, marginBottom: S.sm }}>⚠️</div>
          <div style={{ fontSize: F.sizeSm }}>{error}</div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: S.xxl, color: C.textMuted,
          background: C.bgCard, borderRadius: R.lg,
          border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 32, marginBottom: S.sm }}>🔍</div>
          <div style={{ fontSize: F.sizeBase, fontWeight: 500 }}>Sin alertas en este momento</div>
          <div style={{ fontSize: F.sizeXs, marginTop: 4 }}>El mercado no presenta patrones inusuales ahora</div>
          {scanned > 0 && (
            <div style={{ fontSize: F.sizeXs, marginTop: 8, opacity: 0.5 }}>
              Se escanearon {scanned} stocks sin encontrar patrones por encima del umbral
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={() => loadAlerts(false)} style={{ marginTop: 12 }}>
            ↻ Reintentar
          </Button>
        </div>
      )}

      {/* Alert Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
        {filtered.map((alert, i) => (
          <div key={alert.symbol} style={{ animation: `fadeInUp 0.2s ease ${Math.min(i * 0.03, 0.3)}s both` }}>
            <AlertCard alert={alert} rank={i + 1} onSelect={onSelectStock} />
          </div>
        ))}
      </div>
    </div>
  );
}
