import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createCheckoutSession, PlanTier } from "@/src/lib/payments/stripe";
import { z } from "zod";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { plan } = checkoutSchema.parse(body);

    const url = await createCheckoutSession(
      session.user.id,
      session.user.email,
      plan as PlanTier
    );

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("[Payments] Checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
