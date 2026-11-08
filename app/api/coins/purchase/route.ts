import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { notifyAdmins } from '@/lib/admin-notifications';
import { privateFileExists } from '@/lib/r2-storage';
import { calculateCoinsCost, COIN_PACKAGES, RoleType } from '@/lib/coins';

const proofKeyPattern = /^payment-proofs\/[a-zA-Z0-9-]+\.webp$/;

export async function GET() {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  try {
    const [purchases, transactions] = await Promise.all([
      prisma.coinPurchase.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.coinTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      coinBalance: user.coinBalance,
      reservedCoinBalance: user.reservedCoinBalance,
      availableCoinBalance: Math.max(0, user.coinBalance - user.reservedCoinBalance),
      packages: COIN_PACKAGES,
      purchases,
      transactions,
    });
  } catch (error) {
    console.error('[coins.purchase.GET]', error);
    return NextResponse.json({ error: 'Unable to load coin history.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (user.status !== 'ACTIVE') return NextResponse.json({ error: 'Active account required.' }, { status: 403 });

  try {
    const body = await req.json();
    const coinsCount = Number(body.coinsCount);
    const method = body.method;
    const storageKey = typeof body.storageKey === 'string' ? body.storageKey : '';
    const transactionReference = typeof body.transactionReference === 'string'
      ? body.transactionReference.trim().toUpperCase().slice(0, 120)
      : '';

    if (!Number.isInteger(coinsCount) || coinsCount < 1 || coinsCount > 500) {
      return NextResponse.json({ error: 'Please choose a valid coin package (1–500 coins).' }, { status: 400 });
    }

    if (!['TELEBIRR', 'CBE', 'BOA'].includes(method)) return NextResponse.json({ error: 'Choose a valid payment method.' }, { status: 400 });
    if (!transactionReference || transactionReference.length < 4) return NextResponse.json({ error: 'Enter the payment transaction reference shown by your payment provider.' }, { status: 400 });
    if (!proofKeyPattern.test(storageKey)) return NextResponse.json({ error: 'Valid payment screenshot proof is required.' }, { status: 400 });
    let proofExists = false;
    try { proofExists = await privateFileExists(storageKey); }
    catch (storageError) { console.error('[coins.purchase.POST] R2 proof verification failed', storageError); return NextResponse.json({ error: 'We could not verify the uploaded receipt because private storage is unavailable. Please try again later or contact support.' }, { status: 503 }); }
    if (!proofExists) return NextResponse.json({ error: 'The uploaded payment screenshot could not be found. Please upload it again.' }, { status: 400 });
    const duplicate = await prisma.coinPurchase.findFirst({ where: { paymentMethod: method, transactionReference }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: 'This transaction reference has already been submitted.' }, { status: 409 });

    // Authoritative server-side price calculation
    const expectedAmount = calculateCoinsCost(coinsCount, user.role as RoleType);

    const screenshotUrl = `private-payment://${storageKey.split('/').pop()}`;

    const purchase = await prisma.coinPurchase.create({
      data: {
        userId: user.id,
        coinsCount,
        amountPaid: expectedAmount,
        paymentMethod: method,
        screenshotUrl,
        transactionReference: transactionReference || null,
        status: 'UNDER_REVIEW',
      },
    });

    await notifyAdmins({
      type: 'PAYMENT',
      title: 'New coin purchase proof submitted',
      body: `${user.fullName || user.shopName || 'A user'} submitted proof for ${coinsCount} Listing Coins (ETB ${expectedAmount.toLocaleString()}).`,
      priority: 'URGENT',
      path: '/admin/coins',
    });

    return NextResponse.json({
      ok: true,
      purchaseId: purchase.id,
      coinsCount: purchase.coinsCount,
      amountPaid: purchase.amountPaid,
      status: purchase.status,
    }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'This payment reference has already been submitted.' }, { status: 409 });
    console.error('[coins.purchase.POST]', error);
    return NextResponse.json({ error: 'Unable to submit coin purchase.' }, { status: 500 });
  }
}
