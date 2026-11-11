import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in with an active seller account.' }, { status: 401 });
  try {
    const body = await req.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const shopName = typeof body.shopName === 'string' ? body.shopName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    const publicLocation = typeof body.publicLocation === 'string' ? body.publicLocation.trim() : '';
    const telegramHandle = typeof body.telegramHandle === 'string' ? body.telegramHandle.trim().replace(/^@/, '') : '';
    if (fullName.length < 2 || fullName.length > 80) return NextResponse.json({ error: 'Enter a name between 2 and 80 characters.' }, { status: 400 });
    if (!/^[0-9+()\-\s]{7,20}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
    if (bio.length > 500 || publicLocation.length > 120) return NextResponse.json({ error: 'Bio or location is too long.' }, { status: 400 });
    if (telegramHandle && !/^[A-Za-z0-9_]{5,32}$/.test(telegramHandle)) return NextResponse.json({ error: 'Enter a valid Telegram username.' }, { status: 400 });
    if (user.role === 'MERCHANT' && (shopName.length < 2 || shopName.length > 100)) return NextResponse.json({ error: 'Enter a shop name between 2 and 100 characters.' }, { status: 400 });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { fullName, phone, bio: bio || null, publicLocation: publicLocation || null, telegramHandle: telegramHandle || null, ...(user.role === 'MERCHANT' ? { shopName } : {}) },
      select: { id: true, role: true, fullName: true, shopName: true, phone: true, bio: true, publicLocation: true, telegramHandle: true, profileImageUrl: true },
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error('[profile.PUT]', error);
    return NextResponse.json({ error: 'Unable to update your profile.' }, { status: 500 });
  }
}
