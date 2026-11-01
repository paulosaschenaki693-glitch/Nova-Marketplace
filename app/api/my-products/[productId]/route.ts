import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
export async function PATCH(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await requireUser(['STUDENT','MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in with an approved seller account.' }, { status: 401 });
  try {
    const { productId } = await params;
    const body = await req.json();
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) return NextResponse.json({ error: 'Quantity must be a whole number from 0 to 100000.' }, { status: 400 });
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: user.id } });
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const status = quantity === 0 ? 'SOLD' : product.status === 'SOLD' ? 'ACTIVE' : product.status;
    const updated = await prisma.product.update({ where: { id: product.id }, data: { quantity, status } });
    return NextResponse.json({ id: updated.id, quantity: updated.quantity, status: updated.status });
  } catch { return NextResponse.json({ error: 'Unable to update stock.' }, { status: 500 }); }
}
