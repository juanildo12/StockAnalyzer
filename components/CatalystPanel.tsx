'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

interface Catalyst {
  type: string;
  title: string;
  description?: string;
  date: string;
  importance: number;
  confidence: number;
  status: string;
  source: string;
  link?: string;
  emoji: string;
  meta?: Record<string, any>;
}

interface CalendarDay {
  iso: string;
  label: string;
  total?: number;
  typeCounts?: Record<string, number>;
  events: Catalyst[];
}

interface Roadmap {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  upcoming: Catalyst[];
  news: any[];
  analysts: any[] | null;
  generatedAt: number;
}

interface MoverNews {
  headline: string;
  source: string;
  url: string;
  datetime: number;
}

interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap: number;
  news: MoverNews | null;
}

interface MoversPayload {
  updatedAt: number;
  gainers: MarketMover[];
  losers: MarketMover[];
}

type TabKey = 'catalysts' | 'calendar' | 'movers';

const TABS: { key: TabKey; emoji: string; label: string; color: string; sub: string }[] = [
  {
    key: 'catalysts',
    emoji: '📅',
    label: 'Catalizadores',
    color: C.accent,
    sub: 'Próximas 2 semanas: ganancias, IPOs, Fed/macro y eventos de mercado que mueven acciones',
  },
  {
    key: 'calendar',
    emoji: '🗓️',
    label: 'Catalyst Calendar',
    color: C.info,
    sub: 'Every tracked catalyst, on the day it happens',
  },
  {
    key: 'movers',
    emoji: '📈',
    label: 'Market Movers',
    color: C.warning,
    sub: 'Top gainers y losers con las noticias de hoy',
  },
];

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  return ymOf(new Date(y, m - 1 + delta, 1));
}

function monthLabelEs(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
}

/** Celdas del mes, lunes primero, con `null` en los huecos de otros meses. */
function monthCells(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${ym}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function impChip(n: number) {
  if (n >= 85) return { label: `Alta ${n}`, color: '#F87171', bg: '#F8717115', border: '#F8717140' };
  if (n >= 60) return { label: `Notable ${n}`, color: '#FBBF24', bg: '#FBBF2415', border: '#FBBF2440' };
  return { label: `${n}`, color: '#8B90A5', bg: '#8B90A515', border: '#8B90A540' };
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  earnings: { label: 'Ganancias', color: '#34D399' },
  dividend: { label: 'Dividendo', color: '#A78BFA' },
  ipo: { label: 'IPO', color: '#38BDF8' },
  economic: { label: 'Macro', color: '#34D399' },
  analyst: { label: 'Analistas', color: '#F472B6' },
  news: { label: 'Mercado', color: '#8B90A5' },
  split: { label: 'Split', color: '#A78BFA' },
  holiday: { label: 'Festivo', color: '#FBBF24' },
};

/** Orden en el que se muestran los filtros por tipo (desc por relevancia). */
const FILTER_TYPES: string[] = ['earnings', 'ipo', 'economic', 'holiday', 'dividend', 'split', 'analyst', 'news'];

/** Catálogo de tipos activos por defecto (todos). */
function allTypes(): Set<string> {
  return new Set(FILTER_TYPES);
}

function countByType(events: Catalyst[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) out[e.type] = (out[e.type] || 0) + 1;
  return out;
}

/** Cuenta eventos por tipo usando `typeCounts` (exacto aunque la lista venga recortada). */
function sumTypeCounts(days: CalendarDay[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of days) {
    if (d.typeCounts) {
      for (const t of Object.keys(d.typeCounts)) out[t] = (out[t] || 0) + (d.typeCounts[t] || 0);
    } else {
      const c = countByType(d.events);
      for (const t of Object.keys(c)) out[t] = (out[t] || 0) + c[t];
    }
  }
  return out;
}

/** Aplica el filtro de tipos a un día (recomputa `total` con `typeCounts` si existe). */
function filterDay(day: CalendarDay, active: Set<string>): CalendarDay {
  if (active.size === FILTER_TYPES.length) return day;
  const events = day.events.filter(e => active.has(e.type));
  const counts = day.typeCounts;
  const total = counts
    ? FILTER_TYPES.reduce((s, t) => s + (active.has(t) ? (counts[t] || 0) : 0), 0)
    : events.length;
  return { ...day, events, total };
}

function isWeekend(iso: string): boolean {
  const dow = new Date(iso + 'T12:00:00').getDay();
  return dow === 0 || dow === 6;
}

function isHoliday(day: CalendarDay | undefined): boolean {
  if (!day) return false;
  return (day.typeCounts?.holiday ?? 0) > 0;
}

/** Días desde hoy hasta `iso` (0 = hoy, 1 = mañana; negativo = pasado). */
function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d > 1) return `En ${d} días`;
  if (d === -1) return 'Ayer';
  return `Hace ${Math.abs(d)} días`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts * 1000) / 1000);
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const meridiem = h24 >= 12 ? 'p.m.' : 'a.m.';
  const h = h24 % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${meridiem}`;
}

function fmtCompact(v: number): string {
  if (!v) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

/** Badge "antes de abrir" / "después de cerrar" para earnings (meta.hour BMO/AMC). */
function hourLabel(hour?: string): string | null {
  const h = (hour || '').toLowerCase();
  if (h.startsWith('bmo')) return 'Antes de abrir';
  if (h.startsWith('amc')) return 'Después de cerrar';
  if (h.startsWith('dmh') || h.startsWith('d')) return 'Durante sesión';
  return null;
}

/** Orden cronológico de sesión: pre-mercado → intradía → sin hora → post-mercado. */
function hourOrder(hour?: string): number {
  const h = (hour || '').toLowerCase();
  if (h.startsWith('bmo')) return 0;
  if (h.startsWith('dmh') || h.startsWith('d')) return 1;
  if (h.startsWith('amc')) return 3;
  return 2;
}

/** Hora del evento macro en ET (ej. FOMC 14:00). */
function etTimeLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  });
}

/** Toggles de filtro por tipo, con conteo del conjunto visible. */
function TypeFilterBar({
  active, counts, onToggle, onReset,
}: {
  active: Set<string>;
  counts: Record<string, number>;
  onToggle: (t: string) => void;
  onReset: () => void;
}) {
  const allOn = active.size === FILTER_TYPES.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px',
        color: C.textMuted, textTransform: 'uppercase', marginRight: 2,
      }}>
        Filtrar
      </span>
      {FILTER_TYPES.map(t => {
        const tm = TYPE_META[t] || { label: t, color: C.textMuted };
        const on = active.has(t);
        const n = counts[t] || 0;
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            title={`${on ? 'Ocultar' : 'Mostrar'} ${tm.label}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: R.full, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: F.family,
              border: `1px solid ${on ? tm.color + '66' : C.border}`,
              background: on ? tm.color + '1e' : 'transparent',
              color: on ? tm.color : C.textMuted,
              opacity: n === 0 && on ? 0.45 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: on ? tm.color : 'transparent',
              border: `1.5px solid ${on ? tm.color : C.textMuted}`,
            }} />
            {tm.label}
            <span style={{ fontFamily: F.mono, opacity: 0.75 }}>{n}</span>
          </button>
        );
      })}
      {!allOn && (
        <button
          onClick={onReset}
          style={{
            padding: '3px 9px', borderRadius: R.full, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, fontFamily: F.family,
            border: `1px solid ${C.accentBorder}`, background: C.accent12, color: C.accent,
          }}
        >
          Todos
        </button>
      )}
    </div>
  );
}

