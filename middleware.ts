import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Plan hierarchy: free(0) → pro(1) → elite(2) → enterprise(3) ───────────
const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  pro: 1,
  elite: 2,
  enterprise: 3,
};

const TIER_RATE_LIMITS: Record<string, [number, string]> = {
  free:      [30,  "60 s"],
  pro:       [120, "60 s"],
  elite:     [300, "60 s"],
  enterprise:[500, "60 s"],
};

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redis = Redis.fromEnv();
    }
  } catch {}
  return _redis;
}

// ─── Route → minimum plan mapping ────────────────────────────────────────────
// Options = Elite (deep analysis tools)
// AI + Backtest + Social Share = Pro (the "I can't trade without it" tier)
const PLAN_ROUTES: Record<string, string[]> = {
  pro: [
    "/api/v1/ai",
    "/api/v1/backtest",
    "/api/v1/signals",
    "/api/v1/alerts/smart",
  ],
  elite: [
    "/api/v1/options",
    "/api/v1/options-chain",
    "/api/v1/options-screener",
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

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const userPlan = (token as any)?.plan || "free";
    const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;

    // ─── Rate Limiting (plan-based) ──────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
    const userId = token?.sub ?? ip;
    const [limit, window] = TIER_RATE_LIMITS[userPlan] || TIER_RATE_LIMITS.free;

    let rlLimit = limit;
    let remaining = limit;
    let reset = Math.floor(Date.now() / 1000) + 60;

    const redis = getRedis();
    if (redis) {
      try {
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, window as any),
          analytics: true,
          prefix: `breakoutfinder:ratelimit:${userId}`,
        });

        const rlResult = await ratelimit.limit(`rl_${userId}`);
        remaining = rlResult.remaining;
        reset = rlResult.reset;
        rlLimit = rlResult.limit;

        if (!rlResult.success) {
          return NextResponse.json(
            {
              error: "Rate limit exceeded",
              limit: rlLimit,
              remaining,
              reset: new Date(reset * 1000).toISOString(),
              upgradeHint: userPlan === "free" ? "Upgrade to Pro for 120 req/min" : undefined,
            },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": rlLimit.toString(),
                "X-RateLimit-Remaining": remaining.toString(),
                "X-RateLimit-Reset": reset.toString(),
              },
            }
          );
        }
      } catch (err) {
        // Redis error — allow request through
        console.error("[Middleware] Rate limit error:", err);
      }
    }

    // ─── API Route Protection ────────────────────────────────────────────────
    if (pathname.startsWith("/api/v1/")) {
      // Public v1 routes — no auth required
      const isPublicV1 =
        pathname.startsWith("/api/v1/stock") ||
        pathname.startsWith("/api/v1/market") ||
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
      if (token) {
        const requiredPlan = getRequiredPlan(pathname);
        if (requiredPlan) {
          const requiredLevel = PLAN_HIERARCHY[requiredPlan] || 0;

          if (userLevel < requiredLevel) {
            return NextResponse.json(
              {
                error: "Subscription required",
                required: requiredPlan,
                current: userPlan,
                upgradeUrl: "/settings/billing",
                message: `This feature requires the ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher.`,
              },
              { status: 403 }
            );
          }
        }
      }
    }

    // ─── Add headers ─────────────────────────────────────────────────────────
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", rlLimit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-User-Plan", userPlan);

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

        // v1 stock/market/jobs/score/screener are public (read-only data)
        if (
          pathname.startsWith("/api/v1/stock") ||
          pathname.startsWith("/api/v1/market") ||
          pathname.startsWith("/api/v1/score") ||
          pathname.startsWith("/api/v1/screener") ||
          pathname.startsWith("/api/v1/morning-briefing") ||
          pathname === "/api/v1/jobs"
        ) {
          return true;
        }

        // AI, alerts, signals, payments — require auth
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
