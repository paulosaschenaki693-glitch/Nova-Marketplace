import { NextResponse } from 'next/server';
import { uploadMarketplaceFile } from '@/lib/r2-storage';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
  try {
    const form = await req.formData(); const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 10 MB or smaller.' }, { status: 400 });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, or WebP.' }, { status: 400 });
    const uploaded = await uploadMarketplaceFile(file, 'student-id');
    return NextResponse.json({ url: uploaded.url, storageKey: uploaded.storageKey });
  } catch (e) { return NextResponse.json({ error: e instanceof Error && e.message.includes('not configured') ? e.message : 'Student ID upload failed. Check Cloudflare R2 configuration.' }, { status: 503 }); }
}
