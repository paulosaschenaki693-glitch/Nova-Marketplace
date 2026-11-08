import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const now = new Date();
    const soonStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const soonEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    const expiringSoon = await prisma.product.findMany({
      where: { status: 'ACTIVE', expiresAt: { gte: soonStart, lt: soonEnd } },
      select: { id: true, sellerId: true, title: true, expiresAt: true },
    });
    if (expiringSoon.length) {
      await prisma.notification.createMany({
        data: expiringSoon.map(product => ({
          userId: product.sellerId,
          type: 'LISTING' as const,
          title: 'Your listing expires in 3 days',
          body: `“${product.title}” will expire in 3 days. Renew it with Listing Coins to keep it visible.`,
          dedupeKey: `listing-expiring-3d:${product.id}:${product.expiresAt?.toISOString() || ''}`,
        })),
        skipDuplicates: true,
      });
    }

    const expired = await prisma.product.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true, sellerId: true, title: true, expiresAt: true },
    });
    if (expired.length) {
      await prisma.$transaction(async tx => {
        await tx.product.updateMany({
          where: { id: { in: expired.map(p => p.id) }, status: 'ACTIVE', expiresAt: { lte: now } },
          data: { status: 'EXPIRED' },
        });
        await tx.notification.createMany({
          data: expired.map(product => ({
            userId: product.sellerId,
            type: 'LISTING' as const,
            title: 'Your listing has expired',
            body: `“${product.title}” is no longer visible. Renew it with Listing Coins if you still have it available.`,
            dedupeKey: `listing-expired:${product.id}:${product.expiresAt?.toISOString() || ''}`,
          })),
          skipDuplicates: true,
        });
      });
    }
    return NextResponse.json({ ok: true, expiringSoonNotified: expiringSoon.length, expiredCount: expired.length, checkedAt: now.toISOString() });
  } catch (error) {
    console.error('[cron.expire-listings]', error);
    return NextResponse.json({ error: 'Unable to process listing expiration.' }, { status: 500 });
  }
}
