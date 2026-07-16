import { ShareTrigger, ShareResult } from "../types";
import { CAPTION_TEMPLATES } from "../config";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function shareOnDiscord(
  trigger: ShareTrigger,
  imageBuffer: Buffer
): Promise<ShareResult> {
  if (!WEBHOOK_URL) {
    return { platform: "discord", success: false, error: "Discord webhook not configured" };
  }

  try {
    const caption = CAPTION_TEMPLATES.discord(trigger);

    const returnColor =
      trigger.returnPct >= 0 ? 0x22c55e : 0xef4444;
    const gradeEmoji =
      trigger.grade.startsWith("A") ? "🟢" :
      trigger.grade.startsWith("B") ? "🔵" :
      trigger.grade.startsWith("C") ? "🟡" : "🔴";

    const formData = new FormData();
    formData.append("payload_json", JSON.stringify({
      content: caption,
      embeds: [{
        title: `${trigger.symbol} — ${trigger.hitType} Reached`,
        color: returnColor,
        fields: [
          { name: "Return", value: `${trigger.returnPct >= 0 ? "+" : ""}${trigger.returnPct.toFixed(1)}%`, inline: true },
          { name: "Grade", value: `${gradeEmoji} ${trigger.grade} (${trigger.score}/100)`, inline: true },
          { name: "R/R", value: `${trigger.riskReward.toFixed(1)}:1`, inline: true },
          { name: "Entry", value: `$${trigger.entryPrice.toFixed(2)}`, inline: true },
          { name: "Exit", value: `$${trigger.hitPrice.toFixed(2)}`, inline: true },
          { name: "Hold", value: `${trigger.heldDays}d`, inline: true },
        ],
        footer: {
          text: "BreakoutFinder — Quantitative Trading",
        },
        timestamp: new Date().toISOString(),
      }],
    }));

    // Attach image
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
    formData.append("files[0]", blob, `${trigger.symbol}-${trigger.hitType}.png`);

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      return { platform: "discord", success: false, error: `Webhook failed: ${err}` };
    }

    return {
      platform: "discord",
      success: true,
      postId: `webhook-${Date.now()}`,
    };
  } catch (error) {
    return {
      platform: "discord",
      success: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
