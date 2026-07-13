'use client';

import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';
import { useMLSignal } from '@/src/hooks/useMLSignal';
import MLSignalBadge from './MLSignalBadge';

interface FrameworkScenario {
  id: string;
  name: string;
  icon: string;
  match: boolean;
  desc: string;
  verdict: string | null;
}

interface StockDetailData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  signal: 'BUY' | 'HOLD' | 'SELL';
  score: number;
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  components: Record<string, number>;
  framework?: {
    fcfYield: number;
    fcfPositive: boolean;
    score: number;
    activeScenarios: string[];
    scenarios: FrameworkScenario[];
  };
  details?: {
    marketCap: number;
    peRatio: number;
    sector?: string;
    trend?: string;
    rsi?: number;
    fcf?: number;
  };
}

interface StockDetailPanelProps {
  data: StockDetailData;
  onClose?: () => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
}

function toFixed(n: number | null | undefined, digits: number): string {
  if (n == null || isNaN(n)) return '0.00';
  return n.toFixed(digits);
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(2);
}

const detailSignalColors: Record<string, { text: string; label: string }> = {
  BUY: { text: C.positive, label: 'COMPRAR' },
  HOLD: { text: C.warning, label: 'MANTENER' },
  SELL: { text: C.negative, label: 'VENDER' },
};
const fallbackDetailSignal = { text: C.textMuted, label: '—' };

