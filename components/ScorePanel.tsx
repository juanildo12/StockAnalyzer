"use client";

import { useState, useEffect } from "react";

interface Factor {
  id: string;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  breakdown: { metric: string; value: number; detail: string }[];
}

interface ScoreData {
  success?: boolean;
  symbol?: string;
  totalScore?: number;
  grade?: string;
  factors?: Factor[];
  summary?: string;
  timestamp?: string;
  error?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#0d9488";
  if (score >= 60) return "#0891b2";
  if (score >= 40) return "#d97706";
  if (score >= 20) return "#ea580c";
  return "#dc2626";
}

function getGradeLabel(grade: string): string {
  const map: Record<string, string> = {
    "A+": "Excepcional", A: "Fuerte", "B+": "Favorable", B: "Positivo",
    "C+": "Mixto", C: "Debil", D: "Evitar", F: "Riesgo alto",
  };
  return map[grade] || "";
}

interface Props {
  symbol: string;
}

export default function ScorePanel({ symbol }: Props) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/v1/score?symbol=${symbol}`)
      .then(async res => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `Server error ${res.status}`);
        return json;
      })
      .then(json => { if (active && json?.success) setData(json); else if (active) setError(json?.error || "Scoring failed"); })
      .catch(err => { if (active) setError(err.message || "Failed to load score"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol]);

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 40 }}>
          <div style={styles.spinner} />
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Computing score for {symbol}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.card}>
        <p style={{ color: "#ef4444", fontSize: 13, padding: 40 }}>{error}</p>
      </div>
    );
  }

  if (!data || !data.factors) return null;

  const sorted = [...data.factors].sort((a, b) => b.weightedScore - a.weightedScore);
  const color = getScoreColor(data.totalScore!);
  const strong = sorted.filter(f => f.score >= 60);
  const weak = sorted.filter(f => f.score < 60);

  return (
    <div style={styles.card}>
      {/* ── Header ────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span style={styles.label}>Quantitative Score</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ ...styles.score, color }}>{data.totalScore}</span>
              <span style={styles.scoreUnit}>/100</span>
            </div>
          </div>
          <div style={{ ...styles.gradeBadge, borderColor: color, color }}>
            <span style={styles.gradeLetter}>{data.grade}</span>
            <span style={styles.gradeLabel}>{getGradeLabel(data.grade!)}</span>
          </div>
        </div>

        {/* Master bar */}
        <div style={styles.masterBar}>
          <div style={{ ...styles.masterBarFill, width: `${data.totalScore}%`, background: color }} />
          <div style={styles.masterBarLabels}>
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>

        <p style={styles.summary}>{data.summary}</p>
      </div>

      {/* ── Fortalezas ────────────────────────────────── */}
      {strong.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={{ ...styles.dot, background: "#0d9488" }} />
            <span style={styles.sectionTitle}>Fortalezas</span>
            <span style={styles.sectionCount}>({strong.length})</span>
          </div>
          <div style={styles.grid}>
            {strong.map(f => (
              <FactorCard key={f.id} factor={f} expanded={expanded === f.id} onToggle={() => setExpanded(expanded === f.id ? null : f.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Areas de mejora ──────────────────────────── */}
      {weak.length > 0 && (
        <div style={{ ...styles.section, borderBottom: "none" }}>
          <div style={styles.sectionHeader}>
            <div style={{ ...styles.dot, background: "#d97706" }} />
            <span style={styles.sectionTitle}>Areas de mejora</span>
            <span style={styles.sectionCount}>({weak.length})</span>
          </div>
          <div style={styles.grid}>
            {weak.map(f => (
              <FactorCard key={f.id} factor={f} expanded={expanded === f.id} onToggle={() => setExpanded(expanded === f.id ? null : f.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FactorCard({ factor, expanded, onToggle }: { factor: Factor; expanded: boolean; onToggle: () => void }) {
  const color = getScoreColor(factor.score);

  return (
    <div
      onClick={onToggle}
      style={{
        ...styles.factorCard,
        borderColor: expanded ? color : "#e2e8f0",
        background: expanded ? "#f8fafc" : "#fff",
      }}
    >
      {/* Row 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={styles.factorLabel}>{factor.label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ ...styles.factorScore, color }}>{factor.score}</span>
          <span style={styles.factorWeight}>{Math.round(factor.weight * 100)}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.bar}>
        <div style={{ ...styles.barFill, width: `${Math.max(3, factor.score)}%`, background: color }} />
      </div>

      {/* Explanation */}
      <p style={styles.factorExplanation}>{factor.explanation}</p>

      {/* Expandable detail */}
      {expanded && factor.breakdown.length > 0 && (
        <div style={styles.breakdown}>
          {factor.breakdown.map((b, i) => (
            <div key={i} style={styles.breakdownRow}>
              <span style={styles.breakdownMetric}>{b.metric}</span>
              <span style={styles.breakdownDetail}>{b.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hint */}
      {factor.breakdown.length > 0 && (
        <span style={styles.hint}>
          {expanded ? "Ocultar detalle" : `${factor.breakdown.length} metricas`}
        </span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fafaf8",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  header: {
    padding: "24px 24px 20px",
    borderBottom: "1px solid #f1f5f9",
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "#94a3b8",
  },
  score: {
    fontSize: 48,
    fontWeight: 800,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  scoreUnit: {
    fontSize: 18,
    fontWeight: 500,
    color: "#94a3b8",
  },
  gradeBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    border: "1.5px solid",
    borderRadius: 10,
    background: "#fff",
  },
  gradeLetter: {
    fontSize: 18,
    fontWeight: 700,
  },
  gradeLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "#64748b",
  },
  masterBar: {
    marginTop: 16,
    height: 6,
    background: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  masterBarFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 1s ease-out",
  },
  masterBarLabels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 4,
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: 500,
  },
  summary: {
    marginTop: 14,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    margin: "14px 0 0",
  },
  section: {
    padding: "20px 24px",
    borderBottom: "1px solid #f1f5f9",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "#475569",
  },
  sectionCount: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 500,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
  },
  factorCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  factorLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
  },
  factorScore: {
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  factorWeight: {
    fontSize: 11,
    fontWeight: 500,
    color: "#94a3b8",
  },
  bar: {
    height: 6,
    background: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden" as const,
    marginBottom: 10,
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.7s ease-out",
  },
  factorExplanation: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
    margin: 0,
  },
  breakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  breakdownMetric: {
    fontSize: 12,
    color: "#94a3b8",
    flexShrink: 0,
  },
  breakdownDetail: {
    fontSize: 12,
    color: "#334155",
    textAlign: "right" as const,
  },
  hint: {
    display: "block",
    marginTop: 8,
    fontSize: 10,
    color: "#94a3b8",
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2px solid #e2e8f0",
    borderTopColor: "#0d9488",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
