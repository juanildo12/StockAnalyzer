"use client";

import { useState, useEffect, useCallback } from "react";
import SharePreviewModal from "./SharePreviewModal";
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

interface SmartAlert {
  id: string;
  symbol: string;
  score: number;
  grade: string;
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskReward: number;
  confidence: number;
  riskLevel: string;
  tradeTime: string;
  summary: string;
  topFactors: string[];
  warnings: string[];
  status: string;
  expiresAt: string;
  createdAt: string;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return C.positive;
  if (grade.startsWith("B")) return C.info;
  if (grade.startsWith("C")) return C.warning;
  return C.negative;
}

function riskColor(level: string): string {
  if (level === "Bajo") return C.positive;
  if (level === "Medio") return C.warning;
  return C.negative;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function SmartAlertsPanel() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "triggered" | "expired" | "dismissed">("active");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shareAlert, setShareAlert] = useState<SmartAlert | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/alerts/smart?status=${filter}`);
      const json = await res.json();
      setAlerts(json.alerts || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const createDemo = async () => {
    try {
      const res = await fetch("/api/v1/alerts/smart?demo=true");
      const data = await res.json();
      if (data.alert) {
        setFilter("triggered");
        fetchAlerts();
      }
    } catch {}
  };

  const dismiss = async (id: string) => {
    try {
      await fetch(`/api/v1/alerts/smart/${id}`, { method: "PATCH", body: JSON.stringify({ status: "dismissed" }) });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={styles.label}>Smart Alerts</span>
            <div style={{ fontSize: F.sizeSm, color: C.textSecondary, marginTop: S.xs }}>
              Alertas confluencia basadas en 12 factores
            </div>
          </div>
          <div style={{ display: "flex", gap: S.xs }}>
            {(["active", "triggered", "expired", "dismissed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  ...styles.filterBtn,
                  background: filter === s ? C.positive : "transparent",
                  color: filter === s ? C.textPrimary : C.textSecondary,
                  borderColor: filter === s ? C.positive : "#e2e8f0",
                }}
              >
                {s === "active" ? "Activas" : s === "triggered" ? "Triggered" : s === "expired" ? "Expiradas" : "Descartadas"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={styles.empty}>
          <div style={styles.spinner} />
          <span>Cargando...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 32 }}>🔔</span>
          <span style={{ color: C.textMuted, fontSize: F.sizeMd }}>
            {filter === "active" ? "No hay alertas activas" : "Sin alertas en este estado"}
          </span>
          <button onClick={createDemo} style={styles.demoBtn}>
            Crear alerta de prueba (NVDA)
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {alerts.map(alert => {
            const gc = gradeColor(alert.grade);
            const rc = riskColor(alert.riskLevel);
            const isOpen = expanded === alert.id;
            return (
              <div key={alert.id} style={styles.alertRow}>
                {/* Top row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : alert.id)}
                  style={styles.alertTop}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: S.md, flex: 1, minWidth: 0 }}>
                    {/* Grade pill */}
                    <div style={{ ...styles.gradePill, borderColor: gc, color: gc, flexShrink: 0 }}>
                      <span style={{ fontSize: F.sizeLg, fontWeight: 700 }}>{alert.grade}</span>
                    </div>
                    {/* Symbol + score */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: F.sizeLg, fontWeight: 700, color: C.textPrimary }}>{alert.symbol}</span>
                        <span style={{ fontSize: F.sizeSm, color: C.textSecondary }}>{alert.score}/100</span>
                      </div>
                      <div style={{ fontSize: F.sizeXs, color: C.textMuted, marginTop: 2 }}>
                        {timeAgo(alert.createdAt)} ago · {alert.tradeTime}
                      </div>
                    </div>
                  </div>

                  {/* Right side metrics */}
                  <div style={{ display: "flex", alignItems: "center", gap: S.md, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: F.sizeSm, color: C.textSecondary }}>Conf</div>
                      <div style={{ fontSize: F.sizeBase, fontWeight: 700, color: alert.confidence >= 70 ? C.positive : alert.confidence >= 50 ? C.warning : C.negative }}>
                        {alert.confidence}%
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: F.sizeSm, color: C.textSecondary }}>R/R</div>
                      <div style={{ fontSize: F.sizeBase, fontWeight: 700, color: C.textPrimary }}>{alert.riskReward.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: F.sizeSm, color: C.textSecondary }}>Riesgo</div>
                      <div style={{ fontSize: F.sizeMd, fontWeight: 600, color: rc }}>{alert.riskLevel}</div>
                    </div>
                    <span style={{ color: C.textMuted, fontSize: F.sizeSm, transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={styles.detail}>
                    {/* Entry zone */}
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Zona de Operacion</div>
                      <div style={styles.zoneGrid}>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>Entrada</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>${alert.entry.toFixed(2)}</span>
                        </div>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>Stop</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.negative }}>${alert.stopLoss.toFixed(2)}</span>
                        </div>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>TP1</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.positive }}>${alert.tp1.toFixed(2)}</span>
                        </div>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: F.sizeXs, color: C.textSecondary }}>TP2</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.positive }}>${alert.tp2.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top factors */}
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Factores Clave</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {alert.topFactors.slice(0, 4).map((f, i) => {
                          const [label, score] = f.split(": ");
                          const s = parseInt(score || "0");
                          return (
                            <span key={i} style={{
                              ...styles.factorTag,
                              background: s >= 70 ? `${C.positive}18` : s >= 50 ? `${C.info}18` : `${C.warning}18`,
                              color: s >= 70 ? C.positive : s >= 50 ? C.info : C.warning,
                              borderColor: s >= 70 ? `${C.positive}30` : s >= 50 ? `${C.info}30` : `${C.warning}30`,
                            }}>
                              {label}: {score}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Warnings */}
                    {alert.warnings.length > 0 && (
                      <div style={{ ...styles.detailSection, background: `${C.warning}08` }}>
                        <div style={{ ...styles.detailLabel, color: C.warning }}>Advertencias</div>
                        {alert.warnings.map((w, i) => (
                          <div key={i} style={{ fontSize: F.sizeSm, color: C.warning, padding: "2px 0" }}>⚠ {w}</div>
                        ))}
                      </div>
                    )}

                    {/* Summary */}
                    <div style={{ ...styles.detailSection, borderBottom: "none" }}>
                      <div style={styles.detailLabel}>Resumen</div>
                      <p style={{ fontSize: F.sizeSm, color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>{alert.summary}</p>
                    </div>

                    {/* Actions */}
                    {alert.status === "active" && (
                      <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={() => dismiss(alert.id)} style={styles.dismissBtn}>
                          Descartar
                        </button>
                      </div>
                    )}
                    {alert.status === "triggered" && (
                      <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end", gap: S.sm }}>
                        <button onClick={() => setShareAlert(alert)} style={styles.shareBtn}>
                          Compartir resultado
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Share modal */}
      {shareAlert && (
        <SharePreviewModal
          alertId={shareAlert.id}
          symbol={shareAlert.symbol}
          grade={shareAlert.grade}
          score={shareAlert.score}
          returnPct={((shareAlert.tp1 - shareAlert.entry) / shareAlert.entry) * 100}
          onClose={() => setShareAlert(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: R.lg,
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px",
    borderBottom: `1px solid ${C.border}`,
  },
  label: {
    fontSize: F.sizeSm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: C.textMuted,
  },
  filterBtn: {
    padding: "4px 10px",
    borderRadius: R.sm,
    border: `1px solid ${C.border}`,
    fontSize: F.sizeXs,
    fontWeight: 500,
    cursor: "pointer",
    transition: T.fast,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    padding: "48px 20px",
  },
  spinner: {
    width: 20,
    height: 20,
    border: `2px solid ${C.border}`,
    borderTopColor: C.positive,
    borderRadius: R.full,
    animation: "spin 0.8s linear infinite",
  },
  alertRow: {
    borderBottom: `1px solid ${C.border}`,
  },
  alertTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "14px 20px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    gap: S.md,
  },
  gradePill: {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px solid",
    borderRadius: R.lg,
    background: C.bg,
    flexShrink: 0,
  },
  detail: {
    background: C.bgCard,
    borderTop: `1px solid ${C.border}`,
  },
  detailSection: {
    padding: "14px 20px",
    borderBottom: `1px solid ${C.border}`,
  },
  detailLabel: {
    fontSize: F.sizeXs,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: C.textMuted,
    marginBottom: S.sm,
  },
  zoneGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: S.sm,
  },
  zoneItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    padding: "8px 10px",
    background: C.bg,
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
  },
  factorTag: {
    padding: "4px 10px",
    borderRadius: R.sm,
    border: "1px solid",
    fontSize: F.sizeSm,
    fontWeight: 500,
  },
  dismissBtn: {
    padding: "6px 16px",
    borderRadius: R.sm,
    border: `1px solid ${C.border}`,
    background: "transparent",
    color: C.textMuted,
    fontSize: F.sizeSm,
    cursor: "pointer",
    fontWeight: 500,
  },
  shareBtn: {
    padding: "6px 16px",
    borderRadius: R.sm,
    border: "none",
    background: C.positive,
    color: C.textPrimary,
    fontSize: F.sizeSm,
    cursor: "pointer",
    fontWeight: 600,
  },
  demoBtn: {
    marginTop: S.sm,
    padding: "8px 16px",
    borderRadius: R.md,
    border: `1px solid ${C.border}`,
    background: "transparent",
    color: C.textMuted,
    fontSize: F.sizeSm,
    cursor: "pointer",
    fontWeight: 500,
  },
};
