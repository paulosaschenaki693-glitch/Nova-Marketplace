import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { privateAgreementExists } from '@/lib/r2-storage';

export async function GET(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const url = new URL(req.url), status = url.searchParams.get('status'), q = url.searchParams.get('q')?.trim();
    const now = new Date();
    const where: any = {
      ...(status === 'EXPIRED' ? { OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', expiresAt: { lte: now } }] }
        : status === 'ACTIVE' ? { status: 'ACTIVE', expiresAt: { gt: now } }
        : status && ['PENDING', 'SUSPENDED', 'REVOKED'].includes(status) ? { status } : {}),
      ...(q ? { user: { OR: [
        { fullName: { contains: q, mode: 'insensitive' } }, { shopName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } },
      ] } } : {}),
    };
    const rows = await prisma.verifiedSeller.findMany({
      where, include: { user: { select: { id: true, role: true, status: true, fullName: true, shopName: true, email: true, phone: true, profileImageUrl: true } } },
      orderBy: { createdAt: 'desc' }, take: 300,
    });
    return NextResponse.json(rows.map(row => ({
      ...row, feeAmount: row.feeAmount.toString(),
      effectiveStatus: row.status === 'ACTIVE' && row.expiresAt && row.expiresAt <= now ? 'EXPIRED' : row.status,
      agreementAvailable: Boolean(row.agreementStorageKey),
    })));
  } catch (error) {
    console.error('[admin.verified-sellers.GET]', error);
    return NextResponse.json({ error: 'Unable to load verified sellers.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const body = await req.json(), id = String(body.id || ''), action = String(body.action || '');
    if (!id || !['activate', 'request_response', 'suspend', 'restore', 'revoke'].includes(action)) return NextResponse.json({ error: 'Invalid verification action.' }, { status: 400 });
    const current = await prisma.verifiedSeller.findUnique({ where: { id }, include: { user: { select: { status: true } } } });
    if (!current) return NextResponse.json({ error: 'Verification record not found.' }, { status: 404 });
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    const now = new Date();
    let data: any = { updatedByAdminId: admin.id, reviewedByAdminId: admin.id };

    if (action === 'activate') {
      if (current.status !== 'PENDING' || current.user.status !== 'ACTIVE') return NextResponse.json({ error: 'Only pending applications from active sellers can be activated.' }, { status: 409 });
      const paymentMethod = String(body.paymentMethod || '');
      if (!['TELEBIRR', 'CBE', 'BOA'].includes(paymentMethod)) return NextResponse.json({ error: 'Select the confirmed payment method.' }, { status: 400 });
      const signedAt = new Date(String(body.signedAt || ''));
      if (Number.isNaN(signedAt.getTime()) || signedAt > now) return NextResponse.json({ error: 'Enter a valid signed date.' }, { status: 400 });
      const agreementStorageKey = String(body.agreementStorageKey || '');
      if (!(await privateAgreementExists(agreementStorageKey))) return NextResponse.json({ error: 'Upload the signed agreement PDF or image first.' }, { status: 400 });
      const expiresAt = new Date(now); expiresAt.setMonth(expiresAt.getMonth() + 6);
      data = {
        ...data, status: 'ACTIVE', paymentMethod, paymentReference: String(body.paymentReference || '').trim().slice(0, 120) || null,
        paymentReceivedAt: now, agreementStorageKey,
        agreementFileName: String(body.agreementFileName || 'signed-agreement').replace(/[\\/\r\n"]/g, '_').slice(0, 160),
        agreementContentType: String(body.agreementContentType || ''), agreementSize: Number.isInteger(body.agreementSize) ? body.agreementSize : null,
        signedAt, startsAt: now, expiresAt, activatedAt: now,
        adminNotes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) || null : null,
      };
    } else if (action === 'request_response') {
      if (!['ACTIVE', 'SUSPENDED'].includes(current.status) || reason.length < 5) return NextResponse.json({ error: 'A current verification and a clear concern are required.' }, { status: 409 });
      const deadline = new Date(String(body.responseDeadline || ''));
      if (Number.isNaN(deadline.getTime()) || deadline <= now) return NextResponse.json({ error: 'Choose a response deadline in the future.' }, { status: 400 });
      data = { ...data, responseRequest: reason, responseDeadline: deadline, sellerResponse: null, sellerResponseAt: null };
    } else if (action === 'suspend') {
      if (!['ACTIVE', 'PENDING'].includes(current.status) || reason.length < 5) return NextResponse.json({ error: 'A reason is required for suspension.' }, { status: 409 });
      data = { ...data, status: 'SUSPENDED', suspendedAt: now, suspensionReason: reason };
    } else if (action === 'restore') {
      if (current.status !== 'SUSPENDED') return NextResponse.json({ error: 'Only a suspended application or verification can be restored.' }, { status: 409 });
      const restoredStatus = current.startsAt && current.expiresAt && current.expiresAt > now ? 'ACTIVE' : !current.startsAt ? 'PENDING' : null;
      if (!restoredStatus) return NextResponse.json({ error: 'This verification term has expired and cannot be restored.' }, { status: 409 });
      data = { ...data, status: restoredStatus, suspendedAt: null, suspensionReason: null };
    } else if (action === 'revoke') {
      if (!['ACTIVE', 'SUSPENDED'].includes(current.status) || reason.length < 5) return NextResponse.json({ error: 'A current verification and revocation reason are required.' }, { status: 409 });
      data = { ...data, status: 'REVOKED', revokedAt: now, revocationReason: reason };
    }

    await prisma.$transaction(async tx => {
      await tx.verifiedSeller.update({ where: { id }, data });
      await tx.adminAuditLog.create({ data: {
        adminId: admin.id, action: `VERIFIED_SELLER_${action.toUpperCase()}`, entityType: 'VerifiedSeller', entityId: id,
        reason: action === 'activate' ? 'Signed agreement and payment manually confirmed.' : reason || null,
      } });
      const title = action === 'activate' ? 'Nova Verified Seller badge activated'
        : action === 'suspend' ? 'Nova Verified Seller badge suspended'
        : action === 'revoke' ? 'Nova Verified Seller badge revoked'
        : action === 'restore' ? (current.startsAt ? 'Nova Verified Seller badge restored' : 'Verification application returned to review') : 'Nova requested a response about your verification';
      const notice = action === 'activate'
        ? 'Your Nova Verified Seller badge is active for six months. Check your verification page for expiry and agreement.'
        : action === 'request_response' ? `Nova needs your response: ${reason}`
        : action === 'suspend' ? `Your badge is temporarily hidden while Nova reviews a compliance concern. Reason: ${reason}`
        : action === 'revoke' ? `Your verification was revoked. Reason: ${reason}`
        : action === 'restore' ? (current.startsAt ? 'Your Nova Verified Seller badge has been restored.' : 'Your application has been returned to pending review.') : '';
      await tx.notification.create({ data: { userId: current.userId, type: 'SYSTEM', title, body: notice, priority: ['suspend', 'revoke'].includes(action) ? 'HIGH' : 'NORMAL' } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin.verified-sellers.PATCH]', error);
    return NextResponse.json({ error: 'Unable to update verification.' }, { status: 500 });
  }
}
