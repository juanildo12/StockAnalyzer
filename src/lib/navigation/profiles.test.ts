import { describe, it, expect } from 'vitest';
import {
  PROFILES,
  PROFILE_IDS,
  PROFILE_NAV,
  SECTION_ORDER,
  isTraderProfile,
  getProfile,
  profileViews,
  viewInProfile,
  defaultViewForProfile,
  horizonLabel,
  type TraderProfile,
} from './profiles';

describe('perfiles — estructura', () => {
  it('define los 4 perfiles esperados', () => {
    expect(PROFILE_IDS).toEqual(['day', 'swing', 'position', 'longterm']);
    for (const id of PROFILE_IDS) {
      expect(PROFILES[id].id).toBe(id);
      expect(PROFILES[id].label.length).toBeGreaterThan(0);
      expect(PROFILES[id].icon.length).toBeGreaterThan(0);
      expect(PROFILES[id].bullets.length).toBeGreaterThan(0);
    }
  });

  it('cada perfil tiene un submenú por sección con items no vacíos', () => {
    for (const id of PROFILE_IDS) {
      for (const sec of PROFILE_NAV[id]) {
        expect(sec.items.length).toBeGreaterThan(0);
        expect(SECTION_ORDER).toContain(sec.section);
      }
    }
  });

  it('ningún perfil repite la misma vista en dos sitios', () => {
    for (const id of PROFILE_IDS) {
      const views = profileViews(id);
      expect(new Set(views).size).toBe(views.length);
    }
  });

  it('watchlist y portfolio están en todos los perfiles (transversales)', () => {
    for (const id of PROFILE_IDS) {
      expect(viewInProfile(id, 'watchlist')).toBe(true);
      expect(viewInProfile(id, 'portfolio')).toBe(true);
    }
  });

  it('Market Pulse está en todos los perfiles y es gratis (contexto de mercado)', () => {
    for (const id of PROFILE_IDS) {
      expect(viewInProfile(id, 'market-pulse')).toBe(true);
      const item = PROFILE_NAV[id].flatMap((s) => s.items).find((i) => i.view === 'market-pulse');
      expect(item?.minPlan).toBeUndefined();
    }
  });
});

describe('perfiles — coherencia del horizonte', () => {
  it('el Gamma Screener NO aparece en day trade (el OI es del cierre previo)', () => {
    expect(viewInProfile('day', 'gamma-screener')).toBe(false);
    expect(viewInProfile('swing', 'gamma-screener')).toBe(true);
    expect(viewInProfile('position', 'gamma-screener')).toBe(true);
  });

  it('Trade Picks es solo de day y swing (no hay edges de meses)', () => {
    expect(viewInProfile('day', 'trade-picks')).toBe(true);
    expect(viewInProfile('swing', 'trade-picks')).toBe(true);
    expect(viewInProfile('position', 'trade-picks')).toBe(false);
    expect(viewInProfile('longterm', 'trade-picks')).toBe(false);
  });

  it('Value Investing es de posición y largo plazo', () => {
    expect(viewInProfile('day', 'inversor-inteligente')).toBe(false);
    expect(viewInProfile('swing', 'inversor-inteligente')).toBe(false);
    expect(viewInProfile('position', 'inversor-inteligente')).toBe(true);
    expect(viewInProfile('longterm', 'inversor-inteligente')).toBe(true);
  });

  it('las ventanas de DTE crecen con el horizonte', () => {
    const day = PROFILES.day.defaults;
    const swing = PROFILES.swing.defaults;
    const position = PROFILES.position.defaults;
    const longterm = PROFILES.longterm.defaults;
    expect(day.dteMax).toBeLessThan(swing.dteMin);
    expect(swing.dteMax).toBeLessThan(position.dteMin);
    expect(position.dteMax).toBeLessThanOrEqual(longterm.dteMax);
    for (const p of [day, swing, position, longterm]) {
      expect(p.dteMin).toBeLessThan(p.dteMax);
      expect(p.dteSweet).toBeGreaterThanOrEqual(p.dteMin);
      expect(p.dteSweet).toBeLessThanOrEqual(p.dteMax);
    }
  });

  it('el scope de gamma se abre con el horizonte', () => {
    expect(PROFILES.day.defaults.gammaScope).toBe('nearest');
    expect(PROFILES.swing.defaults.gammaScope).toBe('weekly');
    expect(PROFILES.position.defaults.gammaScope).toBe('monthly');
    expect(PROFILES.longterm.defaults.gammaScope).toBe('all');
  });
});

describe('helpers', () => {
  it('isTraderProfile valida el id', () => {
    expect(isTraderProfile('day')).toBe(true);
    expect(isTraderProfile('nope')).toBe(false);
    expect(isTraderProfile(null)).toBe(false);
    expect(isTraderProfile(42)).toBe(false);
  });

  it('getProfile devuelve null para ids desconocidos', () => {
    expect(getProfile('swing')?.id).toBe('swing');
    expect(getProfile('scalping')).toBeNull();
    expect(getProfile(undefined)).toBeNull();
  });

  it('viewInProfile responde correctamente', () => {
    expect(viewInProfile('swing', 'gamma-screener')).toBe(true);
    expect(viewInProfile('day', 'gamma-screener')).toBe(false);
  });

  it('la vista por defecto pertenece al perfil', () => {
    for (const id of PROFILE_IDS) {
      const v = defaultViewForProfile(id);
      expect(viewInProfile(id, v)).toBe(true);
    }
  });

  it('la vista por defecto cae a Inicio si el plan no da acceso', () => {
    // free no llega a Trade Picks (PRO) ni a Value Investing (ELITE)
    expect(defaultViewForProfile('day', 'free')).toBe('analyzer');
    expect(defaultViewForProfile('swing', 'free')).toBe('analyzer');
    expect(defaultViewForProfile('position', 'free')).toBe('analyzer');
    expect(defaultViewForProfile('day', 'pro')).toBe('trade-picks');
    expect(defaultViewForProfile('swing', 'pro')).toBe('trade-picks');
    expect(defaultViewForProfile('position', 'elite')).toBe('inversor-inteligente');
    expect(defaultViewForProfile('longterm', 'elite')).toBe('inversor-inteligente');
  });

  it('horizonLabel devuelve la etiqueta legible', () => {
    expect(horizonLabel('day')).toBe('Day Trade');
    expect(horizonLabel('swing')).toBe('Swing');
    expect(horizonLabel('position')).toBe('Posición');
  });
});
