import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Active seller account required.' }, { status: 401 });
  try {
    const rows = await prisma.verifiedSeller.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 12 });
    const now = new Date();
    return NextResponse.json({
      pricing: { currency: 'ETB', durationMonths: 6, amount: user.role === 'STUDENT' ? 3999 : 5999 },
      applications: rows.map(row => ({
        id: row.id, status: row.status === 'ACTIVE' && row.expiresAt && row.expiresAt <= now ? 'EXPIRED' : row.status,
        feeAmount: row.feeAmount.toString(), currency: row.currency, createdAt: row.createdAt,
        startsAt: row.startsAt, expiresAt: row.expiresAt, suspensionReason: row.suspensionReason,
        revocationReason: row.revocationReason, responseRequest: row.responseRequest,
        responseDeadline: row.responseDeadline, sellerResponse: row.sellerResponse,
        sellerResponseAt: row.sellerResponseAt, agreementAvailable: Boolean(row.agreementStorageKey),
        agreementFileName: row.agreementFileName,
      })),
    });
  } catch (error) {
    console.error('[verified-seller.GET]', error);
    return NextResponse.json({ error: 'Unable to load verification history.' }, { status: 500 });
  }
}

export async function POST() {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Active seller account required.' }, { status: 401 });
  try {
    const now = new Date();
    const existing = await prisma.verifiedSeller.findFirst({
      where: { userId: user.id, OR: [{ status: { in: ['PENDING', 'SUSPENDED'] } }, { status: 'ACTIVE', expiresAt: { gt: now } }] },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: 'You already have a pending or current verification record.' }, { status: 409 });
    await prisma.verifiedSeller.updateMany({
      where: { userId: user.id, status: 'ACTIVE', expiresAt: { lte: now } }, data: { status: 'EXPIRED' },
    });
    const feeAmount = user.role === 'STUDENT' ? 3999 : 5999;
    const row = await prisma.verifiedSeller.create({ data: { userId: user.id, feeAmount, currency: 'ETB', status: 'PENDING' } });
    await prisma.notification.create({
      data: { userId: user.id, type: 'SYSTEM', title: 'Nova Verified Seller application received',
        body: 'Your application is pending. Nova will review your seller details and arrange the agreement and payment steps. Do not send payment until you receive official instructions.' },
    });
    return NextResponse.json({ ok: true, applicationId: row.id }, { status: 201 });
  } catch (error) {
    console.error('[verified-seller.POST]', error);
    return NextResponse.json({ error: 'Unable to submit your application.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Active seller account required.' }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action !== 'respond' || typeof body.response !== 'string') return NextResponse.json({ error: 'Invalid response.' }, { status: 400 });
    const response = body.response.trim().slice(0, 2000);
    if (response.length < 5) return NextResponse.json({ error: 'Please provide at least 5 characters.' }, { status: 400 });
    const row = await prisma.verifiedSeller.findFirst({
      where: { id: String(body.applicationId || ''), userId: user.id, status: { in: ['ACTIVE', 'SUSPENDED'] },
        responseRequest: { not: null }, responseDeadline: { gt: new Date() }, sellerResponseAt: null },
      select: { id: true },
    });
    if (!row) return NextResponse.json({ error: 'There is no open response request for this verification.' }, { status: 404 });
    await prisma.$transaction(async tx => {
      await tx.verifiedSeller.update({ where: { id: row.id }, data: { sellerResponse: response, sellerResponseAt: new Date() } });
      await tx.notification.create({ data: { userId: user.id, type: 'SYSTEM', title: 'Your verification response was received', body: 'Nova has received your response and will review it.' } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[verified-seller.PATCH]', error);
    return NextResponse.json({ error: 'Unable to submit your response.' }, { status: 500 });
  }
}
