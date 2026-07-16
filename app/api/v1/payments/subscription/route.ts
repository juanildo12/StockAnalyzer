import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/src/lib/prisma";
import { PLANS, PlanTier } from "@/src/lib/payments/stripe";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscriptions.findUnique({
    where: { userId: session.user.id },
  });

  const plan = (subscription?.plan as PlanTier) || "free";
  const planConfig = PLANS[plan];

  return NextResponse.json({
    plan: plan,
    planName: planConfig.name,
    price: planConfig.price,
    features: planConfig.features,
    status: subscription?.status || "active",
    currentPeriodEnd: subscription?.currentPeriodEnd,
    cancelAt: subscription?.cancelAt,
  });
}
