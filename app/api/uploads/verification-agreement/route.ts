import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { uploadPrivateAgreement } from '@/lib/r2-storage';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
  const admin = await requireUser(['ADMIN']);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    const form = await req.formData(), file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose the signed agreement.' }, { status: 400 });
    if (file.size < 1 || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Agreement must be 10 MB or smaller.' }, { status: 400 });
    const uploaded = await uploadPrivateAgreement(file);
    return NextResponse.json({ ok: true, ...uploaded, agreementFileName: file.name.slice(0, 160) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Agreement') || message.includes('contents')) return NextResponse.json({ error: message }, { status: 400 });
    console.error('[uploads.verification-agreement]', error);
    return NextResponse.json({ error: 'Agreement upload failed. Check private R2 configuration.' }, { status: 503 });
  }
}
