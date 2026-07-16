export const ALERT_CONFIG = {
  // ── Evaluation thresholds ──────────────────────
  minScore: 65,
  minStrongFactors: 4,
  minFactorForStrong: 60,
  criticalFactorThreshold: 15,
  minBreakoutScore: 45,
  minVolumeScore: 40,
  minRiskReward: 1.5,
  maxEntryDistancePct: 3,

  // ── Confidence weights ─────────────────────────
  confidence: {
    scoreWeight: 30,
    alignmentWeight: 25,
    rrWeight: 20,
    volumeWeight: 15,
    trendWeight: 10,
  },

  // ── Rate limiting ──────────────────────────────
  maxAlertsPerUserPerDay: 3,
  minIntervalHoursSameTicker: 24,
  maxAlertsGlobalPerDay: 50,

  // ── Market hours (ET) ─────────────────────────
  marketOpenHour: 9,
  marketOpenMinute: 30,
  marketCloseHour: 16,
  marketCloseMinute: 0,

  // ── Alert lifecycle ────────────────────────────
  alertExpiryHours: 24,
};
