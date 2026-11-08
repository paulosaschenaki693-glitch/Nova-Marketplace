import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { WELCOME_COINS } from '@/lib/coins';

export async function GET(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    // Single user detailed inspection
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          products: {
            include: { images: { orderBy: { sortOrder: 'asc' } }, category: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          coinPurchases: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          coinTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          _count: {
            select: { products: true, coinPurchases: true, reports: true },
          },
        },
      });
      if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      return NextResponse.json(user);
    }

    // List users with filters
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const role = url.searchParams.get('role'); // 'STUDENT' | 'MERCHANT' | null
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('q')?.trim().toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        role: role && ['STUDENT', 'MERCHANT'].includes(role) ? (role as any) : { in: ['STUDENT', 'MERCHANT'] },
        ...(status ? { status: status as any } : {}),
        ...(includeDeleted ? { deletedAt: { not: null } } : { deletedAt: null }),
        ...(search ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { shopName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { studentIdNo: { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      select: {
        id: true,
        role: true,
        status: true,
        fullName: true,
        shopName: true,
        email: true,
        phone: true,
        studentIdNo: true,
        studentIdImageUrl: true,
        coinBalance: true,
        createdAt: true,
        reviewNote: true,
        verificationMethod: true,
        verificationReason: true,
        reviewedAt: true,
        _count: {
          select: { products: true, coinPurchases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[admin.users.GET] Failed to load accounts', error);
    return NextResponse.json({ error: 'Unable to load accounts.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const { userId, decision, note, coinAdjustment } = await req.json();
    const validDecisions = ['ACTIVE', 'REJECTED', 'SUSPENDED', 'RESTORE', 'ADJUST_COINS'];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: String(userId), role: { in: ['STUDENT', 'MERCHANT'] } },
      select: { id: true, role: true, coinBalance: true, reservedCoinBalance: true, status: true, email: true, fullName: true, shopName: true },
    });
    if (!target) return NextResponse.json({ error: 'Student or merchant account not found.' }, { status: 404 });

    const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';

    // Handle Manual Coin Adjustment
    if (decision === 'ADJUST_COINS') {
      const delta = Number(coinAdjustment);
      if (!Number.isInteger(delta) || delta === 0 || delta < -1000 || delta > 1000) {
        return NextResponse.json({ error: 'Enter a valid whole coin adjustment amount (non-zero).' }, { status: 400 });
      }
      let newBalance = target.coinBalance + delta;
      if (newBalance < target.reservedCoinBalance) {
        return NextResponse.json({ error: `This adjustment would reduce the wallet below its ${target.reservedCoinBalance} reserved coins. Release pending listing reservations first.` }, { status: 400 });
      }

      await prisma.$transaction(async tx => {
        const changed = await tx.$executeRaw`UPDATE "User" SET "coinBalance" = "coinBalance" + ${delta} WHERE "id" = ${target.id} AND "coinBalance" + ${delta} >= "reservedCoinBalance" AND "coinBalance" + ${delta} >= 0`;
        if (changed !== 1) throw new Error('COIN_ADJUSTMENT_CONFLICT');
        const updated = await tx.user.findUniqueOrThrow({ where: { id: target.id }, select: { coinBalance: true } });
        newBalance = updated.coinBalance;
        await tx.coinTransaction.create({
          data: {
            userId: target.id,
            amount: delta,
            type: 'ADMIN_ADJUSTMENT',
            description: noteText || `Admin ${delta > 0 ? 'credited' : 'deducted'} ${Math.abs(delta)} listing coins.`,
          },
        });
        await tx.adminAuditLog.create({
          data: {
            adminId: admin.id,
            action: 'COIN_ADJUSTMENT',
            entityType: 'User',
            entityId: target.id,
            reason: `Delta: ${delta > 0 ? '+' : ''}${delta}. New balance: ${newBalance}. Note: ${noteText || 'None'}`,
          },
        });
        await tx.notification.create({
          data: {
            userId: target.id,
            type: 'COIN',
            title: delta > 0 ? 'Listing coins added' : 'Listing coins adjusted',
            body: delta > 0
              ? `An administrator added ${delta} listing coins to your balance. Current balance: ${newBalance} coins.${noteText ? ` Note: ${noteText}` : ''}`
              : `An administrator deducted ${Math.abs(delta)} listing coins from your balance. Current balance: ${newBalance} coins.${noteText ? ` Note: ${noteText}` : ''}`,
            priority: 'NORMAL',
          },
        });
      });

      return NextResponse.json({ ok: true, newBalance });
    }

    // Handle Status Updates: ACTIVE, REJECTED, SUSPENDED, RESTORE
    await prisma.$transaction(async tx => {
      // Check if user should receive welcome bonus upon first approval
      const isActivating = decision === 'ACTIVE' || decision === 'RESTORE';
      let awardWelcome = false;
      if (isActivating && target.coinBalance === 0) {
        const hadWelcome = await tx.coinTransaction.findFirst({
          where: { userId: target.id, type: 'WELCOME_BONUS' },
        });
        if (!hadWelcome) {
          awardWelcome = true;
        }
      }

      await tx.user.update({
        where: { id: target.id },
        data: {
          status: decision === 'RESTORE' ? 'ACTIVE' : decision,
          deletedAt: isActivating ? null : undefined,
          reviewNote: noteText || null,
          ...(awardWelcome ? { coinBalance: { increment: WELCOME_COINS } } : {}),
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

      if (awardWelcome) {
        await tx.coinTransaction.create({
          data: {
            userId: target.id,
            amount: WELCOME_COINS,
            type: 'WELCOME_BONUS',
            description: `Welcome bonus of ${WELCOME_COINS} listing coins credited on account approval!`,
          },
        });
        await tx.notification.create({
          data: {
            userId: target.id,
            type: 'COIN',
            title: 'Welcome Bonus Credited!',
            body: `Your account is approved! We've credited ${WELCOME_COINS} free Listing Coins so you can start posting right away.`,
            priority: 'NORMAL',
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: decision === 'RESTORE' ? 'RESTORE' : decision,
          entityType: 'User',
          entityId: target.id,
          reason: noteText || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: target.id,
          type: 'ACCOUNT',
          title: isActivating ? 'Account approved' : 'Account status updated',
          body: noteText || (isActivating
            ? 'Your account is active. You can now use the marketplace.'
            : `Your account status is now ${String(decision).toLowerCase()}.`),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'COIN_ADJUSTMENT_CONFLICT') return NextResponse.json({ error: 'The wallet changed during this adjustment. Refresh and try again; reserved coins cannot be deducted.' }, { status: 409 });
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
      await tx.user.update({
        where: { id: target.id },
        data: { deletedAt: new Date(), status: 'SUSPENDED', reviewNote: reasonText },
      });
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
