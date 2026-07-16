"use client";

import { useState, useEffect, useCallback } from "react";
import SharePreviewModal from "./SharePreviewModal";

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
  if (grade.startsWith("A")) return "#0d9488";
  if (grade.startsWith("B")) return "#0891b2";
  if (grade.startsWith("C")) return "#d97706";
  return "#dc2626";
}

function riskColor(level: string): string {
  if (level === "Bajo") return "#0d9488";
  if (level === "Medio") return "#d97706";
  return "#dc2626";
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
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Alertas confluencia basadas en 12 factores
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["active", "triggered", "expired", "dismissed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  ...styles.filterBtn,
                  background: filter === s ? "#0d9488" : "transparent",
                  color: filter === s ? "#fff" : "#94a3b8",
                  borderColor: filter === s ? "#0d9488" : "#e2e8f0",
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
          <span style={{ color: "#64748b", fontSize: 13 }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    {/* Grade pill */}
                    <div style={{ ...styles.gradePill, borderColor: gc, color: gc, flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{alert.grade}</span>
                    </div>
                    {/* Symbol + score */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#f0f6fc" }}>{alert.symbol}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{alert.score}/100</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                        {timeAgo(alert.createdAt)} ago · {alert.tradeTime}
                      </div>
                    </div>
                  </div>

                  {/* Right side metrics */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Conf</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: alert.confidence >= 70 ? "#0d9488" : alert.confidence >= 50 ? "#d97706" : "#dc2626" }}>
                        {alert.confidence}%
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>R/R</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc" }}>{alert.riskReward.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Riesgo</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: rc }}>{alert.riskLevel}</div>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 12, transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
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
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Entrada</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#f0f6fc" }}>${alert.entry.toFixed(2)}</span>
                        </div>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Stop</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>${alert.stopLoss.toFixed(2)}</span>
                        </div>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>TP1</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#0d9488" }}>${alert.tp1.toFixed(2)}</span>
                        </div>
                        <div style={styles.zoneItem}>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>TP2</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#0d9488" }}>${alert.tp2.toFixed(2)}</span>
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
                              background: s >= 70 ? "#0d948818" : s >= 50 ? "#0891b218" : "#d9770618",
                              color: s >= 70 ? "#0d9488" : s >= 50 ? "#0891b2" : "#d97706",
                              borderColor: s >= 70 ? "#0d948830" : s >= 50 ? "#0891b230" : "#d9770630",
                            }}>
                              {label}: {score}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Warnings */}
                    {alert.warnings.length > 0 && (
                      <div style={{ ...styles.detailSection, background: "#f59e0b08" }}>
                        <div style={{ ...styles.detailLabel, color: "#d97706" }}>Advertencias</div>
                        {alert.warnings.map((w, i) => (
                          <div key={i} style={{ fontSize: 12, color: "#d97706", padding: "2px 0" }}>⚠ {w}</div>
                        ))}
                      </div>
                    )}

                    {/* Summary */}
                    <div style={{ ...styles.detailSection, borderBottom: "none" }}>
                      <div style={styles.detailLabel}>Resumen</div>
                      <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{alert.summary}</p>
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
                      <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px",
    borderBottom: "1px solid #21262d",
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#8b949e",
  },
  filterBtn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #21262d",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "48px 20px",
  },
  spinner: {
    width: 20,
    height: 20,
    border: "2px solid #21262d",
    borderTopColor: "#0d9488",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  alertRow: {
    borderBottom: "1px solid #21262d",
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
    gap: 12,
  },
  gradePill: {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px solid",
    borderRadius: 10,
    background: "#0d1117",
    flexShrink: 0,
  },
  detail: {
    background: "#161b22",
    borderTop: "1px solid #21262d",
  },
  detailSection: {
    padding: "14px 20px",
    borderBottom: "1px solid #21262d",
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#8b949e",
    marginBottom: 8,
  },
  zoneGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  zoneItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    padding: "8px 10px",
    background: "#0d1117",
    borderRadius: 8,
    border: "1px solid #21262d",
  },
  factorTag: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 500,
  },
  dismissBtn: {
    padding: "6px 16px",
    borderRadius: 6,
    border: "1px solid #30363d",
    background: "transparent",
    color: "#8b949e",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 500,
  },
  shareBtn: {
    padding: "6px 16px",
    borderRadius: 6,
    border: "none",
    background: "#0d9488",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
  demoBtn: {
    marginTop: 8,
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #30363d",
    background: "transparent",
    color: "#8b949e",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 500,
  },
};
