import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        role: true,
        status: true,
        fullName: true,
        shopName: true,
        profileImageUrl: true,
        bio: true,
        publicLocation: true,
        telegramHandle: true,
        verifiedSellerRecords: { where: { status: 'ACTIVE', expiresAt: { gt: new Date() } }, select: { id: true, expiresAt: true }, orderBy: { expiresAt: 'desc' }, take: 1 },
        email: true,
        phone: true,
        studentIdNo: true,
        coinBalance: true,
        reservedCoinBalance: true,
        createdAt: true,
      },
    });
    if (!user) return NextResponse.json({ user: null });
    const { verifiedSellerRecords, ...safeUser } = user;
    return NextResponse.json({ user: { ...safeUser, verifiedSeller: verifiedSellerRecords[0] || null } });
  } catch {
    return NextResponse.json({ error: 'Unable to load account.' }, { status: 500 });
  }
}
