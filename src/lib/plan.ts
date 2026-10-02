export interface RawSubscription {
  plan?: string | null;
  status?: string | null;
  currentPeriodEnd?: Date | string | null;
}

export interface ResolvedPlan {
  plan: string;
  status: string;
  isTrial: boolean;
  expired: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
}

// Resuelve el plan efectivo de una suscripción. Los trials (status === 'trial')
// tienen fecha de fin en currentPeriodEnd; al expirar se degradan a free.
export function resolvePlan(sub: RawSubscription | null): ResolvedPlan {
  const rawPlan = (sub?.plan || 'free').toLowerCase();
  const status = (sub?.status || 'active').toLowerCase();
  const endsRaw = sub?.currentPeriodEnd;
  const ends = endsRaw ? new Date(endsRaw) : null;

  if (status === 'trial') {
    const now = Date.now();
    if (ends && ends.getTime() <= now) {
      return {
        plan: 'free',
        status: 'expired_trial',
        isTrial: true,
        expired: true,
        trialEndsAt: ends.toISOString(),
        trialDaysLeft: 0,
      };
    }
    return {
      plan: rawPlan,
      status: 'trial',
      isTrial: true,
      expired: false,
      trialEndsAt: ends ? ends.toISOString() : null,
      trialDaysLeft: ends ? Math.max(1, Math.ceil((ends.getTime() - now) / 86400000)) : null,
    };
  }

  return {
    plan: rawPlan,
    status,
    isTrial: false,
    expired: false,
    trialEndsAt: null,
    trialDaysLeft: null,
  };
}