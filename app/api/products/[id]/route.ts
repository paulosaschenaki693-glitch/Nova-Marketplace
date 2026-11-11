import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Product ID required.' }, { status: 400 });

    const product = await prisma.product.findFirst({
      where: { id, status: 'ACTIVE', quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], seller: { status: 'ACTIVE' } },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        seller: {
          select: {
            id: true,
            role: true,
            status: true,
            shopName: true,
            fullName: true,
            createdAt: true,
            profileImageUrl: true,
            bio: true,
            publicLocation: true,
            verifiedSellerRecords: { where: { status: 'ACTIVE', expiresAt: { gt: new Date() } }, select: { id: true, expiresAt: true }, orderBy: { expiresAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found or unavailable.' }, { status: 404 });
    }
    const { verifiedSellerRecords, ...seller } = product.seller;
    return NextResponse.json({ ...product, seller: { ...seller, verifiedSeller: verifiedSellerRecords[0] || null } });
  } catch (error) {
    console.error('[products.id.GET]', error);
    return NextResponse.json({ error: 'Unable to load product.' }, { status: 500 });
  }
}
