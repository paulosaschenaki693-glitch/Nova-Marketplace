import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { role, identifier, password } = await req.json();
    if (!['STUDENT', 'MERCHANT', 'ADMIN'].includes(role) || !identifier || !password) return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
    const email = String(identifier).trim().toLowerCase();
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Firebase Authentication is not configured.' }, { status: 503 });
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: String(password), returnSecureToken: true }), cache: 'no-store',
    });
    const authData = await response.json();
    if (!response.ok || !authData.localId) return NextResponse.json({ error: 'The email or password is incorrect.' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: authData.localId } });
    if (!user || user.role !== role) return NextResponse.json({ error: 'No marketplace account matches this login type.' }, { status: 403 });
    if (user.status !== 'ACTIVE') return NextResponse.json({ error: user.status === 'PENDING' ? 'Your account is awaiting admin approval.' : 'This account is not active. Please contact support.' }, { status: 403 });
    await createSession(user);
    return NextResponse.json({ ok: true, role: user.role });
  } catch {
    return NextResponse.json({ error: 'Unable to sign in. Check Firebase and Supabase configuration.' }, { status: 500 });
  }
}
