'use client';

import { useEffect, useState } from 'react';
import { colors as C, spacing as S, radius as R, font as F } from '@/src/utils/webTheme';
import { useSession } from 'next-auth/react';

type Trade = any;

type ContractQuote = {
  price: number | null;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spot: number | null;
  dte: number;
  source: 'mid' | 'last' | 'intrinsic' | 'none';
};

function contractKey(t: any): string {
  const sym = String(t.symbol || '').toUpperCase();
  const type = String(t.contractType || t.direction || '').toUpperCase();
  const strike = Number(t.contractStrike);
  const expiry = t.contractExpiry ? new Date(t.contractExpiry).toISOString().slice(0, 10) : '';
  return `${sym}|${type}|${strike}|${expiry}`;
}

const LOCAL_KEY = 'trade-journal-local';

function isLocalTrade(t: any): boolean {
  return String(t?.id || '').startsWith('local-') || t?.userId === 'local';
}

function updateLocalTrade(id: string, patch: any) {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    const next = list.map((t: any) => (t.id === id ? { ...t, ...patch } : t));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {}
}

function removeLocalTrade(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.filter((t: any) => t.id !== id)));
  } catch {}
}

function addLocalTrade(trade: any) {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    list.unshift(trade);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {}
}

function fmt(n: any, d = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toFixed(d);
}
function fmtUsd(n: any) {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  const sign = v >= 0 ? '+' : '';
  return sign + v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function TradeJournalView() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<'trades' | 'stats'>('trades');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [quotes, setQuotes] = useState<Record<string, ContractQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [modal, setModal] = useState(false);
  const [closeModal, setCloseModal] = useState<Trade | null>(null);
  const [form, setForm] = useState<any>({ symbol: '', direction: 'CALL', qty: 1, entryPrice: '', target: '', stop: '', notes: '' });
  const [closeForm, setCloseForm] = useState<any>({ exitPrice: '', outcome: 'WIN', notes: '' });

  const loadLocal = () => {
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return local.map((t: any) => ({ ...t, userId: 'local' }));
    } catch { return []; }
  };

  const fetchQuotes = async (all: Trade[]) => {
    const open = all.filter((t) => t.status === 'OPEN' && t.contractStrike != null && t.contractExpiry != null);
    if (open.length === 0) { setQuotes({}); return; }
    const contracts = open.map((t) => ({
      symbol: t.symbol,
      type: String(t.contractType || t.direction || 'CALL').toUpperCase(),
      strike: Number(t.contractStrike),
      expiry: t.contractExpiry,
    }));
    setQuotesLoading(true);
    try {
      const res = await fetch('/api/trade-journal/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts }),
      });
      const json = await res.json();
      setQuotes(json?.quotes || {});
    } catch {
      setQuotes({});
    }
    setQuotesLoading(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [trRes, stRes] = await Promise.allSettled([
        fetch('/api/trade-journal?status=ALL&limit=300').then((r) => r.json()),
        fetch('/api/trade-journal/stats').then((r) => r.json()),
      ]);
      let serverTrades: any[] = [];
      let serverStats: any = null;
      if (trRes.status === 'fulfilled') serverTrades = trRes.value?.trades || [];
      if (stRes.status === 'fulfilled') serverStats = stRes.value;
      const localTrades = loadLocal();
      const all = [...serverTrades, ...localTrades].sort((a,b) => new Date(b.entryDate || b.createdAt).getTime() - new Date(a.entryDate || a.createdAt).getTime());
      setTrades(all);
      fetchQuotes(all);
      // Recomputar siempre desde los trades combinados (servidor + localStorage),
      // porque el endpoint de stats no ve los trades guardados localmente.
      const closed = all.filter((t:any) => t.status === 'CLOSED');
      let wins=0,losses=0,be=0,totalPnl=0;
      for (const t of closed) {
        if (t.outcome === 'WIN') wins++;
        else if (t.outcome === 'LOSS') losses++;
        else if (t.outcome === 'BE') be++;
        const qty = Number(t.qty||1);
        const entry = t.entryPrice != null ? Number(t.entryPrice) : t.premium != null ? Number(t.premium) : null;
        const exit = t.exitPrice != null ? Number(t.exitPrice) : null;
        if (entry != null && exit != null) totalPnl += (exit-entry)*qty*100;
      }
      const denom = wins+losses;
      const base = serverStats || {};
      setStats({
        ...base,
        totalTrades: all.length,
        open: all.filter((t:any)=>t.status==='OPEN').length,
        closed: closed.length,
        wins, losses, be,
        winRate: denom>0 ? (wins/denom)*100 : 0,
        totalPnl,
        byMonth: base.byMonth || [],
        bySymbol: base.bySymbol || [],
      });
    } catch (e) {
      console.error(e);
      const localTrades = loadLocal();
      setTrades(localTrades);
      fetchQuotes(localTrades);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addTrade = async () => {
    const payload: any = { ...form, entryPrice: form.entryPrice ? Number(form.entryPrice) : null, target: form.target ? Number(form.target) : null, stop: form.stop ? Number(form.stop) : null, qty: Number(form.qty) || 1, source: 'manual' };
    let ok = false;
    try {
      const res = await fetch('/api/trade-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      ok = res.ok;
    } catch {}
    if (!ok) {
      // Sin servidor/DB: guardar localmente para no perder el trade.
      addLocalTrade({
        id: 'local-' + Date.now(),
        source: 'manual',
        symbol: String(form.symbol || '').toUpperCase(),
        direction: form.direction,
        status: 'OPEN',
        entryDate: new Date().toISOString(),
        entryPrice: payload.entryPrice,
        qty: payload.qty,
        contractType: form.direction,
        target: payload.target,
        stop: payload.stop,
        notes: form.notes || '',
        createdAt: new Date().toISOString(),
        userId: 'local',
      });
    }
    setModal(false);
    setForm({ symbol: '', direction: 'CALL', qty: 1, entryPrice: '', target: '', stop: '', notes: '' });
    load();
  };

  const closeTrade = async () => {
    if (!closeModal) return;
    const patch: any = {
      status: 'CLOSED',
      exitPrice: closeForm.exitPrice ? Number(closeForm.exitPrice) : null,
      outcome: closeForm.outcome,
      exitDate: new Date().toISOString(),
      notes: closeForm.notes || closeModal.notes,
    };
    if (isLocalTrade(closeModal)) {
      updateLocalTrade(closeModal.id, patch);
    } else {
      try {
        const res = await fetch(`/api/trade-journal/${closeModal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) alert('No se pudo cerrar el trade en el servidor. Inténtalo de nuevo.');
      } catch {
        alert('No se pudo cerrar el trade. Revisa tu conexión e inténtalo de nuevo.');
      }
    }
    setCloseModal(null);
    setCloseForm({ exitPrice: '', outcome: 'WIN', notes: '' });
    load();
  };

  const delTrade = async (trade: any) => {
    if (!confirm('¿Eliminar este trade del diario?')) return;
    if (isLocalTrade(trade)) {
      removeLocalTrade(trade.id);
    } else {
      try {
        await fetch(`/api/trade-journal/${trade.id}`, { method: 'DELETE' });
      } catch {}
    }
    load();
  };

  const entryOf = (t: any) => (t.entryPrice != null ? Number(t.entryPrice) : t.premium != null ? Number(t.premium) : null);

  const tradePnl = (t: any): { pnl: number | null; mark: number | null; source?: string } => {
    const qty = Number(t.qty || 1);
    const entry = entryOf(t);
    if (t.status === 'CLOSED') {
      const exit = t.exitPrice != null ? Number(t.exitPrice) : null;
      if (entry != null && exit != null) return { pnl: (exit - entry) * qty * 100, mark: exit };
      return { pnl: null, mark: null };
    }
    const q = quotes[contractKey(t)];
    const mark = q?.price ?? null;
    if (entry != null && mark != null) return { pnl: (mark - entry) * qty * 100, mark, source: q?.source };
    return { pnl: null, mark };
  };

  const openPnl = trades.reduce((sum, t) => {
    if (t.status !== 'OPEN') return sum;
    const r = tradePnl(t);
    return r.pnl != null ? sum + r.pnl : sum;
  }, 0);
  const openCount = trades.filter((t) => t.status === 'OPEN').length;
  const openQuoted = trades.filter((t) => t.status === 'OPEN' && tradePnl(t).pnl != null).length;
  const visibleTrades = filter === 'ALL' ? trades : trades.filter((t) => t.status === filter);

  if (!session) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.textSecondary }}>Inicia sesión para llevar tu diario de trades.</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: S.lg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.lg, flexWrap: 'wrap', gap: S.sm }}>
        <div>
          <h1 style={{ margin: 0, fontSize: F.sizeXxl, fontWeight: 800, color: C.textPrimary }}>Diario de Trades</h1>
          <p style={{ margin: '4px 0 0', color: C.textSecondary, fontSize: F.sizeSm }}>Lleva tus ejecuciones reales y calcula tu win rate</p>
        </div>
        <div style={{ display: 'flex', gap: S.sm, flexWrap: 'wrap' }}>
          <button onClick={() => setModal(true)} style={{ padding: '8px 14px', borderRadius: R.md, border: `1px solid ${C.accent}`, background: C.accent + '22', color: C.accent, fontWeight: 700, cursor: 'pointer' }}>+ Añadir trade</button>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: S.sm, marginBottom: S.lg }}>
          <Card label="Abiertos" value={stats.open ?? 0} />
          <Card label="Cerrados" value={stats.closed ?? 0} />
          <Card label="Ganados / Perdidos" value={`${stats.wins ?? 0} / ${stats.losses ?? 0}`} />
          <Card label="Win Rate" value={`${(stats.winRate ?? 0).toFixed ? (stats.winRate ?? 0).toFixed(1) : stats.winRate ?? 0}%`} color={(stats.winRate ?? 0) >= 50 ? '#22c55e' : '#f59e0b'} />
          <Card label="PnL Cerrado" value={fmtUsd(stats.totalPnl)} color={(stats.totalPnl || 0) >= 0 ? '#22c55e' : '#ef4444'} />
          <Card label={`PnL Abierto${openCount ? ` (${openQuoted}/${openCount})` : ''}`} value={fmtUsd(openPnl)} color={openPnl >= 0 ? '#22c55e' : '#ef4444'} />
          <Card label="Expectativa (R$ aprox)" value={fmtUsd(stats.expectancy)} />
          <Card label="Profit Factor" value={stats.profitFactor == null ? '∞' : stats.profitFactor} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: S.md }}>
        <Tab active={tab === 'trades'} onClick={() => setTab('trades')}>Trades</Tab>
        <Tab active={tab === 'stats'} onClick={() => setTab('stats')}>Reportes</Tab>
      </div>

      {tab === 'trades' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: S.sm }}>
            {(['ALL', 'OPEN', 'CLOSED'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: R.full, border: `1px solid ${filter === f ? C.accent : C.border}`, background: filter === f ? C.accent + '18' : 'transparent', color: filter === f ? C.accent : C.textSecondary, fontSize: F.sizeXs, cursor: 'pointer' }}>{f === 'ALL' ? 'Todos' : f === 'OPEN' ? 'Abiertos' : 'Cerrados'}</button>
            ))}
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: R.lg }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeSm }}>
              <thead>
                <tr style={{ background: C.bgElevated }}>
                  <th style={th}>Fecha</th>
                  <th style={th}>Símbolo</th>
                  <th style={th}>Dirección</th>
                  <th style={th}>Qty</th>
                  <th style={th}>Entrada</th>
                  <th style={th}>Target/Stop</th>
                  <th style={th}>Salida</th>
                  <th style={th} title={quotesLoading ? 'Actualizando precios…' : 'Mark-to-market (mid)'}>Actual</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Resultado</th>
                  <th style={th}>PnL</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((t) => {
                  const { pnl, mark, source } = tradePnl(t);
                  const isOpen = t.status === 'OPEN';
                  return (
                    <tr key={t.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={td}>{new Date(t.entryDate).toLocaleDateString('es-ES')}</td>
                      <td style={{ ...td, fontWeight: 700, color: C.textPrimary }}>{t.symbol}</td>
                      <td style={{ ...td, color: t.direction === 'CALL' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{t.direction}</td>
                      <td style={td}>{t.qty}</td>
                      <td style={td}>{t.entryPrice != null ? `$${Number(t.entryPrice).toFixed(2)}` : t.premium != null ? `$${Number(t.premium).toFixed(2)}` : '—'}</td>
                      <td style={td}>{t.target != null ? `T $${Number(t.target).toFixed(2)}` : ''} {t.stop != null ? `/ S $${Number(t.stop).toFixed(2)}` : ''}</td>
                      <td style={td}>{t.exitPrice != null ? `$${Number(t.exitPrice).toFixed(2)}` : '—'}</td>
                      <td style={td}>
                        {isOpen && mark != null
                          ? <span title={source === 'intrinsic' ? 'Valor intrínseco (vencido)' : source === 'last' ? 'Último precio' : 'Mid (bid/ask)'}>${mark.toFixed(2)}{source === 'intrinsic' ? ' (intr.)' : ''}</span>
                          : isOpen && quotesLoading ? <span style={{ color: C.textMuted }}>…</span> : '—'}
                      </td>
                      <td style={td}>{isOpen ? <span style={{ color: '#f59e0b' }}>ABIERTO</span> : <span style={{ color: C.textSecondary }}>CERRADO</span>}</td>
                      <td style={td}>{t.outcome || '—'}</td>
                      <td style={{ ...td, color: pnl == null ? C.textMuted : pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        {pnl == null ? '—' : fmtUsd(pnl)}
                        {isOpen && pnl != null && <span style={{ marginLeft: 6, fontSize: F.sizeXs, color: C.textMuted, fontWeight: 500 }}>abierto</span>}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {t.status === 'OPEN' && <button onClick={() => { setCloseModal(t); setCloseForm({ exitPrice: '', outcome: 'WIN', notes: '' }); }} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.textPrimary, borderRadius: R.sm, padding: '2px 8px', cursor: 'pointer' }}>Cerrar</button>}
                          <button onClick={() => delTrade(t)} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: '#ef4444', borderRadius: R.sm, padding: '2px 8px', cursor: 'pointer' }}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleTrades.length === 0 && !loading && <div style={{ padding: 20, textAlign: 'center', color: C.textMuted }}>Sin trades {filter === 'ALL' ? 'todavía. Añade uno manual o desde Trade Picks.' : `en estado ${filter === 'OPEN' ? 'abierto' : 'cerrado'}.`}</div>}
          </div>
        </>
      )}

      {tab === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: S.md }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, padding: S.md }}>
            <div style={{ fontWeight: 800, color: C.textPrimary, marginBottom: S.sm }}>Por mes</div>
            <table style={{ width: '100%', fontSize: F.sizeSm }}>
              <thead><tr><th style={th2}>Mes</th><th style={th2}>Trades</th><th style={th2}>Ganados</th><th style={th2}>PnL</th></tr></thead>
              <tbody>
                {stats.byMonth.map((m: any) => (
                  <tr key={m.month}><td style={td2}>{m.month}</td><td style={td2}>{m.trades}</td><td style={td2}>{m.wins}</td><td style={{ ...td2, color: m.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{fmtUsd(m.pnl)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, padding: S.md }}>
            <div style={{ fontWeight: 800, color: C.textPrimary, marginBottom: S.sm }}>Mejores por símbolo</div>
            <table style={{ width: '100%', fontSize: F.sizeSm }}>
              <thead><tr><th style={th2}>Símbolo</th><th style={th2}>Trades</th><th style={th2}>Ganados</th><th style={th2}>PnL</th></tr></thead>
              <tbody>
                {stats.bySymbol.map((s: any) => (
                  <tr key={s.symbol}><td style={{ ...td2, fontWeight: 700 }}>{s.symbol}</td><td style={td2}>{s.trades}</td><td style={td2}>{s.wins}</td><td style={{ ...td2, color: s.pnl >= 0 ? '#22c55e' : '#ef4444' }}>{fmtUsd(s.pnl)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title="Añadir trade manual" onClose={() => setModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.sm }}>
            <Field label="Símbolo"><input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} style={inp} placeholder="TSLA" /></Field>
            <Field label="Dirección"><select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} style={inp}><option value="CALL">CALL</option><option value="PUT">PUT</option></select></Field>
            <Field label="Cantidad"><input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} style={inp} /></Field>
            <Field label="Precio entrada (contrato)"><input type="number" step="0.01" value={form.entryPrice} onChange={(e) => setForm({ ...form, entryPrice: e.target.value })} style={inp} placeholder="2.50" /></Field>
            <Field label="Target"><input type="number" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} style={inp} /></Field>
            <Field label="Stop"><input type="number" step="0.01" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })} style={inp} /></Field>
          </div>
          <Field label="Notas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inp, minHeight: 60 }} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(false)} style={btnGhost}>Cancelar</button>
            <button onClick={addTrade} style={btnAccent}>Guardar</button>
          </div>
        </Modal>
      )}

      {closeModal && (
        <Modal title="Cerrar trade" onClose={() => setCloseModal(null)}>
          <div style={{ color: C.textSecondary, fontSize: F.sizeSm, marginBottom: S.sm }}>{closeModal.symbol} {closeModal.direction} · Entrada ${closeModal.entryPrice}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.sm }}>
            <Field label="Precio salida (contrato)"><input type="number" step="0.01" value={closeForm.exitPrice} onChange={(e) => setCloseForm({ ...closeForm, exitPrice: e.target.value })} style={inp} /></Field>
            <Field label="Resultado"><select value={closeForm.outcome} onChange={(e) => setCloseForm({ ...closeForm, outcome: e.target.value })} style={inp}><option value="WIN">WIN</option><option value="LOSS">LOSS</option><option value="BE">BREAK EVEN</option><option value="EXPIRED">EXPIRADO</option></select></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setCloseModal(null)} style={btnGhost}>Cancelar</button>
            <button onClick={closeTrade} style={btnAccent}>Cerrar trade</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const th: any = { textAlign: 'left', padding: '8px 10px', color: C.textMuted, fontSize: F.sizeXs, fontWeight: 600 };
const td: any = { padding: '8px 10px', color: C.textSecondary, borderTop: `1px solid ${C.border}` };
const th2: any = { textAlign: 'left', padding: '6px 8px', color: C.textMuted, fontSize: F.sizeXs };
const td2: any = { padding: '6px 8px', color: C.textSecondary };
const inp: any = { width: '100%', padding: '8px 10px', borderRadius: R.md, border: `1px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: F.sizeSm };
const btnGhost: any = { padding: '7px 12px', borderRadius: R.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, cursor: 'pointer' };
const btnAccent: any = { padding: '7px 12px', borderRadius: R.md, border: `1px solid ${C.accent}`, background: C.accent + '22', color: C.accent, fontWeight: 700, cursor: 'pointer' };

function Card({ label, value, color }: any) {
  return <div style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, padding: S.md }}>
    <div style={{ fontSize: F.sizeXs, color: C.textMuted }}>{label}</div>
    <div style={{ fontSize: F.sizeXl, fontWeight: 800, color: color || C.textPrimary, marginTop: 4 }}>{value}</div>
  </div>;
}
function Tab({ active, onClick, children }: any) {
  return <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: R.md, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent + '18' : 'transparent', color: active ? C.accent : C.textSecondary, fontSize: F.sizeSm, cursor: 'pointer' }}>{children}</button>;
}
function Field({ label, children }: any) {
  return <label style={{ display: 'grid', gap: 4, fontSize: F.sizeXs, color: C.textMuted }}>{label}{children}</label>;
}
function Modal({ title, children, onClose }: any) {
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
    <div style={{ width: 'min(520px, 94vw)', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: S.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: S.md }}>
        <div style={{ fontWeight: 800, color: C.textPrimary }}>{title}</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ display: 'grid', gap: S.sm }}>{children}</div>
    </div>
  </div>;
}
