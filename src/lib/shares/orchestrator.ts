import { prisma } from "@/src/lib/prisma";
import { ShareTrigger, ShareResult } from "./types";
import { SHARE_CONFIG } from "./config";
import { generateShareCard } from "./cardGenerator";
import { shareOnTwitter } from "./platforms/twitter";
import { shareOnLinkedIn } from "./platforms/linkedin";
import { shareOnDiscord } from "./platforms/discord";

export interface ShareDecision {
  shouldShare: boolean;
  reason?: string;
}

export function shouldShare(trigger: ShareTrigger): ShareDecision {
  if (trigger.score < SHARE_CONFIG.minScore) {
    return { shouldShare: false, reason: `Score ${trigger.score} < ${SHARE_CONFIG.minScore}` };
  }
  if (Math.abs(trigger.returnPct) < SHARE_CONFIG.minReturnPct) {
    return { shouldShare: false, reason: `Return ${trigger.returnPct}% < ${SHARE_CONFIG.minReturnPct}%` };
  }
  return { shouldShare: true };
}

export async function wasRecentlyShared(alertId: string): Promise<boolean> {
  const recent = await prisma.share_log.findFirst({
    where: {
      alertId,
      success: true,
      createdAt: { gte: new Date(Date.now() - SHARE_CONFIG.cooldownHours * 60 * 60 * 1000) },
    },
  });
  return !!recent;
}

export async function getDailyShareCount(platform: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const count = await prisma.share_log.count({
    where: {
      platform,
      success: true,
      createdAt: { gte: todayStart },
    },
  });

  return count;
}

export async function shareResult(
  trigger: ShareTrigger,
  platforms: ("twitter" | "linkedin" | "discord")[] = ["twitter", "discord"]
): Promise<ShareResult[]> {
  // Pre-checks
  const decision = shouldShare(trigger);
  if (!decision.shouldShare) {
    return [];
  }

  if (await wasRecentlyShared(trigger.alertId)) {
    return [];
  }

  // Generate card image
  let imageBuffer: Buffer;
  try {
    imageBuffer = await generateShareCard(trigger);
  } catch (error) {
    console.error(`[ShareEngine] Card generation failed:`, error);
    return [];
  }

  // Share to each platform
  const results: ShareResult[] = [];

  for (const platform of platforms) {
    // Check daily limit
    const dailyCount = await getDailyShareCount(platform);
    const limit = SHARE_CONFIG.maxPerDay[platform] || 5;
    if (dailyCount >= limit) {
      results.push({ platform, success: false, error: `Daily limit reached (${dailyCount}/${limit})` });
      continue;
    }

    let result: ShareResult;
    switch (platform) {
      case "twitter":
        result = await shareOnTwitter(trigger, imageBuffer);
        break;
      case "linkedin":
        result = await shareOnLinkedIn(trigger, imageBuffer);
        break;
      case "discord":
        result = await shareOnDiscord(trigger, imageBuffer);
        break;
      default:
        result = { platform: platform as any, success: false, error: "Unknown platform" };
    }

    // Log result
    await prisma.share_log.create({
      data: {
        alertId: trigger.alertId,
        symbol: trigger.symbol,
        platform,
        postId: result.postId || null,
        postUrl: result.postUrl || null,
        success: result.success,
        error: result.error || null,
      },
    });

    results.push(result);
  }

  return results;
}
