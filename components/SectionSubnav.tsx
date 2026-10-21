'use client';

import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';
import {
  PROFILE_NAV,
  SECTION_LABELS,
  type TraderProfile,
} from '@/src/lib/navigation/profiles';

/**
 * Submenú horizontal de la sección actual.
 *
 * El perfil define qué páginas hay en cada sección; aquí se muestran como
 * pestañas horizontales para saltar entre ellas sin volver al menú lateral.
 */
export default function SectionSubnav({
  profile,
  view,
  onViewChange,
  compact,
}: {
  profile: TraderProfile;
  view: string;
  onViewChange: (v: string) => void;
  compact?: boolean;
}) {
  const section = PROFILE_NAV[profile].find((s) => s.items.some((i) => i.view === view));
  if (!section || section.items.length < 2) return null;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: S.xs,
      padding: compact ? '8px 12px' : '10px 24px',
      borderBottom: `1px solid ${C.border}`,
      background: C.bg,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
    }}>
      {section.section !== 'core' && (
        <span style={{
          fontSize: F.sizeXs, fontWeight: 700, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4,
        }}>
          {SECTION_LABELS[section.section]}
        </span>
      )}
      {section.items.map((item) => {
        const active = item.view === view;
        return (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            style={{
              padding: '5px 10px',
              borderRadius: R.full,
              border: `1px solid ${active ? C.accentBorder : C.border}`,
              background: active ? C.accent + '1A' : 'transparent',
              color: active ? C.accentLight : C.textSecondary,
              cursor: 'pointer',
              fontSize: F.sizeXs,
              fontWeight: active ? 700 : 500,
              fontFamily: F.family,
              transition: 'all 0.15s ease',
            }}
          >
            {item.label}
            {item.badge && (
              <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 800, opacity: 0.75 }}>{item.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
