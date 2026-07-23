'use client';

import { useState } from 'react';
import {
  Rocket, LayoutDashboard, Filter, BarChart3, Target,
  Watch, FlaskConical, Brain, Bot, Gamepad2,
  ChevronDown, ChevronRight, Zap, LineChart, Bell,
  Lock, Crown, Gem, Building2, Sun, Moon,
} from 'lucide-react';
import { colors as C, radius as R, font as F, spacing as S, transition as T } from '@/src/utils/webTheme';
import { useTheme } from '@/src/components/ThemeProvider';

interface SidebarProps {
  view: string;
  onViewChange: (v: string) => void;
  userPlan?: string;
  userName?: string;
}

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  minPlan?: 'pro' | 'elite' | 'enterprise';
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const PLAN_HIERARCHY: Record<string, number> = { free: 0, pro: 1, elite: 2, enterprise: 3 };

const PLAN_COLORS: Record<string, string> = {
  free: C.textMuted,
  pro: C.accent,
  elite: C.warning,
  enterprise: C.positive,
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap size={10} />,
  pro: <Crown size={10} />,
  elite: <Gem size={10} />,
  enterprise: <Building2 size={10} />,
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: '',
    items: [
      { view: 'analyzer', label: 'Inicio', icon: <Rocket size={18} /> },
    ],
  },
  {
    id: 'core',
    label: '',
    items: [
      { view: 'briefing', label: 'Briefing', icon: <Rocket size={18} />, badge: 'PRO', minPlan: 'pro' },
      { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, badge: 'PRO', minPlan: 'pro' },
      { view: 'screener', label: 'Screener', icon: <Filter size={18} />, badge: 'PRO', minPlan: 'pro' },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    items: [
      { view: 'alerts', label: 'Smart Alerts', icon: <Bell size={18} />, badge: 'PRO', minPlan: 'pro' },
      { view: 'options', label: 'Opciones', icon: <Target size={18} />, badge: 'ELITE', minPlan: 'elite' },
      { view: 'watchlist', label: 'Watchlist', icon: <Watch size={18} /> },
      { view: 'backtest', label: 'Backtest', icon: <FlaskConical size={18} />, badge: 'PRO', minPlan: 'pro' },
    ],
  },
  {
    id: 'analysis',
    label: 'Análisis',
    items: [
      { view: 'ai-coach', label: 'AI Coach', icon: <Bot size={18} />, badge: 'PRO', minPlan: 'pro' },
      { view: 'inversor-inteligente', label: 'Value Investing', icon: <Brain size={18} />, badge: 'ELITE', minPlan: 'elite' },
    ],
  },
  {
    id: 'tools',
    label: 'Más',
    items: [
      { view: 'trading-trainer', label: 'Trainer', icon: <Gamepad2 size={18} /> },
    ],
  },
];