export default function StockDetailPanel({ data, onClose, onAnalyze, analyzing }: StockDetailPanelProps) {
  const c = detailSignalColors[data.signal] || fallbackDetailSignal;
  const fw = data.framework;
  const fp = data.components;
  const { mlResult, loading: mlLoading } = useMLSignal(data);

  return (
    <div style={{ background: C.bgCard, borderRadius: '12px', border: '1px solid ' + C.border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{ margin: 0, color: C.textPrimary, fontSize: '24px', fontWeight: '700' }}>{data.symbol}</h2>
              {data.details?.sector && (
                <span style={{ color: C.textMuted, fontSize: '11px', background: C.bg, padding: '2px 8px', borderRadius: '4px' }}>
                  {data.details.sector}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: C.textMuted, fontSize: '14px' }}>{data.name}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '20px', padding: '4px 8px' }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '16px' }}>
          <div>
            <div style={{ color: C.textPrimary, fontWeight: '700', fontSize: '28px' }}>
              ${toFixed(data.price, 2)}
            </div>
            <div style={{ color: data.change != null && data.change >= 0 ? C.positive : C.negative, fontSize: '14px' }}>
              {(data.change != null && data.change >= 0 ? '+' : '')}{toFixed(data.change, 2)} ({(data.changePercent != null && data.changePercent >= 0 ? '+' : '')}{toFixed(data.changePercent, 2)}%)
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              background: c.text === C.positive ? '#0a2e1a' : c.text === C.negative ? '#2e0a0a' : '#1a1a0a',
              border: `1px solid ${c.text}40`,
              borderRadius: '12px',
              padding: '12px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: c.text, fontWeight: '700', fontSize: '14px', letterSpacing: '1px' }}>{c.label}</div>
            <div style={{ color: c.text, fontSize: '36px', fontWeight: '800', lineHeight: 1 }}>{data.score}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <ConvictionBadge level={data.conviction} />
          <RiskBadge level={data.riskLevel} />
        </div>

        <div style={{ marginTop: '12px' }}>
          <MLSignalBadge mlResult={mlResult} loading={mlLoading} ruleBasedSignal={data.signal} />
        </div>
      </div>

      {/* Framework Metrics */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.borderLight }}>
        <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: '14px', fontWeight: '600' }}>🧩 FILTRO INICIAL</h3>
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: fw?.fcfPositive ? '#0a2e1a' : '#2e0a0a',
          border: `1px solid ${fw?.fcfPositive ? C.positive : C.negative}40`,
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '20px', marginRight: '8px' }}>{fw?.fcfPositive ? '✅' : '⚠️'}</span>
          <span style={{ color: fw?.fcfPositive ? C.positive : C.negative, fontWeight: '700', fontSize: '15px' }}>
            {fw?.fcfPositive ? 'FCF POSITIVO — Modo Valor' : 'FCF NEGATIVO — Modo Growth'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          <MetricCard
            label="💰 FCF Yield"
            value={`${toFixed(fp?.fcfYield, 1)}%`}
            good={fp?.fcfYield > 5}
            detail={fp?.fcfYield > 10 ? '💎 Muy barata' : fp?.fcfYield > 5 ? '✅ Buena' : fp?.fcfYield > 3 ? '😐 Normal' : '⚠️ Cara'}
          />
          <MetricCard
            label="📊 P/E Ratio"
            value={fp?.peRatio > 0 ? toFixed(fp?.peRatio, 1) : 'N/A'}
            good={fp?.peRatio > 0 && fp?.peRatio < 25}
            detail={fp?.peRatio > 0 && fp?.peRatio < 15 ? 'Value' : fp?.peRatio > 0 && fp?.peRatio < 25 ? 'Balanceada' : fp?.peRatio < 40 ? 'Growth' : '🚨 Alta'}
          />
          <MetricCard
            label="📈 Revenue Growth"
            value={`${fp?.revenueGrowth >= 0 ? '+' : ''}${toFixed(fp?.revenueGrowth, 1)}%`}
            good={fp?.revenueGrowth > 0}
            detail={fp?.revenueGrowth > 20 ? '🚀 Alto' : fp?.revenueGrowth > 10 ? '✅ Saludable' : fp?.revenueGrowth > 0 ? '🐢 Lento' : '🚨 Problema'}
          />
          <MetricCard
            label="🧾 Profit Margin"
            value={`${toFixed(fp?.profitMargin, 1)}%`}
            good={fp?.profitMargin > 10}
            detail={fp?.profitMargin > 20 ? '💪 Excelente' : fp?.profitMargin > 10 ? '✅ Bueno' : '⚠️ Débil'}
          />
        </div>

        {fw && (
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: C.bg,
            border: '1px solid ' + C.borderLight,
            textAlign: 'center',
          }}>
            <span style={{ color: C.textMuted, fontSize: '13px' }}>Framework Score: </span>
            <span style={{
              color: fw.score >= 8 ? C.positive : fw.score >= 5 ? C.warning : C.negative,
              fontWeight: '800',
              fontSize: '22px',
            }}>
              {fw.score}/10
            </span>
            <span style={{
              marginLeft: '12px',
              color: fw.score >= 8 ? C.positive : fw.score >= 5 ? C.warning : C.negative,
              fontWeight: '700',
              fontSize: '14px',
            }}>
              {fw.score >= 8 ? '💎 FUERTE COMPRA' : fw.score >= 5 ? '🤔 EVALUAR' : '❌ EVITAR'}
            </span>
          </div>
        )}
      </div>

      {/* Scenarios */}
      {fw && fw.scenarios && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.borderLight }}>
          <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: '14px', fontWeight: '600' }}>🔥 ESCENARIOS</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
            {fw.scenarios.map(sc => (
              <div
                key={sc.id}
                style={{
                  padding: '12px 14px',
                  background: sc.match ? '#1a2332' : C.bg,
                  borderRadius: '10px',
                  border: sc.match ? '2px solid ' + (sc.id === 'joyas' ? C.positive : sc.id === 'growth' ? C.accent : C.negative) : '1px solid ' + C.borderLight,
                  opacity: sc.match ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>{sc.icon}</span>
                  <span style={{
                    color: sc.match ? C.textPrimary : C.textMuted,
                    fontWeight: '700',
                    fontSize: '14px',
                  }}>
                    {sc.name}
                  </span>
                </div>
                <p style={{ margin: '4px 0', color: C.textMuted, fontSize: '11px', lineHeight: '1.4' }}>
                  {sc.desc}
                </p>
                {sc.verdict && (
                  <p style={{
                    margin: '6px 0 0',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: sc.id === 'joyas' ? C.positive : sc.id === 'growth' ? C.accent : C.negative,
                  }}>
                    {sc.verdict}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Stats */}
      {data.details && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + C.borderLight }}>
          <h3 style={{ margin: '0 0 12px', color: C.textPrimary, fontSize: '14px', fontWeight: '600' }}>MÉTRICAS CLAVE</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
            <StatItem label="Market Cap" value={data.details.marketCap > 0 ? fmtCompact(data.details.marketCap) : 'N/A'} />
            <StatItem label="P/E" value={data.details.peRatio > 0 ? toFixed(data.details.peRatio, 1) : 'N/A'} />
            <StatItem label="Free Cash Flow" value={data.details.fcf != null ? fmtCompact(data.details.fcf) : 'N/A'} />
            {data.details.rsi != null && <StatItem label="RSI" value={toFixed(data.details.rsi, 0)} />}
            {data.details.trend && <StatItem label="Tendencia" value={data.details.trend} />}
          </div>
        </div>
      )}

      {/* Analyze Button */}
      <div style={{ padding: '16px 20px', textAlign: 'center' }}>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          style={{
            background: C.accent,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 32px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: analyzing ? 'not-allowed' : 'pointer',
            opacity: analyzing ? 0.7 : 1,
            width: '100%',
            maxWidth: '400px',
          }}
        >
          {analyzing ? 'Analizando...' : `🤖 Analizar ${data.symbol} con IA`}
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, good, detail }: { label: string; value: string; good: boolean; detail: string }) {
  return (
    <div style={{
      background: C.bg,
      borderRadius: '8px',
      padding: '10px 12px',
      border: '1px solid ' + C.borderLight,
      borderLeft: '3px solid ' + (good ? C.positive : C.negative),
    }}>
      <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: good ? C.positive : C.negative, fontSize: '20px', fontWeight: '800' }}>{value}</div>
      <div style={{ color: C.textMuted, fontSize: '10px', marginTop: '2px' }}>{detail}</div>
    </div>
  );
}

