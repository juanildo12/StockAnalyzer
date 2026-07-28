import { readFileSync } from "fs";
import { join } from "path";
import { ImageResponse } from "@vercel/og";
import { ShareTrigger, ProspectPickTrigger } from "./types";
import { SHARE_CONFIG } from "./config";

const FONT_PATH = join(process.cwd(), "public", "fonts", "Inter-Bold.ttf");
const FONT_MEDIUM_PATH = join(process.cwd(), "public", "fonts", "Inter-Medium.ttf");

let fontBoldBuffer: ArrayBuffer | null = null;
let fontMediumBuffer: ArrayBuffer | null = null;

function loadFonts() {
  if (!fontBoldBuffer) {
    try {
      fontBoldBuffer = readFileSync(FONT_PATH).buffer;
    } catch {
      fontBoldBuffer = new ArrayBuffer(0);
    }
  }
  if (!fontMediumBuffer) {
    try {
      fontMediumBuffer = readFileSync(FONT_MEDIUM_PATH).buffer;
    } catch {
      fontMediumBuffer = new ArrayBuffer(0);
    }
  }
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#0d9488";
  if (grade.startsWith("B")) return "#0891b2";
  if (grade.startsWith("C")) return "#d97706";
  return "#dc2626";
}

function buildCardJsx(trigger: ShareTrigger) {
  const gc = gradeColor(trigger.grade);
  const returnStr =
    trigger.returnPct >= 0
      ? `+${trigger.returnPct.toFixed(1)}%`
      : `${trigger.returnPct.toFixed(1)}%`;
  const returnColor = trigger.returnPct >= 0 ? "#22c55e" : "#ef4444";
  const hitEmoji = trigger.hitType === "TP1" ? "🎯" : "🏆";

  return {
    type: "div",
    props: {
      children: [
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: "◆", style: { fontSize: 22, fontWeight: 800, color: "#ffffff" } } },
              {
                type: "div",
                props: {
                  children: [
                    { type: "div", props: { children: "Prospector", style: { fontSize: 18, fontWeight: 700, color: "#f0f6fc", letterSpacing: "-0.5px" } } },
                    { type: "div", props: { children: "Quantitative Trading Platform", style: { fontSize: 11, color: "#8b949e", marginTop: 1 } } },
                  ],
                  style: { display: "flex", flexDirection: "column", gap: 2 },
                },
              },
            ],
            style: { display: "flex", alignItems: "center", gap: 14, padding: "28px 40px", borderBottom: "1px solid #21262d" },
          },
        },
        {
          type: "div",
          props: {
            children: [
              {
                type: "div",
                props: {
                  children: [
                    { type: "div", props: { children: `${hitEmoji} ${trigger.hitType} REACHED`, style: { fontSize: 12, fontWeight: 700, color: gc, textTransform: "uppercase", letterSpacing: "0.1em" } } },
                    { type: "div", props: { children: trigger.symbol, style: { fontSize: 56, fontWeight: 800, color: "#f0f6fc", letterSpacing: "-2px", lineHeight: 1, marginTop: 8 } } },
                    { type: "div", props: { children: returnStr, style: { fontSize: 42, fontWeight: 800, color: returnColor, marginTop: 4, fontVariantNumeric: "tabular-nums" } } },
                    { type: "div", props: { children: `$${trigger.entryPrice.toFixed(2)} → $${trigger.hitPrice.toFixed(2)}`, style: { fontSize: 16, color: "#8b949e", marginTop: 8, fontVariantNumeric: "tabular-nums" } } },
                  ],
                  style: { display: "flex", flexDirection: "column", flex: 1 },
                },
              },
              {
                type: "div",
                props: {
                  children: [
                    {
                      type: "div",
                      props: {
                        children: [
                          { type: "div", props: { children: "GRADE", style: { fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em" } } },
                          { type: "div", props: { children: trigger.grade, style: { fontSize: 32, fontWeight: 800, color: gc, marginTop: 4 } } },
                        ],
                        style: { padding: "16px 20px", background: "#161b22", borderRadius: 12, border: `1px solid ${gc}30`, display: "flex", flexDirection: "column" },
                      },
                    },
                    {
                      type: "div",
                      props: {
                        children: [
                          { type: "div", props: { children: "SCORE", style: { fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em" } } },
                          { type: "div", props: { children: `${trigger.score}/100`, style: { fontSize: 24, fontWeight: 700, color: "#f0f6fc", marginTop: 4, fontVariantNumeric: "tabular-nums" } } },
                        ],
                        style: { padding: "14px 20px", background: "#161b22", borderRadius: 12, border: "1px solid #21262d", display: "flex", flexDirection: "column" },
                      },
                    },
                    {
                      type: "div",
                      props: {
                        children: [
                          {
                            type: "div",
                            props: {
                              children: [
                                { type: "div", props: { children: [
                                  { type: "div", props: { children: "R/R", style: { fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em" } } },
                                  { type: "div", props: { children: `${trigger.riskReward.toFixed(1)}:1`, style: { fontSize: 18, fontWeight: 700, color: "#f0f6fc", marginTop: 2, fontVariantNumeric: "tabular-nums" } } },
                                ], style: { display: "flex", flexDirection: "column" } } },
                                { type: "div", props: { children: [
                                  { type: "div", props: { children: "HELD", style: { fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.08em" } } },
                                  { type: "div", props: { children: `${trigger.heldDays}d`, style: { fontSize: 18, fontWeight: 700, color: "#f0f6fc", marginTop: 2 } } },
                                ], style: { display: "flex", flexDirection: "column" } } },
                              ],
                              style: { display: "flex", justifyContent: "space-between", gap: 16 },
                            },
                          },
                        ],
                        style: { padding: "14px 20px", background: "#161b22", borderRadius: 12, border: "1px solid #21262d", display: "flex", flexDirection: "column" },
                      },
                    },
                  ],
                  style: { display: "flex", flexDirection: "column", gap: 8, width: 220, flexShrink: 0 },
                },
              },
            ],
            style: { display: "flex", gap: 32, padding: "32px 40px", flex: 1 },
          },
        },
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: "Powered by 12-factor quantitative scoring engine", style: { fontSize: 11, color: "#484f58" } } },
              { type: "div", props: { children: "prospector.com", style: { fontSize: 11, color: "#8b949e", fontWeight: 600 } } },
            ],
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 40px", borderTop: "1px solid #21262d" },
          },
        },
      ],
      style: {
        display: "flex",
        flexDirection: "column",
        width: SHARE_CONFIG.cardWidth,
        height: SHARE_CONFIG.cardHeight,
        background: "#0d1117",
        fontFamily: "Inter",
      },
    },
  };
}

export async function generateShareCard(trigger: ShareTrigger): Promise<Buffer> {
  loadFonts();

  const fonts: { name: string; data: ArrayBuffer; weight: number; style: string }[] = [];
  if (fontBoldBuffer && fontBoldBuffer.byteLength > 0) {
    fonts.push({ name: "Inter", data: fontBoldBuffer, weight: 700, style: "normal" });
  }
  if (fontMediumBuffer && fontMediumBuffer.byteLength > 0) {
    fonts.push({ name: "Inter", data: fontMediumBuffer, weight: 500, style: "normal" });
  }

  const jsx = buildCardJsx(trigger);

  const res = new ImageResponse(jsx as any, {
    width: SHARE_CONFIG.cardWidth,
    height: SHARE_CONFIG.cardHeight,
    fonts: fonts.length > 0 ? fonts : undefined,
  });

  return Buffer.from(await res.arrayBuffer());
}

export function generateShareCaption(trigger: ShareTrigger, platform: "twitter" | "linkedin" | "discord"): string {
  const { CAPTION_TEMPLATES } = require("./config");
  return CAPTION_TEMPLATES[platform](trigger);
}

// ── Prospect Pick Card ──────────────────────────────────────────────────────

function getGradeInfo(score: number): { label: string; color: string; stars: string } {
  if (score >= 90) return { label: "Elite Setup", color: "#2DD4BF", stars: "★★★★★" };
  if (score >= 80) return { label: "Strong Setup", color: "#34D399", stars: "★★★★☆" };
  if (score >= 70) return { label: "Good Setup", color: "#67E8F9", stars: "★★★☆☆" };
  return { label: "Fair Setup", color: "#FBBF24", stars: "★★☆☆☆" };
}

function buildProspectPickJsx(trigger: ProspectPickTrigger) {
  const grade = getGradeInfo(trigger.score);
  const isCall = trigger.direction === "CALL";
  const dirColor = isCall ? "#34D399" : "#FB7185";
  const expDate = trigger.contract?.expiration
    ? new Date(trigger.contract.expiration).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "N/A";

  const reasonsBlock = trigger.reasons.slice(0, 5).map((r) => ({
    type: "div" as const,
    props: {
      children: [
        { type: "span", props: { children: "✓", style: { color: "#34D399", fontWeight: 700, marginRight: 8 } } },
        { type: "span", props: { children: r, style: { color: "#8b949e", fontSize: 13 } } },
      ],
      style: { display: "flex", alignItems: "center", marginBottom: 4 },
    },
  }));

  return {
    type: "div",
    props: {
      children: [
        // Header glow line
        {
          type: "div",
          props: {
            style: { height: 2, background: "linear-gradient(90deg, transparent, #2DD4BF, transparent)" },
          },
        },
        // Header
        {
          type: "div",
          props: {
            children: [
              { type: "span", props: { children: "🎯", style: { fontSize: 28 } } },
              { type: "span", props: { children: "PROSPECT PICK", style: { fontSize: 22, fontWeight: 800, color: "#E8EAF0", letterSpacing: 4 } } },
            ],
            style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "20px 40px 16px" },
          },
        },
        // Divider
        { type: "div", props: { style: { height: 1, background: "#21262d", margin: "0 40px" } } },
        // Ticker + Company
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: trigger.symbol, style: { fontSize: 56, fontWeight: 800, color: "#E8EAF0", letterSpacing: "-2px", lineHeight: 1 } } },
              { type: "div", props: { children: trigger.company, style: { fontSize: 14, color: "#8B90A5", marginTop: 6 } } },
              { type: "div", props: { children: `${grade.stars} ${grade.label}`, style: { fontSize: 13, fontWeight: 600, color: grade.color, marginTop: 10, padding: "4px 12px", borderRadius: 999, border: `1px solid ${grade.color}40` } } },
            ],
            style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 40px 16px" },
          },
        },
        // Score + Confidence
        {
          type: "div",
          props: {
            children: [
              {
                type: "div",
                props: {
                  children: [
                    { type: "div", props: { children: "PROSPECT SCORE", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.8px" } } },
                    { type: "div", props: { children: `${trigger.score}/100`, style: { fontSize: 28, fontWeight: 800, color: grade.color, fontVariantNumeric: "tabular-nums" } } },
                  ],
                  style: { flex: 1, textAlign: "center" },
                },
              },
              { type: "div", props: { style: { width: 1, height: 40, background: "#21262d" } } },
              {
                type: "div",
                props: {
                  children: [
                    { type: "div", props: { children: "CONFIDENCE", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.8px" } } },
                    { type: "div", props: { children: `${trigger.confidence}%`, style: { fontSize: 28, fontWeight: 800, color: grade.color, fontVariantNumeric: "tabular-nums" } } },
                  ],
                  style: { flex: 1, textAlign: "center" },
                },
              },
            ],
            style: { display: "flex", alignItems: "center", padding: "16px 40px" },
          },
        },
        // Divider
        { type: "div", props: { style: { height: 1, background: "#21262d", margin: "0 40px" } } },
        // Direction badge
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: trigger.direction, style: { fontSize: 18, fontWeight: 800, color: dirColor, padding: "6px 32px", borderRadius: 8, border: `1px solid ${dirColor}40`, background: `${dirColor}18`, letterSpacing: 3 } } },
            ],
            style: { display: "flex", justifyContent: "center", padding: "16px 40px" },
          },
        },
        // Divider
        { type: "div", props: { style: { height: 1, background: "#21262d", margin: "0 40px" } } },
        // Entry / Stop / Target / R/R
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: [
                { type: "div", props: { children: "ENTRY", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 } } },
                { type: "div", props: { children: `$${trigger.entry.toFixed(2)}`, style: { fontSize: 16, fontWeight: 700, color: "#E8EAF0", fontVariantNumeric: "tabular-nums" } } },
              ], style: { flex: 1, textAlign: "center", background: "#161b22", borderRadius: 8, padding: "10px 4px" } } },
              { type: "div", props: { children: [
                { type: "div", props: { children: "STOP", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 } } },
                { type: "div", props: { children: `$${trigger.stop.toFixed(2)}`, style: { fontSize: 16, fontWeight: 700, color: "#FB7185", fontVariantNumeric: "tabular-nums" } } },
              ], style: { flex: 1, textAlign: "center", background: "#161b22", borderRadius: 8, padding: "10px 4px" } } },
              { type: "div", props: { children: [
                { type: "div", props: { children: "TARGET", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 } } },
                { type: "div", props: { children: `$${trigger.target.toFixed(2)}`, style: { fontSize: 16, fontWeight: 700, color: "#34D399", fontVariantNumeric: "tabular-nums" } } },
              ], style: { flex: 1, textAlign: "center", background: "#161b22", borderRadius: 8, padding: "10px 4px" } } },
              { type: "div", props: { children: [
                { type: "div", props: { children: "R/R", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 } } },
                { type: "div", props: { children: `${trigger.riskReward.toFixed(1)}`, style: { fontSize: 16, fontWeight: 700, color: grade.color, fontVariantNumeric: "tabular-nums" } } },
              ], style: { flex: 1, textAlign: "center", background: "#161b22", borderRadius: 8, padding: "10px 4px" } } },
            ],
            style: { display: "flex", padding: "16px 40px", gap: 8 },
          },
        },
        // Options Contract
        ...(trigger.contract ? [
          { type: "div" as const, props: { style: { height: 1, background: "#21262d", margin: "0 40px" } } },
          {
            type: "div" as const,
            props: {
              children: [
                { type: "div", props: { children: [
                  { type: "span", props: { children: "📊", style: { marginRight: 8 } } },
                  { type: "span", props: { children: "OPTIONS CONTRACT", style: { fontSize: 13, fontWeight: 700, color: "#8B90A5", textTransform: "uppercase", letterSpacing: "0.8px" } } },
                ], style: { display: "flex", alignItems: "center", marginBottom: 12 } } },
                {
                  type: "div",
                  props: {
                    children: [
                      { type: "div", props: { children: [
                        { type: "div", props: { children: "STRIKE", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 } } },
                        { type: "div", props: { children: `$${trigger.contract.strike.toFixed(2)}`, style: { fontSize: 14, fontWeight: 700, color: "#E8EAF0", fontVariantNumeric: "tabular-nums" } } },
                      ], style: { background: "#161b22", borderRadius: 8, padding: "8px 10px", flex: 1 } } },
                      { type: "div", props: { children: [
                        { type: "div", props: { children: "EXP", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 } } },
                        { type: "div", props: { children: expDate, style: { fontSize: 14, fontWeight: 700, color: "#E8EAF0" } } },
                      ], style: { background: "#161b22", borderRadius: 8, padding: "8px 10px", flex: 1 } } },
                      { type: "div", props: { children: [
                        { type: "div", props: { children: "PREMIUM", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 } } },
                        { type: "div", props: { children: `$${trigger.contract.premium.toFixed(2)}`, style: { fontSize: 14, fontWeight: 700, color: "#FBBF24", fontVariantNumeric: "tabular-nums" } } },
                      ], style: { background: "#161b22", borderRadius: 8, padding: "8px 10px", flex: 1 } } },
                      { type: "div", props: { children: [
                        { type: "div", props: { children: "DELTA", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 } } },
                        { type: "div", props: { children: trigger.contract.delta != null ? trigger.contract.delta.toFixed(2) : "N/A", style: { fontSize: 14, fontWeight: 700, color: "#E8EAF0", fontVariantNumeric: "tabular-nums" } } },
                      ], style: { background: "#161b22", borderRadius: 8, padding: "8px 10px", flex: 1 } } },
                    ],
                    style: { display: "flex", gap: 8 },
                  },
                },
              ],
              style: { padding: "16px 40px" },
            },
          },
        ] : []),
        // Divider
        { type: "div", props: { style: { height: 1, background: "#21262d", margin: "0 40px" } } },
        // Why today?
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: "Why today?", style: { fontSize: 14, fontWeight: 700, color: "#E8EAF0", marginBottom: 10 } } },
              ...reasonsBlock,
            ],
            style: { padding: "16px 40px" },
          },
        },
        // Divider
        { type: "div", props: { style: { height: 1, background: "#21262d", margin: "0 40px" } } },
        // Footer
        {
          type: "div",
          props: {
            children: [
              {
                type: "div",
                props: {
                  children: [
                    { type: "div", props: { children: "GENERATED", style: { fontSize: 10, fontWeight: 600, color: "#555A70", textTransform: "uppercase", letterSpacing: "0.5px" } } },
                    { type: "div", props: { children: new Date().toLocaleDateString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" }), style: { fontSize: 13, color: "#8B90A5", marginTop: 2 } } },
                  ],
                },
              },
              { type: "div", props: { children: "🔒 LOCKED TODAY", style: { fontSize: 12, fontWeight: 800, color: "#2DD4BF", letterSpacing: 1, textTransform: "uppercase", background: "rgba(45, 212, 191, 0.1)", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(45, 212, 191, 0.25)" } } },
            ],
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px" },
          },
        },
        // Bottom branding
        {
          type: "div",
          props: {
            children: [
              { type: "div", props: { children: "Powered by AI-powered multi-source analysis", style: { fontSize: 11, color: "#484f58" } } },
              { type: "div", props: { children: "prospector.com", style: { fontSize: 11, color: "#8b949e", fontWeight: 600 } } },
            ],
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 40px", borderTop: "1px solid #21262d" },
          },
        },
      ],
      style: {
        display: "flex",
        flexDirection: "column",
        width: SHARE_CONFIG.cardWidth,
        height: SHARE_CONFIG.cardHeight,
        background: "#0d1117",
        fontFamily: "Inter",
      },
    },
  };
}

export async function generateProspectPickCard(trigger: ProspectPickTrigger): Promise<Buffer> {
  loadFonts();

  const fonts: { name: string; data: ArrayBuffer; weight: number; style: string }[] = [];
  if (fontBoldBuffer && fontBoldBuffer.byteLength > 0) {
    fonts.push({ name: "Inter", data: fontBoldBuffer, weight: 700, style: "normal" });
  }
  if (fontMediumBuffer && fontMediumBuffer.byteLength > 0) {
    fonts.push({ name: "Inter", data: fontMediumBuffer, weight: 500, style: "normal" });
  }

  const jsx = buildProspectPickJsx(trigger);

  const res = new ImageResponse(jsx as any, {
    width: SHARE_CONFIG.cardWidth,
    height: SHARE_CONFIG.cardHeight,
    fonts: fonts.length > 0 ? fonts : undefined,
  });

  return Buffer.from(await res.arrayBuffer());
}

export function generateProspectPickCaption(trigger: ProspectPickTrigger): string {
  const emoji = trigger.direction === "CALL" ? "📈" : "📉";
  const contractStr = trigger.contract
    ? `Strike $${trigger.contract.strike} | Exp ${new Date(trigger.contract.expiration).toLocaleDateString("en-US", { month: "short", day: "numeric" })} | Premium $${trigger.contract.premium.toFixed(2)}`
    : "";
  return `${emoji} I just picked $${trigger.symbol} — ${trigger.direction}\n\nScore: ${trigger.score}/100 | Confidence: ${trigger.confidence}%\nEntry: $${trigger.entry.toFixed(2)} → Target: $${trigger.target.toFixed(2)} | R/R ${trigger.riskReward.toFixed(1)}:1\n${contractStr}\n\n#OptionsTrading #ProspectorPick`;
}
