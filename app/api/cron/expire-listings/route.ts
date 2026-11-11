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

    const verificationSoonStart = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const verificationSoonEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    const verificationsExpiringSoon = await prisma.verifiedSeller.findMany({
      where: { status: 'ACTIVE', expiresAt: { gte: verificationSoonStart, lt: verificationSoonEnd } },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (verificationsExpiringSoon.length) {
      await prisma.notification.createMany({
        data: verificationsExpiringSoon.map(row => ({
          userId: row.userId, type: 'SYSTEM' as const,
          title: 'Nova Verified Seller badge expires in 30 days',
          body: 'Your six-month Nova Verified Seller term is nearly complete. Contact Nova to arrange renewal.',
          dedupeKey: `verified-seller-expiring-30d:${row.id}:${row.expiresAt?.toISOString() || ''}`,
        })),
        skipDuplicates: true,
      });
    }
    const expiredVerifications = await prisma.verifiedSeller.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (expiredVerifications.length) {
      await prisma.$transaction(async tx => {
        await tx.verifiedSeller.updateMany({
          where: { id: { in: expiredVerifications.map(row => row.id) }, status: 'ACTIVE', expiresAt: { lte: now } },
          data: { status: 'EXPIRED' },
        });
        await tx.notification.createMany({
          data: expiredVerifications.map(row => ({
            userId: row.userId, type: 'SYSTEM' as const,
            title: 'Nova Verified Seller badge expired',
            body: 'Your six-month verification term has ended. Apply again to complete a new agreement and payment process.',
            dedupeKey: `verified-seller-expired:${row.id}:${row.expiresAt?.toISOString() || ''}`,
          })),
          skipDuplicates: true,
        });
      });
    }

    return NextResponse.json({ ok: true, expiringSoonNotified: expiringSoon.length, expiredCount: expired.length, verificationsExpiringSoon: verificationsExpiringSoon.length, expiredVerifications: expiredVerifications.length, checkedAt: now.toISOString() });
  } catch (error) {
    console.error('[cron.expire-listings]', error);
    return NextResponse.json({ error: 'Unable to process listing expiration.' }, { status: 500 });
  }
}