/** Tarjeta con el próximo catalizador relevante y su cuenta atrás. */
function NextCatalystCard({
  days, active, onOpenSymbol, onJump,
}: {
  days: CalendarDay[] | null;
  active: Set<string>;
  onOpenSymbol: (symbol: string) => void;
  onJump?: (iso: string) => void;
}) {
  if (!days || days.length === 0) return null;

  const todayIso = fmtDay(new Date());
  let next: { day: CalendarDay; c: Catalyst } | null = null;
  for (const day of days) {
    if (day.iso < todayIso) continue;
    const candidates = day.events
      .filter(e => active.has(e.type) && e.type !== 'news')
      .sort((a, b) => b.importance - a.importance);
    if (candidates.length > 0) { next = { day, c: candidates[0] }; break; }
  }
  if (!next) return null;

  const { day, c } = next;
  const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
  const sym = c.meta?.symbol;
  const dLeft = daysUntil(day.iso);

  return (
    <div
      onClick={() => { if (sym) onOpenSymbol(sym); else onJump?.(day.iso); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '12px 14px', borderRadius: R.lg, marginBottom: 14,
        cursor: 'pointer', border: `1px solid ${tm.color}44`,
        background: `linear-gradient(90deg, ${tm.color}14, transparent 60%)`,
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minWidth: 62, padding: '6px 8px', borderRadius: R.md,
        background: tm.color + '1e', border: `1px solid ${tm.color}44`,
      }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: tm.color, lineHeight: 1.1 }}>
          {dLeft === 0 ? 'HOY' : dLeft === 1 ? 'MAÑ' : `${dLeft}d`}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
            color: C.textMuted,
          }}>
            Próximo catalizador
          </span>
          <span style={{
            fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: R.full,
            background: tm.color + '18', color: tm.color, border: `1px solid ${tm.color}40`,
          }}>
            {tm.label}
          </span>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.textPrimary, marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {c.emoji} {c.title}
        </div>
        <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>
          {fmtDate(day.iso)} · {countdownLabel(day.iso)}
          {sym && <span style={{ color: C.accentLight, fontWeight: 700 }}> · {sym} →</span>}
        </div>
      </div>
    </div>
  );
}


