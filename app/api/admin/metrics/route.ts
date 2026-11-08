import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const [
      pendingCoinsCount,
      pendingListingsCount,
      pendingStudentsCount,
      activeStudentsCount,
      activeMerchantsCount,
      activeListingsCount,
      openReportsCount,
      approvedCoinPurchases,
    ] = await Promise.all([
      prisma.coinPurchase.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.product.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.user.count({ where: { role: 'STUDENT', status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'MERCHANT', status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'ACTIVE', quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.coinPurchase.findMany({
        where: { status: 'APPROVED' },
        select: { coinsCount: true, amountPaid: true },
      }),
    ]);

    const totalCoinsSold = approvedCoinPurchases.reduce((acc, p) => acc + p.coinsCount, 0);
    const totalRevenue = approvedCoinPurchases.reduce((acc, p) => acc + Number(p.amountPaid), 0);

    return NextResponse.json({
      pendingCoinsCount,
      pendingListingsCount,
      pendingStudentsCount,
      activeStudentsCount,
      activeMerchantsCount,
      activeListingsCount,
      openReportsCount,
      totalCoinsSold,
      totalRevenue,
    });
  } catch (error) {
    console.error('[admin.metrics.GET]', error);
    return NextResponse.json({ error: 'Unable to load metrics.' }, { status: 500 });
  }
}
