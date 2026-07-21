import { prisma } from "@/src/lib/prisma";
import { createNotification } from "./service";
import { getQuote as finnhubQuote } from "@/src/services/finnhubClient";

interface AlertCheck {
  alertId: string;
  userId: string;
  symbol: string;
  alertType: string;
  targetValue: number;
  currentValue: number;
}

export async function checkPriceAlerts(): Promise<{
  checked: number;
  triggered: number;
  sent: number;
}> {
  const startTime = Date.now();
  let triggered = 0;
  let sent = 0;

  // Get all active alerts
  const alerts = await prisma.alerts.findMany({
    where: { status: "active" },
    include: { user: { select: { id: true, email: true, settings: true } } },
  });

  if (alerts.length === 0) {
    return { checked: 0, triggered: 0, sent: 0 };
  }

  // Get unique symbols to fetch quotes for
  const symbols = [...new Set(alerts.map((a) => a.symbol))];

  // Fetch quotes in batches
  const quotes = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (sym) => {
        const q = await finnhubQuote(sym).catch(() => null);
        return { symbol: sym, price: q && q.c > 0 ? q.c : null };
      })
    );
    results.forEach((r) => {
      if (r.price !== null) quotes.set(r.symbol, r.price);
    });
  }

  // Check each alert
  const toProcess: AlertCheck[] = [];

  for (const alert of alerts) {
    const currentPrice = quotes.get(alert.symbol);
    if (currentPrice === undefined) continue;

    const target = Number(alert.targetValue);
    let triggered_flag = false;

    switch (alert.alertType) {
      case "above":
        triggered_flag = currentPrice >= target;
        break;
      case "below":
        triggered_flag = currentPrice <= target;
        break;
      case "percent": {
        // Check if price moved by target% since alert creation
        const createdAt = alert.createdAt.getTime();
        // For percent alerts, we compare current vs target as a threshold
        triggered_flag = Math.abs(currentPrice - target) / target * 100 >= 5;
        break;
      }
    }

    if (triggered_flag) {
      // Check if we already alerted for this combination today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const alreadyAlerted = await prisma.notifications.findFirst({
        where: {
          userId: alert.userId,
          type: "price_alert",
          data: { path: ["alertId"], equals: alert.id },
          createdAt: { gte: today },
        },
      });

      if (!alreadyAlerted) {
        toProcess.push({
          alertId: alert.id,
          userId: alert.userId,
          symbol: alert.symbol,
          alertType: alert.alertType,
          targetValue: target,
          currentValue: currentPrice,
        });
      }
    }
  }

  // Process triggered alerts
  for (const check of toProcess) {
    triggered++;

    const direction = check.alertType === "above" ? "reached" : "dropped to";
    const title = `${check.symbol} ${direction} $${check.currentValue.toFixed(2)}`;
    const message = `${check.symbol} has ${direction} your target of $${check.targetValue.toFixed(2)}. Current price: $${check.currentValue.toFixed(2)}`;

    // Check user notification preferences
    const user = await prisma.users.findUnique({
      where: { id: check.userId },
      select: { settings: true },
    });

    const settings = user?.settings as any;
    const sendEmail = settings?.emailAlerts !== false;

    await createNotification({
      userId: check.userId,
      type: "price_alert",
      title,
      message,
      data: {
        alertId: check.alertId,
        symbol: check.symbol,
        targetPrice: check.targetValue,
        currentPrice: check.currentValue,
        alertType: check.alertType,
      },
      sendEmail,
    });

    // Mark alert as triggered
    await prisma.alerts.update({
      where: { id: check.alertId },
      data: {
        status: "triggered",
        triggeredAt: new Date(),
        currentValue: check.currentValue,
      },
    });

    sent++;
  }

  // Log job run
  await prisma.job_runs.create({
    data: {
      jobType: "check-price-alerts",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        alertsChecked: alerts.length,
        triggered,
        sent,
        durationMs: Date.now() - startTime,
      },
    },
  });

  return { checked: alerts.length, triggered, sent };
}

export async function checkBreakoutAlerts(): Promise<{
  checked: number;
  triggered: number;
}> {
  const startTime = Date.now();

  // Get watchlist items with breakout alerts enabled
  const watchlistItems = await prisma.watchlists.findMany({
    where: { alertPrice: { not: null } },
  });

  if (watchlistItems.length === 0) {
    return { checked: 0, triggered: 0 };
  }

  // Get today's breakout scores
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const breakoutScores = await prisma.screener_results.findMany({
    where: {
      screenerType: "breakout-score",
      computedAt: { gte: today },
    },
  });

  const scoreMap = new Map(
    breakoutScores.map((r) => [r.symbol, r.score])
  );

  let triggered = 0;

  for (const item of watchlistItems) {
    const score = scoreMap.get(item.symbol);
    if (score === undefined) continue;

    const alertPrice = Number(item.alertPrice);

    // Check if breakout score exceeds threshold (alertPrice used as score threshold)
    if (score >= alertPrice) {
      // Check if already notified today
      const alreadyNotified = await prisma.notifications.findFirst({
        where: {
          userId: item.userId,
          type: "breakout_alert",
          data: { path: ["symbol"], equals: item.symbol },
          createdAt: { gte: today },
        },
      });

      if (!alreadyNotified) {
        const user = await prisma.users.findUnique({
          where: { id: item.userId },
          select: { settings: true },
        });

        const settings = user?.settings as any;
        const sendEmail = settings?.emailAlerts !== false && settings?.breakoutAlerts !== false;

        await createNotification({
          userId: item.userId,
          type: "breakout_alert",
          title: `${item.symbol} Breakout Signal (Score: ${score})`,
          message: `${item.symbol} has triggered a breakout alert with a score of ${score}/100.`,
          data: {
            symbol: item.symbol,
            score,
            alertThreshold: alertPrice,
          },
          sendEmail,
        });

        triggered++;
      }
    }
  }

  await prisma.job_runs.create({
    data: {
      jobType: "check-breakout-alerts",
      status: "completed",
      startedAt: new Date(startTime),
      completedAt: new Date(),
      result: {
        watchlistChecked: watchlistItems.length,
        triggered,
        durationMs: Date.now() - startTime,
      },
    },
  });

  return { checked: watchlistItems.length, triggered };
}