export default function Sidebar({ view, onViewChange, userPlan = 'free', userName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { theme, toggle: toggleTheme } = useTheme();
  const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;

  const planLabel = userPlan.charAt(0).toUpperCase() + userPlan.slice(1);

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: 220,
      height: '100vh',
      background: C.bgSidebar,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: S.md,
        padding: `${S.xl} ${S.lg}`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: R.md,
          background: C.gradientPrimary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: C.accent + '30',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, fontFamily: F.mono }}>◆</span>
        </div>
        <div>
          <div style={{
            fontSize: F.sizeBase, fontWeight: 700, color: C.textPrimary,
            letterSpacing: '-0.3px', lineHeight: 1.2,
          }}>Prospector</div>
          <div style={{
            fontSize: F.sizeXs, color: C.textMuted, lineHeight: 1.2,
          }}>AI Stock Analysis</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${S.sm} ${S.sm}`,
      }}>
        {NAV_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: group.label ? S.md : S.lg }}>
            {group.label && (
              <button
                onClick={() => toggle(group.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: S.xs,
                  width: '100%', padding: `${S.xs} ${S.sm}`,
                  border: 'none', borderRadius: R.sm,
                  background: 'transparent',
                  color: C.textMuted,
                  cursor: 'pointer',
                  fontSize: F.sizeXs,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontFamily: F.family,
                  textAlign: 'left',
                  marginBottom: S.xxs,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{
                  display: 'inline-flex',
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: collapsed[group.id] ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}>
                  <ChevronDown size={10} />
                </span>
                {group.label}
              </button>
            )}

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden',
              maxHeight: collapsed[group.id] ? 0 : 400,
              opacity: collapsed[group.id] ? 0 : 1,
              transition: 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
            }}>
              {group.items.map((item, idx) => {
                  const active = view === item.view;
                  const isLocked = item.minPlan && userLevel < PLAN_HIERARCHY[item.minPlan];
                  const badgeColor = item.minPlan ? PLAN_COLORS[item.minPlan] : C.positive;

                  return (
                    <button
                      key={item.view}
                      onClick={() => {
                        if (isLocked) {
                          window.location.href = '/settings/billing';
                        } else {
                          onViewChange(item.view);
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: S.md,
                        width: '100%',
                        padding: `${S.sm} ${S.md}`,
                        border: 'none',
                        borderRadius: R.md,
                        background: active ? C.accentGlow : 'transparent',
                        color: active ? C.accentLight : isLocked ? C.textMuted : C.textSecondary,
                        cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        fontSize: F.sizeBase,
                        fontFamily: F.family,
                        textAlign: 'left',
                        transition: 'all 0.15s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        position: 'relative',
                        borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
                        opacity: isLocked ? 0.7 : 1,
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = C.bgCardHover;
                          e.currentTarget.style.color = C.textPrimary;
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = isLocked ? C.textMuted : C.textSecondary;
                          e.currentTarget.style.transform = 'translateX(0)';
                        }
                      }}
                    >
                      <span style={{
                        color: active ? C.accentLight : C.textMuted,
                        display: 'flex', alignItems: 'center',
                        transition: T.fast,
                      }}>
                        {item.icon}
                      </span>
                      {item.label}
                      {isLocked && (
                        <Lock size={12} color={C.textMuted} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                      )}
                      {item.badge && !isLocked && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          padding: '1px 5px', borderRadius: R.full,
                          background: badgeColor + '20',
                          color: badgeColor,
                          border: `1px solid ${badgeColor}40`,
                          marginLeft: 'auto',
                          letterSpacing: '0.02em',
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
          </div>
        ))}
      </nav>

      {/* Plan badge + Upgrade CTA */}
      {userPlan === 'free' && (
        <div style={{
          padding: `${S.md} ${S.md}`,
          margin: `0 ${S.sm} ${S.sm}`,
          borderRadius: R.lg,
          background: `linear-gradient(135deg, ${C.accent12}, ${C.info10})`,
          border: `1px solid ${C.accent25}`,
          cursor: 'pointer',
          transition: T.normal,
          boxShadow: `0 2px 8px ${C.accent10}`,
        }} onClick={() => window.location.href = '/settings/billing'}
          onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${C.accent20}, ${C.info18})`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${C.accent15}`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${C.accent12}, ${C.info10})`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 2px 8px ${C.accent10}`; }}
        >
          <div style={{
            fontSize: F.sizeSm, fontWeight: 700, color: C.accentLight,
            marginBottom: 3, letterSpacing: '-0.01em',
          }}>Desbloquear Pro — $49/mo</div>
          <div style={{
            fontSize: F.sizeXs, color: C.textMuted, lineHeight: 1.4,
          }}>AI Analysis + Smart Alerts + Backtest</div>
        </div>
      )}

      {/* Theme toggle */}
      <div style={{ padding: `${S.sm} ${S.sm}`, margin: `0 ${S.sm}` }}>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          style={{
            display: 'flex', alignItems: 'center', gap: S.sm, width: '100%',
            padding: `${S.sm} ${S.md}`, borderRadius: R.md,
            border: `1px solid ${C.border}`, background: C.bgCard,
            color: C.textSecondary, cursor: 'pointer', fontFamily: F.family,
            fontSize: F.sizeSm, transition: T.fast,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.bgCardHover; e.currentTarget.style.borderColor = C.borderHover; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.bgCard; e.currentTarget.style.borderColor = C.border; }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
      </div>

      {/* User section */}
      <div style={{
        padding: `${S.md} ${S.lg}`,
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: S.sm,
        }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: R.full,
            background: C.gradientAccent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: F.sizeSm, fontWeight: 700, color: C.textPrimary,
          }}>{(userName || 'U').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{userName || 'User'}</div>
            <div style={{
              fontSize: F.sizeXs, color: PLAN_COLORS[userPlan] || C.textMuted, lineHeight: 1.2,
              fontWeight: 600,
            }}>{planLabel} Plan</div>
          </div>
          {userPlan !== 'free' && (
            <span style={{ color: PLAN_COLORS[userPlan] }}>
              {PLAN_ICONS[userPlan]}
            </span>
          )}
          {userPlan === 'free' && <Zap size={14} color={C.warning} />}
        </div>
      </div>
    </aside>
  );
}
