import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { notifyAdmins } from '@/lib/admin-notifications';
import { privateFileExists } from '@/lib/r2-storage';

const proofKeyPattern = /^payment-proofs\/[a-zA-Z0-9-]+\.webp$/;

export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in with an active account.' }, { status: 401 });

  try {
    const body = await req.json();
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    const method = body.method;
    const storageKey = typeof body.storageKey === 'string' ? body.storageKey : '';
    const transactionReference = typeof body.transactionReference === 'string'
      ? body.transactionReference.trim().slice(0, 120) : '';

    if (!orderId || !['TELEBIRR', 'CBE', 'BOA'].includes(method) || !proofKeyPattern.test(storageKey)) {
      return NextResponse.json({ error: 'Choose a payment method and upload a valid payment screenshot.' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, buyerId: user.id },
      include: { payment: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (!['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(order.status)) {
      return NextResponse.json({ error: 'This order is no longer accepting payment submissions.' }, { status: 409 });
    }
    if (order.payment?.status === 'APPROVED') {
      return NextResponse.json({ error: 'Payment is already approved.' }, { status: 409 });
    }

    if (!await privateFileExists(storageKey)) return NextResponse.json({ error: 'Payment screenshot could not be found in private storage. Please upload it again.' }, { status: 400 });
    const screenshotUrl = `private-payment://${storageKey.split('/').pop()}`;
    await prisma.$transaction([
      prisma.payment.upsert({
        where: { orderId },
        create: { orderId, method, amount: order.total, screenshotUrl, transactionReference: transactionReference || null, status: 'UNDER_REVIEW', submittedAt: new Date() },
        update: { method, amount: order.total, screenshotUrl, transactionReference: transactionReference || null, status: 'UNDER_REVIEW', adminNote: null, submittedAt: new Date(), reviewedAt: null, reviewedById: null },
      }),
      prisma.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_REVIEW' } }),
      prisma.orderStatusHistory.create({ data: { orderId, status: 'PAYMENT_REVIEW', note: 'Payment proof submitted for manual review.' } }),
    ]);

    await notifyAdmins({
      type: 'PAYMENT', title: 'Payment proof submitted',
      body: `A buyer submitted payment proof for order ${order.orderNumber} (ETB ${Number(order.total).toLocaleString()}).`,
      priority: 'URGENT', path: '/admin/payments',
    });
    return NextResponse.json({ ok: true, status: 'UNDER_REVIEW' });
  } catch (error) {
    console.error('[payments.POST] Payment proof submission failed', error);
    return NextResponse.json({ error: 'Unable to submit payment proof.' }, { status: 500 });
  }
}
