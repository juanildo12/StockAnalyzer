'use client';

import { useState } from 'react';
import {
  Rocket, LayoutDashboard, Filter, BarChart3, Target,
  Watch, FlaskConical, Brain, Bot, Gamepad2,
  ChevronDown, ChevronRight, Zap, LineChart,
} from 'lucide-react';
import { colors as C, radius as R, font as F, spacing as S, transition as T } from '@/src/utils/webTheme';

interface SidebarProps {
  view: string;
  onViewChange: (v: string) => void;
}

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: '',
    items: [
      { view: 'briefing', label: 'Briefing', icon: <Rocket size={18} />, badge: 'NEW' },
      { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { view: 'screener', label: 'Screener', icon: <Filter size={18} /> },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    items: [
      { view: 'options', label: 'Opciones', icon: <Target size={18} /> },
      { view: 'watchlist', label: 'Watchlist', icon: <Watch size={18} /> },
      { view: 'backtest', label: 'Backtest', icon: <FlaskConical size={18} /> },
    ],
  },
  {
    id: 'analysis',
    label: 'Análisis',
    items: [
      { view: 'analyzer', label: 'Analizador', icon: <LineChart size={18} /> },
      { view: 'ai-coach', label: 'AI Coach', icon: <Bot size={18} /> },
      { view: 'inversor-inteligente', label: 'Value Investing', icon: <Brain size={18} /> },
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

export default function Sidebar({ view, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

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
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: F.mono }}>◆</span>
        </div>
        <div>
          <div style={{
            fontSize: F.sizeBase, fontWeight: 700, color: C.textPrimary,
            letterSpacing: '-0.3px', lineHeight: 1.2,
          }}>BreakoutFinder</div>
          <div style={{
            fontSize: F.sizeXs, color: C.textMuted, lineHeight: 1.2,
          }}>AI Trading Platform</div>
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
            {/* Group label */}
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
                }}
              >
                {collapsed[group.id]
                  ? <ChevronRight size={10} />
                  : <ChevronDown size={10} />
                }
                {group.label}
              </button>
            )}

            {/* Items */}
            {!collapsed[group.id] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map(item => {
                  const active = view === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => onViewChange(item.view)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: S.md,
                        width: '100%',
                        padding: `${S.sm} ${S.md}`,
                        border: 'none',
                        borderRadius: R.md,
                        background: active ? C.accentGlow : 'transparent',
                        color: active ? C.accentLight : C.textSecondary,
                        cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        fontSize: F.sizeBase,
                        fontFamily: F.family,
                        textAlign: 'left',
                        transition: T.fast,
                        position: 'relative',
                        borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = C.bgCardHover;
                          e.currentTarget.style.color = C.textPrimary;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = C.textSecondary;
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
                      {item.badge && (
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          padding: '1px 5px', borderRadius: R.full,
                          background: C.positiveBg, color: C.positive,
                          border: `1px solid ${C.positiveBorder}`,
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
            )}
          </div>
        ))}
      </nav>

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
            fontSize: F.sizeSm, fontWeight: 700, color: '#fff',
          }}>J</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: F.sizeSm, fontWeight: 600, color: C.textPrimary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>Juanildo</div>
            <div style={{
              fontSize: F.sizeXs, color: C.textMuted, lineHeight: 1.2,
            }}>Pro Plan</div>
          </div>
          <Zap size={14} color={C.warning} />
        </div>
      </div>
    </aside>
  );
}
