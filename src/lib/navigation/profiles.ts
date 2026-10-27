/**
 * Perfiles de trader.
 *
 * El usuario elige su perfil (day trade, swing, posición, largo plazo) y la
 * plataforma se organiza alrededor de él: cada sección del menú muestra el
 * submenú de páginas que corresponden a su horizonte, y cada página abre con
 * los parámetros por defecto de ese horizonte (DTE de las expiraciones, scope
 * del screener de gamma, etc.).
 *
 * Todo es puro y testeable: la UI solo lo consume.
 */

export type TraderProfile = 'day' | 'swing' | 'position' | 'longterm';

/** Secciones del menú. El orden de estas secciones es el orden del sidebar. */
export type NavSection = 'core' | 'trading' | 'analysis' | 'tools';

export interface ProfileNavItem {
  view: string;
  label: string;
  badge?: string;
  minPlan?: 'pro' | 'elite' | 'enterprise';
}

export interface ProfileNavSection {
  section: NavSection;
  items: ProfileNavItem[];
}

export interface ProfileDefaults {
  /** Ventana de DTE preferida para los contratos de opciones. */
  dteMin: number;
  dteMax: number;
  /** DTE "óptimo" (centro de la ventana) para los picks. */
  dteSweet: number;
  /** Scope por defecto del Gamma Screener. */
  gammaScope: 'nearest' | 'weekly' | 'monthly' | 'all';
  /** Horizonte operativo (etiqueta de la recomendación). */
  horizon: 'day' | 'swing' | 'position';
  /** Días que se mira hacia atrás en los datos de momentum (5/10/20/60). */
  momentumLookback: number;
}

export interface TraderProfileDef {
  id: TraderProfile;
  label: string;
  shortLabel: string;
  icon: string;
  tagline: string;
  description: string;
  /** Qué espera hacer este usuario en la plataforma. */
  bullets: string[];
  defaults: ProfileDefaults;
  nav: ProfileNavSection[];
}

/**
 * Páginas por perfil, agrupadas por sección del menú.
 * Inicio (analyzer) y las páginas universales (watchlist, portfolio,
 * catalizadores) están en todos los perfiles: son transversales.
 */
