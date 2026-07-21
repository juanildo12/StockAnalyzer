import { prisma } from "@/src/lib/prisma";

export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  sendEmail?: boolean;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  data,
  sendEmail = false,
}: NotificationData): Promise<void> {
  // Store in DB
  const notification = await prisma.notifications.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data || undefined,
    },
  });

  // Send email if enabled
  if (sendEmail) {
    await sendEmailNotification(userId, title, message).catch((err) => {
      console.error(`[Notification] Email failed for ${userId}:`, err);
    });

    // Mark as sent
    await prisma.notifications.update({
      where: { id: notification.id },
      data: { sentAt: new Date() },
    });
  }
}

export async function sendEmailNotification(
  userId: string,
  subject: string,
  body: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[Notification] RESEND_API_KEY not configured, skipping email");
    return;
  }

  // Get user email
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true, settings: true },
  });

  if (!user?.email) return;

  // Check notification preferences
  const settings = user.settings as any;
  if (settings?.emailAlerts === false) return;

  // Send via Resend
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Prospector <alerts@prospector.com>",
      to: [user.email],
      subject,
      html: buildEmailHtml(subject, body),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
}

function buildEmailHtml(subject: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 12px; border: 1px solid #1e1e2e; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 20px; }
    .body { padding: 24px; }
    .body p { color: #a0a0b0; line-height: 1.6; }
    .highlight { color: #6366f1; font-weight: 600; }
    .footer { padding: 16px 24px; text-align: center; color: #555; font-size: 12px; border-top: 1px solid #1e1e2e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Prospector</h1>
    </div>
    <div class="body">
      <h2 style="color: #e0e0e0; margin-top: 0;">${subject}</h2>
      <p>${body}</p>
    </div>
    <div class="footer">
      Prospector &mdash; Smart Trading Signals
    </div>
  </div>
</body>
</html>`;
}

export async function getUnreadNotifications(userId: string) {
  return prisma.notifications.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const where: any = { userId, read: false };
  if (ids && ids.length > 0) {
    where.id = { in: ids };
  }

  await prisma.notifications.updateMany({
    where,
    data: { read: true },
  });
}
