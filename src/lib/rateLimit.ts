import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Per-tier rate limits ────────────────────────────────────────────────────
// These are used by middleware for per-user rate limiting
export const TIER_LIMITS = {
  free: 30,
  pro: 120,
  elite: 300,
  enterprise: 500,
} as const;

// ─── Default rate limiter (fallback, used by non-middleware routes) ───────────
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  analytics: true,
  prefix: "breakoutfinder:ratelimit",
});

// ─── Plan-based rate limiter factory ─────────────────────────────────────────
export function createRateLimiter(plan: string) {
  const limit = TIER_LIMITS[plan as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free;
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, "60 s"),
    analytics: true,
    prefix: `breakoutfinder:ratelimit:${plan}`,
  });
}
