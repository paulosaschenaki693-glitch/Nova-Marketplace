import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { downloadPrivateFile } from '@/lib/supabase-storage';
export const runtime = 'nodejs';
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser(['ADMIN']); if (!user) return new NextResponse('Forbidden', { status: 403 });
  const { key } = await params; const file = await downloadPrivateFile(`student-ids/${key}`);
  if (!file) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(file.bytes, { headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
