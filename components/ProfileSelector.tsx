'use client';

import { useEffect, useState } from 'react';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import {
  PROFILES,
  PROFILE_IDS,
  type TraderProfile,
  type TraderProfileDef,
} from '@/src/lib/navigation/profiles';

const STORAGE_KEY = 'trader-profile';

export function readStoredProfile(): TraderProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (PROFILE_IDS as string[]).includes(raw)) return raw as TraderProfile;
  } catch { /* localStorage bloqueado */ }
  return null;
}

export function storeProfile(id: TraderProfile) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch { /* localStorage bloqueado */ }
  // Cookie para que el servidor pueda saber el perfil sin leer localStorage.
  document.cookie = `${STORAGE_KEY}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function clearStoredProfile() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
  document.cookie = `${STORAGE_KEY}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Switcher compacto para el sidebar: muestra el perfil activo y permite
 * cambiar entre los 4 perfiles.
 */
export function ProfileSwitcher({
  profile,
  onChange,
}: {
  profile: TraderProfile;
  onChange: (p: TraderProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const def = PROFILES[profile];

  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Cambiar perfil de trading"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: R.md,
          background: C.accent + '14', border: `1px solid ${C.accentBorder}`,
          color: C.textPrimary, cursor: 'pointer', fontSize: 12, fontWeight: 700,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{def.icon}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {def.label}
        </span>
        <span style={{ fontSize: 10, color: C.textMuted }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 41,
            background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: R.md,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)', overflow: 'hidden',
          }}>
            {PROFILE_IDS.map((id) => {
              const p = PROFILES[id];
              const active = id === profile;
              return (
                <button
                  key={id}
                  onClick={() => { onChange(id); setOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 10px', background: active ? C.accent + '1A' : 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.divider}`,
                    color: active ? C.accentLight : C.textSecondary, cursor: 'pointer',
                    fontSize: 12, fontWeight: active ? 700 : 500, textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15 }}>{p.icon}</span>
                  <span style={{ flex: 1 }}>{p.label}</span>
                  {active && <span style={{ fontSize: 11 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Pantalla de bienvenida: el usuario elige su perfil de trading y la
 * plataforma se organiza a partir de ahí.
 */
export function ProfileWelcome({
  onSelect,
}: {
  onSelect: (p: TraderProfile) => void;
}) {
  const [hover, setHover] = useState<TraderProfile | null>(null);

  useEffect(() => {
    document.title = 'Elige tu perfil de trading · StockAnalyzer';
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px 64px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Configura tu plataforma
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: C.textPrimary, margin: 0, letterSpacing: '-0.5px' }}>
          ¿Cómo operas?
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: '10px auto 0', maxWidth: 560, lineHeight: 1.6 }}>
          Organizamos las herramientas alrededor de tu horizonte: cada perfil muestra las páginas que
          necesitas y abre cada una con los parámetros que corresponden a tu estilo.
          Puedes cambiarlo cuando quieras.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {PROFILE_IDS.map((id) => {
          const p: TraderProfileDef = PROFILES[id];
          const active = hover === id;
          return (
            <button
              key={id}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(id)}
              style={{
                display: 'flex', flexDirection: 'column', textAlign: 'left', cursor: 'pointer',
                background: active ? C.accent + '12' : C.bgCard,
                border: `1px solid ${active ? C.accentBorder : C.border}`,
                borderRadius: R.lg, padding: 20,
                transition: 'all 0.15s ease',
                transform: active ? 'translateY(-2px)' : 'none',
                boxShadow: active ? `0 8px 24px ${C.accent}22` : 'none',
              }}
            >
              <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 12 }}>{p.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 12, color: C.accentLight, fontWeight: 600, marginBottom: 10 }}>
                {p.tagline}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.55, marginBottom: 14 }}>
                {p.description}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {p.bullets.map((b, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.7, display: 'flex', gap: 6 }}>
                    <span style={{ color: C.accent }}>▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div style={{
                marginTop: 'auto', paddingTop: 14, fontSize: 12, fontWeight: 800,
                color: active ? C.accentLight : C.textMuted,
              }}>
                Elegir {p.shortLabel} →
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
        Tu perfil se guarda en este dispositivo. Puedes cambiarlo desde el switcher del menú lateral.
      </div>
    </div>
  );
}
