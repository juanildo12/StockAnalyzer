import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, handleWebhook } from "@/src/lib/payments/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("x-signature");

  if (!verifyWebhookSignature(body, sig)) {
    console.error("[LemonSqueezy Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleWebhook(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[LemonSqueezy Webhook] Error handling event:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
