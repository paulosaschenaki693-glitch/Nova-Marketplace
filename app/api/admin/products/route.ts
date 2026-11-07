import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const products = await prisma.product.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED'] } },
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
      select: { id: true, sellerId: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: 'Listing not found or no longer reviewable.' }, { status: 404 });
    const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    await prisma.$transaction(async tx => {
      await tx.product.update({
        where: { id: existing.id },
        data: {
          status: decision,
          moderationSource: decision === 'ACTIVE' ? 'MANUAL_VERIFIED' : 'MANUAL_REJECTED',
          moderationNote: noteText || null,
          publishedAt: decision === 'ACTIVE' ? new Date() : null,
        },
      });
      await tx.adminAuditLog.create({
        data: { adminId: admin.id, action: decision, entityType: 'Product', entityId: existing.id, reason: noteText || null },
      });
      await tx.notification.create({
        data: {
          userId: existing.sellerId,
          type: 'LISTING',
          title: decision === 'ACTIVE' ? 'Listing approved' : 'Listing rejected',
          body: noteText || (decision === 'ACTIVE'
            ? 'Your product listing is now active in the marketplace.'
            : 'Your product listing was not approved. Please review the note and update it.'),
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin.products.PATCH] Listing decision failed', error);
    return NextResponse.json({ error: 'Unable to update listing.' }, { status: 500 });
  }
}
