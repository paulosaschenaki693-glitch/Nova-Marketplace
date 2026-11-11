import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { downloadPrivateAgreement } from '@/lib/r2-storage';
export const runtime = 'nodejs';
export async function GET(_: Request, { params }: { params: Promise<{ verificationId: string }> }) {
  const viewer = await requireUser();
  if (!viewer) return new NextResponse('Unauthorized', { status: 401 });
  const { verificationId } = await params;
  const record = await prisma.verifiedSeller.findUnique({ where: { id: verificationId }, select: { userId: true, agreementStorageKey: true, agreementFileName: true } });
  if (!record?.agreementStorageKey) return new NextResponse('Not found', { status: 404 });
  if (viewer.role !== 'ADMIN' && viewer.id !== record.userId) return new NextResponse('Forbidden', { status: 403 });
  const file = await downloadPrivateAgreement(record.agreementStorageKey);
  if (!file) return new NextResponse('Not found', { status: 404 });
  const safeName = (record.agreementFileName || 'signed-agreement').replace(/[\\/\r\n"]/g, '_').slice(0, 160);
  return new NextResponse(file.bytes, { headers: { 'Content-Type': file.contentType, 'Content-Disposition': `attachment; filename="${safeName}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" } });
}