function ConvictionBadge({ level }: { level: string }) {
  const colors: Record<string, { text: string; bg: string }> = {
    HIGH: { text: C.positive, bg: '#0a2e1a' },
    MEDIUM: { text: C.warning, bg: '#1a1a0a' },
    LOW: { text: C.textMuted, bg: C.bg },
  };
  const c = colors[level] || colors.LOW;
  return (
    <span style={{
      color: c.text, fontSize: '12px', fontWeight: '600', background: c.bg,
      padding: '4px 12px', borderRadius: '20px', border: `1px solid ${c.text}40`,
    }}>
      {level === 'HIGH' ? '🔥 Alta Convicción' : level === 'MEDIUM' ? '⚡ Media Convicción' : '💭 Baja Convicción'}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, { text: string; bg: string }> = {
    LOW: { text: C.positive, bg: '#0a2e1a' },
    MEDIUM: { text: C.warning, bg: '#1a1a0a' },
    HIGH: { text: C.negative, bg: '#2e0a0a' },
  };
  const c = colors[level] || colors.MEDIUM;
  return (
    <span style={{
      color: c.text, fontSize: '12px', fontWeight: '600', background: c.bg,
      padding: '4px 12px', borderRadius: '20px', border: `1px solid ${c.text}40`,
    }}>
      Riesgo: {level === 'LOW' ? 'Bajo' : level === 'MEDIUM' ? 'Medio' : 'Alto'}
    </span>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: '6px', padding: '8px 12px', border: '1px solid ' + C.borderLight }}>
      <div style={{ color: C.textMuted, fontSize: '11px', marginBottom: '2px' }}>{label}</div>
      <div style={{ color: C.textPrimary, fontSize: '14px', fontWeight: '700' }}>{value}</div>
    </div>
  );
}
