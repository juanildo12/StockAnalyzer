'use client';

import { useState, useRef, useEffect } from 'react';
import {
  colors as C,
  radius as R,
  font as F,
  spacing as S,
  shadow,
  transition as T,
} from '@/src/utils/webTheme';

export interface LandingHeroProps {
  symbol: string;
  onSymbolChange: (s: string) => void;
  onSearch: () => void;
  loading: boolean;
  dailyAnalysisCount: number;
  userPlan: string;
  suggestions: { symbol: string; name: string }[];
  suggestionsLoading: boolean;
  onFetchSuggestions: (q: string) => void;
  showSuggestions: boolean;
  onShowSuggestions: (show: boolean) => void;
}

const QUICK_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA'];

const FEATURES = [
  { icon: '\u{1F4CB}', title: 'Briefing Matutino', desc: 'Picks automatizados con scoring de breakout cada manana' },
  { icon: '\u{1F4CA}', title: 'Analisis Fundamental', desc: 'PE, cash, deuda, crecimiento, profit margin y mas' },
  { icon: '\u{1F3AF}', title: 'Valoracion Graham', desc: 'Fair value, NNWC, FCF yield y gauge de valoracion' },
  { icon: '\u{1F4C8}', title: 'Setup de Trading', desc: 'Entry, targets, stop loss y risk/reward automatico' },
  { icon: '\u{1F50D}', title: 'Screener Inteligente', desc: '7 screeners: momentum, breakout, dark pool, gamma squeeze' },
  { icon: '\u{1F9E0}', title: 'AI Coach', desc: 'Preguntas en tiempo real sobre cualquier accion' },
];

const STATS = [
  { value: '500+', label: 'Acciones cubiertas' },
  { value: '12', label: 'Metricas de scoring' },
  { value: '7', label: 'Screeners activos' },
  { value: '< 5s', label: 'Tiempo de analisis' },
];

