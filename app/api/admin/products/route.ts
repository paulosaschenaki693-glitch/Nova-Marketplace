import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const products = await prisma.product.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED'] } },
      include: {
        seller: { select: { role: true, fullName: true, shopName: true, phone: true } },
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('[admin.products.GET] Failed to load listings', error);
    return NextResponse.json({ error: 'Unable to load listings.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const { productId, decision, note } = await req.json();
    if (typeof productId !== 'string' || !productId || !['ACTIVE', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'Choose a valid listing and decision.' }, { status: 400 });
    }
    const existing = await prisma.product.findFirst({
      where: { id: productId, status: { in: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED'] } },
      select: { id: true, sellerId: true, title: true, coinCost: true, coinReserved: true, coinChargedAt: true, status: true },
    });
    if (!existing) return NextResponse.json({ error: 'Listing not found or no longer reviewable.' }, { status: 404 });
    if (existing.status !== 'PENDING_REVIEW') return NextResponse.json({ error: 'Only listings awaiting review can be approved or rejected here.' }, { status: 409 });
    const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${existing.id} FOR UPDATE`;
      const current = await tx.product.findUniqueOrThrow({ where: { id: existing.id } });
      if (current.status !== 'PENDING_REVIEW') throw new Error('LISTING_REVIEW_CONFLICT');
      const changed = await tx.product.updateMany({ where: { id: current.id, status: 'PENDING_REVIEW' }, data: {
        status: decision,
        moderationSource: decision === 'ACTIVE' ? 'MANUAL_VERIFIED' : 'MANUAL_REJECTED',
        moderationNote: noteText || null,
        publishedAt: decision === 'ACTIVE' ? new Date() : null,
        expiresAt: decision === 'ACTIVE' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        coinReserved: false,
        coinChargedAt: decision === 'ACTIVE' ? (current.coinChargedAt || new Date()) : current.coinChargedAt,
      } });
      if (changed.count !== 1) throw new Error('LISTING_REVIEW_CONFLICT');

      if (current.coinReserved) {
        const walletChange = decision === 'ACTIVE'
          ? await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" - ${current.coinCost}, "reservedCoinBalance" = "reservedCoinBalance" - ${current.coinCost} WHERE "id" = ${current.sellerId} AND "coinBalance" >= ${current.coinCost} AND "reservedCoinBalance" >= ${current.coinCost}`
          : await tx.$executeRaw`UPDATE "User" SET "reservedCoinBalance" = "reservedCoinBalance" - ${current.coinCost} WHERE "id" = ${current.sellerId} AND "reservedCoinBalance" >= ${current.coinCost}`;
        if (walletChange !== 1) throw new Error('COIN_RESERVATION_CONFLICT');
        if (decision === 'ACTIVE') await tx.coinTransaction.create({ data: { userId: current.sellerId, amount: -current.coinCost, type: 'LISTING_FEE', description: `Listing fee for approved listing: ${current.title.slice(0, 45)}`, referenceId: current.id } });
      } else if (decision === 'ACTIVE' && !current.coinChargedAt) {
        const charged = await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" - ${current.coinCost} WHERE "id" = ${current.sellerId} AND "coinBalance" - "reservedCoinBalance" >= ${current.coinCost}`;
        if (charged !== 1) throw new Error('INSUFFICIENT_COINS');
        await tx.coinTransaction.create({ data: { userId: current.sellerId, amount: -current.coinCost, type: 'LISTING_FEE', description: `Listing fee for approved listing: ${current.title.slice(0, 45)}`, referenceId: current.id } });
      }

      await tx.adminAuditLog.create({ data: { adminId: admin.id, action: decision, entityType: 'Product', entityId: current.id, reason: noteText || null } });
      await tx.notification.create({ data: { userId: current.sellerId, type: 'LISTING', title: decision === 'ACTIVE' ? 'Listing approved' : 'Listing rejected', body: noteText || (decision === 'ACTIVE' ? `Your listing is active for 30 days. ${!current.coinChargedAt ? `${current.coinCost} coins were deducted after approval.` : 'Your previous listing fee was already paid.'}` : (current.coinReserved ? 'Your product listing was not approved. Reserved coins have been released. Please review the note and update it.' : 'Your product listing was not approved. No additional coins were deducted.')) } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_COINS') return NextResponse.json({ error: 'The seller no longer has enough available coins to activate this listing.' }, { status: 402 });
    if (error instanceof Error && error.message.includes('CONFLICT')) return NextResponse.json({ error: 'This listing review or coin reservation changed. Refresh and try again.' }, { status: 409 });
    console.error('[admin.products.PATCH] Listing decision failed', error);
    return NextResponse.json({ error: 'Unable to update listing.' }, { status: 500 });
  }
}
