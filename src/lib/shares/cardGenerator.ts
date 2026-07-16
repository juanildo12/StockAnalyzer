import { readFileSync } from "fs";
import { join } from "path";
import { ImageResponse } from "@vercel/og";
import { ShareTrigger } from "./types";
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
                    { type: "div", props: { children: "BreakoutFinder", style: { fontSize: 18, fontWeight: 700, color: "#f0f6fc", letterSpacing: "-0.5px" } } },
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
              { type: "div", props: { children: "breakoutfinder.com", style: { fontSize: 11, color: "#8b949e", fontWeight: 600 } } },
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
