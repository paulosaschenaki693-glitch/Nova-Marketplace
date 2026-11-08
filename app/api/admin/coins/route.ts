import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { notifyAdmins } from '@/lib/admin-notifications';

export async function GET(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const purchases = await prisma.coinPurchase.findMany({
      where: status && status !== 'ALL' ? { status: status as any } : {},
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            shopName: true,
            role: true,
            email: true,
            phone: true,
            studentIdNo: true,
            coinBalance: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error('[admin.coins.GET]', error);
    return NextResponse.json({ error: 'Unable to load coin purchases.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const { purchaseId, decision, note } = await req.json();
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
    }

    const purchase = await prisma.coinPurchase.findUnique({
      where: { id: String(purchaseId) },
      include: { user: { select: { id: true, coinBalance: true, fullName: true, shopName: true } } },
    });
    if (!purchase) return NextResponse.json({ error: 'Coin purchase record not found.' }, { status: 404 });
    if (purchase.status !== 'UNDER_REVIEW') {
      return NextResponse.json({ error: 'Purchase has already been reviewed.' }, { status: 409 });
    }

    const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';

    await prisma.$transaction(async tx => {
      const statusChanged = await tx.coinPurchase.updateMany({
        where: { id: purchase.id, status: 'UNDER_REVIEW' },
        data: { status: decision, adminNote: noteText || null, reviewedById: admin.id, reviewedAt: new Date() },
      });
      if (statusChanged.count !== 1) throw new Error('PURCHASE_ALREADY_REVIEWED');

      if (decision === 'APPROVED') {
        const creditedUser = await tx.user.update({ where: { id: purchase.userId }, data: { coinBalance: { increment: purchase.coinsCount } }, select: { coinBalance: true } });
        const newBalance = creditedUser.coinBalance;

        await tx.coinTransaction.create({
          data: {
            userId: purchase.userId,
            amount: purchase.coinsCount,
            type: 'PURCHASE',
            description: `Purchased ${purchase.coinsCount} Listing Coins (${purchase.paymentMethod}).`,
            referenceId: purchase.id,
          },
        });

        await tx.notification.create({
          data: {
            userId: purchase.userId,
            type: 'COIN',
            title: 'Coin Purchase Approved! 🪙',
            body: `Your payment was verified. ${purchase.coinsCount} Listing Coins have been added to your balance. Current balance: ${newBalance} coins.`,
            priority: 'HIGH',
          },
        });
      } else {
        await tx.notification.create({
          data: {
            userId: purchase.userId,
            type: 'COIN',
            title: 'Coin Purchase Needs Attention',
            body: noteText || 'Your payment proof could not be verified. Please check the payment details and submit a new screenshot.',
            priority: 'HIGH',
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: decision === 'APPROVED' ? 'COIN_PURCHASE_APPROVED' : 'COIN_PURCHASE_REJECTED',
          entityType: 'CoinPurchase',
          entityId: purchase.id,
          reason: `Coins: ${purchase.coinsCount}, Amount: ETB ${purchase.amountPaid}. Note: ${noteText || 'None'}`,
        },
      });
    });

    await notifyAdmins({
      type: 'PAYMENT',
      title: `Coin purchase ${decision.toLowerCase()}`,
      body: `Coin purchase for ${purchase.coinsCount} coins by ${purchase.user.fullName || purchase.user.shopName || 'user'} was ${decision.toLowerCase()} by an admin.`,
      priority: decision === 'REJECTED' ? 'HIGH' : 'NORMAL',
      path: '/admin/coins',
    });

    return NextResponse.json({ ok: true, status: decision });
  } catch (error) {
    if (error instanceof Error && error.message === 'PURCHASE_ALREADY_REVIEWED') return NextResponse.json({ error: 'This purchase was already reviewed by another administrator.' }, { status: 409 });
    console.error('[admin.coins.PATCH]', error);
    return NextResponse.json({ error: 'Unable to process coin review.' }, { status: 500 });
  }
}
