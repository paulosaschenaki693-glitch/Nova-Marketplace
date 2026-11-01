import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { firebaseAdmin } from '@/lib/firebase-admin';

const schema = z.object({
  role: z.enum(['STUDENT', 'MERCHANT']), fullName: z.string().trim().min(2).optional(),
  shopName: z.string().trim().min(2).optional(), phone: z.string().trim().min(7),
  studentIdNo: z.string().trim().min(3).optional(), studentIdImageUrl: z.string().min(1).optional().or(z.literal('')),
  email: z.string().trim().email(), password: z.string().min(8),
});

export async function POST(req: Request) {
  let createdUid: string | undefined;
  try {
    const data = schema.parse(await req.json());
    const email = data.email.toLowerCase();
    if (data.role === 'STUDENT' && (!data.fullName || !data.studentIdNo || !data.studentIdImageUrl?.startsWith('private://'))) {
      return NextResponse.json({ error: 'Full name, email, student ID number, and student ID image are required.' }, { status: 400 });
    }
    if (data.role === 'MERCHANT' && !data.shopName) return NextResponse.json({ error: 'Shop name is required.' }, { status: 400 });
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, ...(data.studentIdNo ? [{ studentIdNo: data.studentIdNo }] : [])] }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'An account already uses this email or student ID.' }, { status: 409 });

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!apiKey || !projectId) return NextResponse.json({ error: 'Firebase Authentication is not configured. Add the Firebase web API key and project ID.' }, { status: 503 });
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: data.password, returnSecureToken: true }), cache: 'no-store',
    });
    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.localId) {
      const code = authData?.error?.message;
      const message = code === 'EMAIL_EXISTS' ? 'An account already uses this email.' : code === 'WEAK_PASSWORD' ? 'Choose a stronger password with at least 8 characters.' : 'Unable to create your authentication account. Check Firebase Authentication settings.';
      return NextResponse.json({ error: message }, { status: code === 'EMAIL_EXISTS' ? 409 : 400 });
    }
    createdUid = authData.localId;
    const user = await prisma.user.create({ data: {
      id: createdUid, role: data.role, status: 'PENDING', email,
      fullName: data.role === 'STUDENT' ? data.fullName : undefined,
      shopName: data.role === 'MERCHANT' ? data.shopName : undefined,
      phone: data.phone, studentIdNo: data.role === 'STUDENT' ? data.studentIdNo : undefined,
      studentIdImageUrl: data.role === 'STUDENT' ? data.studentIdImageUrl : undefined,
      passwordHash: null,
    }, select: { id: true, status: true } });
    return NextResponse.json({ ok: true, id: user.id, status: user.status }, { status: 201 });
  } catch (error) {
    if (createdUid) {
      try { await firebaseAdmin().auth.deleteUser(createdUid); } catch { /* avoid leaving an orphaned account when possible */ }
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Please check the required fields and password.' }, { status: 400 });
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? 'An account already uses this email or student ID.' : 'Unable to create account. Check Supabase database and Firebase configuration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
