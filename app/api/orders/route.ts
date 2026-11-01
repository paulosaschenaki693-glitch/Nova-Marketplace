import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const orders = await prisma.order.findMany({ where: user.role === 'ADMIN' ? {} : { buyerId: user.id }, include: { items: { include: { product: { include: { images: true } }, seller: { select: { role: true, shopName: true } } } }, payment: true, fulfillments: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json(orders);
  } catch (error) { console.error('[orders.GET] Failed to load orders', error); return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in with an approved account to order.' }, { status: 401 });
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
  try {
    const d = await req.json();
    const items = d.items as { productId: string; quantity: number }[];
    if (!Array.isArray(items) || !items.length || items.length > 50) return NextResponse.json({ error: 'Your cart is empty or too large.' }, { status: 400 });
    if (!d.fullName || !d.phone || !d.deliveryAddress) return NextResponse.json({ error: 'Delivery name, phone and address are required.' }, { status: 400 });
    if (items.some(i => !i || typeof i.productId !== 'string' || !i.productId.trim())) return NextResponse.json({ error: 'One or more cart items are invalid.' }, { status: 400 });
    const ids = items.map(i => i.productId);
    if (new Set(ids).size !== ids.length) return NextResponse.json({ error: 'Duplicate cart lines are not supported. Update the quantity instead.' }, { status: 400 });
    const normalized = items.map(i => ({ productId: i.productId, quantity: Math.max(1, Math.min(20, Math.floor(Number(i.quantity) || 1))) }));
    const deliveryFee = Math.max(0, Number(process.env.DEFAULT_DELIVERY_FEE || 0));
    const order = await prisma.$transaction(async tx => {
      // Read and reserve stock inside the same transaction as order creation. A failed order rolls back every reservation.
      const products = await tx.product.findMany({ where: { id: { in: ids }, status: 'ACTIVE', quantity: { gt: 0 }, seller: { status: 'ACTIVE' } }, include: { seller: { select: { id: true, role: true, status: true } } } });
      if (products.length !== ids.length) throw new OrderConflict('One or more items are no longer available. Refresh your cart and try again.');
      for (const item of normalized) {
        const product = products.find(p => p.id === item.productId)!;
        if (product.seller.status !== 'ACTIVE') throw new OrderConflict(`${product.title} is not available from this seller.`);
        if (product.quantity < item.quantity) throw new OrderConflict(`Not enough stock for ${product.title}. Available: ${product.quantity}.`);
      }
      const subtotal = normalized.reduce((sum, item) => sum + Number(products.find(p => p.id === item.productId)!.price) * item.quantity, 0);
      const orderNumber = `NV-${Date.now().toString().slice(-8)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const created = await tx.order.create({ data: { orderNumber, buyerId: user.id, subtotal, deliveryFee, total: subtotal + deliveryFee, fullName: String(d.fullName).trim(), phone: String(d.phone).trim(), deliveryAddress: String(d.deliveryAddress).trim(), deliveryNotes: d.deliveryNotes ? String(d.deliveryNotes).trim() : undefined, status: 'AWAITING_PAYMENT', items: { create: normalized.map(item => { const p = products.find(p => p.id === item.productId)!; const rate = p.seller.role === 'STUDENT' ? 10 : 20; const gross = Number(p.price) * item.quantity; return { productId: p.id, sellerId: p.sellerId, titleSnapshot: p.title, quantity: item.quantity, unitPrice: Number(p.price), commissionRate: rate, commissionAmount: gross * rate / 100, sellerNetAmount: gross * (1 - rate / 100) }; }) }, payment: { create: { amount: subtotal + deliveryFee } } } });
      for (const item of normalized) {
        const p = products.find(p => p.id === item.productId)!;
        const reserved = await tx.product.updateMany({ where: { id: p.id, status: 'ACTIVE', quantity: { gte: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
        if (reserved.count !== 1) throw new OrderConflict(`Stock changed for ${p.title}. Refresh your cart and try again.`);
        const remaining = p.quantity - item.quantity;
        if (remaining === 0) await tx.product.update({ where: { id: p.id }, data: { status: 'SOLD' } });
      }
      const grouped = new Map<string, string[]>();
      const orderItems = await tx.orderItem.findMany({ where: { orderId: created.id } });
      for (const item of orderItems) grouped.set(item.sellerId, [...(grouped.get(item.sellerId) || []), item.id]);
      for (const [sellerId, itemIds] of grouped) {
        const fulfillment = await tx.sellerFulfillment.create({ data: { orderId: created.id, sellerId } });
        await tx.fulfillmentItem.createMany({ data: itemIds.map(orderItemId => ({ fulfillmentId: fulfillment.id, orderItemId })) });
      }
      await tx.orderStatusHistory.create({ data: { orderId: created.id, status: 'AWAITING_PAYMENT', note: 'Combined order created.' } });
      return created;
    }, { maxWait: 10000, timeout: 20000 });
    return NextResponse.json({ id: order.id, orderNumber: order.orderNumber, total: order.total }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    // Keep diagnostics server-side so production responses don't expose database details.
    console.error('[orders.POST] Order creation failed', error);
    return NextResponse.json({ error: 'Unable to create order. Your order was not confirmed; please retry once. If the issue continues, contact support.' }, { status: 500 });
  }
}
class OrderConflict extends Error {}
