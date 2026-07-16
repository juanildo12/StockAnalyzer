import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

export interface CacheOptions {
  ttl: number; // seconds
  prefix?: string;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis();
    const data = await r.get(key);
    return data as T | null;
  } catch (error) {
    console.warn(`[Cache] GET error for ${key}:`, error);
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl: number
): Promise<void> {
  try {
    const r = getRedis();
    await r.set(key, value, { ex: ttl });
  } catch (error) {
    console.warn(`[Cache] SET error for ${key}:`, error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const r = getRedis();
    await r.del(key);
  } catch (error) {
    console.warn(`[Cache] DEL error for ${key}:`, error);
  }
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const r = getRedis();
    const keys = await r.keys(pattern);
    if (keys.length > 0) {
      await r.del(...keys);
    }
  } catch (error) {
    console.warn(`[Cache] INVALIDATE error for ${pattern}:`, error);
  }
}

// Helper: cache-aside pattern (read from cache, fallback to DB/compute)
export async function cacheAside<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss — fetch from source
  const data = await fetcher();

  // Store in cache (fire and forget)
  cacheSet(key, data, ttl).catch(() => {});

  return data;
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  QUOTE: 30,           // 30 seconds — near real-time
  SCREENER: 300,       // 5 minutes
  BREAKOUT: 300,       // 5 minutes
  BRIEFING: 3600,      // 1 hour
  FUNDAMENTALS: 3600,  // 1 hour
  HISTORY: 3600,       // 1 hour
  MARKET: 300,         // 5 minutes
  USER_WATCHLIST: 300, // 5 minutes
  USER_PORTFOLIO: 300, // 5 minutes
} as const;
