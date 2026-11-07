import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { uploadMarketplaceFile } from '@/lib/r2-storage';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
  const user = await requireUser(['STUDENT', 'MERCHANT']);
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const form = await req.formData(); const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, WebP, or AVIF.' }, { status: 400 });
    const uploaded = await uploadMarketplaceFile(file, 'payment-proof');
    return NextResponse.json({ url: `private-payment://${uploaded.storageKey.split('/').pop()}`, storageKey: uploaded.storageKey });
  } catch { return NextResponse.json({ error: 'Payment proof upload failed. Check Cloudflare R2 configuration.' }, { status: 503 }); }
}
