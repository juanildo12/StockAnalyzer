import { Queue } from "bullmq";
import { Redis } from "@upstash/redis";

// BullMQ requires a standard Redis connection, not Upstash REST.
// We construct a basic connection from the Upstash env vars.
const connection = {
  host: process.env.UPSTASH_REDIS_REST_URL?.replace("https://", "").replace("http://", "") || "",
  port: 443,
  password: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  tls: {},
  maxRetriesPerRequest: null,
};

export const scannerQueue = new Queue("scanner", { connection });
export const cacheQueue = new Queue("cache", { connection });

export const QUEUE_NAMES = {
  SCANNER: "scanner",
  CACHE: "cache",
} as const;

export const JOB_NAMES = {
  RUN_ALL_SCREENERS: "run-all-screeners",
  COMPUTE_BREAKOUT_SCORES: "compute-breakout-scores",
  COMPUTE_MORNING_BRIEFING: "compute-morning-briefing",
  WARM_POPULAR_STOCKS: "warm-popular-stocks",
  REFRESH_FUNDAMENTALS: "refresh-fundamentals",
} as const;
