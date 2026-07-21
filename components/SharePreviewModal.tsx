"use client";

import { useState, useEffect } from "react";
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface SharePreviewModalProps {
  alertId: string;
  symbol: string;
  grade: string;
  score: number;
  returnPct: number;
  onClose: () => void;
}

export default function SharePreviewModal({
  alertId,
  symbol,
  grade,
  score,
  returnPct,
  onClose,
}: SharePreviewModalProps) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    twitter: true,
    discord: true,
    linkedin: false,
  });
  const [results, setResults] = useState<any[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/alerts/smart/${alertId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const blob = await res.blob();
        if (active) setCardUrl(URL.createObjectURL(blob));
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [alertId]);

  const share = async () => {
    setSharing(true);
    try {
      const platforms = Object.entries(selected)
        .filter(([_, v]) => v)
        .map(([k]) => k) as ("twitter" | "linkedin" | "discord")[];

      const res = await fetch(`/api/v1/alerts/smart/${alertId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([{ platform: "?", success: false, error: "Network error" }]);
    } finally {
      setSharing(false);
    }
  };

  const toggle = (p: string) => setSelected(prev => ({ ...prev, [p]: !prev[p] }));
  const returnStr = returnPct >= 0 ? `+${returnPct.toFixed(1)}%` : `${returnPct.toFixed(1)}%`;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Compartir resultado</div>
            <div style={styles.subtitle}>
              {symbol} · {returnStr} · Grade {grade} · Score {score}/100
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Card preview */}
        <div style={styles.previewArea}>
          {loading ? (
            <div style={styles.placeholder}>
              <div style={styles.spinner} />
              <span style={{ color: "#64748b", fontSize: 13 }}>Generando card...</span>
            </div>
          ) : cardUrl ? (
            <img src={cardUrl} alt="Share card" style={styles.cardImage} />
          ) : (
            <div style={styles.placeholder}>
              <span style={{ color: C.negative, fontSize: 13 }}>Error generando card</span>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div style={styles.resultsArea}>
            {results.map((r: any, i: number) => (
              <div key={i} style={{
                ...styles.resultRow,
                borderLeftColor: r.success ? C.positive : C.negative,
              }}>
                <span style={styles.resultPlatform}>{r.platform}</span>
                {r.success ? (
                  <a href={r.postUrl} target="_blank" rel="noopener" style={styles.resultLink}>
                    Ver publicación →
                  </a>
                ) : (
                  <span style={styles.resultError}>{r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Platform selector */}
        {!results && (
          <div style={styles.platformArea}>
            <div style={styles.platformLabel}>Plataformas</div>
            <div style={styles.platformGrid}>
              {[
                { id: "twitter", label: "X / Twitter", icon: "𝕏" },
                { id: "linkedin", label: "LinkedIn", icon: "in" },
                { id: "discord", label: "Discord", icon: "◈" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  style={{
                    ...styles.platformBtn,
                    background: selected[p.id] ? `${C.positive18}` : "transparent",
                    borderColor: selected[p.id] ? C.positive : C.border,
                    color: selected[p.id] ? C.positive : C.textMuted,
                  }}
                >
                  <span style={styles.platformIcon}>{p.icon}</span>
                  <span>{p.label}</span>
                  {selected[p.id] && <span style={styles.checkMark}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          {results ? (
            <button onClick={onClose} style={styles.doneBtn}>Cerrar</button>
          ) : (
            <>
              <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
              <button
                onClick={share}
                disabled={sharing || !Object.values(selected).some(Boolean)}
                style={{
                  ...styles.shareBtn,
                  opacity: sharing || !Object.values(selected).some(Boolean) ? 0.5 : 1,
                }}
              >
                {sharing ? "Compartiendo..." : "Compartir"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    width: "100%",
    maxWidth: 640,
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 24px 16px",
    borderBottom: `1px solid ${C.border}`,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: C.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 4,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: C.textMuted,
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  previewArea: {
    padding: "16px 24px",
    display: "flex",
    justifyContent: "center",
  },
  cardImage: {
    width: "100%",
    borderRadius: 12,
    border: `1px solid ${C.border}`,
  },
  placeholder: {
    width: "100%",
    aspectRatio: "1200/630",
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  spinner: {
    width: 20,
    height: 20,
    border: `2px solid ${C.border}`,
    borderTopColor: C.positive,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  resultsArea: {
    padding: "0 24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  resultRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: C.bgCard,
    borderRadius: 8,
    borderLeft: "3px solid",
    fontSize: 13,
  },
  resultPlatform: {
    color: C.textSecondary,
    fontWeight: 600,
    textTransform: "capitalize" as const,
  },
  resultLink: {
    color: C.positive,
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 500,
  },
  resultError: {
    color: C.negative,
    fontSize: 12,
  },
  platformArea: {
    padding: "0 24px 16px",
  },
  platformLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: C.textMuted,
    marginBottom: 8,
  },
  platformGrid: {
    display: "flex",
    gap: 8,
  },
  platformBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid",
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  platformIcon: {
    fontSize: 14,
    fontWeight: 700,
  },
  checkMark: {
    fontSize: 12,
    marginLeft: 2,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "16px 24px",
    borderTop: `1px solid ${C.border}`,
  },
  cancelBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: "transparent",
    color: C.textMuted,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  shareBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: C.positive,
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  doneBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: "transparent",
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
};
