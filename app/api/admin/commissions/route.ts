import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const rows = await prisma.commissionLedger.findMany({
      include: {
        seller: { select: { role: true, shopName: true, fullName: true, phone: true } },
        order: { select: { orderNumber: true, status: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[admin.commissions.GET]', error);
    return NextResponse.json({ error: 'Unable to load commission records.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const { ledgerId, amountPaid, note } = await req.json();
    if (typeof ledgerId !== 'string' || !ledgerId) return NextResponse.json({ error: 'Commission record is required.' }, { status: 400 });
    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
      return NextResponse.json({ error: 'Enter a valid settlement amount.' }, { status: 400 });
    }
    const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    const updated = await prisma.$transaction(async tx => {
      const ledger = await tx.commissionLedger.findUnique({ where: { id: ledgerId } });
      if (!ledger) throw new Error('COMMISSION_NOT_FOUND');
      const due = Number(ledger.amountDue);
      const alreadyPaid = Number(ledger.amountPaid);
      if (['PAID', 'WAIVED'].includes(ledger.status) || amount > due - alreadyPaid + 0.000001) {
        throw new Error('INVALID_SETTLEMENT_AMOUNT');
      }
      const nextPaid = Number((alreadyPaid + amount).toFixed(2));
      const status = nextPaid >= due - 0.000001 ? 'PAID' : 'PARTIALLY_PAID';
      const changed = await tx.commissionLedger.updateMany({
        where: { id: ledger.id, amountPaid: ledger.amountPaid, status: ledger.status },
        data: { amountPaid: nextPaid, status, adminNote: noteText || ledger.adminNote, settledAt: status === 'PAID' ? new Date() : null },
      });
      if (changed.count !== 1) throw new Error('COMMISSION_CONFLICT');
      await tx.adminAuditLog.create({
        data: { adminId: admin.id, action: 'COMMISSION_PAYMENT_RECORDED', entityType: 'CommissionLedger', entityId: ledger.id, reason: noteText || `Recorded ETB ${amount.toFixed(2)}` },
      });
      await tx.notification.create({
        data: { userId: ledger.sellerId, type: 'SYSTEM', title: 'Commission settlement updated', body: `ETB ${amount.toFixed(2)} was recorded toward your marketplace commission settlement. Current status: ${status.replaceAll('_', ' ').toLowerCase()}.` },
      });
      return { status, amountPaid: nextPaid, amountDue: due };
    });
    return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'COMMISSION_NOT_FOUND') return NextResponse.json({ error: 'Commission record not found.' }, { status: 404 });
    if (message === 'INVALID_SETTLEMENT_AMOUNT') return NextResponse.json({ error: 'Enter a valid settlement amount. Paid and waived records cannot be changed.' }, { status: 400 });
    if (message === 'COMMISSION_CONFLICT') return NextResponse.json({ error: 'This commission was updated by another administrator. Reload and try again.' }, { status: 409 });
    console.error('[admin.commissions.PATCH]', error);
    return NextResponse.json({ error: 'Unable to record settlement.' }, { status: 500 });
  }
}
