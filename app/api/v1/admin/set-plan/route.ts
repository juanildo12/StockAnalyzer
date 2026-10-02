import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/src/lib/prisma';
import { isAdminSession } from '@/src/lib/admin';

export const dynamic = 'force-dynamic';

const VALID_PLANS = new Set(['free', 'pro', 'elite', 'enterprise']);

export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({
    isAdmin: isAdminSession(session?.user?.email ?? null, (session?.user as any)?.plan ?? null),
    email: session?.user?.email ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session?.user?.email ?? null, (session?.user as any)?.plan ?? null)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const plan = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : '';
  const trial = body.trial === true || body.trial === 'true' || body.trial === 1;
  const days =
    typeof body.days === 'number' ? Math.max(1, Math.min(365, Math.round(body.days))) : 30;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (!VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: `Plan inválido; usa: ${Array.from(VALID_PLANS).join(', ')}` }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      email
    );
    let userId = rows[0]?.id ?? null;
    if (!userId) {
      const created = await prisma.users.create({ data: { email }, select: { id: true } });
      userId = created.id;
    }

    const now = new Date();
    const periodEnd = trial ? new Date(now.getTime() + days * 86400000) : null;

    const sub = await prisma.subscriptions.upsert({
      where: { userId },
      update: {
        plan,
        status: trial ? 'trial' : 'active',
        currentPeriodStart: trial ? now : null,
        currentPeriodEnd: trial ? periodEnd : null,
      },
      create: {
        userId,
        plan,
        status: trial ? 'trial' : 'active',
        currentPeriodStart: trial ? now : null,
        currentPeriodEnd: trial ? periodEnd : null,
      },
    });

    return NextResponse.json({
      ok: true,
      email,
      userId,
      plan: sub.plan,
      status: sub.status,
      trial,
      daysLeft: sub.currentPeriodEnd
        ? Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86400000))
        : null,
    });
  } catch (err: any) {
    console.error('[Admin/SetPlan] Error:', err?.message || err);
    return NextResponse.json({ error: 'Error al actualizar el plan: ' + (err?.message || 'desconocido') }, { status: 500 });
  }
}