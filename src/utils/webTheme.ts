// BreakoutFinder design tokens
export const colors = {
  // Backgrounds
  bg: '#07080A',
  bgCard: '#0F1117',
  bgCardHover: '#141720',
  bgElevated: '#1A1D28',
  bgInput: '#0A0C10',
  bgSidebar: '#0C0E14',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accent - Purple
  accent: '#7C3AED',
  accentLight: '#8B5CF6',
  accentDark: '#6D28D9',
  accentGlow: 'rgba(124, 58, 237, 0.12)',
  accentBorder: 'rgba(124, 58, 237, 0.3)',

  // Semantic
  positive: '#10B981',
  positiveBg: 'rgba(16, 185, 129, 0.10)',
  positiveBorder: 'rgba(16, 185, 129, 0.25)',
  negative: '#EF4444',
  negativeBg: 'rgba(239, 68, 68, 0.10)',
  negativeBorder: 'rgba(239, 68, 68, 0.25)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.10)',
  warningBorder: 'rgba(245, 158, 11, 0.25)',
  info: '#06B6D4',
  infoBg: 'rgba(6, 182, 212, 0.10)',
  infoBorder: 'rgba(6, 182, 212, 0.25)',

  // Neutral
  border: '#1A1E2A',
  borderHover: '#2A2F3E',
  borderLight: '#272B3A',
  bgBase: '#07080A',
  divider: '#15181F',

  // Gradients
  gradientPrimary: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
  gradientAccent: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
  gradientPositive: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
  gradientNegative: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
  gradientHero: 'linear-gradient(180deg, rgba(124, 58, 237, 0.06) 0%, transparent 100%)',
  gradientCard: 'linear-gradient(180deg, rgba(124, 58, 237, 0.03) 0%, transparent 100%)',
};

export const spacing = {
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
  xxxxl: '40px',
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
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(124, 58, 237, 0.12)',
  glowPositive: '0 0 16px rgba(16, 185, 129, 0.12)',
};

export const transition = {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
};
