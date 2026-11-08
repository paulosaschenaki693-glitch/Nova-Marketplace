import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in with an approved seller account.' }, { status: 401 });
  try {
    // Keep the seller dashboard accurate even if the daily cron has not run yet.
    const now = new Date();
    const expired = await prisma.product.findMany({
      where: { sellerId: user.id, status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true, title: true, expiresAt: true },
    });
    if (expired.length) {
      await prisma.$transaction(async tx => {
        await tx.product.updateMany({
          where: { id: { in: expired.map(p => p.id) }, sellerId: user.id, status: 'ACTIVE', expiresAt: { lte: now } },
          data: { status: 'EXPIRED' },
        });
        await tx.notification.createMany({
          data: expired.map(product => ({
            userId: user.id,
            type: 'LISTING' as const,
            title: 'Your listing has expired',
            body: `“${product.title}” is no longer visible. Renew it with Listing Coins if you still have it available.`,
            dedupeKey: `listing-expired:${product.id}:${product.expiresAt?.toISOString() || ''}`,
          })),
          skipDuplicates: true,
        });
      });
    }
    const products = await prisma.product.findMany({
      where: { sellerId: user.id },
      include: { category: true, images: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('[my-products.GET]', error);
    return NextResponse.json({ error: 'Unable to load your listings.' }, { status: 500 });
  }
}
