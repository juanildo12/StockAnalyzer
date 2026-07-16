import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ratelimit } from "@/src/lib/rateLimit";

const PLAN_ROUTES: Record<string, string[]> = {
  // Routes that require a specific minimum plan
  starter: [
    "/api/v1/options",
    "/api/v1/options-chain",
    "/api/v1/options-screener",
  ],
  pro: [
    "/api/v1/ai",
    "/api/v1/backtest",
  ],
};

function getRequiredPlan(pathname: string): string | null {
  for (const [plan, routes] of Object.entries(PLAN_ROUTES)) {
    if (routes.some((route) => pathname.startsWith(route))) {
      return plan;
    }
  }
  return null;
}

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // ─── Rate Limiting ───────────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
    const userId = token?.sub ?? ip;

    const { success, limit, reset, remaining } = await ratelimit.limit(
      `mw_${userId}`
    );

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          limit,
          remaining,
          reset: new Date(reset * 1000).toISOString(),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    // ─── API Route Protection ────────────────────────────────────────
    if (pathname.startsWith("/api/v1/")) {
      // Public v1 routes — skip auth check
      const isPublicV1 =
        pathname.startsWith("/api/v1/stock") ||
        pathname.startsWith("/api/v1/market") ||
        pathname.startsWith("/api/v1/ai") ||
        pathname.startsWith("/api/v1/score") ||
        pathname.startsWith("/api/v1/screener") ||
        pathname.startsWith("/api/v1/morning-briefing") ||
        pathname === "/api/v1/jobs";

      if (!isPublicV1 && !token) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Plan-based access control (only for authenticated users)
      if (!isPublicV1 && token) {
        const requiredPlan = getRequiredPlan(pathname);
        if (requiredPlan) {
          const userPlan = (token as any)?.plan || "free";
          const requiredLevel = PLAN_HIERARCHY[requiredPlan] || 0;
          const userLevel = PLAN_HIERARCHY[userPlan] || 0;

          if (userLevel < requiredLevel) {
            return NextResponse.json(
              {
                error: "Subscription required",
                required: requiredPlan,
                current: userPlan,
                upgradeUrl: "/settings/billing",
              },
              { status: 403 }
            );
          }
        }
      }
    }

    // ─── Add headers ─────────────────────────────────────────────────
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public routes — no auth required
        if (
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/stock") ||
          pathname.startsWith("/api/signal") ||
          pathname.startsWith("/api/screener") ||
          pathname.startsWith("/api/market") ||
          pathname.startsWith("/api/morning-briefing") ||
          pathname === "/api/health"
        ) {
          return true;
        }

        // v1 stock/market/jobs/ai are public (read-only data)
        if (
          pathname.startsWith("/api/v1/stock") ||
          pathname.startsWith("/api/v1/market") ||
          pathname.startsWith("/api/v1/ai") ||
          pathname.startsWith("/api/v1/score") ||
          pathname.startsWith("/api/v1/screener") ||
          pathname.startsWith("/api/v1/morning-briefing") ||
          pathname === "/api/v1/jobs"
        ) {
          return true;
        }

        // All other API routes require auth
        if (pathname.startsWith("/api/")) {
          return !!token;
        }

        // All page routes are public
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
