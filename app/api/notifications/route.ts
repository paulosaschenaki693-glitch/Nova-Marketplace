import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    return NextResponse.json(await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }));
  } catch (error) {
    console.error('[notifications.GET]', error);
    return NextResponse.json({ error: 'Unable to load notifications.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const body = await req.json();
    if (body.all === true) {
      await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    if (typeof body.notificationId !== 'string' || !body.notificationId) {
      return NextResponse.json({ error: 'Notification ID required.' }, { status: 400 });
    }
    const result = await prisma.notification.updateMany({
      where: { id: body.notificationId, userId: user.id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: result.count > 0 });
  } catch {
    return NextResponse.json({ error: 'Unable to update notifications.' }, { status: 400 });
  }
}
