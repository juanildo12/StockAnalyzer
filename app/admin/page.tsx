"use client";

import { useEffect, useMemo, useState } from "react";
import { colors as C } from "@/src/utils/webTheme";

const PLANS = [
  { id: "free", name: "Free", hint: "Plan gratuito" },
  { id: "pro", name: "Pro", hint: "49/mes" },
  { id: "elite", name: "Elite", hint: "99/mes" },
  { id: "enterprise", name: "Enterprise", hint: "Personalizado" },
];

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("elite");
  const [trial, setTrial] = useState(true);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/set-plan");
        const data = await res.json();
        setIsAdmin(!!data.isAdmin);
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const daysLabel = useMemo(() => (days === 30 ? "1 mes" : `${days} días`), [days]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.textSecondary, fontFamily: "system-ui, sans-serif" }}>
        Verificando...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.negative, fontFamily: "system-ui, sans-serif" }}>
        No autorizado — no eres administrador.
      </div>
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/admin/set-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan, trial, days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: "err", text: data.error || "Error" });
      } else {
        const suffix = data.status === "trial"
          ? ` · Trial de ${daysLabel} (quedan ${data.daysLeft} días)`
          : "";
        setResult({ type: "ok", text: `Plan ${data.plan.toUpperCase()} aplicado a ${data.email}${suffix}` });
      }
    } catch (err: any) {
      setResult({ type: "err", text: err?.message || "Error de red" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textSecondary, fontFamily: "system-ui, -apple-system, sans-serif", padding: "40px 24px" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ color: C.textPrimary, fontSize: "28px", margin: "0 0 4px" }}>Admin — Gestión de planes</h1>
        <p style={{ margin: "0 0 28px", fontSize: "14px", color: C.textMuted }}>
          Otorga o modifica el plan de un usuario por email.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "24px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: C.textSecondary }}>
              Email del usuario
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@correo.com"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "10px", boxSizing: "border-box",
                background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: C.textSecondary }}>
              Plan
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  style={{
                    padding: "10px 12px", borderRadius: "10px", textAlign: "left", cursor: "pointer",
                    background: plan === p.id ? "rgba(124,58,237,0.15)" : C.bg,
                    border: `1px solid ${plan === p.id ? C.accent : C.border}`,
                    color: plan === p.id ? C.textPrimary : C.textSecondary,
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: "11px", opacity: 0.7 }}>{p.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={trial}
              onChange={(e) => setTrial(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: C.accent }}
            />
            <span style={{ fontSize: "14px", color: C.textPrimary }}>Trial de {daysLabel}</span>
          </label>

          {trial && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: C.textSecondary }}>
                Duración del trial (días)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={{
                  width: "120px", padding: "10px 12px", borderRadius: "10px",
                  background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "14px",
                }}
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email}
            style={{
              padding: "12px 16px", borderRadius: "12px", cursor: loading || !email ? "not-allowed" : "pointer",
              background: C.accent, color: C.textPrimary, border: "none", fontWeight: 700, fontSize: "15px",
              opacity: loading || !email ? 0.5 : 1,
            }}
          >
            {loading ? "Aplicando..." : "Aplicar plan"}
          </button>

          {result && (
            <div style={{
              padding: "12px 16px", borderRadius: "10px", fontSize: "14px",
              background: result.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              color: result.type === "ok" ? "#6ee7b7" : "#fca5a5",
              border: `1px solid ${result.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>
              {result.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}