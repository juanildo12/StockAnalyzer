// Prospero.ai-inspired design tokens for the StockAnalyzer web app
export const colors = {
  // Backgrounds
  bg: '#07080A',
  bgCard: '#111318',
  bgCardHover: '#161922',
  bgElevated: '#1A1D26',
  bgInput: '#0D0F14',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accent - Purple/Indigo (primary brand)
  accent: '#7C3AED',
  accentLight: '#8B5CF6',
  accentDark: '#6D28D9',
  accentGlow: 'rgba(124, 58, 237, 0.15)',

  // Semantic
  positive: '#10B981',
  positiveBg: 'rgba(16, 185, 129, 0.12)',
  positiveBorder: 'rgba(16, 185, 129, 0.3)',
  negative: '#EF4444',
  negativeBg: 'rgba(239, 68, 68, 0.12)',
  negativeBorder: 'rgba(239, 68, 68, 0.3)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.3)',
  info: '#06B6D4',
  infoBg: 'rgba(6, 182, 212, 0.12)',
  infoBorder: 'rgba(6, 182, 212, 0.3)',

  // Neutral
  border: '#1E2230',
  borderLight: '#272B3A',
  divider: '#1A1E2A',

  // Gradients
  gradientPrimary: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
  gradientAccent: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
  gradientPositive: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
  gradientNegative: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
  gradientHero: 'linear-gradient(180deg, rgba(124, 58, 237, 0.08) 0%, transparent 100%)',
  gradientCard: 'linear-gradient(180deg, rgba(124, 58, 237, 0.03) 0%, transparent 100%)',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
};

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

export const font = {
  family: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '13px',
  sizeBase: '14px',
  sizeLg: '16px',
  sizeXl: '18px',
  sizeXxl: '20px',
  sizeHero: '24px',
};

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(124, 58, 237, 0.15)',
};

export const transition = {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
};
