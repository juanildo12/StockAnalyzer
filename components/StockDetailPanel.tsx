'use client';

import { useState, useEffect, useRef } from 'react';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';
import ShareScreenshotModal from './ShareScreenshotModal';

interface PrincipleResult {
  name: string;
  description: string;
  value: number;
  threshold: number;
  isInDiscount: boolean;
  details: string;
}

interface StockDetailPanelProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector?: string;
  marketCap?: number;
  peRatio?: number;
  technical?: {
    rsi: number;
    sma50: number;
    sma200: number;
    trend: string;
    support: number;
    resistance: number;
    signal: string;
  };
  summary?: {
    buyZoneLow: number;
    buyZoneHigh: number;
    target1: number;
    target2: number;
    stopLoss: number;
    projectedPrice: number;
    potentialReturn: number;
    freeCashflow?: number;
    revenueGrowth?: number;
    profitMargins?: number;
  };
  recommendation?: {
    action: string;
    confidence: number;
    reasoning: string;
  };
  score?: number;
  fundamentals?: Record<string, PrincipleResult>;
  userPlan?: string;
  onClose?: () => void;
  onAddPortfolio?: () => void;
  onAddWatchlist?: () => void;
  onFullAnalysis?: () => void;
  inWatchlist?: boolean;
}

interface AIAnalysis {
  verdict: string;
  conviction: string;
  summary: string;
  entry: { ideal: number; stopLoss: number; tp1: number; tp2: number; currentOk: boolean };
  analysis: {
    trend: { signal: string; detail: string; strength?: string };
    ema: { signal: string; detail: string; alignment?: string };
    breakout: { signal: string; detail: string; level?: number };
    volume: { signal: string; detail: string; vsAverage?: number };
    momentum: { signal: string; detail: string; rsi?: number; macd?: string };
    risk: { signal: string; detail: string; atr?: number };
  };
  support: { price: number; type: string }[];
  resistance: { price: number; type: string }[];
  catalysts: string[];
  warnings: string[];
}

const VERDICT_COLORS: Record<string, { text: string; bg: string; border: string; gradient: string }> = {
  BUY: { text: C.positive, bg: `${C.positive12}`, border: `${C.positive30}`, gradient: `linear-gradient(135deg, ${C.positive08}, transparent)` },
  HOLD: { text: C.warning, bg: `${C.warning12}`, border: `${C.warning30}`, gradient: `linear-gradient(135deg, ${C.warning08}, transparent)` },
  SELL: { text: C.negative, bg: `${C.negative12}`, border: `${C.negative30}`, gradient: `linear-gradient(135deg, ${C.negative08}, transparent)` },
};

const TECH_SIGNAL_ICON: Record<string, string> = {
  bullish: '▲', bearish: '▼', lateral: '—', mixed: '◆', neutral: '—',
  accumulation: '▲', distribution: '▼', confirmed: '▲', imminent: '◆', failed: '▼',
  low: '▲', medium: '◆', high: '▼',
};

const PLAN_HIERARCHY: Record<string, number> = { free: 0, pro: 1, elite: 2, enterprise: 3 };

const PRINCIPLE_KEYS = [
  'principle1', 'principle2', 'principle3', 'principle4', 'principle5',
  'principle6', 'principle7', 'principle8', 'principle9', 'principle10',
] as const;

const PRINCIPLE_ICONS: Record<string, string> = {
  'PE Ratio': '📊', 'Price/Book': '📗', 'Debt/Equity': '🏦',
  'Current Ratio': '💧', 'ROE': '📈', 'Revenue Growth': '🚀',
  'Earnings Growth': '💰', 'Dividend Yield': '🎯', 'vs 52w Range': '📅',
  'Free Cash Flow': '💵',
};

const PRINCIPLE_DESCRIPTIONS: Record<string, string> = {
  'PE Ratio': 'P/E por debajo del promedio del sector indica subvaloración',
  'Price/Book': 'P/B bajo 1.0 sugiere compra por debajo del valor contable',
  'Debt/Equity': 'Deuda equitativa baja reduce riesgo financiero',
  'Current Ratio': 'Liquidez saludable para cubrir obligaciones',
  'ROE': 'Retorno sólido sobre el capital de los accionistas',
  'Revenue Growth': 'Crecimiento constante de ingresos año tras año',
  'Earnings Growth': 'Ganancias en expansión con margen creciente',
  'Dividend Yield': 'Rendimiento por dividendos competitivo',
  'vs 52w Range': 'Cerca del mínimo de 52 semanas = oportunidad',
  'Free Cash Flow': 'Genera efectivo libre después de inversiones',
};

