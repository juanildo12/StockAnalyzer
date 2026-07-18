import { NextRequest, NextResponse } from "next/server";
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

// ─── Simple JWT decode (no library needed) ───────────────────────────────────
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split(".")[1];
    const padded = base64.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTokenFromRequest(req: NextRequest): Record<string, any> | null {
  const sessionToken =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;
  if (!sessionToken) return null;
  const payload = decodeJwtPayload(sessionToken);
  if (!payload) return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip NextAuth internal routes entirely — let NextAuth handle its own flow
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = getTokenFromRequest(req);
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
      console.error("[Middleware] Rate limit error:", err);
    }
  } else {
    console.warn("[Middleware] Redis unavailable — rate limiting bypassed");
  }

  // ─── API Route Protection ────────────────────────────────────────────────
  if (pathname.startsWith("/api/v1/")) {
    const isPublicV1 =
      pathname.startsWith("/api/v1/stock") ||
      pathname.startsWith("/api/v1/market") ||
      pathname.startsWith("/api/v1/score") ||
      pathname.startsWith("/api/v1/screener") ||
      pathname.startsWith("/api/v1/morning-briefing") ||
      pathname.startsWith("/api/v1/payments") ||
      pathname === "/api/v1/jobs";

    if (!isPublicV1 && !token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

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

  // ─── Legacy API routes that require auth ─────────────────────────────────
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/v1/")) {
    const publicLegacy =
      pathname.startsWith("/api/stock") ||
      pathname.startsWith("/api/signal") ||
      pathname.startsWith("/api/screener") ||
      pathname.startsWith("/api/market") ||
      pathname.startsWith("/api/morning-briefing") ||
      pathname === "/api/health" ||
      pathname.startsWith("/api/search") ||
      pathname.startsWith("/api/calendar") ||
      pathname.startsWith("/api/radar") ||
      pathname.startsWith("/api/scraper") ||
      pathname.startsWith("/api/options-screener") ||
      pathname.startsWith("/api/options-chain") ||
      pathname.startsWith("/api/pro-signals") ||
      pathname.startsWith("/api/historical-metrics") ||
      pathname.startsWith("/api/watchlist");

    if (!publicLegacy && !token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  // ─── Add headers ─────────────────────────────────────────────────────────
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", rlLimit.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set("X-User-Plan", userPlan);

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
