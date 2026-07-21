import { SmartAlert } from "./types";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Prospector <alerts@prospector.com>";

function riskColor(level: string): string {
  if (level === "Bajo") return "#0d9488";
  if (level === "Medio") return "#d97706";
  return "#dc2626";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#0d9488";
  if (grade.startsWith("B")) return "#0891b2";
  if (grade.startsWith("C")) return "#d97706";
  return "#dc2626";
}

export async function sendAlertEmail(alert: SmartAlert): Promise<boolean> {
  if (!RESEND_API_KEY) {
    return false;
  }

  // Get user email from DB
  const { prisma } = await import("@/src/lib/prisma");
  const user = await prisma.users.findUnique({
    where: { id: alert.userId },
    select: { email: true },
  });

  if (!user?.email) {
    return false;
  }

  const html = buildEmailHtml(alert);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: user.email,
        subject: `🔔 ${alert.symbol} — Score ${alert.score}/100 (${alert.grade}) — R/R ${alert.riskReward.toFixed(1)}:1`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[AlertDelivery] Resend error:`, err);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[AlertDelivery] Failed:`, error);
    return false;
  }
}

function buildEmailHtml(alert: SmartAlert): string {
  const rc = riskColor(alert.riskLevel);
  const gc = gradeColor(alert.grade);
  const entryPct = alert.entry > 0 ? (((alert.tp1 - alert.entry) / alert.entry) * 100).toFixed(1) : "0";
  const stopPct = alert.entry > 0 ? (((alert.stopLoss - alert.entry) / alert.entry) * 100).toFixed(1) : "0";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="padding:24px 24px 16px;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">Alerta Inteligente</div>
          <div style="font-size:28px;font-weight:800;color:#1e293b;margin-top:4px;">${alert.symbol}</div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block;padding:6px 12px;border:1.5px solid ${gc};border-radius:8px;">
            <span style="font-size:18px;font-weight:700;color:${gc};">${alert.grade}</span>
            <span style="font-size:12px;color:#64748b;margin-left:4px;">${alert.score}/100</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Entry Zone -->
    <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:12px;">Zona de Operacion</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Entrada</td>
          <td style="padding:8px 0;font-size:15px;font-weight:700;color:#1e293b;text-align:right;">$${alert.entry.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Stop Loss</td>
          <td style="padding:8px 0;font-size:15px;font-weight:700;color:#dc2626;text-align:right;">$${alert.stopLoss.toFixed(2)} (${stopPct}%)</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Take Profit 1</td>
          <td style="padding:8px 0;font-size:15px;font-weight:700;color:#0d9488;text-align:right;">$${alert.tp1.toFixed(2)} (+${entryPct}%)</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Take Profit 2</td>
          <td style="padding:8px 0;font-size:15px;font-weight:700;color:#0d9488;text-align:right;">$${alert.tp2.toFixed(2)}</td>
        </tr>
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:8px 0;font-size:13px;color:#64748b;">R/R Ratio</td>
          <td style="padding:8px 0;font-size:15px;font-weight:700;color:#1e293b;text-align:right;">${alert.riskReward.toFixed(1)}:1</td>
        </tr>
      </table>
    </div>

    <!-- Meta -->
    <div style="padding:16px 24px;border-bottom:1px solid #f1f5f9;display:flex;gap:16px;">
      <div style="flex:1;text-align:center;padding:10px;background:#f8fafc;border-radius:8px;">
        <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;">Confianza</div>
        <div style="font-size:18px;font-weight:700;color:#1e293b;margin-top:2px;">${alert.confidence}%</div>
      </div>
      <div style="flex:1;text-align:center;padding:10px;background:#f8fafc;border-radius:8px;">
        <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;">Riesgo</div>
        <div style="font-size:18px;font-weight:700;color:${rc};margin-top:2px;">${alert.riskLevel}</div>
      </div>
      <div style="flex:1;text-align:center;padding:10px;background:#f8fafc;border-radius:8px;">
        <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;">Tiempo</div>
        <div style="font-size:12px;font-weight:600;color:#1e293b;margin-top:4px;">${alert.tradeTime}</div>
      </div>
    </div>

    <!-- Top Factors -->
    <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:10px;">Factores Clave</div>
      ${alert.topFactors.slice(0, 4).map(f => {
        const [label, score] = f.split(": ");
        const s = parseInt(score || "0");
        const color = s >= 70 ? "#0d9488" : s >= 50 ? "#0891b2" : "#d97706";
        return `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;">
          <span style="color:#475569;">${s >= 60 ? "✅" : "⚠️"} ${label}</span>
          <span style="font-weight:600;color:${color};">${score}</span>
        </div>`;
      }).join("\n")}
    </div>

    ${alert.warnings.length > 0 ? `
    <!-- Warnings -->
    <div style="padding:16px 24px;border-bottom:1px solid #f1f5f9;background:#fffbeb;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#92400e;margin-bottom:8px;">Advertencias</div>
      ${alert.warnings.map(w => `<div style="font-size:12px;color:#92400e;padding:2px 0;">⚠ ${w}</div>`).join("\n")}
    </div>` : ""}

    <!-- Footer -->
    <div style="padding:16px 24px;text-align:center;">
      <div style="font-size:11px;color:#94a3b8;">
        Expira: ${alert.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        ${alert.expiresAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style="font-size:10px;color:#cbd5e1;margin-top:8px;">Prospector — Smart Alerts</div>
    </div>

  </div>
</body>
</html>`;
}
