'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R } from '@/src/utils/webTheme';

interface ContractData {
  strike: number;
  expiration: string;
  daysToExpiration: number;
  premium: number;
  delta: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
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
  contract: ContractData | null;
  createdAt: string;
}

const STORAGE_KEY = 'trade-picks-history';

function loadPicks(): TradePick[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePicks(picks: TradePick[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks.slice(0, 20)));
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

function getGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'ELITE', color: '#2DD4BF' };
  if (score >= 80) return { label: 'STRONG', color: '#34D399' };
  if (score >= 70) return { label: 'GOOD', color: '#67E8F9' };
  return { label: 'FAIR', color: '#FBBF24' };
}

type PickStatus = 'win' | 'loss' | 'pending' | null;

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

function getStatus(pick: TradePick, price: number | null | undefined): PickStatus {
  if (price == null || !isFinite(price)) return null;
  const settled = getSettlement(pick, price);
  if (settled) return settled.status;
  if (pick.direction === 'CALL') {
    if (price >= pick.target) return 'win';
    if (price <= pick.stop) return 'loss';
  } else {
    if (price <= pick.target) return 'win';
    if (price >= pick.stop) return 'loss';
  }
  return 'pending';
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

export default function TradePickView() {
  const [scanning, setScanning] = useState(false);
  const [currentPick, setCurrentPick] = useState<TradePick | null>(null);
  const [history, setHistory] = useState<TradePick[]>([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | PickStatus>('all');

  const refreshPrices = useCallback(async (picks: TradePick[]) => {
    const syms = Array.from(new Set(picks.map(p => p.symbol)));
    if (syms.length === 0) return;
    try {
      const res = await fetch(`/api/trade-picks/quotes?symbols=${encodeURIComponent(syms.join(','))}`);
      const json = await res.json();
      if (json?.prices) setPrices(prev => ({ ...prev, ...json.prices }));
    } catch {}
  }, []);

  useEffect(() => {
    const picks = loadPicks();
    setHistory(picks);
    if (picks.length > 0) setCurrentPick(picks[0]);
    refreshPrices(picks);
  }, [refreshPrices]);

  const scan = useCallback(async () => {
    setScanning(true);
    setError('');
    try {
      const res = await fetch('/api/trade-picks/scan');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');

      if (!data.pick) {
        setError('No se encontró ningún pick con score ≥ 70. Intenta más tarde cuando el mercado esté activo.');
        return;
      }

      const pick: TradePick = {
        ...data.pick,
        id: `pick-${Date.now()}`,
        createdAt: data.generatedAt || new Date().toISOString(),
      };

      setCurrentPick(pick);
      const updated = [pick, ...history].slice(0, 20);
      setHistory(updated);
      savePicks(updated);
      refreshPrices(updated);
    } catch (e: any) {
      setError(e.message || 'Error al escanear');
    } finally {
      setScanning(false);
    }
  }, [history, refreshPrices]);

  const grade = currentPick ? getGrade(currentPick.score) : null;
  const isCall = currentPick?.direction === 'CALL';
  const dirColor = isCall ? '#34D399' : '#FB7185';

  const results = history.map(p => getStatus(p, prices[p.symbol]));
  const wins = results.filter(s => s === 'win').length;
  const losses = results.filter(s => s === 'loss').length;
  const pendingN = results.filter(s => s === 'pending').length;
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
            <p style={styles.subtitle}>Tu pick del día para mañana</p>
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

          {/* Footer */}
          <div style={styles.footer}>
            <span style={styles.footerTime}>Locked {formatDate(currentPick.createdAt)}</span>
            <span style={styles.lockedBadge}>🔒 LOCKED TODAY</span>
          </div>
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
                <span style={{ ...styles.winRateChip, background: 'linear-gradient(135deg, #2DD4BF18, #34D39918)', border: '1px solid #2DD4BF55', color: '#2DD4BF', fontWeight: 800, cursor: 'default' }}>
                  Win Rate {winRate != null ? `${winRate.toFixed(0)}%` : '—'}
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
                const sm = status ? STATUS_META[status] : null;
                const settled = getSettlement(pick, prices[pick.symbol]);
                const stPnl = getPnl(pick, status, prices[pick.symbol]);
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
                          {pick.contract && (
                            <span style={styles.lvlContract}>
                              {pick.contract.strike} {exp || ''} @ ${fmt(pick.contract.premium)}
                            </span>
                          )}
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