function safe(n: number | null | undefined, fallback = 0): number {
  return (n != null && isFinite(n)) ? n : fallback;
}

function fmtCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return Math.abs(n) < 1000 ? n.toFixed(2) : n.toFixed(0);
}

function rr(entry: number, sl: number, tp: number): string {
  if (!entry || !sl || !tp || entry <= sl) return '—';
  return ((tp - entry) / (entry - sl)).toFixed(1) + ':1';
}

function pctChange(entry: number, target: number): string {
  if (!entry || !target || entry <= 0) return '';
  return ((target - entry) / entry * 100).toFixed(1) + '%';
}

function techColor(signal: string): string {
  const pos = ['bullish', 'accumulation', 'confirmed', 'imminent', 'low'];
  const neg = ['bearish', 'distribution', 'failed', 'high'];
  if (pos.includes(signal)) return C.positive;
  if (neg.includes(signal)) return C.negative;
  return C.textMuted;
}

export default function StockDetailPanel({
  symbol, name, price, change, changePercent, sector,
  marketCap, peRatio, technical, summary, recommendation,
  score, fundamentals, userPlan = 'free',
  onClose, onAddPortfolio, onAddWatchlist, onFullAnalysis, inWatchlist,
}: StockDetailPanelProps) {
  const [ai, setAi] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const p = safe(price);
  const ch = safe(change);
  const chp = safe(changePercent);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let active = true;
    setAiLoading(true);
    setAiError(false);
    fetch(`/api/v1/ai/analysis?symbol=${symbol}`)
      .then(r => r.json())
      .then(json => {
        if (active && json?.success && json.analysis) setAi(json.analysis);
        else if (active) setAiError(true);
      })
      .catch(() => { if (active) setAiError(true); })
      .finally(() => { if (active) setAiLoading(false); });
    return () => { active = false; };
  }, [symbol]);

  const verdict = ai?.verdict || (recommendation?.action === 'COMPRAR' ? 'BUY' : recommendation?.action === 'VENDER' ? 'SELL' : 'HOLD') || 'HOLD';
  const vc = VERDICT_COLORS[verdict] || VERDICT_COLORS.HOLD;
  const conviction = ai?.conviction || 'MEDIUM';

  const aiEntry = ai?.entry?.ideal || 0;
  const aiStop = ai?.entry?.stopLoss || 0;
  const aiTp1 = ai?.entry?.tp1 || 0;
  const aiTp2 = ai?.entry?.tp2 || 0;
  const sumEntry = summary?.buyZoneLow || 0;
  const sumStop = summary?.stopLoss || 0;
  const sumTp1 = summary?.target1 || 0;
  const sumTp2 = summary?.target2 || 0;
  const techSupport = technical?.support || 0;
  const techResistance = technical?.resistance || 0;

  const entry = aiEntry || sumEntry || (techSupport > 0 && techSupport < p ? techSupport : 0);
  const stop = aiStop || sumStop || (techSupport > 0 && techSupport < p ? +(techSupport * 0.97).toFixed(2) : 0);

  const validTp1 = p > 0 && sumTp1 > 0 && sumTp1 < p * 5 ? sumTp1 : 0;
  const validTp2 = p > 0 && sumTp2 > 0 && sumTp2 < p * 10 ? sumTp2 : 0;
  const tp1 = aiTp1 || validTp1 || (techResistance > 0 && techResistance > p ? techResistance : +(p * 1.15).toFixed(2));
  const tp2 = aiTp2 || validTp2 || (techResistance > 0 && techResistance > p ? +(techResistance * 1.05).toFixed(2) : +(tp1 * 1.25).toFixed(2));

  const signalScore = score || Math.round(
    (technical?.signal === 'bullish' ? 70 : technical?.signal === 'bearish' ? 30 : 50) +
    (technical?.rsi < 30 ? 10 : technical?.rsi > 70 ? -10 : 0) +
    (technical?.trend === 'uptrend' ? 10 : technical?.trend === 'downtrend' ? -10 : 0)
  );
  const scoreColor = signalScore >= 70 ? C.positive : signalScore >= 40 ? C.warning : C.negative;

  return (
    <>
    <div ref={panelRef} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, overflow: 'hidden', boxShadow: shadow.lg, animation: 'fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>

      {/* ═══ HERO HEADER ═══ */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: vc.gradient,
        borderBottom: `1px solid ${vc.border}`,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 20% 50%, ${vc.bg}, transparent 70%)`,
          opacity: 0.6,
        }} />
        <div style={{ position: 'relative', padding: `${S.xl} ${S.xxl}`, display: 'flex', alignItems: 'center', gap: S.xxl }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.md, marginBottom: S.xs }}>
              <span style={{
                fontSize: '32px', fontWeight: 900, color: C.textPrimary,
                fontFamily: F.mono, letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {symbol}
              </span>
              {sector && (
                <span style={{
                  fontSize: F.sizeXs, fontWeight: 600, color: C.textMuted,
                  background: `${C.bgElevatedcc}`, padding: '3px 10px', borderRadius: R.full,
                  border: `1px solid ${C.border}`, backdropFilter: 'blur(4px)',
                }}>
                  {sector}
                </span>
              )}
            </div>
            <div style={{ fontSize: F.sizeSm, color: C.textMuted, marginBottom: S.sm }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: S.md }}>
              <span style={{ fontSize: '28px', fontWeight: 900, color: C.textPrimary, fontFamily: F.mono, letterSpacing: '-0.02em' }}>
                ${p.toFixed(2)}
              </span>
              <span style={{
                fontSize: F.sizeBase, fontWeight: 700, fontFamily: F.mono,
                color: ch >= 0 ? C.positive : C.negative,
                background: ch >= 0 ? `${C.positive15}` : `${C.negative15}`,
                padding: '2px 8px', borderRadius: R.sm,
              }}>
                {ch >= 0 ? '+' : ''}{chp.toFixed(2)}%
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: `conic-gradient(${scoreColor} ${mounted ? signalScore * 3.6 : 0}deg, ${C.border} 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
              boxShadow: `0 0 20px ${scoreColor}15`,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: C.bgCard,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '22px', fontWeight: 900, color: scoreColor, fontFamily: F.mono, lineHeight: 1 }}>
                  {signalScore}
                </span>
                <span style={{ fontSize: '9px', color: C.textMuted, fontWeight: 600 }}>/100</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              padding: '10px 24px', borderRadius: R.lg,
              background: vc.bg, border: `1px solid ${vc.border}`,
              color: vc.text, fontWeight: 900, fontSize: 16, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontFamily: F.mono,
              animation: 'verdictReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}>
              {verdict === 'BUY' ? 'COMPRAR' : verdict === 'SELL' ? 'VENDER' : 'MANTENER'}
            </div>
            <div style={{
              marginTop: S.sm, display: 'inline-flex',
              padding: '3px 12px', borderRadius: R.full,
              background: conviction === 'HIGH' ? `${C.positive15}` : conviction === 'MEDIUM' ? `${C.warning15}` : `${C.textMuted15}`,
              border: `1px solid ${conviction === 'HIGH' ? `${C.positive30}` : conviction === 'MEDIUM' ? `${C.warning30}` : C.border}`,
              animation: 'fadeInUp 0.3s ease 0.15s both',
            }}>
              <span style={{
                fontSize: F.sizeXs, fontWeight: 700,
                color: conviction === 'HIGH' ? C.positive : conviction === 'MEDIUM' ? C.warning : C.textMuted,
              }}>
                {conviction} Convicción
              </span>
            </div>
          </div>

          {onClose && (
            <button onClick={onClose} style={{
              position: 'absolute', top: S.md, right: S.md,
              background: `${C.bgElevated80}`, border: `1px solid ${C.border}`,
              color: C.textMuted, cursor: 'pointer', borderRadius: R.full,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1, transition: T.fast, backdropFilter: 'blur(4px)',
            }} onMouseOver={e => { e.currentTarget.style.color = C.textPrimary; e.currentTarget.style.borderColor = C.borderHover; }}
               onMouseOut={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ═══ AI BRIEFING ═══ */}
      {aiLoading ? (
        <div style={{
          padding: `${S.lg} ${S.xxl}`, borderBottom: `1px solid ${C.border}`,
          animation: 'fadeIn 0.2s ease forwards',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
            <div style={{
              width: 36, height: 36, borderRadius: R.md,
              background: C.gradientPrimary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              animation: 'pulseSoft 1.5s ease-in-out infinite',
            }}>🧠</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
                <div style={{
                  height: 10, width: 160,
                  borderRadius: R.sm,
                  background: `linear-gradient(90deg, ${C.bgElevated} 25%, ${C.bgCardHover} 50%, ${C.bgElevated} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmerModern 1.5s ease-in-out infinite',
                }} />
                <div style={{
                  height: 8, width: 240,
                  borderRadius: R.sm,
                  background: `linear-gradient(90deg, ${C.bgElevated} 25%, ${C.bgCardHover} 50%, ${C.bgElevated} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmerModern 1.5s ease-in-out infinite 0.2s',
                }} />
              </div>
            </div>
          </div>
        </div>
      ) : aiError ? (
        <div style={{
          padding: `${S.lg} ${S.xxl}`, borderBottom: `1px solid ${C.border}`,
          borderLeft: `3px solid ${C.warning}`, background: `${C.warning08}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.xs }}>
            <span style={{ fontSize: '14px' }}>🤖</span>
            <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: C.warning, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Informe IA
            </span>
          </div>
          <p style={{ margin: 0, color: C.textSecondary, fontSize: F.sizeSm, lineHeight: 1.6 }}>
            El análisis IA no está disponible temporalmente. Los niveles y configuración de operación se calcularon con datos técnicos.
          </p>
        </div>
      ) : ai ? (
        <>
          <div style={{
            padding: `${S.lg} ${S.xxl}`,
            borderBottom: `1px solid ${C.border}`,
            borderLeft: `3px solid ${vc.text}`,
            background: `${vc.text}04`,
            animation: 'fadeInUp 0.3s ease 0.1s both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.xs }}>
              <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: vc.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Informe IA
              </span>
            </div>
            <p style={{
              margin: 0, color: C.textPrimary, fontSize: F.sizeBase,
              lineHeight: 1.8, fontStyle: 'italic', opacity: 0.9,
            }}>&ldquo;{ai.summary}&rdquo;</p>
          </div>

          {(ai.catalysts.length > 0 || ai.warnings.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: ai.catalysts.length > 0 && ai.warnings.length > 0 ? '1fr 1fr' : '1fr', gap: 1, background: C.border }}>
              {ai.catalysts.length > 0 && (
                <div style={{ background: C.bgCard, padding: `${S.md} ${S.xxl}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                    <span style={{ fontSize: '14px' }}>⚡</span>
                    <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: C.positive, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Catalizadores
                    </span>
                  </div>
                  {ai.catalysts.slice(0, 3).map((c, i) => (
                    <div key={i} style={{
                      fontSize: F.sizeSm, color: C.textSecondary, paddingLeft: 20,
                      position: 'relative', marginBottom: S.xs, lineHeight: 1.5,
                      animation: `fadeInRight 0.2s ease ${0.05 * i}s both`,
                    }}>
                      <span style={{ position: 'absolute', left: 0, top: 1, color: C.positive, fontSize: F.sizeSm }}>+</span>
                      {c}
                    </div>
                  ))}
                </div>
              )}
              {ai.warnings.length > 0 && (
                <div style={{ background: C.bgCard, padding: `${S.md} ${S.xxl}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                    <span style={{ fontSize: '14px' }}>⚠️</span>
                    <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: C.negative, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Advertencias
                    </span>
                  </div>
                  {ai.warnings.slice(0, 3).map((w, i) => (
                    <div key={i} style={{
                      fontSize: F.sizeSm, color: C.textSecondary, paddingLeft: 20,
                      position: 'relative', marginBottom: S.xs, lineHeight: 1.5,
                      animation: `fadeInRight 0.2s ease ${0.05 * i}s both`,
                    }}>
                      <span style={{ position: 'absolute', left: 0, top: 1, color: C.negative, fontSize: F.sizeSm }}>!</span>
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : recommendation ? (
        <div style={{
          padding: `${S.lg} ${S.xxl}`, borderBottom: `1px solid ${C.border}`,
          borderLeft: `3px solid ${vc.text}`, background: `${vc.text}04`,
        }}>
          <p style={{ margin: 0, color: C.textPrimary, fontSize: F.sizeBase, lineHeight: 1.8 }}>
            {recommendation.reasoning}
          </p>
          <div style={{ marginTop: S.sm, fontSize: F.sizeXs, color: C.textMuted }}>
            Confianza: {recommendation.confidence}%
          </div>
        </div>
      ) : null}

      {/* ═══ TRADE SETUP ═══ */}
      <div style={{ padding: `${S.lg} ${S.xxl}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.md }}>
          <span style={{ fontSize: '14px' }}>🎯</span>
          <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Configuración de Operación
          </span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: S.sm,
        }}>
          <div style={{ animation: 'fadeInUp 0.25s ease 0.05s both' }}><TradeLevel label="ENTRY" value={entry} sub={summary?.buyZoneHigh ? `$${safe(summary.buyZoneHigh).toFixed(2)} top` : undefined} color={C.accent} /></div>
          <div style={{ animation: 'fadeInUp 0.25s ease 0.1s both' }}><TradeLevel label="STOP" value={stop} sub={entry && stop ? `${((1 - stop / p) * 100).toFixed(1)}% risk` : undefined} color={C.negative} /></div>
          <div style={{ animation: 'fadeInUp 0.25s ease 0.15s both' }}><TradeLevel label="TARGET 1" value={tp1} sub={entry && tp1 ? pctChange(entry, tp1) : undefined} color={C.positive} /></div>
          <div style={{ animation: 'fadeInUp 0.25s ease 0.2s both' }}><TradeLevel label="TARGET 2" value={tp2} sub={entry && tp2 ? pctChange(entry, tp2) : undefined} color={C.positive} /></div>
          <div style={{ animation: 'fadeInUp 0.25s ease 0.25s both' }}><TradeLevel label="R : R" value={0} rawDisplay={rr(entry, stop, tp1)} color={C.accent} /></div>
        </div>
      </div>

      {/* ═══ TECHNICAL MATRIX ═══ */}
      {ai?.analysis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, background: C.border }}>
          {(['trend', 'ema', 'breakout', 'volume', 'momentum', 'risk'] as const).map((key, idx) => {
            const s = ai.analysis[key];
            const c = techColor(s.signal);
            return (
              <div key={key} style={{ background: C.bgCard, padding: `${S.md} ${S.md}`, animation: `fadeInUp 0.2s ease ${0.03 * idx}s both` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xs }}>
                  <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {key === 'ema' ? 'EMAs' : key === 'risk' ? 'Risk' : key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                  <span style={{ color: c, fontSize: 11 }}>{TECH_SIGNAL_ICON[s.signal] || '—'}</span>
                </div>
                <div style={{ fontSize: F.sizeSm, fontWeight: 800, color: c, textTransform: 'uppercase', marginBottom: S.xs }}>
                  {s.signal}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${S.xs} ${S.sm}` }}>
                  {s.strength && <Tag label={s.strength} />}
                  {s.alignment && <Tag label={s.alignment} />}
                  {s.rsi != null && <Tag label={`RSI ${s.rsi.toFixed(0)}`} />}
                  {s.macd && <Tag label={`MACD ${s.macd}`} />}
                  {s.vsAverage != null && <Tag label={`${s.vsAverage.toFixed(1)}x avg`} />}
                  {s.level != null && s.level > 0 && <Tag label={`@ $${s.level.toFixed(2)}`} color={C.accent} />}
                  {s.atr != null && <Tag label={`ATR ${s.atr.toFixed(2)}`} />}
                </div>
                <div style={{ fontSize: F.sizeXs, color: C.textSecondary, marginTop: S.xs, lineHeight: 1.4 }}>{s.detail}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ KEY LEVELS ═══ */}
      {!ai && technical && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
          <LevelColumn title="Soportes" items={[{ price: technical.support, type: 'Technical' }]} color={C.positive} icon="🟢" />
          <LevelColumn title="Resistencias" items={[{ price: technical.resistance, type: 'Technical' }]} color={C.negative} icon="🔴" />
        </div>
      )}
      {ai && (ai.support.length > 0 || ai.resistance.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
          <LevelColumn title="Soportes" items={ai.support} color={C.positive} icon="🟢" />
          <LevelColumn title="Resistencias" items={ai.resistance} color={C.negative} icon="🔴" />
        </div>
      )}

      {/* ═══ FUNDAMENTALS ═══ */}
      {(marketCap || peRatio) && (
        <div style={{
          padding: `${S.sm} ${S.xxl}`,
          borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: S.xxxl,
        }}>
          {marketCap > 0 && (
            <span style={{
              fontSize: F.sizeXs, color: C.textMuted,
              animation: 'fadeInUp 0.2s ease 0.1s both',
            }}>
              Mkt Cap{' '}
              <span style={{ color: C.textPrimary, fontWeight: 700 }}>{fmtCompact(marketCap)}</span>
            </span>
          )}
          {peRatio > 0 && (
            <span style={{
              fontSize: F.sizeXs, color: C.textMuted,
              animation: 'fadeInUp 0.2s ease 0.15s both',
            }}>
              P/E{' '}
              <span style={{ color: C.textPrimary, fontWeight: 700 }}>{safe(peRatio, NaN).toFixed(1)}</span>
            </span>
          )}
          {technical?.rsi != null && !ai?.analysis?.momentum?.rsi && (
            <span style={{
              fontSize: F.sizeXs, color: C.textMuted,
              animation: 'fadeInUp 0.2s ease 0.2s both',
            }}>
              RSI{' '}
              <span style={{ color: C.textPrimary, fontWeight: 700 }}>{safe(technical?.rsi, NaN).toFixed(0)}</span>
            </span>
          )}
        </div>
      )}

      {/* ═══ GRAHAM PRINCIPLES ═══ */}
      {fundamentals && (() => {
        const allPrinciples = PRINCIPLE_KEYS
          .map(k => fundamentals[k])
          .filter((p): p is PrincipleResult => !!p);
        if (allPrinciples.length === 0) return null;

        const isPro = PLAN_HIERARCHY[userPlan] >= 1;
        const visiblePrinciples = isPro ? allPrinciples : allPrinciples.slice(0, 5);
        const lockedPrinciples = isPro ? [] : allPrinciples.slice(5);
        const favorableCount = allPrinciples.filter(p => p.isInDiscount).length;
        const visibleFavorable = visiblePrinciples.filter(p => p.isInDiscount).length;
        const pct = Math.round((favorableCount / allPrinciples.length) * 100);
        const gradeColor = favorableCount >= 7 ? C.positive : favorableCount >= 4 ? C.warning : C.negative;
        const gradeLabel = favorableCount >= 8 ? 'Excelente' : favorableCount >= 6 ? 'Sólido' : favorableCount >= 4 ? 'Mixto' : 'Débil';
        const gradeLetter = favorableCount >= 8 ? 'A' : favorableCount >= 6 ? 'B' : favorableCount >= 4 ? 'C' : 'D';

        return (
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            <div style={{ padding: `${S.xl} ${S.xxl}` }}>

              {/* Premium header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: S.xl, marginBottom: S.xl,
              }}>
                {/* Grade circle */}
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                  background: `conic-gradient(${gradeColor} ${pct * 3.6}deg, ${C.border} 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 24px ${gradeColor}18`,
                }}>
                  <div style={{
                    width: 58, height: 58, borderRadius: '50%',
                    background: C.bgCard,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${gradeColor}40`,
                  }}>
                    <span style={{
                      fontSize: '24px', fontWeight: 900, color: gradeColor,
                      fontFamily: F.mono, lineHeight: 1,
                    }}>
                      {gradeLetter}
                    </span>
                    <span style={{ fontSize: '8px', color: C.textMuted, fontWeight: 700, marginTop: 1 }}>
                      {favorableCount}/{allPrinciples.length}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: S.md, marginBottom: S.xs,
                  }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <span style={{
                      fontSize: F.sizeLg, fontWeight: 800, color: C.textPrimary,
                      letterSpacing: '-0.01em',
                    }}>
                      Graham Principles
                    </span>
                  </div>
                  <div style={{
                    fontSize: F.sizeSm, color: C.textSecondary, marginBottom: S.sm, lineHeight: 1.5,
                  }}>
                    Análisis fundamental de Benjamin Graham — {visibleFavorable} de {allPrinciples.length} criterios favorables
                  </div>
                  {/* Progress bar */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      height: 6, background: C.bgElevated, borderRadius: R.full, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: R.full,
                        background: `linear-gradient(90deg, ${gradeColor}cc, ${gradeColor})`,
                        transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                      }} />
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', marginTop: S.xs,
                    }}>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: gradeColor,
                        padding: '1px 6px', borderRadius: R.sm,
                        background: `${gradeColor}12`,
                      }}>
                        {gradeLabel}
                      </span>
                      <span style={{ fontSize: '9px', color: C.textMuted }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Principles grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: S.sm,
              }}>
                {visiblePrinciples.map((p, i) => {
                  const icon = PRINCIPLE_ICONS[p.name] || '📌';
                  const isFav = p.isInDiscount;
                  const desc = PRINCIPLE_DESCRIPTIONS[p.name] || p.description;
                  return (
                    <div key={i} style={{
                      padding: `${S.md} ${S.lg}`, borderRadius: R.lg,
                      background: isFav
                        ? `linear-gradient(135deg, ${C.positive08} 0%, transparent 100%)`
                        : `linear-gradient(135deg, ${C.negative06} 0%, transparent 100%)`,
                      border: `1px solid ${isFav ? `${C.positive20}` : `${C.negative18}`}`,
                      transition: 'all 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      animation: `fadeInUp 0.25s ease ${0.05 * i}s both`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = isFav ? `0 4px 16px ${C.positive12}` : `0 4px 16px ${C.negative10}`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                      {/* Subtle glow */}
                      {isFav && (
                        <div style={{
                          position: 'absolute', top: -20, right: -20,
                          width: 60, height: 60, borderRadius: '50%',
                          background: `${C.positive08}`,
                          filter: 'blur(16px)',
                        }} />
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.sm, position: 'relative' }}>
                        {/* Status indicator */}
                        <div style={{
                          width: 28, height: 28, borderRadius: R.sm, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isFav ? `${C.positive15}` : `${C.negative12}`,
                          border: `1px solid ${isFav ? `${C.positive25}` : `${C.negative20}`}`,
                        }}>
                          <span style={{ fontSize: 13 }}>{icon}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: S.xs, marginBottom: 3,
                          }}>
                            <span style={{
                              fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary,
                              lineHeight: 1.2,
                            }}>
                              {p.name}
                            </span>
                            <span style={{
                              fontSize: '8px', fontWeight: 800, padding: '1px 5px', borderRadius: R.sm,
                              background: isFav ? `${C.positive18}` : `${C.negative14}`,
                              color: isFav ? C.positive : C.negative,
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>
                              {isFav ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '10px', color: C.textMuted, lineHeight: 1.4,
                          }}>
                            {desc}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Locked principles */}
              {lockedPrinciples.length > 0 && (
                <div style={{ marginTop: S.lg }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: S.sm,
                    filter: 'blur(2px)', opacity: 0.4, pointerEvents: 'none',
                  }}>
                    {lockedPrinciples.map((p, i) => {
                      const icon = PRINCIPLE_ICONS[p.name] || '📌';
                      return (
                        <div key={i} style={{
                          padding: `${S.md} ${S.lg}`, borderRadius: R.lg,
                          background: `${C.textMuted06}`,
                          border: `1px solid ${C.border}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
                            <span style={{ fontSize: 13 }}>{icon}</span>
                            <span style={{ fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary }}>{p.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{
                    marginTop: -S.xl, padding: `${S.lg} ${S.md}`,
                    background: `linear-gradient(180deg, transparent 0%, ${C.bgCard} 30%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sm,
                    position: 'relative',
                  }}>
                    <div style={{
                      padding: '6px 16px', borderRadius: R.full,
                      background: `${C.accent15}`, border: `1px solid ${C.accent30}`,
                      display: 'flex', alignItems: 'center', gap: S.sm,
                    }}>
                      <span style={{ fontSize: 12 }}>🔒</span>
                      <span style={{ fontSize: F.sizeSm, color: C.accentLight, fontWeight: 700 }}>
                        {lockedPrinciples.length} principles — Actualizar a Pro
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ ACTIONS ═══ */}
      <div style={{
        padding: `${S.md} ${S.xxl}`,
        borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: S.sm,
      }}>
        {onFullAnalysis && (
          <button
            onClick={onFullAnalysis}
            style={{
              flex: 1, padding: `${S.sm} ${S.lg}`, borderRadius: R.md,
              border: 'none',
              background: PLAN_HIERARCHY[userPlan] >= 1 ? C.gradientPrimary : `${C.accent20}`,
              color: PLAN_HIERARCHY[userPlan] >= 1 ? '#fff' : C.textMuted,
              fontSize: F.sizeSm, fontWeight: 700,
              cursor: 'pointer', fontFamily: F.family, transition: T.spring,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sm,
              animation: 'fadeInUp 0.2s ease 0.05s both',
            }}
            onMouseOver={e => {
              e.currentTarget.style.opacity = '0.92';
              e.currentTarget.style.transform = 'translateY(-1px)';
              if (PLAN_HIERARCHY[userPlan] >= 1) e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.35)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          >
            {PLAN_HIERARCHY[userPlan] >= 1 ? (
              <>Análisis Completo <span style={{ fontSize: 14 }}>&rarr;</span></>
            ) : (
              <>🔒 Análisis Completo <span style={{ fontSize: F.sizeXs, opacity: 0.7 }}>(Pro)</span></>
            )}
          </button>
        )}
        {onAddPortfolio && (
          <button onClick={onAddPortfolio} style={{
            flex: 1, padding: `${S.sm} ${S.lg}`, borderRadius: R.md,
            border: `1px solid ${C.accent50}`, background: `${C.accent08}`,
            color: C.accentLight, fontSize: F.sizeSm, fontWeight: 700,
            cursor: 'pointer', fontFamily: F.family, transition: T.spring,
            animation: 'fadeInUp 0.2s ease 0.1s both',
          }}
            onMouseOver={e => { e.currentTarget.style.background = `${C.accent18}`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.currentTarget.style.background = `${C.accent08}`; e.currentTarget.style.transform = 'translateY(0)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          >+ Portafolio</button>
        )}
        {onAddWatchlist && (
          <button onClick={onAddWatchlist} style={{
            flex: 1, padding: `${S.sm} ${S.lg}`, borderRadius: R.md,
            border: `1px solid ${inWatchlist ? `${C.positive40}` : C.border}`,
            background: inWatchlist ? `${C.positive10}` : 'transparent',
            color: inWatchlist ? C.positive : C.textSecondary,
            fontSize: F.sizeSm, fontWeight: 700,
            cursor: 'pointer', fontFamily: F.family, transition: T.spring,
            animation: 'fadeInUp 0.2s ease 0.15s both',
          }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; if (!inWatchlist) e.currentTarget.style.borderColor = C.borderHover; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; if (!inWatchlist) e.currentTarget.style.borderColor = C.border; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
           >{inWatchlist ? '✓ Lista de seguimiento' : '+ Lista de seguimiento'}</button>
        )}
        <button
          onClick={() => setShowShareModal(true)}
          style={{
            padding: `${S.sm} ${S.lg}`, borderRadius: R.md,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.textSecondary, fontSize: F.sizeSm, fontWeight: 700,
            cursor: 'pointer', fontFamily: F.family, transition: T.spring,
            display: 'flex', alignItems: 'center', gap: S.xs,
            animation: 'fadeInUp 0.2s ease 0.2s both',
          }}
          onMouseOver={e => { e.currentTarget.style.background = `${C.textMuted12}`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
        >📸 Compartir</button>
      </div>

      {/* ═══ TIMESTAMP ═══ */}
      <div style={{
        padding: `${S.sm} ${S.xxl}`,
        borderTop: `1px solid ${C.border}`,
        fontSize: F.sizeXs, color: C.textMuted,
        display: 'flex', alignItems: 'center', gap: S.xs,
      }}>
        <span style={{ opacity: 0.6 }}>⏱</span>
        {new Date().toLocaleString()} — Prospector Research
      </div>
    </div>

      {/* ═══ SHARE MODAL (fuera del ref para no capturarlo) ═══ */}
      {showShareModal && (
        <ShareScreenshotModal
          targetRef={panelRef}
          symbol={symbol}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}

// ─── Tag ──────────────────────────────────────────────────────────────────────
function Tag({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: F.sizeXs, fontWeight: 600, color: color || C.textSecondary,
      background: color ? `${color}12` : `${C.textMuted12}`,
      padding: '1px 6px', borderRadius: R.sm, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ─── Trade Level ──────────────────────────────────────────────────────────────
function TradeLevel({ label, value, sub, color, rawDisplay }: {
  label: string; value: number; sub?: string; color: string; rawDisplay?: string;
}) {
  return (
    <div style={{
      textAlign: 'center', padding: `${S.sm} ${S.xs}`, borderRadius: R.md,
      background: `${color}08`, border: `1px solid ${color}15`,
    }}>
      <div style={{
        fontSize: '9px', fontWeight: 700, color: C.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: S.xs,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '18px', fontWeight: 900, color,
        fontFamily: F.mono, lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {rawDisplay || (value > 0 ? `$${value.toFixed(2)}` : '—')}
      </div>
      {sub && (
        <div style={{ fontSize: '9px', color: C.textMuted, marginTop: S.xs }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Level Column ─────────────────────────────────────────────────────────────
function LevelColumn({ title, items, color, icon }: {
  title: string; items: { price: number; type: string }[]; color: string; icon?: string;
}) {
  return (
    <div style={{ background: C.bgCard, padding: `${S.md} ${S.md}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
        {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
        <span style={{ fontSize: F.sizeXs, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: F.sizeSm, color: C.textMuted }}>Ninguno detectado</div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 0', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
        }}>
          <span style={{ fontSize: F.sizeSm, fontWeight: 800, color, fontFamily: F.mono }}>${item.price.toFixed(2)}</span>
          <span style={{ fontSize: F.sizeXs, color: C.textMuted }}>{item.type}</span>
        </div>
      ))}
    </div>
  );
}
