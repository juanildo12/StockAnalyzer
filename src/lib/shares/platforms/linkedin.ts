import { ShareTrigger, ShareResult } from "../types";
import { CAPTION_TEMPLATES } from "../config";

const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const PERSON_URN = process.env.LINKEDIN_PERSON_URN;

export async function shareOnLinkedIn(
  trigger: ShareTrigger,
  imageBuffer: Buffer
): Promise<ShareResult> {
  if (!ACCESS_TOKEN || !PERSON_URN) {
    return { platform: "linkedin", success: false, error: "LinkedIn credentials not configured" };
  }

  try {
    // 1. Upload image to LinkedIn
    const uploadRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: PERSON_URN,
          serviceRelationships: [{
            relationshipType: "OWNER",
            protocol: "urn:li:digitalmediaProtocol:form-data-upload",
          }],
        },
      }),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return { platform: "linkedin", success: false, error: `Upload register failed: ${err}` };
    }

    const uploadData = await uploadRes.json();
    const uploadUrl = uploadData.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
    const asset = uploadData.value?.asset;

    if (!uploadUrl || !asset) {
      return { platform: "linkedin", success: false, error: "No upload URL returned" };
    }

    // 2. Upload binary
    const binaryRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "image/png",
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!binaryRes.ok) {
      return { platform: "linkedin", success: false, error: "Binary upload failed" };
    }

    // 3. Create post
    const caption = CAPTION_TEMPLATES.linkedin(trigger);

    const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author: PERSON_URN,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: caption },
            shareMediaCategory: "IMAGE",
            media: [{
              status: "READY",
              media: asset,
              title: { text: `${trigger.symbol} ${trigger.hitType} — ${trigger.returnPct >= 0 ? "+" : ""}${trigger.returnPct.toFixed(1)}%` },
              description: { text: `Score: ${trigger.score}/100 (Grade ${trigger.grade})` },
            }],
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      return { platform: "linkedin", success: false, error: `Post failed: ${err}` };
    }

    const post = await postRes.json();
    return {
      platform: "linkedin",
      success: true,
      postId: post.id,
      postUrl: `https://www.linkedin.com/feed/update/${post.id}`,
    };
  } catch (error) {
    return {
      platform: "linkedin",
      success: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