function MoverRow({ mover, onOpen }: { mover: MarketMover; onOpen: (symbol: string) => void }) {
  const up = mover.changePct >= 0;
  const tint = up ? C.positive : C.negative;

  return (
    <div
      onClick={() => onOpen(mover.symbol)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '9px 10px', borderRadius: R.md, cursor: 'pointer',
        borderLeft: `3px solid ${tint}`, background: C.bgCardHover,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.bgElevated; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.bgCardHover; }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: C.textPrimary, flexShrink: 0 }}>{mover.symbol}</span>
        <span style={{
          fontSize: 12.5, fontWeight: 800, color: tint,
          fontFamily: F.mono, flexShrink: 0, marginLeft: 'auto',
        }}>
          {up ? '+' : ''}{mover.changePct.toFixed(2)}%
        </span>
      </div>

      <div style={{
        fontSize: 11.5, color: C.textMuted, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {mover.name} · ${mover.price.toFixed(2)} · Vol {fmtCompact(mover.volume)}
      </div>

      {mover.news && (
        <div
          onClick={e => {
            if (mover.news?.url) {
              e.stopPropagation();
              window.open(mover.news.url, '_blank', 'noreferrer');
            }
          }}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 5,
            marginTop: 2, cursor: mover.news.url ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 10.5, lineHeight: 1.5, flexShrink: 0 }}>📰</span>
          <span style={{ minWidth: 0 }}>
            <span style={{
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', fontSize: 11.5, color: C.textSecondary, lineHeight: 1.4,
            }}>
              {mover.news.headline}
            </span>
            <span style={{ display: 'block', fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
              {mover.news.source}
              {mover.news.datetime ? ` · ${timeAgo(mover.news.datetime)}` : ''}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function MoverColumn({
  title, movers, onOpen,
}: { title: string; movers: MarketMover[]; onOpen: (symbol: string) => void }) {
  const up = title.toLowerCase().includes('gan');
  const tint = up ? C.positive : C.negative;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        fontSize: 11.5, fontWeight: 800, letterSpacing: '0.6px', color: tint,
        textTransform: 'uppercase',
      }}>
        {up ? '▲' : '▼'} {title}
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: 0,
          padding: '1px 7px', borderRadius: R.full, color: tint,
          background: up ? C.positiveBg : C.negativeBg,
          border: `1px solid ${up ? C.positiveBorder : C.negativeBorder}`,
        }}>
          {movers.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {movers.map(m => <MoverRow key={m.symbol} mover={m} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

const CELL_HEIGHT = 96;
const CELL_MAX_CHIPS = 2;
/** Máximo de filas por día en la lista de próximas 2 semanas (el resto, en el calendario). */
const WEEKLY_DAY_MAX = 12;

function DayCell({
  iso, day, todayIso, isOpen, weekend, holiday, onToggle, onOpenSymbol,
}: {
  iso: string;
  day: CalendarDay | undefined;
  todayIso: string;
  isOpen: boolean;
  weekend: boolean;
  holiday: boolean;
  onToggle: () => void;
  onOpenSymbol: (symbol: string) => void;
}) {
  const num = Number(iso.slice(-2));
  const isToday = iso === todayIso;
  const events = day?.events ?? [];
  const total = day?.total ?? events.length;
  const shown = events.slice(0, CELL_MAX_CHIPS);
  const hidden = Math.max(0, total - shown.length);

  const holidayName = holiday
    ? (events.find(e => e.type === 'holiday')?.meta?.holiday as string | undefined)
    : undefined;

  const bg = isOpen ? C.accent12
    : isToday ? C.bgCardHover
    : holiday ? '#FBBF2410'
    : weekend ? '#0f1319'
    : C.bgCard;
  const border = isOpen ? C.accentBorder
    : isToday ? C.borderHover
    : holiday ? '#FBBF2440'
    : C.border;
  const numColor = isToday ? C.accent : holiday ? '#FBBF24' : weekend ? C.textMuted : C.textSecondary;

  const title = holidayName
    ? `🏖️ ${holidayName}`
    : total > 0 ? `${total} catalizador${total === 1 ? '' : 'es'} — clic para ver todos` : undefined;

  return (
    <div
      onClick={total > 0 ? onToggle : undefined}
      title={title}
      style={{
        height: CELL_HEIGHT, padding: '4px 5px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden',
        borderRadius: R.sm, cursor: total > 0 ? 'pointer' : 'default',
        background: bg, border: `1px solid ${border}`,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={e => { if (total > 0 && !isOpen) e.currentTarget.style.background = C.bgCardHover; }}
      onMouseLeave={e => { if (total > 0 && !isOpen) e.currentTarget.style.background = bg; }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, marginBottom: 1,
        fontSize: 10.5, fontWeight: isToday ? 800 : 600, lineHeight: 1.2,
        color: numColor,
      }}>
        <span>{num}{holiday && holidayName ? ' 🏖️' : ''}</span>
        {total > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: C.textMuted,
            fontFamily: F.mono, lineHeight: 1.4, padding: '0 4px', borderRadius: R.full,
            background: C.bgElevated,
          }}>
            {total}
          </span>
        )}
      </div>

      {shown.map((c, i) => {
        const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
        const sym = c.meta?.symbol as string | undefined;
        return (
          <div
            key={i}
            onClick={sym ? (e) => { e.stopPropagation(); onOpenSymbol(sym); } : undefined}
            title={sym ? `${c.title} — ver ${sym}` : c.title}
            style={{
              fontSize: 9.5, lineHeight: 1.28, padding: '1px 3px',
              borderRadius: 3, overflow: 'hidden', wordBreak: 'break-word',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              background: tm.color + '16', color: tm.color,
              borderLeft: `2px solid ${tm.color}`,
              cursor: sym ? 'pointer' : 'inherit',
            }}
          >
            {c.emoji} {c.title}
          </div>
        );
      })}

      {hidden > 0 && (
        <div style={{
          fontSize: 9.5, fontWeight: 700, color: C.accent,
          marginTop: 'auto', lineHeight: 1.2, flexShrink: 0,
        }}>
          +{hidden} más
        </div>
      )}
    </div>
  );
}

interface MonthCalendarProps {
  ym: string;
  days: CalendarDay[] | null;
  loading: boolean;
  openDay: string | null;
  dayEvents: Catalyst[] | null;
  dayLoading: boolean;
  activeTypes: Set<string>;
  onToggleType: (t: string) => void;
  onResetTypes: () => void;
  onShift: (delta: number) => void;
  onToday: () => void;
  onToggleDay: (iso: string) => void;
  onOpenSymbol: (symbol: string) => void;
}

function MonthCalendar({
  ym, days, loading, openDay, dayEvents, dayLoading, activeTypes,
  onToggleType, onResetTypes, onShift, onToday, onToggleDay, onOpenSymbol,
}: MonthCalendarProps) {
  const todayIso = fmtDay(new Date());
  const byIso = new Map((days || []).map(d => [d.iso, d]));
  const filteredByIso = new Map((days || []).map(d => [d.iso, filterDay(d, activeTypes)]));
  const cells = monthCells(ym);

  const monthCounts = sumTypeCounts((days || []).filter(d => d.iso.slice(0, 7) === ym));

  const navBtn = {
    padding: '5px 11px', borderRadius: R.sm, border: `1px solid ${C.border}`,
    background: C.bgCard, color: C.textSecondary, cursor: 'pointer',
    fontSize: 12, fontFamily: F.family, transition: 'all 0.15s ease',
  };

  return (
    <div style={{
      padding: '16px 18px', borderRadius: R.xl,
      background: C.gradientCard, border: `1px solid ${C.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginBottom: 14, flexWrap: 'wrap',
      }}>
        <h2 style={{
          fontSize: 16, fontWeight: 800, color: C.textPrimary,
          margin: 0, letterSpacing: '-0.2px', textTransform: 'capitalize',
        }}>
          Catalyst Calendar
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => onShift(-1)} style={navBtn} aria-label="Mes anterior">←</button>
          <span style={{
            fontSize: 12.5, fontWeight: 700, color: C.textPrimary,
            minWidth: 130, textAlign: 'center', textTransform: 'capitalize',
          }}>
            {loading ? '···' : monthLabelEs(ym)}
          </span>
          <button onClick={() => onShift(1)} style={navBtn} aria-label="Mes siguiente">→</button>
          <button
            onClick={onToday}
            style={{ ...navBtn, fontSize: 11.5, color: C.accent, borderColor: C.accentBorder, background: C.accent12 }}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Próximo catalizador del mes */}
      {!loading && (
        <NextCatalystCard
          days={(days || []).filter(d => d.iso >= todayIso)}
          active={activeTypes}
          onOpenSymbol={onOpenSymbol}
          onJump={onToggleDay}
        />
      )}

      {/* Contadores por tipo del mes */}
      {!loading && days && days.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {FILTER_TYPES.map(t => {
            const n = monthCounts[t] || 0;
            if (n === 0) return null;
            const tm = TYPE_META[t] || { label: t, color: C.textMuted };
            return (
              <span key={t} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px',
                borderRadius: R.full, fontSize: 11, fontWeight: 600,
                border: `1px solid ${C.border}`, background: C.bgCard, color: C.textSecondary,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: tm.color }} />
                {tm.label}
                <span style={{ fontFamily: F.mono, fontWeight: 700, color: tm.color }}>{n}</span>
              </span>
            );
          })}
        </div>
      )}

      <TypeFilterBar
        active={activeTypes}
        counts={monthCounts}
        onToggle={(t) => onToggleType(t)}
        onReset={onResetTypes}
      />

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map(w => (
          <div
            key={w}
            style={{
              fontSize: 9.5, fontWeight: 700, color: C.textMuted,
              textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.3px',
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((iso, i) =>
          iso ? (
            <DayCell
              key={iso}
              iso={iso}
              day={filteredByIso.get(iso)}
              todayIso={todayIso}
              isOpen={openDay === iso}
              weekend={isWeekend(iso)}
              holiday={isHoliday(byIso.get(iso))}
              onToggle={() => onToggleDay(iso)}
              onOpenSymbol={onOpenSymbol}
            />
          ) : (
            <div key={`e${i}`} style={{ height: CELL_HEIGHT, borderRadius: R.sm }} />
          )
        )}
      </div>

      {/* Expanded day */}
      {openDay && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 8, marginBottom: 8, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {fmtDate(openDay)}
            </div>
            <button
              onClick={() => onToggleDay(openDay)}
              style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 12, fontFamily: F.family }}
            >
              cerrar ✕
            </button>
          </div>

          {dayLoading && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted, fontSize: 12 }}>
              Cargando catalizadores del día...
            </div>
          )}

          {!dayLoading && dayEvents && dayEvents.length === 0 && (
            <div style={{ color: C.textMuted, fontSize: 12.5 }}>Sin eventos.</div>
          )}

          {!dayLoading && dayEvents && dayEvents.length > 0 && (() => {
            const visible = dayEvents
              .filter(e => activeTypes.has(e.type))
              .slice()
              .sort((a, b) =>
                hourOrder(a.meta?.hour) - hourOrder(b.meta?.hour) || b.importance - a.importance
              );
            if (visible.length === 0) {
              return (
                <div style={{
                  padding: '14px 12px', borderRadius: R.md, border: `1px dashed ${C.border}`,
                  color: C.textMuted, fontSize: 12.5,
                }}>
                  Los {dayEvents.length} eventos de este día están ocultos por el filtro de tipos.
                </div>
              );
            }
            return (
              <>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
                  {visible.length} evento{visible.length === 1 ? '' : 's'}
                  {visible.length < dayEvents.length && ` · ${dayEvents.length - visible.length} ocultos`}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
                  {visible.map((c, i) => {
                    const im = impChip(c.importance);
                    const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
                    const sym = c.meta?.symbol;
                    const hl = etTimeLabel(c.meta?.time) || hourLabel(c.meta?.hour);
                    return (
                      <div
                        key={i}
                        onClick={() => sym && onOpenSymbol(sym)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 9,
                          padding: '7px 9px', borderRadius: R.sm,
                          border: `1px solid ${C.border}`, background: C.bgCard,
                          borderLeft: `3px solid ${im.color}`,
                          cursor: sym ? 'pointer' : 'default',
                        }}
                        onMouseEnter={e => { if (sym) e.currentTarget.style.background = C.bgCardHover; }}
                        onMouseLeave={e => { if (sym) e.currentTarget.style.background = C.bgCard; }}
                      >
                        <span style={{ fontSize: 12 }}>{c.emoji}</span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
                          background: tm.color + '16', color: tm.color, flexShrink: 0, marginTop: 1,
                        }}>
                          {tm.label}
                        </span>
                        <span style={{
                          flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500,
                          color: C.textPrimary, lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {c.title}
                        </span>
                        {hl && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: C.bgElevated, color: C.textMuted, flexShrink: 0, marginTop: 1,
                            whiteSpace: 'nowrap',
                          }}>
                            {hl}
                          </span>
                        )}
                        {sym && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: C.accentLight, flexShrink: 0 }}>
                            {sym} →
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function CatalystPanel({ onSelectStock }: { onSelectStock?: (symbol: string) => void }) {
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [selected, setSelected] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [movers, setMovers] = useState<MoversPayload | null>(null);
  const [moversLoading, setMoversLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('catalysts');
  const [calYm, setCalYm] = useState(() => ymOf(new Date()));
  const [calDays, setCalDays] = useState<CalendarDay[] | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<Catalyst[] | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(() => allTypes());
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moversRequested = useRef(false);

  const toggleType = useCallback((t: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);
  const resetTypes = useCallback(() => setActiveTypes(allTypes()), []);

  const loadCalendar = useCallback((offset: number) => {
    setLoading(true);
    setError('');
    setDays(null);
    fetch('/api/catalysts')
      .then(r => r.json())
      .then(d => { setDays(d.days || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const loadSymbol = useCallback((sym: string) => {
    setLoading(true);
    setError('');
    setSelected(null);
    fetch(`/api/catalysts?symbol=${encodeURIComponent(sym)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setSelected(d);
        setQuery('');
        setShowSug(false);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // La ficha del ticker vive en la pestaña de Catalizadores, así que al tocar
  // una fila de Movers saltamos allí en vez de dejarla fuera de pantalla.
  const openMover = useCallback((sym: string) => {
    setTab('catalysts');
    loadSymbol(sym);
  }, [loadSymbol]);

  useEffect(() => { loadCalendar(0); }, [loadCalendar]);

  // Los movers solo se piden cuando se abre su pestaña: son ~12 llamadas a
  // Finnhub que no queremos gastar si el usuario se queda en el calendario.
  useEffect(() => {
    if (tab !== 'movers' || moversRequested.current) return;
    moversRequested.current = true;
    fetch('/api/catalysts/movers')
      .then(r => r.json())
      .then(d => { if (!d.error) setMovers(d); })
      .catch(() => {})
      .finally(() => setMoversLoading(false));
  }, [tab]);

  // El mes se pide al abrir la pestaña y en cada navegación: el endpoint lo
  // cachea por rango, así que volver atrás no vuelve a pegarle a Finnhub.
  useEffect(() => {
    if (tab !== 'calendar') return;
    let alive = true;
    setCalLoading(true);
    fetch(`/api/catalysts?start=${calYm}&months=1`)
      .then(r => r.json())
      .then(d => { if (alive && !d.error) setCalDays(d.days || []); })
      .catch(() => { if (alive) setCalDays([]); })
      .finally(() => { if (alive) setCalLoading(false); });
    return () => { alive = false; };
  }, [tab, calYm]);

  const shiftMonth = useCallback((delta: number) => {
    setCalYm(prev => shiftYm(prev, delta));
    setOpenDay(null);
    setDayEvents(null);
  }, []);

  // La celda solo trae 6 eventos recortados; el resto se pide al desplegar.
  const fetchDay = useCallback((iso: string) => {
    setDayEvents(null);
    setDayLoading(true);
    fetch(`/api/catalysts?day=${iso}`)
      .then(r => r.json())
      .then(d => { setDayEvents(d.days?.[0]?.events || []); })
      .catch(() => setDayEvents([]))
      .finally(() => setDayLoading(false));
  }, []);

  const toggleDay = useCallback((iso: string) => {
    if (openDay === iso) { setOpenDay(null); return; }
    setOpenDay(iso);
    fetchDay(iso);
  }, [openDay, fetchDay]);

  // "+N más" de la lista: salta al calendario mensual con el día ya desplegado.
  const openDayInMonth = useCallback((iso: string) => {
    setTab('calendar');
    setCalYm(iso.slice(0, 7));
    setOpenDay(iso);
    fetchDay(iso);
  }, [fetchDay]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onQuery = (q: string) => {
    setQuery(q);
    setShowSug(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 1) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setSuggestions((d.results || []).slice(0, 8));
      } catch { setSuggestions([]); }
    }, 250);
  };

  const visibleDays = days || [];
  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: 0, letterSpacing: '-0.3px' }}>
          ⚡ Catalizadores
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0' }}>
          {selected
            ? `Próximos eventos que pueden mover a ${selected.symbol}`
            : activeTab.sub}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: R.md,
                border: `1px solid ${active ? t.color + '55' : C.border}`,
                background: active ? t.color + '15' : C.bgCard,
                color: active ? t.color : C.textSecondary,
                cursor: 'pointer', fontWeight: active ? 700 : 500,
                fontSize: 13, transition: 'all 0.15s ease', fontFamily: F.family,
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.borderColor = C.borderHover;
              }}
              onMouseLeave={e => {
                if (!active) e.currentTarget.style.borderColor = C.border;
              }}
            >
              <span style={{ fontSize: 15 }}>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      {tab === 'catalysts' && (
      <div ref={searchRef} style={{ position: 'relative', marginBottom: 16 }}>
        <input
          type="text"
          value={query}
          onChange={e => onQuery(e.target.value)}
          onFocus={() => query.trim().length > 0 && setShowSug(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && suggestions.length > 0) loadSymbol(suggestions[0].symbol);
          }}
          placeholder="Buscar ticker y ver su hoja de ruta de catalizadores (ej. AAPL, NVDA)..."
          style={{
            width: '100%', padding: '10px 14px', borderRadius: R.md,
            border: `1px solid ${C.border}`, background: C.bgCard,
            color: C.textSecondary, fontSize: 13, outline: 'none', fontFamily: F.family,
            boxSizing: 'border-box',
          }}
        />
        {showSug && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
            background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: R.md,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)', overflow: 'hidden',
          }}>
            {suggestions.map(s => (
              <button
                key={s.symbol}
                onClick={() => loadSymbol(s.symbol)}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%',
                  padding: '9px 14px', background: 'transparent', border: 'none',
                  borderBottom: `1px solid ${C.divider}`, color: C.textPrimary,
                  cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: F.family,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bgCardHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                <span style={{ color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Loading */}
      {tab === 'catalysts' && loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted, fontSize: 13 }}>
          Buscando catalizadores...
        </div>
      )}
      {tab === 'catalysts' && error && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.negative, fontSize: 13 }}>
          Error: {error}
        </div>
      )}

      {tab === 'catalysts' && !loading && !error && selected && (
        <div>
          {/* Back */}
          <button
            onClick={() => { setSelected(null); loadCalendar(0); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
              background: 'transparent', border: 'none', color: C.textMuted,
              cursor: 'pointer', fontSize: 13, fontFamily: F.family,
            }}
          >
            ← Calendario
          </button>

          {/* Stock header */}
          <div style={{
            padding: '16px 18px', borderRadius: R.xl, marginBottom: 14,
            background: C.gradientHero, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary }}>{selected.symbol}</span>
                <span style={{ fontSize: 13, color: C.textMuted }}>{selected.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.textPrimary }}>${selected.price.toFixed(2)}</span>
                <span style={{ color: selected.changePct >= 0 ? C.positive : C.negative, fontWeight: 600 }}>
                  {selected.changePct >= 0 ? '+' : ''}{selected.changePct.toFixed(2)}%
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onSelectStock?.(selected.symbol)}
                style={{
                  padding: '8px 14px', borderRadius: R.md, border: 'none', cursor: 'pointer',
                  background: C.accent, color: C.textPrimary, fontWeight: 600, fontSize: 12.5, fontFamily: F.family,
                }}
              >
                Análisis completo
              </button>
            </div>
          </div>

          {/* Upcoming catalysts */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Próximos catalizadores ({selected.upcoming.length})
            </div>
            {selected.upcoming.length === 0 && (
              <div style={{
                padding: '18px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`,
                background: '#0d1117', color: C.textMuted, fontSize: 12.5, textAlign: 'center',
              }}>
                No hay eventos programados en los próximos 45 días. Las noticias recientes están abajo.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.upcoming.map((c, i) => {
                const im = impChip(c.importance);
                const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 14px', borderRadius: R.md,
                    border: `1px solid ${C.border}`, background: C.bgCard,
                  }}>
                    <div style={{
                      minWidth: 62, textAlign: 'center' as const, padding: '6px 4px', borderRadius: R.sm,
                      background: im.bg, border: `1px solid ${im.border}`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: im.color, textTransform: 'capitalize' }}>{im.label}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>{c.emoji} {c.title}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: R.full,
                          background: tm.color + '18', color: tm.color, border: `1px solid ${tm.color}40`,
                        }}>
                          {tm.label}
                        </span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(c.date)}</span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>· {c.status}</span>
                      </div>
                      {c.description && (
                        <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>{c.description}</div>
                      )}
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                        {c.source}
                        {c.link && <span> · <a href={c.link} target="_blank" rel="noreferrer" style={{ color: C.accent }}>ver fuente</a></span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analyst sentiment */}
          {selected.analysts && selected.analysts.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Consenso de analistas
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected.analysts.map((a, i) => {
                  const buy = (a.strongBuy || 0) + (a.buy || 0);
                  const hold = a.hold || 0;
                  const sell = (a.sell || 0) + (a.strongSell || 0);
                  const total = buy + hold + sell;
                  const pBuy = total > 0 ? Math.round((buy / total) * 100) : 0;
                  return (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: R.md, minWidth: 180,
                      border: `1px solid ${C.border}`, background: C.bgCard,
                    }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Período {a.period}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: pBuy >= 60 ? C.positive : pBuy >= 40 ? C.warning : C.negative }}>
                        {pBuy}% comprar
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {buy} compra · {hold} mantiene · {sell} vende
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent news */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Por qué se mueve · noticias recientes
            </div>
            {selected.news.length === 0 && (
              <div style={{ padding: '18px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`, color: C.textMuted, fontSize: 12.5, textAlign: 'center' }}>
                Sin noticias recientes.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.news.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noreferrer"
                  style={{
                    display: 'block', padding: '10px 14px', borderRadius: R.md, textDecoration: 'none',
                    border: `1px solid ${C.border}`, background: C.bgCard, transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.bgCardHover; e.currentTarget.style.borderColor = C.borderHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.bgCard; e.currentTarget.style.borderColor = C.border; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{n.source} · {timeAgo(n.datetime)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4 }}>{n.headline}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly calendar */}
      {tab === 'catalysts' && !loading && !error && !selected && (
        <div>
          <NextCatalystCard days={days} active={activeTypes} onOpenSymbol={loadSymbol} />

          <TypeFilterBar
            active={activeTypes}
            counts={sumTypeCounts(days || [])}
            onToggle={toggleType}
            onReset={resetTypes}
          />

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F87171' }} /> Alta actividad (≥85)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#FBBF24' }} /> Notable (60)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#8B90A5' }} /> Background (30)
            </span>
          </div>

          {days && days.length === 0 && (
            <div style={{
              padding: '20px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`,
              background: '#0d1117', color: C.textMuted, fontSize: 12.5, textAlign: 'center',
            }}>
              Sin eventos programados para las próximas 2 semanas. Prueba buscar un ticker arriba para ver su hoja de ruta.
            </div>
          )}

          {days && days.length > 0 && days.every(d => (filterDay(d, activeTypes).total ?? 0) === 0) && (
            <div style={{
              padding: '20px 16px', borderRadius: R.md, border: `1px dashed ${C.border}`,
              background: '#0d1117', color: C.textMuted, fontSize: 12.5, textAlign: 'center',
            }}>
              Ningún evento coincide con el filtro seleccionado.
            </div>
          )}

          {days && visibleDays.map(d => {
            const fday = filterDay(d, activeTypes);
            if ((fday.total ?? 0) === 0) return null;
            const evs = fday.events;
            const shown = evs.slice(0, WEEKLY_DAY_MAX);
            const more = evs.length - shown.length;
            return (
              <div key={d.iso} style={{
                padding: '12px 14px', borderRadius: R.lg, marginBottom: 10,
                border: `1px solid ${C.border}`, background: C.bgCard,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  fontSize: 13, fontWeight: 700, color: C.textPrimary, textTransform: 'capitalize',
                }}>
                  {d.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: R.full, color: C.accent,
                    background: C.accent12,
                  }}>
                    {fday.total ?? evs.length} eventos
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {shown.map((c, i) => {
                    const im = impChip(c.importance);
                    const tm = TYPE_META[c.type] || { label: c.type, color: C.textMuted };
                    const metaSymbol = c.meta?.symbol;
                    const hl = etTimeLabel(c.meta?.time) || hourLabel(c.meta?.hour);
                    const clickable = metaSymbol != null;
                    return (
                      <div
                        key={i}
                        onClick={() => clickable && loadSymbol(metaSymbol)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                          borderRadius: R.sm, cursor: clickable ? 'pointer' : 'default',
                          borderLeft: `3px solid ${im.color}`,
                          background: clickable ? 'transparent' : '#0d1117',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => { if (clickable) e.currentTarget.style.background = C.bgCardHover; }}
                        onMouseLeave={e => { if (clickable) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 15 }}>{c.emoji}</span>
                        <span style={{
                          fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                          background: tm.color + '16', color: tm.color, border: `1px solid ${tm.color}35`, flexShrink: 0,
                        }}>
                          {tm.label}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textPrimary, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title}
                        </span>
                        {hl && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: C.bgElevated, color: C.textMuted, flexShrink: 0, whiteSpace: 'nowrap',
                          }}>
                            {hl}
                          </span>
                        )}
                        {metaSymbol && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 4,
                            background: C.accent12, color: C.accentLight, cursor: 'pointer', flexShrink: 0,
                          }}>
                            {metaSymbol} →
                          </span>
                        )}
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: im.bg, color: im.color, border: `1px solid ${im.border}`, flexShrink: 0,
                        }}>
                          {im.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {more > 0 && (
                  <button
                    onClick={() => openDayInMonth(d.iso)}
                    style={{
                      marginTop: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                      color: C.accent, fontSize: 12, fontWeight: 700, fontFamily: F.family, padding: '2px 0',
                    }}
                  >
                    +{more} más · ver en el calendario →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Catalyst Calendar */}
      {tab === 'calendar' && (
        <MonthCalendar
          ym={calYm}
          days={calDays}
          loading={calLoading}
          openDay={openDay}
          dayEvents={dayEvents}
          dayLoading={dayLoading}
          activeTypes={activeTypes}
          onToggleType={toggleType}
          onResetTypes={resetTypes}
          onShift={shiftMonth}
          onToday={() => { setCalYm(ymOf(new Date())); setOpenDay(null); setDayEvents(null); }}
          onToggleDay={toggleDay}
          onOpenSymbol={loadSymbol}
        />
      )}

      {/* Market Movers Today */}
      {tab === 'movers' && (
        <div style={{
          padding: '16px 18px', borderRadius: R.xl,
          background: C.gradientCard, border: `1px solid ${C.border}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 10, flexWrap: 'wrap',
          }}>
            <h2 style={{
              fontSize: 16, fontWeight: 800, color: C.textPrimary,
              margin: 0, letterSpacing: '-0.2px',
            }}>
              Market Movers Today
            </h2>
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: F.mono }}>
              {moversLoading
                ? 'Actualizando…'
                : movers
                  ? `Updated ${fmtClock(movers.updatedAt)}`
                  : 'Sin datos'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0', lineHeight: 1.5 }}>
            Top gainers and losers with today's news headlines. Tap any row to open the ticker page.
          </p>

          {moversLoading && (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: C.textMuted, fontSize: 12.5 }}>
              Cargando mayores movimientos del día...
            </div>
          )}

          {!moversLoading && movers && movers.gainers.length === 0 && movers.losers.length === 0 && (
            <div style={{
              marginTop: 14, padding: '24px 16px', borderRadius: R.md,
              border: `1px dashed ${C.border}`, background: '#0d1117',
              color: C.textMuted, fontSize: 12.5, textAlign: 'center',
            }}>
              Sin movimientos destacados ahora mismo. Vuelve más tarde.
            </div>
          )}

          {!moversLoading && movers && (movers.gainers.length > 0 || movers.losers.length > 0) && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 18, marginTop: 16,
            }}>
              <MoverColumn title="Gainers" movers={movers.gainers} onOpen={openMover} />
              <MoverColumn title="Losers" movers={movers.losers} onOpen={openMover} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}