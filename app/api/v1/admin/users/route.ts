import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/src/lib/prisma';
import { isAdminSession } from '@/src/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session?.user?.email ?? null, (session?.user as any)?.plan ?? null)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get('q') || '';
  const q = raw.trim();

  const emailFilter = q
    ? { email: { contains: q, mode: 'insensitive' as const } }
    : undefined;

  const users = await prisma.users.findMany({
    where: emailFilter
      ? { AND: [{ email: { not: null } }, emailFilter] }
      : { email: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: q ? 25 : 60,
    include: { subscriptions: true },
  });

  const rows = users.map((u) => {
    const s = u.subscriptions;
    let trialDaysLeft: number | null = null;
    let trialEndsAt: string | null = null;
    if (s?.status === 'trial' && s.currentPeriodEnd) {
      const end = new Date(s.currentPeriodEnd).getTime();
      const now = Date.now();
      trialDaysLeft = end > now ? Math.max(1, Math.ceil((end - now) / 86400000)) : 0;
      trialEndsAt = s.currentPeriodEnd.toISOString();
    }
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: s?.plan ?? 'free',
      status: s?.status ?? 'none',
      trialDaysLeft,
      trialEndsAt,
      currentPeriodEnd: s?.currentPeriodEnd ?? null,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ users: rows, total: rows.length });
}