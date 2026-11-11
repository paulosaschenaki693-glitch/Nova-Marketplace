import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadMarketplaceFile } from '@/lib/r2-storage';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in with an active seller account.' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a profile image.' }, { status: 400 });
    if (form.get('publicConsent') !== 'true') return NextResponse.json({ error: 'Confirm that your profile image may be displayed publicly.' }, { status: 400 });
    if (file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Profile image must be 5 MB or smaller.' }, { status: 400 });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, WebP, or AVIF.' }, { status: 400 });
    const uploaded = await uploadMarketplaceFile(file, 'profile-image');
    await prisma.user.update({ where: { id: user.id }, data: { profileImageUrl: uploaded.url, profileImagePublicConsentAt: new Date() } });
    return NextResponse.json({ ok: true, profileImageUrl: uploaded.url });
  } catch (error) {
    console.error('[uploads.profile-image]', error);
    return NextResponse.json({ error: 'Profile image upload failed. Check Cloudflare R2 configuration.' }, { status: 503 });
  }
}
