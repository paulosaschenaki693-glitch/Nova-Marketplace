import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const includeDeleted = new URL(req.url).searchParams.get('includeDeleted') === 'true';
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['STUDENT', 'MERCHANT'] },
        ...(includeDeleted ? { deletedAt: { not: null } } : { deletedAt: null }),
      },
      select: {
        id: true, role: true, status: true, fullName: true, shopName: true,
        email: true, phone: true, studentIdNo: true, studentIdImageUrl: true,
        createdAt: true, reviewNote: true, verificationMethod: true,
        verificationReason: true, reviewedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('[admin.users.GET] Failed to load accounts', error);
    return NextResponse.json({ error: 'Unable to load accounts. Apply the reviewed database compatibility SQL if required.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const { userId, decision, note } = await req.json();
    if (!['ACTIVE', 'REJECTED', 'SUSPENDED', 'RESTORE'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
    }
    const target = await prisma.user.findFirst({
      where: { id: String(userId), role: { in: ['STUDENT', 'MERCHANT'] } },
      select: { id: true, role: true },
    });
    if (!target) return NextResponse.json({ error: 'Student or merchant account not found.' }, { status: 404 });

    const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          status: decision === 'RESTORE' ? 'ACTIVE' : decision,
          deletedAt: decision === 'ACTIVE' || decision === 'RESTORE' ? null : undefined,
          reviewNote: noteText || null,
          ...(target.role === 'STUDENT' && ['ACTIVE', 'REJECTED'].includes(decision) ? {
            verificationMethod: 'ADMIN_MANUAL',
            verificationReason: noteText.slice(0, 800) || (decision === 'ACTIVE'
              ? 'Student ID manually approved by an administrator.'
              : 'Student registration rejected by an administrator.'),
          } : {}),
          reviewedAt: new Date(),
          reviewedById: admin.id,
        },
      });
      await tx.adminAuditLog.create({
        data: { adminId: admin.id, action: decision === 'RESTORE' ? 'RESTORE' : decision, entityType: 'User', entityId: target.id, reason: noteText || null },
      });
      await tx.notification.create({
        data: {
          userId: target.id,
          type: 'ACCOUNT',
          title: decision === 'ACTIVE' || decision === 'RESTORE' ? 'Account approved' : 'Account status updated',
          body: noteText || (decision === 'ACTIVE' || decision === 'RESTORE'
            ? 'Your account is active. You can now use the marketplace.'
            : `Your account status is now ${String(decision).toLowerCase()}.`),
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin.users.PATCH] Account update failed', error);
    return NextResponse.json({ error: 'Unable to update account.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const { userId, reason } = await req.json();
    if (!userId || userId === admin.id) return NextResponse.json({ error: 'Invalid user.' }, { status: 400 });
    const target = await prisma.user.findFirst({
      where: { id: String(userId), role: { in: ['STUDENT', 'MERCHANT'] } },
      select: { id: true },
    });
    if (!target) return NextResponse.json({ error: 'Student or merchant account not found.' }, { status: 404 });
    const reasonText = String(reason || 'Soft-deleted by administrator').slice(0, 500);
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: target.id }, data: { deletedAt: new Date(), status: 'SUSPENDED', reviewNote: reasonText } });
      await tx.adminAuditLog.create({
        data: { adminId: admin.id, action: 'SOFT_DELETE', entityType: 'User', entityId: target.id, reason: reasonText },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin.users.DELETE] Account deactivation failed', error);
    return NextResponse.json({ error: 'Unable to deactivate user.' }, { status: 500 });
  }
}
