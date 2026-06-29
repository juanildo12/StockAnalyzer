'use client';

import { useState } from 'react';
import {
  LineChart, FileText, Shield, Wallet, Eye, Filter,
  DollarSign, CheckCircle, Building2, FlaskConical,
  LayoutDashboard, Brain, Puzzle, Bot, ChevronDown,
  ChevronRight, Search, Briefcase, Wrench,
} from 'lucide-react';
import { colors as C, radius as R } from '@/src/utils/webTheme';

interface SidebarProps {
  view: string;
  onViewChange: (v: string) => void;
}

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'analisis',
    label: 'Análisis',
    icon: <Search size={14} />,
    items: [
      { view: 'analyzer', label: 'Analizador', icon: <LineChart size={18} /> },
      { view: 'informe', label: 'Informe', icon: <FileText size={18} /> },
      { view: 'risk-report', label: 'Risk Report', icon: <Shield size={18} /> },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    icon: <Briefcase size={14} />,
    items: [
      { view: 'portfolio', label: 'Portafolio', icon: <Wallet size={18} /> },
      { view: 'watchlist', label: 'Watchlist', icon: <Eye size={18} /> },
      { view: 'screener', label: 'Screener', icon: <Filter size={18} /> },
      { view: 'options', label: 'Opciones', icon: <DollarSign size={18} /> },
      { view: 'trade-validator', label: 'Trade Validator', icon: <CheckCircle size={18} /> },
      { view: 'tradestation', label: 'TradeStation', icon: <Building2 size={18} /> },
      { view: 'backtest', label: 'Backtest', icon: <FlaskConical size={18} /> },
    ],
  },
  {
    id: 'herramientas',
    label: 'Herramientas',
    icon: <Wrench size={14} />,
    items: [
      { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { view: 'inversor-inteligente', label: 'Inv. Inteligente', icon: <Brain size={18} /> },
      { view: 'framework', label: 'Framework', icon: <Puzzle size={18} /> },
      { view: 'ai-coach', label: 'FinRobot Coach', icon: <Bot size={18} /> },
    ],
  },
];

export default function Sidebar({ view, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    analisis: false,
    trading: false,
    herramientas: false,
  });

  const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: 220,
      height: '100vh',
      background: C.bgCard,
      borderRight: '1px solid ' + C.border,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '16px 16px 14px',
        borderBottom: '1px solid ' + C.border,
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: C.gradientPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
          flexShrink: 0,
        }}>P</div>
        <span style={{
          fontSize: '17px',
          fontWeight: '700',
          color: C.textPrimary,
          letterSpacing: '-0.3px',
        }}>Prospector</span>
      </div>

      <nav style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 10px',
      }}>
        {NAV_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: '16px' }}>
            <button
              onClick={() => toggle(group.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                padding: '6px 8px',
                border: 'none',
                borderRadius: R.md,
                background: 'transparent',
                color: C.textMuted,
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textAlign: 'left',
              }}
            >
              {collapsed[group.id] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {group.icon}
              {group.label}
            </button>

            {!collapsed[group.id] && (
              <div style={{ marginTop: '2px' }}>
                {group.items.map(item => {
                  const active = view === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => onViewChange(item.view)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 10px 8px 14px',
                        border: 'none',
                        borderRadius: R.md,
                        background: active ? C.accent + '18' : 'transparent',
                        color: active ? C.accent : C.textSecondary,
                        cursor: 'pointer',
                        fontWeight: active ? '600' : '400',
                        fontSize: '13px',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <span style={{
                        color: active ? C.accent : C.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
