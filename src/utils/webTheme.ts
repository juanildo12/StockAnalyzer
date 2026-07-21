// Prospector design tokens — Obsidian + Teal
// Supports dark (default) and light themes via data-theme attribute

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex).split(', ');
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Palette definitions ──────────────────────────────────────────────────────

const dark = {
  bg: '#0A0B0E',
  bgCard: '#12141A',
  bgCardHover: '#181B24',
  bgElevated: '#1E212B',
  bgInput: '#0E1015',
  bgSidebar: '#0D0F15',
  bgBase: '#0A0B0E',
  textPrimary: '#E8EAF0',
  textSecondary: '#8B90A5',
  textMuted: '#555A70',
  accent: '#2DD4BF',
  accentLight: '#5EEAD4',
  accentDark: '#14B8A6',
  positive: '#34D399',
  negative: '#FB7185',
  warning: '#FBBF24',
  info: '#67E8F9',
  border: '#1C1F2A',
  borderHover: '#2A2E3C',
  borderLight: '#23263A',
  divider: '#181B24',
};

const light = {
  bg: '#F4F5F0',
  bgCard: '#FFFFFF',
  bgCardHover: '#FAFAF8',
  bgElevated: '#ECEEE8',
  bgInput: '#FFFFFF',
  bgSidebar: '#F8F9F4',
  bgBase: '#F4F5F0',
  textPrimary: '#1A1C22',
  textSecondary: '#555A70',
  textMuted: '#8B90A5',
  accent: '#0D9488',
  accentLight: '#14B8A6',
  accentDark: '#0F766E',
  positive: '#059669',
  negative: '#E11D48',
  warning: '#D97706',
  info: '#0891B2',
  border: '#E0E2DA',
  borderHover: '#CCD0C6',
  borderLight: '#E8EAE3',
  divider: '#E8EAE3',
};

// ── Helper to build alpha variants ───────────────────────────────────────────

type BaseColors = typeof dark;
type AlphaSuffix = string;

function buildAlphaVariants(base: BaseColors, prefix: string, hex: string, opacities: Record<AlphaSuffix, number>) {
  const result: Record<string, string> = {};
  for (const [suffix, alpha] of Object.entries(opacities)) {
    result[`${prefix}${suffix}`] = rgba(hex, alpha);
  }
  return result;
}

const opacityMap: Record<string, number> = {
  '06': 0.024, '08': 0.031, '0a': 0.039, '0b': 0.043, '0c': 0.047, '0d': 0.051,
  '10': 0.063, '12': 0.071, '14': 0.078, '15': 0.082, '18': 0.094, '1a': 0.102,
  '20': 0.125, '25': 0.145, '26': 0.149, '30': 0.188, '35': 0.207, '40': 0.251,
  '4d': 0.302, '50': 0.313, '60': 0.376, '80': 0.502, 'b3': 0.702, 'cc': 0.800, 'f0': 0.941,
};

function buildFullPalette(p: BaseColors) {
  return {
    ...p,
    accentGlow: rgba(p.accent, 0.12),
    accentBorder: rgba(p.accent, 0.30),
    positiveBg: rgba(p.positive, 0.10),
    positiveBorder: rgba(p.positive, 0.25),
    negativeBg: rgba(p.negative, 0.10),
    negativeBorder: rgba(p.negative, 0.25),
    warningBg: rgba(p.warning, 0.10),
    warningBorder: rgba(p.warning, 0.25),
    infoBg: rgba(p.info, 0.10),
    infoBorder: rgba(p.info, 0.25),
    gradientPrimary: `linear-gradient(135deg, ${p.accent} 0%, ${p.accentDark} 100%)`,
    gradientAccent: `linear-gradient(135deg, ${p.accent} 0%, ${p.info} 100%)`,
    gradientPositive: `linear-gradient(135deg, ${p.positive} 0%, ${rgba(p.positive, 0.7)} 100%)`,
    gradientNegative: `linear-gradient(135deg, ${p.negative} 0%, ${rgba(p.negative, 0.7)} 100%)`,
    gradientHero: `linear-gradient(180deg, ${rgba(p.accent, 0.06)} 0%, transparent 100%)`,
    gradientCard: `linear-gradient(180deg, ${rgba(p.accent, 0.03)} 0%, transparent 100%)`,
    // Alpha variants for all semantic colors
    ...buildAlphaVariants(p, 'accent', p.accent, opacityMap),
    ...buildAlphaVariants(p, 'accentLight', p.accentLight, opacityMap),
    ...buildAlphaVariants(p, 'positive', p.positive, opacityMap),
    ...buildAlphaVariants(p, 'negative', p.negative, opacityMap),
    ...buildAlphaVariants(p, 'warning', p.warning, opacityMap),
    ...buildAlphaVariants(p, 'info', p.info, opacityMap),
    ...buildAlphaVariants(p, 'textMuted', p.textMuted, opacityMap),
    ...buildAlphaVariants(p, 'textPrimary', p.textPrimary, opacityMap),
    ...buildAlphaVariants(p, 'bg', p.bg, opacityMap),
    ...buildAlphaVariants(p, 'bgCard', p.bgCard, opacityMap),
    ...buildAlphaVariants(p, 'bgElevated', p.bgElevated, opacityMap),
    ...buildAlphaVariants(p, 'bgBase', p.bgBase, opacityMap),
    ...buildAlphaVariants(p, 'divider', p.divider, opacityMap),
  } as typeof colors;
}

// ── Mutable colors object ────────────────────────────────────────────────────

type ColorMap = ReturnType<typeof buildFullPalette>;

let _palette: ColorMap = buildFullPalette(dark);

// The exported colors object — all components import this as `C`
export const colors: ColorMap = new Proxy({} as ColorMap, {
  get(_, prop: string) {
    return (_palette as any)[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(_palette);
  },
  getOwnPropertyDescriptor() {
    return { configurable: true, enumerable: true };
  },
});

export function applyTheme(theme: 'dark' | 'light') {
  _palette = buildFullPalette(theme === 'dark' ? dark : light);
}

// ── Static tokens (unchanged by theme) ──────────────────────────────────────

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
  sizeXl: '20px',
  sizeXxl: '24px',
  sizeHero: '32px',
  sizeDisplay: '44px',
};

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  card: '0 2px 8px rgba(0, 0, 0, 0.25), 0 0 1px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(45, 212, 191, 0.12)',
  glowPositive: '0 0 16px rgba(52, 211, 153, 0.12)',
};

export const transition = {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
  spring: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
  springSnap: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  smoothHeavy: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
  press: 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const anim = {
  fadeIn: 'fadeIn 0.3s ease forwards',
  fadeInUp: 'fadeInUp 0.3s ease forwards',
  fadeInScale: 'fadeInScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  slideDown: 'slideDown 0.25s ease forwards',
  slideRight: 'slideRight 0.3s ease forwards',
  shimmer: 'shimmer 2s linear infinite',
  scoreFill: 'scoreFill 0.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
  pulseGlow: 'pulseGlow 2s ease-in-out infinite',
  spin: 'spin 0.6s linear infinite',
  countUp: 'countUp 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
  shimmerFast: 'shimmer 1.2s ease-in-out infinite',
  pulseSoft: 'pulseSoft 2s ease-in-out infinite',
  glowPulse: 'glowPulse 2s ease-in-out infinite',
};