const KEYFRAMES_CSS = `
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulseGlow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

export default function LandingHero(props: LandingHeroProps) {
  const {
    symbol,
    onSymbolChange,
    onSearch,
    loading,
    dailyAnalysisCount,
    userPlan,
    suggestions,
    suggestionsLoading,
    onFetchSuggestions,
    showSuggestions,
    onShowSuggestions,
  } = props;

  const isFree = !userPlan || userPlan === 'free';
  const limitReached = isFree && dailyAnalysisCount >= 5;
  const inputRef = useRef<HTMLInputElement>(null);
  const [hoveredPill, setHoveredPill] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = () => {
    if (!loading && !limitReached) onSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSymbolChange(e.target.value);
    onShowSuggestions(true);
    onFetchSuggestions(e.target.value);
  };

  const handleInputFocus = () => {
    setFocused(true);
    onShowSuggestions(true);
  };

  const handleInputBlur = () => {
    setFocused(false);
    setTimeout(() => onShowSuggestions(false), 200);
  };

  const selectSuggestion = (ticker: string) => {
    onSymbolChange(ticker);
    onShowSuggestions(false);
    onSearch();
  };

  const selectTicker = (ticker: string) => {
    onSymbolChange(ticker);
    onSearch();
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />

      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: R.xl,
          marginBottom: '32px',
          background: `linear-gradient(135deg, ${C.bgCard} 0%, ${C.bgElevated} 100%)`,
          border: `1px solid ${C.border}`,
          boxShadow: shadow.lg,
          animation: mounted ? 'fadeInScale 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
          fontFamily: F.family,
        }}
      >
        {/* Glow effects */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 300, height: 300, borderRadius: '50%',
          background: C.accent10, filter: 'blur(80px)',
          animation: 'pulseGlow 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: C.positive08, filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        {/* ─── Section A: Hero ─── */}
        <div style={{ position: 'relative', padding: '56px 48px 48px', textAlign: 'center' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: R.full,
            background: C.accent12, border: `1px solid ${C.accent25}`,
            marginBottom: '24px',
            animation: 'fadeInUp 0.3s ease 0.05s both',
          }}>
            <span style={{ fontSize: F.sizeXs, color: C.accentLight, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
              AI-Powered Stock Analysis
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: F.sizeDisplay, fontWeight: 800, color: C.textPrimary,
            lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 16px',
            fontFamily: F.family,
            animation: 'fadeInUp 0.3s ease 0.1s both',
          }}>
            Analiza cualquier accion<br />
            <span style={{
              background: C.gradientPrimary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>como un profesional</span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: F.sizeLg, color: C.textSecondary,
            margin: '0 auto 36px', maxWidth: 540,
            lineHeight: 1.7, letterSpacing: '-0.01em',
            animation: 'fadeInUp 0.3s ease 0.15s both',
          }}>
            Fundamentales, tecnicos, valoracion y IA — todo en un solo dashboard.
          </p>

          {/* Search bar */}
          <div style={{
            display: 'flex', gap: '12px', maxWidth: 640, margin: '0 auto',
            position: 'relative',
            animation: 'fadeInUp 0.3s ease 0.2s both',
          }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
                fontSize: 18, color: C.textMuted, pointerEvents: 'none',
              }}>
                &#128269;
              </span>
              <input
                ref={inputRef}
                type="text"
                value={symbol}
                placeholder="AAPL, MSFT, GOOGL, NVDA..."
                aria-label="Buscar accion por ticker"
                onKeyDown={handleKeyDown}
                onChange={handleChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                style={{
                  width: '100%', padding: '18px 18px 18px 48px',
                  borderRadius: R.xl,
                  border: `1px solid ${focused ? C.accent : C.borderHover}`,
                  background: C.bgInput,
                  color: C.textPrimary,
                  fontSize: F.sizeLg,
                  outline: 'none',
                  fontFamily: F.family,
                  transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  boxShadow: focused ? `0 0 0 3px ${C.accent15}, 0 4px 16px ${C.accent10}` : shadow.sm,
                  boxSizing: 'border-box' as const,
                }}
              />

              {/* Suggestions dropdown */}
              {showSuggestions && (suggestions.length > 0 || suggestionsLoading) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  borderRadius: R.xl, marginTop: '8px', zIndex: 100,
                  maxHeight: 260, overflow: 'auto', boxShadow: shadow.xl,
                  animation: 'slideDown 0.2s ease forwards',
                }}>
                  {suggestionsLoading && suggestions.length === 0 && (
                    <div style={{ padding: '14px', textAlign: 'center', color: C.textMuted, fontSize: F.sizeSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite', fontSize: '14px' }}>&#8635;</span>
                      Buscando...
                    </div>
                  )}
                  {suggestions.map(s => (
                    <div
                      key={s.symbol}
                      onClick={() => selectSuggestion(s.symbol)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: `1px solid ${C.border}`,
                        display: 'flex', alignItems: 'center', gap: '10px',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = C.bgCardHover)}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: C.accentLight, fontWeight: 700, fontSize: F.sizeBase, fontFamily: F.mono }}>{s.symbol}</span>
                      <span style={{ color: C.textMuted, fontSize: F.sizeSm }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Analyze button */}
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || limitReached}
              aria-label="Analizar accion"
              style={{
                padding: '18px 36px', borderRadius: R.xl,
                border: 'none',
                background: C.gradientPrimary,
                color: '#fff',
                fontSize: F.sizeLg,
                fontWeight: 700,
                cursor: loading || limitReached ? 'not-allowed' : 'pointer',
                opacity: loading || limitReached ? 0.6 : 1,
                fontFamily: F.family,
                transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                whiteSpace: 'nowrap',
                boxShadow: `0 4px 14px rgba(124, 58, 237, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)`,
                letterSpacing: '-0.01em',
              }}
              onMouseOver={e => {
                if (!loading && !limitReached) {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.35)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseOut={e => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(124, 58, 237, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading
                ? 'Analizando...'
                : limitReached
                  ? 'Limite diario alcanzado — Actualiza a Pro'
                  : 'Analizar'}
            </button>
          </div>

          {/* Daily limit indicator */}
          {isFree && (
            <p style={{
              fontSize: F.sizeXs, color: dailyAnalysisCount >= 5 ? '#ef4444' : C.textMuted,
              marginTop: '8px', textAlign: 'center',
              animation: 'fadeInUp 0.3s ease 0.25s both',
            }}>
              {dailyAnalysisCount} de 5 analisis gratuitos hoy
            </p>
          )}

          {/* Quick ticker pills */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', marginTop: '24px', flexWrap: 'wrap',
            animation: 'fadeInUp 0.3s ease 0.3s both',
          }}>
            <span style={{ fontSize: F.sizeSm, color: C.textMuted, fontWeight: 500 }}>Popular:</span>
            {QUICK_TICKERS.map((t, i) => (
              <button
                key={t}
                onClick={() => selectTicker(t)}
                style={{
                  padding: '6px 14px', borderRadius: R.full,
                  border: `1px solid ${hoveredPill === t ? C.accent : C.border}`,
                  background: 'transparent',
                  color: hoveredPill === t ? C.accentLight : C.textSecondary,
                  fontSize: F.sizeSm, fontWeight: 600,
                  cursor: 'pointer', fontFamily: F.mono,
                  transition: 'all 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  transform: hoveredPill === t ? 'translateY(-1px)' : 'translateY(0)',
                  boxShadow: hoveredPill === t ? `0 2px 8px ${C.accent15}` : 'none',
                  animation: `fadeInUp 0.2s ease ${0.35 + i * 0.04}s both`,
                }}
                onMouseOver={() => setHoveredPill(t)}
                onMouseOut={() => setHoveredPill(null)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Section B: Features Grid ─── */}
        <div style={{
          padding: '0 48px 48px',
          animation: 'fadeInUp 0.3s ease 0.4s both',
        }}>
          <div className="landing-hero-grid-features" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}>
            {FEATURES.map((feat, i) => (
              <div
                key={feat.title}
                style={{
                  padding: '24px',
                  borderRadius: R.xl,
                  background: hoveredFeature === i ? C.bgCardHover : C.bgCard,
                  border: `1px solid ${hoveredFeature === i ? C.accent25 : C.border}`,
                  transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  cursor: 'default',
                  animation: `fadeInUp 0.25s ease ${0.45 + i * 0.06}s both`,
                  transform: hoveredFeature === i ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: hoveredFeature === i ? shadow.md : 'none',
                }}
                onMouseOver={() => setHoveredFeature(i)}
                onMouseOut={() => setHoveredFeature(null)}
              >
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{feat.icon}</div>
                <div style={{ fontSize: F.sizeBase, fontWeight: 700, color: C.textPrimary, marginBottom: '6px' }}>
                  {feat.title}
                </div>
                <div style={{ fontSize: F.sizeSm, color: C.textSecondary, lineHeight: 1.6 }}>
                  {feat.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Section C: Stats Bar ─── */}
        <div style={{
          padding: '0 48px 40px',
          animation: 'fadeInUp 0.3s ease 0.6s both',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: '32px', flexWrap: 'wrap',
            padding: '28px 0',
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}>
            {STATS.map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', minWidth: 120 }}>
                <div style={{
                  fontSize: F.sizeXxl, fontWeight: 800, color: C.accentLight,
                  letterSpacing: '-0.02em', marginBottom: '4px',
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: F.sizeSm, color: C.textMuted, fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Section D: Pricing Teaser ─── */}
        <div style={{
          padding: '0 48px 56px',
          animation: 'fadeInUp 0.3s ease 0.7s both',
        }}>
          <div className="landing-hero-grid-pricing" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            maxWidth: 720,
            margin: '0 auto',
          }}>
            {/* Free tier */}
            <div style={{
              padding: '28px',
              borderRadius: R.xl,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: F.sizeBase, fontWeight: 700, color: C.textSecondary, marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                Free
              </div>
              <div style={{ fontSize: F.sizeSm, color: C.textMuted, lineHeight: 1.8 }}>
                5 analisis/dia<br />
                Briefing<br />
                Screener basico
              </div>
            </div>

            {/* Pro tier */}
            <div style={{
              padding: '28px',
              borderRadius: R.xl,
              background: `linear-gradient(135deg, ${C.bgCard} 0%, ${C.accent10} 100%)`,
              border: `1px solid ${C.accent25}`,
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 120, height: 120, borderRadius: '50%',
                background: C.accent08, filter: 'blur(40px)',
                pointerEvents: 'none',
              }} />
              <div style={{ fontSize: F.sizeBase, fontWeight: 700, color: C.accentLight, marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', position: 'relative' }}>
                Pro — $49/mo
              </div>
              <div style={{ fontSize: F.sizeSm, color: C.textSecondary, lineHeight: 1.8, position: 'relative' }}>
                Ilimitado<br />
                AI Coach<br />
                Backtest<br />
                Smart Alerts<br />
                Opciones
              </div>
              <a
                href="/settings/billing"
                style={{
                  display: 'inline-block',
                  marginTop: '16px',
                  padding: '10px 28px',
                  borderRadius: R.full,
                  background: C.gradientPrimary,
                  color: '#fff',
                  fontSize: F.sizeSm,
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: `0 4px 14px rgba(124, 58, 237, 0.3)`,
                  transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  position: 'relative',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 58, 237, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive styles via inline media query hack */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .landing-hero-grid-features {
            grid-template-columns: 1fr !important;
          }
          .landing-hero-grid-pricing {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
    </>
  );
}
