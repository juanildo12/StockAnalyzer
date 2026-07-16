import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  analytics: true,
  prefix: "breakoutfinder:ratelimit",
});

export const TIER_LIMITS = {
  free: 30,
  starter: 60,
  pro: 120,
  enterprise: 300,
} as const;
