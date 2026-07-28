'use client';

import { useState } from 'react';
import { colors as C, radius as R, font as F, shadow } from '@/src/utils/webTheme';

export interface ProspectPickData {
  symbol: string;
  company: string;
  direction: 'CALL' | 'PUT';
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  confidence: number;
  score: number;
  reasons: string[];
  contract: {
    strike: number;
    expiration: string;
    daysToExpiration: number;
    premium: number;
    delta: number | null;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
  } | null;
}

interface ProspectPickCardProps {
  data: ProspectPickData;
  onShare?: (data: ProspectPickData) => void;
  onClose?: () => void;
}

function getGrade(score: number): { label: string; color: string; stars: number } {
  if (score >= 90) return { label: 'Elite Setup', color: '#2DD4BF', stars: 5 };
  if (score >= 80) return { label: 'Strong Setup', color: '#34D399', stars: 4 };
  if (score >= 70) return { label: 'Good Setup', color: '#67E8F9', stars: 3 };
  if (score >= 60) return { label: 'Fair Setup', color: '#FBBF24', stars: 2 };
  return { label: 'Weak Setup', color: '#FB7185', stars: 1 };
}

function formatTime() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${days[now.getDay()]} ${h12}:${m} ${ampm}`;
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return 'N/A';
  return n.toFixed(dec);
}

export default function ProspectPickCard({ data, onShare, onClose }: ProspectPickCardProps) {
  const [sharing, setSharing] = useState(false);
  const grade = getGrade(data.score);
  const isCall = data.direction === 'CALL';
  const dirColor = isCall ? '#34D399' : '#FB7185';
  const potentialReturn = data.target && data.entry
    ? ((data.target - data.entry) / data.entry * 100)
    : 0;

  const handleShare = async () => {
    if (onShare) {
      setSharing(true);
      try { onShare(data); } finally { setSharing(false); }
    }
  };

  const expDate = data.contract?.expiration
    ? new Date(data.contract.expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'N/A';

  return (
    <div style={styles.outerContainer}>
      <div style={styles.card}>
        {/* Glow effect */}
        <div style={styles.glowTop} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>🎯</div>
          <div style={styles.headerLabel}>PROSPECT PICK</div>
        </div>

        <div style={styles.divider} />

        {/* Ticker + Company */}
        <div style={styles.tickerSection}>
          <div style={styles.ticker}>{data.symbol}</div>
          <div style={styles.company}>{data.company}</div>
          <div style={{ ...styles.gradeBadge, color: grade.color, borderColor: grade.color + '40' }}>
            {'★'.repeat(grade.stars)}{'☆'.repeat(5 - grade.stars)} {grade.label}
          </div>
        </div>

        {/* Score + Confidence row */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Prospect Score</div>
            <div style={{ ...styles.statValue, color: grade.color }}>{data.score}<span style={styles.statUnit}>/100</span></div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Confidence</div>
            <div style={{ ...styles.statValue, color: grade.color }}>{data.confidence}<span style={styles.statUnit}>%</span></div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Direction badge */}
        <div style={styles.directionSection}>
          <div style={{ ...styles.directionBadge, background: dirColor + '18', borderColor: dirColor + '40', color: dirColor }}>
            {data.direction}
          </div>
        </div>

        <div style={styles.divider} />

        {/* Entry / Stop / Target / RR */}
        <div style={styles.tradeRow}>
          <div style={styles.tradeItem}>
            <div style={styles.tradeLabel}>Entry</div>
            <div style={styles.tradeValue}>${fmt(data.entry)}</div>
          </div>
          <div style={styles.tradeItem}>
            <div style={styles.tradeLabel}>Stop</div>
            <div style={{ ...styles.tradeValue, color: C.negative }}>${fmt(data.stop)}</div>
          </div>
          <div style={styles.tradeItem}>
            <div style={styles.tradeLabel}>Target</div>
            <div style={{ ...styles.tradeValue, color: C.positive }}>${fmt(data.target)}</div>
          </div>
          <div style={styles.tradeItem}>
            <div style={styles.tradeLabel}>R/R</div>
            <div style={{ ...styles.tradeValue, color: grade.color }}>{fmt(data.riskReward, 1)}</div>
          </div>
        </div>

        {/* Options Contract */}
        {data.contract && (
          <>
            <div style={styles.divider} />
            <div style={styles.contractSection}>
              <div style={styles.contractHeader}>
                <span style={styles.contractIcon}>📊</span>
                <span style={styles.contractTitle}>Options Contract</span>
              </div>
              <div style={styles.contractGrid}>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Strike</div>
                  <div style={styles.contractValue}>${fmt(data.contract.strike)}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Exp</div>
                  <div style={styles.contractValue}>{expDate}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Premium</div>
                  <div style={{ ...styles.contractValue, color: C.warning }}>${fmt(data.contract.premium)}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Delta</div>
                  <div style={styles.contractValue}>{data.contract.delta != null ? fmt(data.contract.delta) : 'N/A'}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>OI</div>
                  <div style={styles.contractValue}>{data.contract.openInterest > 1000 ? `${(data.contract.openInterest / 1000).toFixed(1)}K` : data.contract.openInterest}</div>
                </div>
                <div style={styles.contractItem}>
                  <div style={styles.contractLabel}>Cost</div>
                  <div style={styles.contractValue}>${fmt(data.contract.premium * 100, 0)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Why today? */}
        <div style={styles.divider} />
        <div style={styles.reasonsSection}>
          <div style={styles.reasonsTitle}>Why today?</div>
          {data.reasons.map((r, i) => (
            <div key={i} style={styles.reasonItem}>
              <span style={styles.reasonCheck}>✓</span>
              <span style={styles.reasonText}>{r}</span>
            </div>
          ))}
        </div>

        <div style={styles.divider} />

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerLeft}>
            <div style={styles.footerLabel}>Generated</div>
            <div style={styles.footerValue}>{formatTime()}</div>
          </div>
          <div style={styles.lockedBadge}>🔒 LOCKED TODAY</div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          {onShare && (
            <button
              onClick={handleShare}
              disabled={sharing}
              style={styles.shareBtn}
            >
              {sharing ? 'Compartiendo...' : 'Compartir en X'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    padding: '8px 0',
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    background: '#0d1117',
    borderRadius: 16,
    border: '1px solid #21262d',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui, sans-serif",
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(45, 212, 191, 0.15)',
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #2DD4BF, transparent)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '20px 24px 16px',
  },
  headerIcon: {
    fontSize: 28,
  },
  headerLabel: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '4px',
    color: '#E8EAF0',
    textTransform: 'uppercase' as const,
  },
  divider: {
    height: 1,
    background: '#21262d',
    margin: '0 24px',
  },
  tickerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 24px 16px',
  },
  ticker: {
    fontSize: 56,
    fontWeight: 800,
    color: '#E8EAF0',
    letterSpacing: '-2px',
    lineHeight: 1,
  },
  company: {
    fontSize: 14,
    color: '#8B90A5',
    marginTop: 6,
  },
  gradeBadge: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 999,
    border: '1px solid',
    letterSpacing: '0.5px',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    gap: 0,
  },
  statBox: {
    flex: 1,
    textAlign: 'center' as const,
  },
  statDivider: {
    width: 1,
    height: 40,
    background: '#21262d',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#555A70',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  statUnit: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.6,
  },
  directionSection: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 24px',
  },
  directionBadge: {
    fontSize: 18,
    fontWeight: 800,
    padding: '6px 32px',
    borderRadius: 8,
    border: '1px solid',
    letterSpacing: '3px',
  },
  tradeRow: {
    display: 'flex',
    padding: '16px 24px',
    gap: 8,
  },
  tradeItem: {
    flex: 1,
    textAlign: 'center' as const,
    background: '#161b22',
    borderRadius: 8,
    padding: '10px 4px',
  },
  tradeLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#555A70',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 4,
  },
  tradeValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#E8EAF0',
    fontVariantNumeric: 'tabular-nums',
  },
  contractSection: {
    padding: '16px 24px',
  },
  contractHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  contractIcon: {
    fontSize: 16,
  },
  contractTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#8B90A5',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
  },
  contractGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  },
  contractItem: {
    background: '#161b22',
    borderRadius: 8,
    padding: '8px 10px',
  },
  contractLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#555A70',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 2,
  },
  contractValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#E8EAF0',
    fontVariantNumeric: 'tabular-nums',
  },
  reasonsSection: {
    padding: '16px 24px',
  },
  reasonsTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#E8EAF0',
    marginBottom: 10,
  },
  reasonItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  reasonCheck: {
    color: '#34D399',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: '20px',
    flexShrink: 0,
  },
  reasonText: {
    fontSize: 13,
    color: '#8B90A5',
    lineHeight: '20px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
  },
  footerLeft: {},
  footerLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#555A70',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  footerValue: {
    fontSize: 13,
    color: '#8B90A5',
    marginTop: 2,
  },
  lockedBadge: {
    fontSize: 12,
    fontWeight: 800,
    color: '#2DD4BF',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    background: 'rgba(45, 212, 191, 0.1)',
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid rgba(45, 212, 191, 0.25)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 24px 20px',
  },
  shareBtn: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #2DD4BF, #14B8A6)',
    color: '#0d1117',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.3px',
    transition: 'all 0.2s ease',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid #21262d',
    background: 'transparent',
    color: '#555A70',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
};
