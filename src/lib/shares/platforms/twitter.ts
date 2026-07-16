import { ShareTrigger, ShareResult } from "../types";
import { CAPTION_TEMPLATES } from "../config";

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const API_KEY = process.env.TWITTER_API_KEY;
const API_SECRET = process.env.TWITTER_API_SECRET;
const ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

export async function shareOnTwitter(
  trigger: ShareTrigger,
  imageBuffer: Buffer
): Promise<ShareResult> {
  if (!BEARER_TOKEN || !API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_SECRET) {
    return { platform: "twitter", success: false, error: "Twitter credentials not configured" };
  }

  try {
    // 1. Get upload token
    const initRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
      method: "POST",
      headers: {
        Authorization: `OAuth oauth_consumer_key="${API_KEY}",oauth_token="${ACCESS_TOKEN}"`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        command: "INIT",
        total_bytes: String(imageBuffer.length),
        media_type: "image/png",
      }).toString(),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      return { platform: "twitter", success: false, error: `Upload init failed: ${err}` };
    }

    const init = await initRes.json();
    const mediaId = init.media_id_string;

    // 2. Append media
    const formData = new FormData();
    formData.append("command", "APPEND");
    formData.append("media_id", mediaId);
    formData.append("segment_index", "0");
    formData.append("media_data", imageBuffer.toString("base64"));

    const appendRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
      method: "POST",
      headers: {
        Authorization: `OAuth oauth_consumer_key="${API_KEY}",oauth_token="${ACCESS_TOKEN}"`,
      },
      body: formData,
    });

    if (!appendRes.ok) {
      return { platform: "twitter", success: false, error: "Upload append failed" };
    }

    // 3. Finalize
    const finalizeRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
      method: "POST",
      headers: {
        Authorization: `OAuth oauth_consumer_key="${API_KEY}",oauth_token="${ACCESS_TOKEN}"`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        command: "FINALIZE",
        media_id: mediaId,
      }).toString(),
    });

    if (!finalizeRes.ok) {
      return { platform: "twitter", success: false, error: "Upload finalize failed" };
    }

    // 4. Create tweet with image
    const caption = CAPTION_TEMPLATES.twitter(trigger);

    const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: caption,
        media: { media_ids: [mediaId] },
      }),
    });

    if (!tweetRes.ok) {
      const err = await tweetRes.text();
      return { platform: "twitter", success: false, error: `Tweet failed: ${err}` };
    }

    const tweet = await tweetRes.json();
    const tweetId = tweet?.data?.id;

    return {
      platform: "twitter",
      success: true,
      postId: tweetId,
      postUrl: tweetId ? `https://x.com/i/status/${tweetId}` : undefined,
    };
  } catch (error) {
    return {
      platform: "twitter",
      success: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
