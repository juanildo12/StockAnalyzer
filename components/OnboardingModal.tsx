'use client';

import { useState, useEffect } from 'react';
import { colors as C, radius as R, font as F, shadow, transition } from '@/src/utils/webTheme';

interface OnboardingModalProps {
  onSelectSymbol: (symbol: string) => void;
}

const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA'];

export default function OnboardingModal({ onSelectSymbol }: OnboardingModalProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('prospector_onboarded')) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('prospector_onboarded', 'true');
    setVisible(false);
  };

  const next = () => {
    if (step < 2) {
      setFading(true);
      setTimeout(() => {
        setStep(s => s + 1);
        setFading(false);
      }, 200);
    }
  };

  const back = () => {
    if (step > 0) {
      setFading(true);
      setTimeout(() => {
        setStep(s => s - 1);
        setFading(false);
      }, 200);
    }
  };

  const selectTicker = (symbol: string) => {
    dismiss();
    onSelectSymbol(symbol);
  };

  if (!visible) return null;

  return (
    <div style={styles.overlay} onClick={dismiss}>
      <div style={styles.card} onClick={e => e.stopPropagation()}>
        <div style={{ ...styles.body, opacity: fading ? 0 : 1 }}>
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepHowItWorks />}
          {step === 2 && <StepQuickStart onSelect={selectTicker} onSkip={dismiss} />}
        </div>

        {/* Dots */}
        <div style={styles.dots}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i === step ? C.accent : C.border,
                width: i === step ? 20 : 8,
              }}
            />
          ))}
        </div>

        {/* Navigation */}
        <div style={styles.nav}>
          {step > 0 ? (
            <button style={styles.ghostBtn} onClick={back}>Atrás</button>
          ) : (
            <button style={styles.ghostBtn} onClick={dismiss}>Skip</button>
          )}

          {step < 2 ? (
            <button style={styles.primaryBtn} onClick={next}>Siguiente</button>
          ) : (
            <button style={styles.positiveBtn} onClick={dismiss}>Empezar</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step Components ──────────────────────────────────────────────────────── */

function StepWelcome() {
  return (
    <div style={stepStyles.center}>
      <div style={stepStyles.iconWrap}>
        <span style={{ fontSize: 48 }}>🔍</span>
      </div>
      <div style={stepStyles.title}>Bienvenido a Prospector</div>
      <div style={stepStyles.subtitle}>Tu plataforma de análisis de acciones con IA</div>
      <div style={stepStyles.desc}>
        Analiza fundamentales, técnicos, valoración y más en segundos.
      </div>
    </div>
  );
}

function StepHowItWorks() {
  const items = [
    { icon: '🔎', label: 'Busca', desc: 'Escribe cualquier ticker (AAPL, TSLA...)' },
    { icon: '📊', label: 'Analiza', desc: 'Obtén fundamentales, technicals y valoración' },
    { icon: '✅', label: 'Decide', desc: 'Recibe recomendación con entry, targets y stop loss' },
  ];

  return (
    <div style={stepStyles.center}>
      <div style={stepStyles.title}>Cómo funciona</div>
      <div style={stepStyles.cardsRow}>
        {items.map((item, i) => (
          <div key={i} style={stepStyles.miniCard}>
            <div style={stepStyles.miniIcon}>{item.icon}</div>
            <div style={stepStyles.miniLabel}>{item.label}</div>
            <div style={stepStyles.miniDesc}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepQuickStart({ onSelect, onSkip }: { onSelect: (s: string) => void; onSkip: () => void }) {
  return (
    <div style={stepStyles.center}>
      <div style={stepStyles.title}>Empieza ahora</div>
      <div style={stepStyles.pillsRow}>
        {TICKERS.map(t => (
          <button key={t} style={stepStyles.pill} onClick={() => onSelect(t)}>
            {t}
          </button>
        ))}
      </div>
      <button style={stepStyles.linkBtn} onClick={onSkip}>
        Explorar sin buscar
      </button>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 20,
    animation: 'fadeIn 0.3s ease forwards',
  },
  card: {
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: R.xl,
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: shadow.xl,
  },
  body: {
    padding: '36px 32px 16px',
    minHeight: 260,
    transition: 'opacity 0.2s ease',
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: R.full,
    transition: transition.normal,
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 32px 20px',
  },
  ghostBtn: {
    padding: '8px 16px',
    borderRadius: R.md,
    border: 'none',
    background: 'transparent',
    color: C.textMuted,
    fontSize: F.sizeMd,
    fontWeight: 500,
    cursor: 'pointer',
    transition: transition.fast,
  },
  primaryBtn: {
    padding: '8px 20px',
    borderRadius: R.md,
    border: 'none',
    background: C.gradientPrimary,
    color: '#fff',
    fontSize: F.sizeMd,
    fontWeight: 600,
    cursor: 'pointer',
    transition: transition.fast,
  },
  positiveBtn: {
    padding: '8px 20px',
    borderRadius: R.md,
    border: 'none',
    background: C.positive,
    color: '#fff',
    fontSize: F.sizeMd,
    fontWeight: 600,
    cursor: 'pointer',
    transition: transition.fast,
  },
};

const stepStyles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    background: C.gradientAccent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    boxShadow: shadow.glow,
  },
  title: {
    fontSize: F.sizeXl,
    fontWeight: 700,
    color: C.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: F.sizeMd,
    color: C.accent,
    marginBottom: 16,
  },
  desc: {
    fontSize: F.sizeBase,
    color: C.textSecondary,
    lineHeight: 1.6,
    maxWidth: 360,
  },
  cardsRow: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  miniCard: {
    flex: 1,
    background: C.bgCardHover,
    border: `1px solid ${C.border}`,
    borderRadius: R.lg,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  miniIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  miniLabel: {
    fontSize: F.sizeMd,
    fontWeight: 700,
    color: C.textPrimary,
  },
  miniDesc: {
    fontSize: F.sizeXs,
    color: C.textSecondary,
    lineHeight: 1.4,
    textAlign: 'center',
  },
  pillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 20,
  },
  pill: {
    padding: '10px 20px',
    borderRadius: R.full,
    border: `1px solid ${C.border}`,
    background: C.bgCardHover,
    color: C.textPrimary,
    fontSize: F.sizeMd,
    fontWeight: 600,
    cursor: 'pointer',
    transition: transition.normal,
  },
  linkBtn: {
    marginTop: 16,
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: C.textMuted,
    fontSize: F.sizeSm,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};
