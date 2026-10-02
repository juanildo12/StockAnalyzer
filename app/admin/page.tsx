"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { colors as C } from "@/src/utils/webTheme";

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  status: string;
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

const PLAN_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  free: { label: "Free", color: C.textMuted, bg: "rgba(255,255,255,0.05)" },
  pro: { label: "Pro", color: "#a78bfa", bg: "rgba(124,58,237,0.15)" },
  elite: { label: "Elite", color: "#fbbf24", bg: "rgba(245,158,11,0.15)" },
  enterprise: { label: "Enterprise", color: "#6ee7b7", bg: "rgba(16,185,129,0.15)" },
};

const QUICK_ACTIONS = [
  { plan: "elite", trial: true, label: "Trial 1 mes" },
  { plan: "elite", trial: false, label: "Elite" },
  { plan: "pro", trial: false, label: "Pro" },
  { plan: "free", trial: false, label: "Free" },
];

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formPlan, setFormPlan] = useState("elite");
  const [formTrial, setFormTrial] = useState(true);
  const [formDays, setFormDays] = useState(30);
  const [formLoading, setFormLoading] = useState(false);

  async function loadUsers() {
    try {
      const res = await fetch("/api/v1/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/set-plan");
        const data = await res.json();
        setIsAdmin(!!data.isAdmin);
        setSessionEmail(data.email ?? null);
        if (data.isAdmin) await loadUsers();
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const trialUsers = useMemo(() => users.filter((u) => u.status === "trial"), [users]);

  async function doApply(email: string, plan: string, trial: boolean, days = 30) {
    setApplying(email);
    setFlash(null);
    try {
      const res = await fetch("/api/v1/admin/set-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan, trial, days }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash({ type: "err", text: data.error || "Error" });
      } else {
        const suffix = data.status === "trial" ? ` · Trial de ${days}d (quedan ${data.daysLeft} días)` : "";
        setFlash({ type: "ok", text: `Plan ${data.plan.toUpperCase()} aplicado a ${data.email}${suffix}` });
      }
    } catch (err: any) {
      setFlash({ type: "err", text: err?.message || "Error de red" });
    } finally {
      setApplying(null);
      await loadUsers();
    }
  }

  async function applyFromForm() {
    if (!formEmail) return;
    setFormLoading(true);
    try {
      await doApply(formEmail, formPlan, formTrial, formDays);
    } finally {
      setFormLoading(false);
    }
  }

  async function doSearch() {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } finally {
      setSearchLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.textSecondary, fontFamily: "system-ui, sans-serif" }}>
        Verificando...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.negative, fontFamily: "system-ui, sans-serif", flexDirection: "column", gap: "8px", padding: "24px", textAlign: "center" }}>
        <div>No autorizado — no eres administrador.</div>
        {sessionEmail ? (
          <div style={{ color: C.textMuted, fontSize: "13px" }}>
            Sesión actual: <strong>{sessionEmail}</strong>. Si este es tu correo, recarga en unos minutos.
          </div>
        ) : (
          <button onClick={() => signOut()} style={{ marginTop: "8px", padding: "8px 16px", borderRadius: "10px", border: `1px solid ${C.accent}`, background: "transparent", color: C.accentLight, cursor: "pointer" }}>
            Iniciar sesión / cambiar cuenta
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textSecondary, fontFamily: "system-ui, -apple-system, sans-serif", padding: "32px 20px" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
          <div>
            <h1 style={{ color: C.textPrimary, fontSize: "30px", margin: "0 0 4px" }}>Panel de Administración</h1>
            <p style={{ margin: 0, fontSize: "13px", color: C.textMuted }}>
              Admin: <strong style={{ color: C.accentLight }}>{sessionEmail}</strong> · Plan Enterprise
            </p>
          </div>
          <button
            onClick={() => signOut()}
            style={{ padding: "8px 14px", borderRadius: "10px", border: `1px solid ${C.border}`, background: C.bgElevated, color: C.textSecondary, cursor: "pointer", fontSize: "13px" }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* Flash */}
        {flash && (
          <div style={{
            marginBottom: "20px", padding: "12px 16px", borderRadius: "10px", fontSize: "14px",
            background: flash.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: flash.type === "ok" ? "#6ee7b7" : "#fca5a5",
            border: `1px solid ${flash.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            {flash.text}
          </div>
        )}

        {/* Buscar usuario */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ color: C.textPrimary, fontSize: "18px", margin: "0 0 10px" }}>🔍 Buscar usuario</h2>
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Buscar por email..."
              style={{
                flex: 1, padding: "10px 12px", borderRadius: "10px",
                background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "14px",
              }}
            />
            <button
              onClick={doSearch}
              disabled={searchLoading}
              style={{
                padding: "10px 18px", borderRadius: "10px", cursor: searchLoading ? "not-allowed" : "pointer",
                background: C.accent, color: C.textPrimary, border: "none", fontWeight: 600, opacity: searchLoading ? 0.5 : 1,
              }}
            >
              {searchLoading ? "..." : "Buscar"}
            </button>
          </div>

          {/* Tabla de usuarios */}
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: "14px", background: C.bgElevated }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.textMuted, fontSize: "12px", textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 14px" }}>Usuario</th>
                  <th style={{ padding: "10px 14px" }}>Plan</th>
                  <th style={{ padding: "10px 14px" }}>Trial</th>
                  <th style={{ padding: "10px 14px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: C.textMuted }}>Sin usuarios que cumplan la búsqueda.</td>
                  </tr>
                )}
                {users.map((u) => {
                  const badge = PLAN_BADGES[u.plan] ?? PLAN_BADGES.free;
                  const isTrial = u.status === "trial";
                  return (
                    <tr key={u.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 14px", color: C.textPrimary }}>
                        <div>{u.email ?? "—"}</div>
                        {u.name && <div style={{ fontSize: "11px", color: C.textMuted }}>{u.name}</div>}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, color: badge.color, background: badge.bg, border: `1px solid ${badge.color}40` }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: C.textSecondary }}>
                        {isTrial ? (
                          <span style={{ color: "#fbbf24" }}>
                            {u.trialDaysLeft !== null && u.trialDaysLeft > 0 ? `${u.trialDaysLeft}d` : "expirado"}
                          </span>
                        ) : (
                          <span style={{ color: C.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {QUICK_ACTIONS.map((a) => (
                              <button
                                key={a.label}
                                disabled={applying === u.email}
                                onClick={() => doApply(u.email!, a.plan, a.trial, 30)}
                                style={{
                                  padding: "5px 10px", borderRadius: "8px", cursor: applying === u.email ? "wait" : "pointer",
                                  background: a.trial ? "rgba(245,158,11,0.12)" : C.bg,
                                  border: `1px solid ${a.trial ? "rgba(245,158,11,0.4)" : C.border}`,
                                  color: a.trial ? "#fbbf24" : C.textSecondary, fontSize: "12px",
                                  opacity: applying === u.email ? 0.5 : 1,
                                }}
                              >
                                {applying === u.email ? "..." : a.label}
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Otorgar por email (manual) */}
        <section style={{ marginBottom: "24px", background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "20px" }}>
          <h2 style={{ color: C.textPrimary, fontSize: "18px", margin: "0 0 14px" }}>✉️ Otorgar plan por email</h2>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="usuario@correo.com"
              style={{
                flex: "1 1 220px", padding: "10px 12px", borderRadius: "10px",
                background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "14px",
              }}
            />
            <select
              value={formPlan}
              onChange={(e) => setFormPlan(e.target.value)}
              style={{
                padding: "10px 12px", borderRadius: "10px", background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "14px",
              }}
            >
              {Object.keys(PLAN_BADGES).map((p) => (
                <option key={p} value={p}>{PLAN_BADGES[p].label}</option>
              ))}
            </select>
            <button
              onClick={applyFromForm}
              disabled={formLoading || !formEmail}
              style={{
                padding: "10px 16px", borderRadius: "10px", cursor: !formEmail ? "not-allowed" : "pointer",
                background: C.accent, color: C.textPrimary, border: "none", fontWeight: 600,
                opacity: !formEmail ? 0.5 : 1, fontSize: "14px",
              }}
            >
              {formLoading ? "..." : "Aplicar"}
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginTop: "12px" }}>
            <input
              type="checkbox"
              checked={formTrial}
              onChange={(e) => setFormTrial(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: C.accent }}
            />
            <span style={{ fontSize: "14px", color: C.textPrimary }}>Como trial</span>
            {formTrial && (
              <input
                type="number"
                min={1}
                max={365}
                value={formDays}
                onChange={(e) => setFormDays(Number(e.target.value))}
                style={{
                  width: "90px", padding: "6px 10px", borderRadius: "8px",
                  background: C.bg, border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "13px",
                }}
              />
            )}
            {formTrial && <span style={{ fontSize: "13px", color: C.textMuted }}>días (por defecto: 1 mes)</span>}
          </label>
        </section>

        {/* Trials activos */}
        <section style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "20px" }}>
          <h2 style={{ color: C.textPrimary, fontSize: "18px", margin: "0 0 12px" }}>
            🎁 Trials activos ({trialUsers.length})
          </h2>
          {trialUsers.length === 0 ? (
            <p style={{ margin: 0, color: C.textMuted, fontSize: "14px" }}>No hay trials activos.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {trialUsers.map((u) => {
                const badge = PLAN_BADGES[u.plan];
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderRadius: "10px", background: C.bg, border: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: C.textPrimary, fontSize: "14px" }}>{u.email}</div>
                      <div style={{ fontSize: "12px", color: C.textMuted }}>
                        Plan <span style={{ color: badge.color }}>{badge.label}</span> · Trial de 1 mes
                        {u.trialEndsAt && (
                          <> · Finaliza el {new Date(u.trialEndsAt).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</>
                        )}
                      </div>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, color: "#fbbf24", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)" }}>
                      {u.trialDaysLeft !== null && u.trialDaysLeft > 0 ? `quedan ${u.trialDaysLeft} ${u.trialDaysLeft === 1 ? "día" : "días"}` : "expirado"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}