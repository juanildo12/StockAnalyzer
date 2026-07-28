'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R, font as F, shadow, spacing as S } from '@/src/utils/webTheme';

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

export default function TradePickView() {
  const [scanning, setScanning] = useState(false);
  const [currentPick, setCurrentPick] = useState<TradePick | null>(null);
  const [history, setHistory] = useState<TradePick[]>([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const picks = loadPicks();
    setHistory(picks);
    if (picks.length > 0) setCurrentPick(picks[0]);
  }, []);

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
      const updated = [pick, ...history.filter((p) => p.symbol !== pick.symbol)].slice(0, 20);
      setHistory(updated);
      savePicks(updated);
    } catch (e: any) {
      setError(e.message || 'Error al escanear');
    } finally {
      setScanning(false);
    }
  }, [history]);

  const grade = currentPick ? getGrade(currentPick.score) : null;
  const isCall = currentPick?.direction === 'CALL';
  const dirColor = isCall ? '#34D399' : '#FB7185';
  const expDate = currentPick?.contract?.expiration
    ? new Date(currentPick.contract.expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
          {showHistory && (
            <div style={styles.historyList}>
              {history.slice(1).map((pick) => {
                const g = getGrade(pick.score);
                return (
                  <div key={pick.id} style={styles.historyItem} onClick={() => setCurrentPick(pick)}>
                    <div style={styles.historyLeft}>
                      <span style={{ ...styles.historySymbol, color: g.color }}>{pick.symbol}</span>
                      <span style={{ ...styles.historyDir, color: pick.direction === 'CALL' ? '#34D399' : '#FB7185' }}>{pick.direction}</span>
                    </div>
                    <div style={styles.historyRight}>
                      <span style={{ color: g.color }}>{pick.score}</span>
                      <span style={styles.historyDate}>{new Date(pick.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
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
  historyDate: {
    fontSize: 12,
    color: C.textMuted,
  },
};