export const PROFILE_NAV: Record<TraderProfile, ProfileNavSection[]> = {
  day: [
    {
      section: 'core',
      items: [
        { view: 'briefing', label: 'Briefing', badge: 'PRO', minPlan: 'pro' },
        { view: 'market-pulse', label: 'Market Pulse' },
        { view: 'screener', label: 'Screener', badge: 'PRO', minPlan: 'pro' },
        { view: 'catalysts', label: 'Catalizadores', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'trading',
      items: [
        { view: 'trade-picks', label: 'Trade Picks', badge: 'PRO', minPlan: 'pro' },
        { view: 'trade-journal', label: 'Diario de Trades' },
        { view: 'algo-alerts', label: 'Algo Alerts', badge: 'PRO', minPlan: 'pro' },
        { view: 'options', label: 'Opciones', badge: 'ELITE', minPlan: 'elite' },
        { view: 'options-sim', label: 'Sim. Opciones', badge: 'ELITE', minPlan: 'elite' },
      ],
    },
    {
      section: 'analysis',
      items: [
        { view: 'ai-coach', label: 'AI Coach', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'tools',
      items: [
        { view: 'trading-trainer', label: 'Trainer' },
        { view: 'watchlist', label: 'Watchlist' },
        { view: 'portfolio', label: 'Portafolio' },
      ],
    },
  ],

  swing: [
    {
      section: 'core',
      items: [
        { view: 'briefing', label: 'Briefing', badge: 'PRO', minPlan: 'pro' },
        { view: 'market-pulse', label: 'Market Pulse' },
        { view: 'dashboard', label: 'Dashboard', badge: 'PRO', minPlan: 'pro' },
        { view: 'screener', label: 'Screener', badge: 'PRO', minPlan: 'pro' },
        { view: 'catalysts', label: 'Catalizadores', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'trading',
      items: [
        { view: 'trade-picks', label: 'Trade Picks', badge: 'PRO', minPlan: 'pro' },
        { view: 'trade-journal', label: 'Diario de Trades' },
        { view: 'gamma-screener', label: 'Gamma Screener', badge: 'ELITE', minPlan: 'elite' },
        { view: 'options', label: 'Opciones', badge: 'ELITE', minPlan: 'elite' },
        { view: 'options-sim', label: 'Sim. Opciones', badge: 'ELITE', minPlan: 'elite' },
        { view: 'backtest', label: 'Backtest', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'analysis',
      items: [
        { view: 'ai-coach', label: 'AI Coach', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'tools',
      items: [
        { view: 'watchlist', label: 'Watchlist' },
        { view: 'portfolio', label: 'Portafolio' },
      ],
    },
  ],

  position: [
    {
      section: 'core',
      items: [
        { view: 'briefing', label: 'Briefing', badge: 'PRO', minPlan: 'pro' },
        { view: 'market-pulse', label: 'Market Pulse' },
        { view: 'dashboard', label: 'Dashboard', badge: 'PRO', minPlan: 'pro' },
        { view: 'screener', label: 'Screener', badge: 'PRO', minPlan: 'pro' },
        { view: 'catalysts', label: 'Catalizadores', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'trading',
      items: [
        { view: 'trade-journal', label: 'Diario de Trades' },
        { view: 'gamma-screener', label: 'Gamma Screener', badge: 'ELITE', minPlan: 'elite' },
        { view: 'options', label: 'Opciones', badge: 'ELITE', minPlan: 'elite' },
        { view: 'backtest', label: 'Backtest', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'analysis',
      items: [
        { view: 'ai-coach', label: 'AI Coach', badge: 'PRO', minPlan: 'pro' },
        { view: 'inversor-inteligente', label: 'Value Investing', badge: 'ELITE', minPlan: 'elite' },
        { view: 'classification', label: 'Clasificación', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'tools',
      items: [
        { view: 'watchlist', label: 'Watchlist' },
        { view: 'portfolio', label: 'Portafolio' },
      ],
    },
  ],

  longterm: [
    {
      section: 'core',
      items: [
        { view: 'market-pulse', label: 'Market Pulse' },
        { view: 'dashboard', label: 'Dashboard', badge: 'PRO', minPlan: 'pro' },
        { view: 'catalysts', label: 'Catalizadores', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'trading',
      items: [
        { view: 'trade-journal', label: 'Diario de Trades' },
        { view: 'options', label: 'Opciones', badge: 'ELITE', minPlan: 'elite' },
        { view: 'backtest', label: 'Backtest', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'analysis',
      items: [
        { view: 'ai-coach', label: 'AI Coach', badge: 'PRO', minPlan: 'pro' },
        { view: 'inversor-inteligente', label: 'Value Investing', badge: 'ELITE', minPlan: 'elite' },
        { view: 'classification', label: 'Clasificación', badge: 'PRO', minPlan: 'pro' },
      ],
    },
    {
      section: 'tools',
      items: [
        { view: 'watchlist', label: 'Watchlist' },
        { view: 'portfolio', label: 'Portafolio' },
      ],
    },
  ],
};

/** Definición completa de cada perfil. */
export const PROFILES: Record<TraderProfile, TraderProfileDef> = {
  day: {
    id: 'day',
    label: 'Day Trader',
    shortLabel: 'Day',
    icon: '🕐',
    tagline: 'Intradía: decisiones rápidas, mecanismos finos',
    description:
      'Señales de la sesión, alertas en vivo y estructuras de opciones de vida corta. Todo lo que necesitas para operar dentro del día.',
    bullets: [
      'Expiraciones de 0 a 7 días',
      'Alertas y catalizadores de la sesión',
      'Simulador para montar la operación antes de entrar',
    ],
    defaults: {
      dteMin: 0,
      dteMax: 7,
      dteSweet: 3,
      gammaScope: 'nearest',
      horizon: 'day',
      momentumLookback: 5,
    },
    nav: PROFILE_NAV.day,
  },
  swing: {
    id: 'swing',
    label: 'Swing Trader',
    shortLabel: 'Swing',
    icon: '📈',
    tagline: 'Días a semanas: setups, gamma y gestión',
    description:
      'Setups de momentum con días de antelación, mapa de gamma para colocar objetivos y un pick diario con contrato líquido.',
    bullets: [
      'Expiraciones de 14 a 45 días',
      'Gamma Screener: el mapa de niveles que sí funciona a días vista',
      'Trade Picks con stop y target en prima',
    ],
    defaults: {
      dteMin: 14,
      dteMax: 40,
      dteSweet: 38,
      gammaScope: 'weekly',
      horizon: 'swing',
      momentumLookback: 10,
    },
    nav: PROFILE_NAV.swing,
  },
  position: {
    id: 'position',
    label: 'Posición',
    shortLabel: 'Posición',
    icon: '📊',
    tagline: 'Semanas a meses: convicción con estructura',
    description:
      'Análisis fundamental y técnico para tomar posición con un plan: valuation, catalizadores de largo plazo y backtests.',
    bullets: [
      'Expiraciones de 45 a 120 días',
      'Value Investing y Clasificación como base de la decisión',
      'CatMacro y dividendos como catalizadores',
    ],
    defaults: {
      dteMin: 45,
      dteMax: 120,
      dteSweet: 60,
      gammaScope: 'monthly',
      horizon: 'position',
      momentumLookback: 20,
    },
    nav: PROFILE_NAV.position,
  },
  longterm: {
    id: 'longterm',
    label: 'Largo plazo',
    shortLabel: 'Largo plazo',
    icon: '🏦',
    tagline: 'Meses a años: el negocio, no el gráfico',
    description:
      'Inversión de largo plazo: fundamental, dividendos, catalizadores macro y seguimiento de la cartera.',
    bullets: [
      'Expiraciones de 60 a 180 días',
      'Foco en fundamental y distribución de dividendos',
      'Seguimiento de cartera y rentabilidad',
    ],
    defaults: {
      dteMin: 60,
      dteMax: 180,
      dteSweet: 90,
      gammaScope: 'all',
      horizon: 'position',
      momentumLookback: 60,
    },
    nav: PROFILE_NAV.longterm,
  },
};

export const PROFILE_IDS: TraderProfile[] = ['day', 'swing', 'position', 'longterm'];

/** Jerarquía de planes (misma que usa el sidebar para los badges). */
export const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, elite: 2, enterprise: 3 };

/** Etiquetas de las secciones del menú, en orden. */
export const SECTION_LABELS: Record<NavSection, string> = {
  core: '',
  trading: 'Trading',
  analysis: 'Análisis',
  tools: 'Más',
};

export const SECTION_ORDER: NavSection[] = ['core', 'trading', 'analysis', 'tools'];

export function isTraderProfile(v: unknown): v is TraderProfile {
  return typeof v === 'string' && (PROFILE_IDS as string[]).includes(v);
}

export function getProfile(id: string | null | undefined): TraderProfileDef | null {
  return isTraderProfile(id) ? PROFILES[id] : null;
}

/** Items de navegación de un perfil, aplanados (para searches y tests). */
export function profileViews(id: TraderProfile): string[] {
  // 'analyzer' (Inicio) está siempre en el menú, en todos los perfiles.
  return ['analyzer', ...PROFILE_NAV[id].flatMap((s) => s.items.map((i) => i.view))];
}

/** ¿La vista pertenece a este perfil? */
export function viewInProfile(id: TraderProfile, view: string): boolean {
  return profileViews(id).includes(view);
}

/** ¿Alguna sección de este perfil contiene esta vista? (sin contar Inicio) */
export function profileHasView(id: TraderProfile, view: string): boolean {
  return PROFILE_NAV[id].some((s) => s.items.some((i) => i.view === view));
}

/** Página de inicio por perfil (la que se abre al entrar). */
export function defaultViewForProfile(id: TraderProfile, plan = 'free'): string {
  const preferred =
    id === 'day' || id === 'swing' ? 'trade-picks' : 'inversor-inteligente';
  const rank = PLAN_RANK[plan] ?? 0;
  const item = PROFILE_NAV[id]
    .flatMap((s) => s.items)
    .find((i) => i.view === preferred);
  // Si la vista preferida está bloqueada para el plan del usuario, se abre
  // Inicio (el análisis de símbolo, disponible siempre).
  if (!item || !item.minPlan) return preferred;
  return rank >= (PLAN_RANK[item.minPlan] ?? 0) ? preferred : 'analyzer';
}

/** Etiqueta legible del horizonte para la UI. */
export function horizonLabel(horizon: ProfileDefaults['horizon']): string {
  switch (horizon) {
    case 'day':
      return 'Day Trade';
    case 'swing':
      return 'Swing';
    case 'position':
      return 'Posición';
  }
}
