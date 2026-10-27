'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R } from '@/src/utils/webTheme';
import { computePremiumRiskBenefit, contractsForRisk } from '@/src/lib/options/tradeRisk';
import { PROFILES, type TraderProfile } from '@/src/lib/navigation/profiles';
import GammaLevelsPanel from './GammaLevelsPanel';

interface ContractData {
  strike: number;
  expiration: string;
  daysToExpiration: number;
  premium: number;
  delta: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  breakeven?: number;
  breakevenPct?: number;
  expectedReturn?: number;
  targetReachable?: boolean;
  earningsSoon?: boolean;
  callWall?: number | null;
  putWall?: number | null;
  targetBlockedByOi?: boolean;
  optionScore?: number;
}

interface TradePick {
  id: string;
  symbol: string;
  company: string;
  price: number;
  score: number;
  direction: 'CALL' | 'PUT';
  reasons: string[];
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  volumeRatio: number;
  rsi: number | null;
  trend: string;
  setupState?: 'near' | 'confirmed';
  trigger?: number;
  triggerDist?: number;
  adr?: number;
  trail8?: number | null;
  trail21?: number | null;
  trail50?: number | null;
  contract: ContractData | null;
  createdAt: string;
  resolved?: { status: 'win' | 'loss'; price: number; at: string };
}

interface Regime {
  level: 'BULL' | 'MIXED' | 'CHOP';
  spyAbove: boolean;
  qqqAbove: boolean;
  vix?: number | null;
  breadth?: number | null;
}

const REGIME_META: Record<Regime['level'], { icon: string; title: string; text: string; color: string; bg: string; border: string }> = {
  BULL: { icon: '📈', title: 'Mercado alcista', text: 'SPY/QQQ sobre EMA 8/21/50 — convicción completa', color: '#34D399', bg: '#34D39914', border: '#34D39940' },
  MIXED: { icon: '🟡', title: 'Mercado mixto', text: 'SPY o QQQ sin tendencia clara — convicción normal', color: '#FBBF24', bg: '#FBBF2414', border: '#FBBF2440' },
  CHOP: { icon: '🔴', title: 'Mercado chop', text: 'Reduce el tamaño: SPY/QQQ sin tendencia sobre EMA 8/21/50', color: '#FB7185', bg: '#FB718514', border: '#FB718540' },
};

const STORAGE_KEY = 'trade-picks-history';
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 1 mes
const HISTORY_HARD_CAP = 500; // techo de seguridad para localStorage (nunca se toca en un mes)

function loadPicks(): TradePick[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function prunePicks(picks: TradePick[]): TradePick[] {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  return picks.filter(p => new Date(p.createdAt).getTime() >= cutoff).slice(0, HISTORY_HARD_CAP);
}

function savePicks(picks: TradePick[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prunePicks(picks)));
  } catch {}
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null || !isFinite(n)) return 'N/A';
  return n.toFixed(dec);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} at ${h % 12 || 12}:${m} ${ampm}`;
}


async function addToJournal(pick: TradePick) {
  try {
    const body: any = {
      source: 'trade-picks',
      symbol: pick.symbol,
      direction: pick.direction,
      status: 'OPEN',
      entryDate: new Date().toISOString(),
      entryPrice: pick.contract?.premium ?? null,
      qty: 1,
      contractStrike: pick.contract?.strike ?? null,
      contractExpiry: pick.contract?.expiration ?? null,
      contractType: pick.direction,
      premium: pick.contract?.premium ?? null,
      target: pick.target,
      stop: pick.stop,
      riskReward: pick.riskReward,
      pickSnapshot: {
        score: pick.score,
        setupState: pick.setupState,
        entry: pick.entry,
        contract: pick.contract,
      },
      notes: Array.isArray((pick as any).reasons) ? (pick as any).reasons.join(' · ') : ((pick as any).reason || ''),
    };
    const res = await fetch('/api/trade-journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      alert('Añadido al Diario de Trades');
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error === 'unauthorized' ? 'Inicia sesión para añadir al diario' : 'Error al añadir al diario');
    }
  } catch {
    alert('Error al añadir al diario');
  }
}

function getGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'A+', color: '#2DD4BF' };
  if (score >= 80) return { label: 'A', color: '#34D399' };
  if (score >= 70) return { label: 'B+', color: '#67E8F9' };
  if (score >= 60) return { label: 'B', color: '#FBBF24' };
  if (score >= 50) return { label: 'C+', color: '#FB923C' };
  return { label: 'C', color: '#F97316' };
}

type PickStatus = 'win' | 'loss' | 'pending';

function getSettlement(pick: TradePick, price: number | null | undefined): { status: 'win' | 'loss'; pnl: number } | null {
  if (price == null || !isFinite(price) || !pick.contract) return null;
  const exp = new Date(pick.contract.expiration + 'T23:59:59').getTime();
  if (!isFinite(exp) || exp >= Date.now()) return null;
  const strike = pick.contract.strike;
  const premium = pick.contract.premium || 0;
  const intrinsic = pick.direction === 'CALL'
    ? Math.max(0, price - strike)
    : Math.max(0, strike - price);
  const pnl = (intrinsic - premium) * 100;
  return { status: pnl > 0 ? 'win' : 'loss', pnl };
}

/**
 * Resultado por toque con el precio actual: si el precio alcanza el target
 * gana, si alcanza el stop pierde (aunque luego retroceda). Si ya expiró,
 * liquida por intrínseco. Devuelve null si aún no hay resultado claro.
 */
function touchOutcome(pick: TradePick, price: number | null | undefined): 'win' | 'loss' | null {
  if (price != null && isFinite(price)) {
    const isCall = pick.direction === 'CALL';
    if (isCall ? price >= pick.target : price <= pick.target) return 'win';
    if (isCall ? price <= pick.stop : price >= pick.stop) return 'loss';
  }
  const settled = getSettlement(pick, price);
  return settled ? settled.status : null;
}

/** Estado final: resuelto (persistido) o resultado por toque; mientras tanto, pendiente. */
function getStatus(pick: TradePick, price: number | null | undefined): PickStatus {
  if (pick.resolved) return pick.resolved.status;
  return touchOutcome(pick, price) ?? 'pending';
}

const STATUS_META: Record<string, { label: string; bg: string; border: string; color: string }> = {
  win: { label: 'WIN', bg: '#34D39918', border: '#34D39955', color: '#34D399' },
  loss: { label: 'LOSS', bg: '#FB718518', border: '#FB718555', color: '#FB7185' },
  pending: { label: 'ACTIVO', bg: '#8B90A515', border: '#8B90A540', color: '#8B90A5' },
};

const RISK_PER_TRADE = 100;

function getPnl(pick: TradePick, status: PickStatus, price: number | null | undefined): number {
  const settled = getSettlement(pick, price);
  if (settled) return settled.pnl;
  if (status === 'win') return RISK_PER_TRADE * (pick.riskReward || 1);
  if (status === 'loss') return -RISK_PER_TRADE;
  return 0;
}

function getProgress(pick: TradePick, price: number | null | undefined) {
  if (price == null || !isFinite(price)) return null;
  const risk = Math.abs(pick.entry - pick.stop);
  const total = Math.abs(Math.max(pick.stop, pick.target) - Math.min(pick.stop, pick.target));
  if (risk <= 0 || total <= 0) return null;
  const pct = Math.max(0, Math.min(100, (pick.direction === 'CALL' ? (price - pick.stop) : (pick.stop - price)) / total * 100));
  const favor = pick.direction === 'CALL' ? price - pick.entry : pick.entry - price;
  const unreal = RISK_PER_TRADE * (favor / risk);
  return { pct, unreal };
}

/**
 * Riesgo/beneficio en prima de un pick con contrato, ponderado por la calidad
 * del trade. Devuelve null si el pick no tiene contrato.
 */
function riskBenefitFor(pick: TradePick) {
  if (!pick.contract) return null;
  return computePremiumRiskBenefit(
    {
      entry: pick.entry,
      stop: pick.stop,
      target: pick.target,
      strike: pick.contract.strike,
      premium: pick.contract.premium,
      iv: pick.contract.impliedVolatility,
      dte: pick.contract.daysToExpiration,
      isCall: pick.direction === 'CALL',
      delta: pick.contract.delta,
    },
    {
      score: pick.score,
      setupState: pick.setupState,
      targetReachable: pick.contract.targetReachable,
      targetBlockedByOi: pick.contract.targetBlockedByOi,
      earningsSoon: pick.contract.earningsSoon,
    },
    { adrPct: pick.adr ?? null }
  );
}

export default function TradePickView({ profile = 'swing' }: { profile?: TraderProfile }) {
  const [scanning, setScanning] = useState(false);
  const [currentPick, setCurrentPick] = useState<TradePick | null>(null);
  const [history, setHistory] = useState<TradePick[]>([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | PickStatus>('all');
  const [regime, setRegime] = useState<Regime | null>(null);
  const [focusList, setFocusList] = useState<TradePick[]>([]);
  const [bias, setBias] = useState<'bull' | 'bear'>('bull');
  const [gammaSymbol, setGammaSymbol] = useState<string | null>(null);

  const refreshPrices = useCallback(async (picks: TradePick[]) => {
    const syms = Array.from(new Set(picks.map(p => p.symbol)));
    if (syms.length === 0) return;
    try {
      const res = await fetch(`/api/trade-picks/quotes?symbols=${encodeURIComponent(syms.join(','))}`);
      const json = await res.json();
      if (json?.prices) setPrices(prev => ({ ...prev, ...json.prices }));
    } catch {}
  }, []);

  const evaluateHistory = useCallback(async (picks: TradePick[]) => {
    const unresolved = picks.filter(p => !p.resolved);
    if (unresolved.length === 0) return;
    try {
      const res = await fetch('/api/trade-picks/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: unresolved.map(p => ({
            id: p.id, symbol: p.symbol, direction: p.direction,
            entry: p.entry, stop: p.stop, target: p.target, createdAt: p.createdAt,
            contract: p.contract
              ? { strike: p.contract.strike, expiration: p.contract.expiration, premium: p.contract.premium }
              : null,
          })),
        }),
      });
      const json = await res.json();
      const results: Record<string, { status: 'win' | 'loss'; price: number; at: string }> = json?.results || {};
      if (Object.keys(results).length === 0) return;
      setHistory(prev => {
        const next = prev.map(p => (p.resolved || !results[p.id]) ? p : { ...p, resolved: results[p.id] });
        savePicks(next);
        return next;
      });
    } catch { /* sin evaluación → se queda pendiente */ }
  }, []);

  useEffect(() => {
    const picks = loadPicks();
    setHistory(picks);
    if (picks.length > 0) setCurrentPick(picks[0]);
    refreshPrices(picks);
    evaluateHistory(picks);
  }, [refreshPrices, evaluateHistory]);

  // Resolución inmediata con el precio en vivo (target/stop tocado)
  useEffect(() => {
    setHistory(prev => {
      let changed = false;
      const next = prev.map(p => {
        if (p.resolved) return p;
        const price = prices[p.symbol];
        const st = touchOutcome(p, price);
        if (!st) return p;
        changed = true;
        return { ...p, resolved: { status: st, price: price as number, at: new Date().toISOString() } };
      });
      if (changed) savePicks(next);
      return changed ? next : prev;
    });
  }, [prices]);

  const scan = useCallback(async () => {
    setScanning(true);
    setError('');
    try {
      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const excludedToday = Array.from(new Set(
        history.filter(p => new Date(p.createdAt).getTime() > cutoff24h).map(p => p.symbol)
      ));
      const res = await fetch(`/api/trade-picks/scan?bias=${bias}&profile=${profile}&exclude=${encodeURIComponent(excludedToday.join(','))}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      const genAt = data.generatedAt || new Date().toISOString();
      setRegime(data.regime || null);
      const focus: TradePick[] = (data.focusList || []).map((f: any) => ({
        ...f,
        id: `focus-${f.symbol}-${genAt}`,
        createdAt: genAt,
      }));
      setFocusList(focus);

      if (!data.pick) {
        setCurrentPick(null);
        const liquidFocus = focus.filter((f) => f.contract);
        setError(
          liquidFocus.length > 0
            ? 'Ningún setup A/A+ con contrato líquido hoy. Revisa la focus list (B+) más abajo.'
            : bias === 'bear'
              ? 'Sin contratos líquidos hoy (OI≥500, Vol≥100, spread≤10%). Espera a que SPY/QQQ pierdan las EMA 8/21/50.'
              : 'Sin contratos líquidos hoy (OI≥500, Vol≥100, spread≤10%). Espera a que SPY/QQQ recuperen las EMA 8/21/50.'
        );
        return;
      }
      setError('');

      const pick: TradePick = {
        ...data.pick,
        id: `pick-${Date.now()}`,
        createdAt: data.generatedAt || new Date().toISOString(),
      };

      setCurrentPick(pick);
      const updated = prunePicks([pick, ...history]);
      setHistory(updated);
      savePicks(updated);
      refreshPrices(updated);
      evaluateHistory(updated);
    } catch (e: any) {
      setError(e.message || 'Error al escanear');
    } finally {
      setScanning(false);
    }
  }, [history, refreshPrices, evaluateHistory, bias, profile]);

  const grade = currentPick ? getGrade(currentPick.score) : null;
  const isCall = currentPick?.direction === 'CALL';
  const dirColor = isCall ? '#34D399' : '#FB7185';

  const rb = currentPick ? riskBenefitFor(currentPick) : null;
  const qColor = rb ? (rb.quality.label === 'alta' ? C.positive : rb.quality.label === 'media' ? C.warning : C.negative) : C.textMuted;
  const contracts = rb ? contractsForRisk(Math.abs(rb.riskPerContract), RISK_PER_TRADE) : 0;

  const results = history.map(p => getStatus(p, prices[p.symbol]));
  const wins = results.filter(s => s === 'win').length;
  const losses = results.filter(s => s === 'loss').length;
  const pendingN = results.filter(s => s === 'pending').length;
  const todayCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const excludedToday = Array.from(new Set(history.filter(p => new Date(p.createdAt).getTime() > todayCutoff).map(p => p.symbol)));
  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : null;

  const pnlRows = history.map(p => {
    const st = getStatus(p, prices[p.symbol]);
    return { p, st, pnl: getPnl(p, st, prices[p.symbol]) };
  });
  const totalWon = pnlRows.reduce((a, r) => a + Math.max(0, r.pnl), 0);
  const totalLost = pnlRows.reduce((a, r) => a + Math.min(0, r.pnl), 0);
  const netPnl = totalWon + totalLost;
  const unrealTotal = history.reduce((a, p) => {
    const prog = getProgress(p, prices[p.symbol]);
    return a + (getStatus(p, prices[p.symbol]) === 'pending' && prog ? prog.unreal : 0);
  }, 0);
  const toggleFilter = (f: 'all' | PickStatus) => setStatusFilter(statusFilter === f ? 'all' : f);

  const expDate = currentPick?.contract?.expiration
    ? new Date(currentPick.contract.expiration + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>🎯</div>
          <div>
            <h1 style={styles.title}>Trade Picks</h1>
            <p style={styles.subtitle}>{bias === 'bear' ? 'Tu put del día para mañana' : 'Tu pick del día para mañana'}</p>
          </div>
        </div>
        <button onClick={scan} disabled={scanning} style={styles.scanBtn}>
          {scanning ? (
            <span style={styles.scanBtnInner}>
              <span style={styles.spinner} /> Scanning...
            </span>
          ) : (
            <span style={styles.scanBtnInner}>
              ⚡ {currentPick ? 'Scan Again' : 'Scan for Pick'}
            </span>
          )}
        </button>
      </div>

      {/* Toggle Alcista / Bajista */}
      <div style={styles.biasToggle}>
        <button
          onClick={() => setBias('bull')}
          style={{ ...styles.biasBtn, ...(bias === 'bull' ? styles.biasBtnBull : {}) }}
        >
          📈 Alcista (CALL)
        </button>
        <button
          onClick={() => setBias('bear')}
          style={{ ...styles.biasBtn, ...(bias === 'bear' ? styles.biasBtnBear : {}) }}
        >
          📉 Bajista (PUT)
        </button>
      </div>

      {/* Ventana de expiraciones según el perfil de trading */}
      <div style={{ ...styles.excludeHint, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>{PROFILES[profile].icon} Perfil <b>{PROFILES[profile].label}</b></span>
        <span style={{ opacity: 0.75 }}>
          · expiraciones {PROFILES[profile].defaults.dteMin}–{PROFILES[profile].defaults.dteMax} DTE
          (óptimo ~{PROFILES[profile].defaults.dteSweet})
        </span>
      </div>

      {/* Exclusión de repetidos del día */}
      {excludedToday.length > 0 && (
        <div style={styles.excludeHint}>
          🔁 Sin repetir hoy: {excludedToday.length} {excludedToday.length === 1 ? 'símbolo' : 'símbolos'} ya elegidos en las últimas 24h (
          {excludedToday.join(', ')})
        </div>
      )}

      {/* Régimen de mercado — SPY/QQQ vs EMA 8/21/50 */}
      {regime && (
        <div style={{ ...styles.regimeBanner, background: REGIME_META[regime.level].bg, borderColor: REGIME_META[regime.level].border, color: REGIME_META[regime.level].color }}>
          <span>{REGIME_META[regime.level].icon}</span>
          <span><b>{REGIME_META[regime.level].title}</b> — {REGIME_META[regime.level].text}</span>
          {typeof regime.vix === 'number' && <span style={{ marginLeft: 'auto', opacity: 0.85 }}>VIX {regime.vix.toFixed(1)}</span>}
          {typeof regime.breadth === 'number' && <span style={{ opacity: 0.85 }}>· {Math.round(regime.breadth)}% sobre MA50</span>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>{error}</div>
      )}

      {/* Main Pick Card */}
      {currentPick && (
        <div style={styles.card}>
          {/* Top glow */}
          <div style={{ ...styles.glowTop, background: `linear-gradient(90deg, transparent, ${grade?.color || '#2DD4BF'}, transparent)` }} />

          {/* I JUST PICKED header */}
          <div style={styles.pickHeader}>
            <div style={styles.pickLabel}>I JUST PICKED</div>
            <div style={{ ...styles.pickSymbol, color: grade?.color || '#2DD4BF' }}>{currentPick.symbol}</div>
            <div style={styles.pickCompany}>{currentPick.company}</div>
          </div>

          {/* Direction + Score badge */}
          <div style={styles.badgeRow}>
            <div style={{ ...styles.dirBadge, background: dirColor + '18', borderColor: dirColor + '50', color: dirColor }}>
              {currentPick.direction}
            </div>
            <div style={{ ...styles.scoreBadge, background: grade?.color + '18', borderColor: grade?.color + '50', color: grade?.color }}>
              {grade?.label} — {currentPick.score}/100
            </div>
          </div>

          {/* Niveles gamma del símbolo del pick */}
          <button
            onClick={() => setGammaSymbol(currentPick.symbol)}
            style={{
              width: '100%', marginBottom: '14px', padding: '10px 14px',
              background: '#8B5CF618', border: '1px solid #8B5CF655', color: '#A78BFA',
              borderRadius: R.md, cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            🎯 Ver niveles gamma de {currentPick.symbol}
          </button>

          {/* Price */}
          <div style={styles.priceSection}>
            <div style={styles.priceLabel}>Current Price</div>
            <div style={styles.priceValue}>${fmt(currentPick.price)}</div>
            {expDate && (
              <div style={styles.expiryRow}>
                <span>📅 Expiration</span>
                <span style={styles.expiryValue}>{expDate}</span>
              </div>
            )}
          </div>

          {/* ── Options Contract ── */}
          {currentPick.contract && (
            <div style={styles.contractBlock}>
              <div style={styles.contractHeader}>
                <span style={{ fontSize: 20 }}>📊</span>
                <span style={styles.contractTitle}>Options Contract</span>
              </div>
              <div style={styles.contractGrid}>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Strike</div>
                  <div style={styles.contractValue}>${fmt(currentPick.contract.strike)}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Expiration</div>
                  <div style={styles.contractValue}>{expDate || 'N/A'}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Premium</div>
                  <div style={{ ...styles.contractValue, color: '#FBBF24' }}>${fmt(currentPick.contract.premium)}</div>
                </div>
              </div>
              <div style={styles.contractGrid}>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Delta</div>
                  <div style={styles.contractValue}>{currentPick.contract.delta != null ? fmt(currentPick.contract.delta) : 'N/A'}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Open Interest</div>
                  <div style={styles.contractValue}>{currentPick.contract.openInterest > 1000 ? `${(currentPick.contract.openInterest / 1000).toFixed(1)}K` : currentPick.contract.openInterest}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Cost (x100)</div>
                  <div style={styles.contractValue}>${fmt(currentPick.contract.premium * 100, 0)}</div>
                </div>
              </div>
              {(currentPick.contract.breakeven != null || currentPick.contract.impliedVolatility > 0) && (
                <div style={styles.contractGrid}>
                  {currentPick.contract.breakeven != null && (
                    <div style={styles.contractItem}>
                      <div style={styles.contractLabel}>Breakeven</div>
                      <div style={styles.contractValue}>${fmt(currentPick.contract.breakeven)}{currentPick.contract.breakevenPct != null ? ` (+${currentPick.contract.breakevenPct}%)` : ''}</div>
                    </div>
                  )}
                  {currentPick.contract.impliedVolatility > 0 && (
                    <div style={styles.contractItem}>
                      <div style={styles.contractLabel}>IV</div>
                      <div style={styles.contractValue}>{(currentPick.contract.impliedVolatility * 100).toFixed(0)}%</div>
                    </div>
                  )}
                  {currentPick.contract.expectedReturn != null && (
                    <div style={styles.contractItem}>
                      <div style={styles.contractLabel}>Return al target</div>
                      <div style={{ ...styles.contractValue, color: currentPick.contract.expectedReturn >= 0 ? C.positive : C.negative }}>
                        {currentPick.contract.expectedReturn >= 0 ? '+' : ''}{(currentPick.contract.expectedReturn * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
              {currentPick.contract.earningsSoon && (
                <div style={{ ...styles.warnLine, borderColor: '#FB718550', color: '#FB7185' }}>
                  ⚠️ Earnings dentro de la ventana del contrato — riesgo de evento
                </div>
              )}
              {currentPick.contract.targetBlockedByOi && (isCall ? currentPick.contract.callWall != null : currentPick.contract.putWall != null) && (
                <div style={{ ...styles.warnLine, borderColor: '#FBBF2450', color: '#FBBF24' }}>
                  {isCall
                    ? `⚠️ Muro de OI call en $${fmt(currentPick.contract.callWall)} — frena el target`
                    : `⚠️ Muro de OI put en $${fmt(currentPick.contract.putWall)} — frena el target`}
                </div>
              )}
              {currentPick.contract.targetReachable === false && (
                <div style={{ ...styles.warnLine, borderColor: '#FBBF2450', color: '#FBBF24' }}>
                  ⚠️ Breakeven fuera del movimiento esperado para este DTE
                </div>
              )}
            </div>
          )}

          {/* Trade Levels */}
          <div style={styles.tradeGrid}>
            <div style={styles.tradeItem}>
              <div style={styles.tradeLabel}>Entry</div>
              <div style={styles.tradeValue}>${fmt(currentPick.entry)}</div>
            </div>
            <div style={styles.tradeItem}>
              <div style={styles.tradeLabel}>Stop</div>
              <div style={{ ...styles.tradeValue, color: C.negative }}>${fmt(currentPick.stop)}</div>
            </div>
            <div style={styles.tradeItem}>
              <div style={styles.tradeLabel}>Target</div>
              <div style={{ ...styles.tradeValue, color: C.positive }}>${fmt(currentPick.target)}</div>
            </div>
            <div style={styles.tradeItem}>
              <div style={styles.tradeLabel}>R/R</div>
              <div style={{ ...styles.tradeValue, color: grade?.color }}>{fmt(currentPick.riskReward, 1)}</div>
            </div>
          </div>

          {/* Riesgo / Beneficio en prima, ponderado por la calidad del trade */}
          {rb && (
            <div style={{ marginBottom: 16, padding: 12, background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: R.md }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: C.textPrimary, fontWeight: 800 }}>
                  Riesgo / Beneficio en prima
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: R.full,
                  background: qColor + '22', color: qColor, border: `1px solid ${qColor}55`,
                }}>
                  Calidad {rb.quality.label} · ×{rb.quality.factor.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={styles.tradeItem}>
                  <div style={styles.tradeLabel}>Riesgo (stop ${fmt(currentPick.stop)})</div>
                  <div style={{ ...styles.tradeValue, color: C.negative }}>
                    ${fmt(rb.stopPremium)}
                    <span style={{ fontSize: 11, color: C.textMuted }}> → −${fmt(Math.abs(rb.riskPerContract), 0)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{fmt(rb.riskPct, 0)}% de la prima</div>
                </div>
                <div style={styles.tradeItem}>
                  <div style={styles.tradeLabel}>Beneficio (target ${fmt(currentPick.target)})</div>
                  <div style={{ ...styles.tradeValue, color: C.positive }}>
                    ${fmt(rb.targetPremium)}
                    <span style={{ fontSize: 11, color: C.textMuted }}> → +${fmt(rb.rewardPerContract, 0)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{fmt(rb.rewardPct, 0)}% de la prima</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={styles.tradeItem}>
                  <div style={styles.tradeLabel}>R/R en prima</div>
                  <div style={{ ...styles.tradeValue, color: rb.rrBase != null && rb.rrBase >= 1 ? C.positive : C.warning }}>
                    {rb.rrBase != null ? fmt(rb.rrBase, 1) : '—'}
                  </div>
                </div>
                <div style={styles.tradeItem}>
                  <div style={styles.tradeLabel}>R/R ponderado por calidad</div>
                  <div style={{ ...styles.tradeValue, color: rb.rrQuality != null && rb.rrQuality >= 1 ? C.positive : C.warning }}>
                    {rb.rrQuality != null ? fmt(rb.rrQuality, 1) : '—'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8 }}>
                Prima pagada ${fmt(currentPick.contract?.premium ?? 0)} · Riesgo real por contrato ${fmt(Math.abs(rb.riskPerContract), 0)} · Beneficio esperado ${fmt(rb.rewardExpectedPerContract, 0)}
                {contracts > 0 && ` · Para arriesgar $${RISK_PER_TRADE}: ${contracts} contrato${contracts > 1 ? 's' : ''}`}
              </div>

              {rb.breakevenMovePct != null && (
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                  Breakeven al vencimiento ${fmt(rb.breakeven)} → la acción necesita {fmt(Math.abs(rb.breakevenMovePct), 1)}% de movimiento
                  {rb.expectedMovePct != null && ` · movimiento esperado en ${currentPick.contract?.daysToExpiration ?? 0} días ≈ ${fmt(rb.expectedMovePct, 1)}% (ADR×√DTE)`}
                  {rb.breakevenWithinExpectedMove === false && ' · ⚠️ fuera del rango habitual'}
                </div>
              )}

              {rb.notes.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: C.warning, fontSize: 10, lineHeight: 1.6 }}>
                  {rb.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}

              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 10, color: C.textMuted, cursor: 'pointer' }}>Cómo se calcula la calidad</summary>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: C.textMuted, fontSize: 10, lineHeight: 1.6 }}>
                  {rb.quality.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </details>

              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>
                Escenarios de la opción con Black-Scholes (IV y DTE reales) escalados a la prima que pagaste, con suelo de valor intrínseco. El R/R ponderado aplica el factor de calidad (score/100) al beneficio: el score es una métrica de ranking, no una probabilidad calibrada — úsalo como el R/R que estás dispuesto a suscribir, no como un valor esperado estadístico.
              </div>
            </div>
          )}

          {/* Reasons */}
          {currentPick.reasons.length > 0 && (
            <div style={styles.reasonsSection}>
              <div style={styles.reasonsTitle}>Why this pick?</div>
              {currentPick.reasons.map((r, i) => (
                <div key={i} style={styles.reasonItem}>
                  <span style={{ color: '#34D399', marginRight: 8 }}>✓</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Plan de gestión — trims en cuartos sobre las EMAs */}
          {(currentPick.trail8 || currentPick.trail21 || currentPick.trail50) && (
            <div style={styles.planSection}>
              <div style={styles.planTitle}>Plan de gestión — trims en ¼</div>
              <div style={styles.planRow}>
                <span>1) 25% en el target <b style={{ color: C.positive }}>${fmt(currentPick.target)}</b></span>
                <span>2) 25% al cerrar {isCall ? 'bajo' : 'sobre'} EMA8 <b style={{ color: C.textPrimary }}>${fmt(currentPick.trail8 ?? null)}</b></span>
                <span>3) 25% {isCall ? 'bajo' : 'sobre'} EMA21 <b style={{ color: C.textPrimary }}>${fmt(currentPick.trail21 ?? null)}</b></span>
                <span>4) Salida {isCall ? 'bajo' : 'sobre'} EMA50 <b style={{ color: C.negative }}>${fmt(currentPick.trail50 ?? null)}</b></span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={styles.footer}>
            <span style={styles.footerTime}>Locked {formatDate(currentPick.createdAt)}</span>
            <span style={styles.lockedBadge}>🔒 LOCKED TODAY</span>
          </div>
        </div>
      )}

      {/* Focus list — top 5 setups del escaneo (solo con contrato líquido) */}
      {focusList.filter((f) => f.contract).length > 0 && (
        <div style={styles.focusSection}>
          <div style={styles.focusTitle}>FOCUS LIST — mejores setups del scan</div>
          {focusList.filter((f) => f.contract).map((f) => {
            const fg = getGrade(f.score);
            const active = currentPick?.symbol === f.symbol;
            const setupText = f.setupState === 'confirmed'
              ? (f.direction === 'PUT' ? 'BREAKDOWN' : 'BREAKOUT')
              : f.triggerDist != null ? `TRG ${f.trigger != null ? f.trigger.toFixed(2) : ''} · ${f.triggerDist >= 0 ? '+' : ''}${f.triggerDist.toFixed(1)}%` : 'SETUP';
            const setupColor = f.setupState === 'confirmed' ? (f.direction === 'PUT' ? '#FB7185' : '#34D399') : '#67E8F9';
            const fExp = f.contract?.expiration
              ? new Date(f.contract.expiration + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : null;
            return (
              <div
                key={f.symbol}
                onClick={() => setCurrentPick(f)}
                style={{ ...styles.focusItem, borderColor: active ? fg.color : C.border, background: active ? fg.color + '0A' : '#0d1117' }}
                title="Toca para ver este setup"
              >
                <div style={styles.focusLeft}>
                  <span style={{ ...styles.focusSymbol, color: fg.color }}>{f.symbol}</span>
                  <span style={{ ...styles.focusGrade, background: fg.color + '18', borderColor: fg.color + '50', color: fg.color }}>{fg.label}</span>
                  <span style={{ ...styles.focusChip, color: setupColor, borderColor: setupColor + '50', background: setupColor + '12' }}>{setupText}</span>
                </div>
                <div style={styles.focusRight}>
                  <span style={styles.focusContract}>{f.contract!.strike}{f.direction === 'PUT' ? 'P' : 'C'} {fExp} · ${fmt(f.contract!.premium)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setGammaSymbol(f.symbol); }}
                    title={`Ver niveles gamma de ${f.symbol}`}
                    style={{
                      background: '#8B5CF618', border: '1px solid #8B5CF655', color: '#A78BFA',
                      borderRadius: R.sm, cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                      padding: '3px 7px', whiteSpace: 'nowrap',
                    }}
                  >
                    🎯 γ
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 800, color: fg.color }}>{f.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!currentPick && !scanning && !error && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <div style={styles.emptyTitle}>No picks yet</div>
          <div style={styles.emptyText}>Hit "Scan for Pick" to find tomorrow&apos;s best options trade</div>
        </div>
      )}

      {/* History toggle */}
      {history.length > 1 && (
        <div style={styles.historySection}>
          <button onClick={() => setShowHistory(!showHistory)} style={styles.historyToggle}>
            {showHistory ? '▲' : '▼'} Pick History ({history.length})
          </button>

          {history.length > 1 && (
            <>
              <div style={styles.winRateBar}>
                <button
                  onClick={() => toggleFilter('win')}
                  style={{ ...styles.winRateChip, background: statusFilter === 'win' ? '#34D39925' : '#34D39918', border: `1px solid ${statusFilter === 'win' ? '#34D399' : '#34D39950'}`, color: '#34D399', cursor: 'pointer' }}
                >
                  ✅ {wins} W
                </button>
                <button
                  onClick={() => toggleFilter('loss')}
                  style={{ ...styles.winRateChip, background: statusFilter === 'loss' ? '#FB718525' : '#FB718518', border: `1px solid ${statusFilter === 'loss' ? '#FB7185' : '#FB718550'}`, color: '#FB7185', cursor: 'pointer' }}
                >
                  ❌ {losses} L
                </button>
                <button
                  onClick={() => toggleFilter('pending')}
                  style={{ ...styles.winRateChip, background: statusFilter === 'pending' ? '#8B90A525' : '#8B90A515', border: `1px solid ${statusFilter === 'pending' ? '#8B90A5' : '#8B90A540'}`, color: '#8B90A5', cursor: 'pointer' }}
                >
                  ⏳ {pendingN} en curso
                </button>
                <button
                  onClick={() => toggleFilter('all')}
                  style={{ ...styles.winRateChip, background: statusFilter === 'all' ? '#2DD4BF25' : '#2DD4BF18', border: `1px solid ${statusFilter === 'all' ? '#2DD4BF' : '#2DD4BF40'}`, color: '#2DD4BF', cursor: 'pointer' }}
                >
                  Todos
                </button>
                <span style={{ ...styles.winRateChip, background: 'linear-gradient(135deg, #2DD4BF18, #34D39918)', border: '1px solid #2DD4BF55', color: '#2DD4BF', fontWeight: 800, cursor: 'default' }} title={`${wins} ganados / ${losses} perdidos de ${closed} cerrados`}>
                  Win Rate {winRate != null ? `${winRate.toFixed(0)}%` : '—'}{closed > 0 ? ` · ${wins}W/${losses}L` : ''}
                </span>
              </div>

              <div style={styles.pnlBar}>
                <span style={{ ...styles.pnlChip, color: '#34D399' }}>
                  💵 Ganado +${totalWon.toFixed(0)}
                </span>
                <span style={{ ...styles.pnlChip, color: '#FB7185' }}>
                  Perdido -${Math.abs(totalLost).toFixed(0)}
                </span>
                <span style={{ ...styles.pnlChip, color: netPnl >= 0 ? '#2DD4BF' : '#FB7185', fontWeight: 800 }}>
                  Neto {netPnl >= 0 ? '+' : '-'}${Math.abs(netPnl).toFixed(0)}
                </span>
                {unrealTotal !== 0 && (
                  <span style={{ ...styles.pnlChip, color: unrealTotal >= 0 ? '#67E8F9' : '#FB923C' }}>
                    No realizado {unrealTotal >= 0 ? '+' : '-'}${Math.abs(unrealTotal).toFixed(0)}
                  </span>
                )}
                <span style={{ ...styles.pnlChip, color: C.textMuted, cursor: 'help' }} title="Estimado con riesgo fijo de $100 por trade (ganancia = $100 × R/R)">
                  <b>{RISK_PER_TRADE}</b> riesgo/trade
                </span>
              </div>
            </>
          )}

          {showHistory && (
            <div style={styles.historyList}>
              {history.slice(1).filter(p => statusFilter === 'all' || getStatus(p, prices[p.symbol]) === statusFilter).map((pick) => {
                const g = getGrade(pick.score);
                const dirCol = pick.direction === 'CALL' ? '#34D399' : '#FB7185';
                const status = getStatus(pick, prices[pick.symbol]);
                const sm = STATUS_META[status];
                const settled = getSettlement(pick, prices[pick.symbol]);
                const stPnl = getPnl(pick, status, prices[pick.symbol]);
                const hrb = riskBenefitFor(pick);
                const prog = status === 'pending' ? getProgress(pick, prices[pick.symbol]) : null;
                const exp = pick.contract?.expiration
                  ? new Date(pick.contract.expiration + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : null;
                const expanded = expandedId === pick.id;
                return (
                  <div key={pick.id}>
                    <div
                      style={{
                        ...styles.historyItem,
                        background: sm?.bg || '#0d1117',
                        borderColor: sm?.border || C.border,
                      }}
                      onClick={() => setExpandedId(expanded ? null : pick.id)}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.historyLeft}>
                          <span style={{ ...styles.historySymbol, color: g.color }}>{pick.symbol}</span>
                          <span style={{ ...styles.historyDir, color: dirCol }}>{pick.direction}</span>
                          <span style={{ color: g.color, fontWeight: 700 }}>{pick.score}</span>
                          <span style={styles.historyDate}>{new Date(pick.createdAt).toLocaleDateString()}</span>
                          {sm && (
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                              background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color, letterSpacing: '0.5px',
                            }}>
                              {sm.label}
                            </span>
                          )}
                        </div>
                        <div style={styles.historyLevels}>
                          <span style={styles.lvl}>Entry <b style={{ color: C.textPrimary }}>${fmt(pick.entry)}</b></span>
                          <span style={styles.lvl}>Stop <b style={{ color: C.negative }}>${fmt(pick.stop)}</b></span>
                          <span style={styles.lvl}>Target <b style={{ color: C.positive }}>${fmt(pick.target)}</b></span>
                          <span style={styles.lvl}>R/R <b style={{ color: g.color }}>{fmt(pick.riskReward, 1)}</b></span>
                          {status && prices[pick.symbol] != null && (
                            <span style={styles.lvl}>Ahora <b style={{ color: status === 'win' ? '#34D399' : status === 'loss' ? '#FB7185' : C.textPrimary }}>${fmt(prices[pick.symbol]!)}</b></span>
                          )}
                          {pick.resolved && (
                            <span style={styles.lvl}>
                              Cerrado <b style={{ color: pick.resolved.status === 'win' ? '#34D399' : '#FB7185' }}>
                                {pick.resolved.status === 'win' ? 'WIN' : 'LOSS'}
                              </b> a ${fmt(pick.resolved.price)} · {new Date(pick.resolved.at).toLocaleDateString()}
                            </span>
                          )}
                          {pick.contract && (
                            <span style={styles.lvlContract}>
                              {pick.contract.strike} {exp || ''} @ ${fmt(pick.contract.premium)}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); addToJournal(pick); }}
                            title="Añadir este trade al Diario de Trades"
                            style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.accent}55`, background: C.accent + '14', color: C.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                          >
                            + Añadir al diario
                          </button>
                        </div>
                        {prog && (
                          <div style={{ marginTop: 8, width: '100%' }}>
                            <div style={styles.progressTrack}>
                              <div style={{ ...styles.progressFill, width: `${prog.pct}%`, background: prog.unreal >= 0 ? '#2DD4BF' : '#FB7185' }} />
                            </div>
                            <div style={styles.progressLabels}>
                              <span style={{ color: C.negative, fontSize: 10 }}>Stop ${fmt(pick.stop)}</span>
                              <span style={{ color: prog.unreal >= 0 ? '#2DD4BF' : '#FB923C', fontSize: 11, fontWeight: 700 }}>
                                Cómo va {prog.unreal >= 0 ? '+' : '-'}${Math.abs(prog.unreal).toFixed(0)}
                                {prices[pick.symbol] != null && (
                                  <span> · a ${fmt(Math.abs(pick.target - prices[pick.symbol]!))} del target</span>
                                )}
                              </span>
                              <span style={{ color: C.positive, fontSize: 10 }}>Target ${fmt(pick.target)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <span style={{ ...styles.historyChevron, color: sm?.color || C.textMuted, transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>›</span>
                    </div>

                    {expanded && (
                      <div style={styles.historyExpanded}>
                        {stPnl !== 0 && (
                          <div style={{
                            marginBottom: 10, textAlign: 'center' as const,
                            fontSize: 15, fontWeight: 800,
                            color: stPnl >= 0 ? '#34D399' : '#FB7185',
                            padding: '6px', borderRadius: R.sm,
                            background: stPnl >= 0 ? '#34D39912' : '#FB718512',
                            border: `1px solid ${stPnl >= 0 ? '#34D39940' : '#FB718540'}`,
                          }}>
                            {stPnl >= 0 ? '+' : '-'}${Math.abs(stPnl).toFixed(0)} P/L ({settled
                              ? `liquidado: opción ${status === 'win' ? 'ITM' : 'OTM'}`
                              : status === 'win' ? `ganancia = $${RISK_PER_TRADE} × R/R ${fmt(pick.riskReward, 1)}` : `pérdida = riesgo $${RISK_PER_TRADE}`})
                          </div>
                        )}
                        <div style={styles.hxGrid}>
                          <div style={styles.hxItem}>
                            <div style={styles.hxLabel}>Entry</div>
                            <div style={styles.hxValue}>${fmt(pick.entry)}</div>
                          </div>
                          <div style={styles.hxItem}>
                            <div style={styles.hxLabel}>Stop</div>
                            <div style={{ ...styles.hxValue, color: C.negative }}>${fmt(pick.stop)}</div>
                          </div>
                          <div style={styles.hxItem}>
                            <div style={styles.hxLabel}>Target</div>
                            <div style={{ ...styles.hxValue, color: C.positive }}>${fmt(pick.target)}</div>
                          </div>
                          <div style={styles.hxItem}>
                            <div style={styles.hxLabel}>R/R</div>
                            <div style={{ ...styles.hxValue, color: g.color }}>{fmt(pick.riskReward, 1)}</div>
                          </div>
                        </div>

                        {pick.contract && (
                          <div style={styles.hxContract}>
                            <div style={styles.hxContractTitle}>
                              📊 {pick.contract.strike} {pick.direction} · {exp || 'N/A'}
                            </div>
                            <div style={styles.hxContractGrid}>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>Premium</div>
                                <div style={{ ...styles.hxValue, color: '#FBBF24' }}>${fmt(pick.contract.premium)}</div>
                              </div>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>Cost (x100)</div>
                                <div style={styles.hxValue}>${fmt(pick.contract.premium * 100, 0)}</div>
                              </div>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>Delta</div>
                                <div style={styles.hxValue}>{pick.contract.delta != null ? fmt(pick.contract.delta) : 'N/A'}</div>
                              </div>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>Riesgo (prima)</div>
                                <div style={{ ...styles.hxValue, color: C.negative }}>
                                  {hrb ? `$${fmt(hrb.stopPremium)} → −$${fmt(Math.abs(hrb.riskPerContract), 0)}` : 'N/A'}
                                </div>
                              </div>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>Beneficio (prima)</div>
                                <div style={{ ...styles.hxValue, color: C.positive }}>
                                  {hrb ? `$${fmt(hrb.targetPremium)} → +$${fmt(hrb.rewardPerContract, 0)}` : 'N/A'}
                                </div>
                              </div>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>R/R en prima</div>
                                <div style={{ ...styles.hxValue, color: hrb && hrb.rrQuality != null && hrb.rrQuality >= 1 ? C.positive : C.warning }}>
                                  {hrb ? (hrb.rrQuality != null ? `${fmt(hrb.rrQuality, 1)} (cal.)` : '—') : 'N/A'}
                                </div>
                              </div>
                              <div style={styles.hxContractItem}>
                                <div style={styles.hxLabel}>Open Interest</div>
                                <div style={styles.hxValue}>{pick.contract.openInterest > 1000 ? `${(pick.contract.openInterest / 1000).toFixed(1)}K` : pick.contract.openInterest}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {pick.reasons.length > 0 && (
                          <div style={styles.hxReasons}>
                            {pick.reasons.map((r, i) => (
                              <div key={i} style={styles.hxReason}>
                                <span style={{ color: '#34D399', marginRight: 8 }}>✓</span>
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {history.slice(1).filter(p => statusFilter === 'all' || getStatus(p, prices[p.symbol]) === statusFilter).length === 0 && (
                <div style={styles.historyEmpty}>
                  Sin picks en este estado{statusFilter !== 'all' && statusFilter ? ` (${STATUS_META[statusFilter].label})` : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de niveles gamma del símbolo */}
      {gammaSymbol && (
        <div
          onClick={() => setGammaSymbol(null)}
          style={{ position: 'fixed', inset: 0, background: '#000000C0', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720 }}>
            <GammaLevelsPanel symbol={gammaSymbol} onClose={() => setGammaSymbol(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: C.textPrimary,
    margin: 0,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: 13,
    color: C.textMuted,
    margin: 0,
    marginTop: 2,
  },
  biasToggle: {
    display: 'flex',
    gap: 6,
    marginBottom: 16,
    padding: 4,
    background: '#0d1117',
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
  },
  biasBtn: {
    flex: 1,
    padding: '9px 12px',
    borderRadius: R.sm,
    border: '1px solid transparent',
    background: 'transparent',
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  biasBtnBull: {
    background: '#34D39918',
    border: '1px solid #34D39955',
    color: '#34D399',
  },
  biasBtnBear: {
    background: '#FB718518',
    border: '1px solid #FB718555',
    color: '#FB7185',
  },
  scanBtn: {
    padding: '12px 24px',
    borderRadius: R.md,
    border: 'none',
    background: 'linear-gradient(135deg, #2DD4BF 0%, #34D399 100%)',
    color: '#0d1117',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(45, 212, 191, 0.3)',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  scanBtnInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  excludeHint: {
    marginBottom: 14,
    padding: '8px 12px',
    borderRadius: R.sm,
    background: C.warning + '14',
    border: `1px solid ${C.warning}35`,
    color: C.warning,
    fontSize: 12,
  },
  regimeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    padding: '10px 14px',
    borderRadius: R.sm,
    border: '1px solid',
    fontSize: 12.5,
    lineHeight: 1.4,
  },
  spinner: {
    width: 14,
    height: 14,
    border: '2px solid #0d1117',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
  errorBox: {
    padding: '12px 16px',
    borderRadius: R.md,
    background: '#FB7185' + '15',
    border: '1px solid #FB718540',
    color: '#FB7185',
    fontSize: 13,
    marginBottom: 20,
  },
  card: {
    position: 'relative',
    background: '#0d1117',
    borderRadius: 20,
    border: '1px solid #21262d',
    overflow: 'hidden',
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6), 0 0 1px rgba(45, 212, 191, 0.2)',
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: '2px',
  },
  pickHeader: {
    textAlign: 'center' as const,
    padding: '36px 24px 20px',
  },
  pickLabel: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '5px',
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  pickSymbol: {
    fontSize: 64,
    fontWeight: 900,
    letterSpacing: '-3px',
    lineHeight: 1,
  },
  pickCompany: {
    fontSize: 14,
    color: '#8B90A5',
    marginTop: 8,
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 10,
    padding: '0 24px 20px',
  },
  dirBadge: {
    padding: '6px 16px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '1px',
    border: '1px solid',
  },
  scoreBadge: {
    padding: '6px 16px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.5px',
    border: '1px solid',
  },
  priceSection: {
    textAlign: 'center' as const,
    padding: '0 24px 24px',
  },
  priceLabel: {
    fontSize: 11,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 800,
    color: C.textPrimary,
  },
  expiryRow: {
    marginTop: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    borderRadius: 999,
    background: '#2DD4BF14',
    border: '1px solid #2DD4BF40',
    fontSize: 13,
    fontWeight: 600,
    color: '#8B90A5',
  },
  expiryValue: {
    fontSize: 15,
    fontWeight: 800,
    color: '#2DD4BF',
  },
  contractBlock: {
    margin: '0 20px',
    padding: '20px',
    background: '#161B22',
    borderRadius: R.lg,
    border: '1px solid #21262d',
  },
  contractHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  contractTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.textPrimary,
  },
  contractGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12,
    marginBottom: 12,
  },
  warnLine: {
    fontSize: 12,
    fontWeight: 600 as const,
    padding: '8px 10px',
    borderRadius: R.sm,
    borderWidth: 1,
    borderStyle: 'solid' as const,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  contractItem: {
    textAlign: 'center' as const,
  },
  contractLabel: {
    fontSize: 10,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  contractValue: {
    fontSize: 16,
    fontWeight: 700,
    color: C.textPrimary,
  },
  tradeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 1,
    margin: '20px 20px 0',
    background: '#21262d',
    borderRadius: R.md,
    overflow: 'hidden',
  },
  tradeItem: {
    textAlign: 'center' as const,
    padding: '14px 8px',
    background: '#161B22',
  },
  tradeLabel: {
    fontSize: 10,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  tradeValue: {
    fontSize: 15,
    fontWeight: 700,
    color: C.textPrimary,
  },
  reasonsSection: {
    padding: '20px 24px',
  },
  reasonsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: 10,
  },
  reasonItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  planSection: {
    margin: '0 24px 20px',
    padding: '14px 16px',
    background: '#161B22',
    borderRadius: R.md,
    border: '1px solid #21262d',
  },
  planTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: 8,
  },
  planRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: 12.5,
    color: C.textSecondary,
    lineHeight: 1.5,
  },
  focusSection: {
    marginTop: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  focusTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
    marginBottom: 4,
  },
  focusItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
    background: '#0d1117',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  focusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexWrap: 'wrap' as const,
  },
  focusSymbol: {
    fontSize: 15,
    fontWeight: 800,
  },
  focusGrade: {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid',
    letterSpacing: '0.5px',
  },
  focusChip: {
    fontSize: 9.5,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid',
    letterSpacing: '0.5px',
  },
  focusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  focusContract: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    borderTop: '1px solid #21262d',
  },
  footerTime: {
    fontSize: 12,
    color: '#8B90A5',
  },
  lockedBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#34D399',
    letterSpacing: '0.5px',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 24px',
    background: '#0d1117',
    borderRadius: 20,
    border: '1px solid #21262d',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: C.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8B90A5',
    maxWidth: 300,
    margin: '0 auto',
  },
  historySection: {
    marginTop: 24,
  },
  historyToggle: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  winRateBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    margin: '10px 0 8px',
  },
  winRateChip: {
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: 999,
    whiteSpace: 'nowrap' as const,
  },
  pnlBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    margin: '0 0 8px',
  },
  pnlChip: {
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 12px',
    borderRadius: 999,
    background: '#0d1117',
    border: `1px solid ${C.border}`,
    whiteSpace: 'nowrap' as const,
  },
  historyEmpty: {
    padding: '18px 16px',
    borderRadius: R.md,
    border: `1px dashed ${C.border}`,
    background: '#0d1117',
    color: C.textMuted,
    fontSize: 12,
    textAlign: 'center' as const,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    background: '#21262d',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.3s ease',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  historyList: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 16px',
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
    background: '#0d1117',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  historyLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  historySymbol: {
    fontSize: 15,
    fontWeight: 800,
  },
  historyDir: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  historyRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: C.textMuted,
  },
  historyLevels: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  lvl: {
    fontSize: 11,
    color: C.textMuted,
    whiteSpace: 'nowrap' as const,
  },
  lvlContract: {
    fontSize: 11,
    color: '#FBBF24',
    whiteSpace: 'nowrap' as const,
    fontWeight: 700,
  },
  historyChevron: {
    fontSize: 18,
    color: C.textMuted,
    flexShrink: 0,
  },
  historyExpanded: {
    margin: '4px 0 4px',
    padding: '14px 16px',
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
    background: '#161B22',
  },
  hxGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 8,
  },
  hxItem: {
    textAlign: 'center' as const,
    padding: '10px 6px',
    background: '#0d1117',
    borderRadius: R.sm,
    border: `1px solid ${C.border}`,
  },
  hxLabel: {
    fontSize: 10,
    color: C.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  hxValue: {
    fontSize: 15,
    fontWeight: 700,
    color: C.textPrimary,
  },
  hxContract: {
    marginTop: 12,
    padding: '12px 14px',
    background: '#0d1117',
    borderRadius: R.sm,
    border: `1px solid #2DD4BF30`,
  },
  hxContractTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#2DD4BF',
    marginBottom: 10,
  },
  hxContractGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 8,
  },
  hxContractItem: {
    textAlign: 'center' as const,
  },
  hxReasons: {
    marginTop: 12,
    padding: '12px 14px',
    background: '#0d1117',
    borderRadius: R.sm,
    border: `1px solid ${C.border}`,
  },
  hxReason: {
    display: 'flex',
    alignItems: 'flex-start',
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 5,
    lineHeight: 1.4,
  },
  historyDate: {
    fontSize: 12,
    color: C.textMuted,
  },
};
