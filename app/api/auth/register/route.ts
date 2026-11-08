import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { firebaseAdmin } from '@/lib/firebase-admin';
import { downloadPrivateFile } from '@/lib/r2-storage';
import { inspectStudentId } from '@/lib/gemini';
import { notifyAdmins } from '@/lib/admin-notifications';
import { WELCOME_COINS } from '@/lib/coins';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  role: z.enum(['STUDENT', 'MERCHANT']), fullName: z.string().trim().min(2).max(120).optional(),
  shopName: z.string().trim().min(2).max(100).optional(), phone: z.string().trim().min(7).max(30),
  studentIdNo: z.string().trim().min(3).max(60).optional(), studentIdImageUrl: z.string().min(1).optional().or(z.literal('')),
  studentIdStorageKey: z.string().optional(), email: z.string().trim().email().max(254), password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  let createdUid: string | undefined;
  try {
    const data = schema.parse(await req.json()); const email = data.email.toLowerCase();
    if (data.role === 'STUDENT' && (!data.fullName || !data.studentIdNo || !data.studentIdStorageKey?.startsWith('student-ids/'))) {
      return NextResponse.json({ error: 'Full name, student ID number, and student ID image are required.' }, { status: 400 });
    }
    if (data.role === 'MERCHANT' && !data.shopName) {
      return NextResponse.json({ error: 'Shop name is required.' }, { status: 400 });
    }
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, ...(data.studentIdNo ? [{ studentIdNo: data.studentIdNo }] : [])] }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'An account already uses this email or student ID.' }, { status: 409 });

    let status: 'ACTIVE' | 'PENDING' = data.role === 'MERCHANT' ? 'ACTIVE' : 'PENDING';
    let verificationMethod = data.role === 'MERCHANT' ? 'FORM_VALIDATION' : 'MANUAL_REVIEW';
    let verificationReason = data.role === 'MERCHANT' ? 'Required merchant registration fields passed validation.' : 'Student ID is awaiting verification.';
    if (data.role === 'STUDENT' && data.studentIdStorageKey) {
      try {
        const stored = await downloadPrivateFile(data.studentIdStorageKey);
        if (stored) {
          const check = await inspectStudentId(stored.bytes, stored.contentType, data.studentIdNo!);
          if (check.layoutRecognized && check.numberReadable && check.matchesEnteredNumber && Number(check.confidence) >= 0.85) {
            status = 'ACTIVE'; verificationMethod = 'GEMINI_AI'; verificationReason = 'Student ID layout and handwritten number matched the registration number.';
          } else {
            verificationReason = Array.isArray(check.reasons) ? check.reasons.join('; ').slice(0, 800) : 'ID number could not be confidently matched; manual review required.';
          }
        } else verificationReason = 'Uploaded ID image could not be retrieved; manual review required.';
      } catch (error) {
        console.error('Student ID AI verification unavailable:', error);
        verificationReason = 'Automatic verification was unavailable; manual review required.';
      }
    }
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY; const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!apiKey || !projectId) return NextResponse.json({ error: 'Firebase Authentication is not configured.' }, { status: 503 });
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: data.password, returnSecureToken: true }), cache: 'no-store' });
    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.localId) {
      const code = authData?.error?.message; const message = code === 'EMAIL_EXISTS' ? 'An account already uses this email.' : code === 'WEAK_PASSWORD' ? 'Choose a stronger password with at least 8 characters.' : 'Unable to create your authentication account. Check Firebase Authentication settings.';
      return NextResponse.json({ error: message }, { status: code === 'EMAIL_EXISTS' ? 409 : 400 });
    }
    createdUid = authData.localId;

    const initialCoins = status === 'ACTIVE' ? WELCOME_COINS : 0;

    const user = await prisma.user.create({
      data: {
        id: createdUid, role: data.role, status, email,
        fullName: data.role === 'STUDENT' ? data.fullName : undefined,
        shopName: data.role === 'MERCHANT' ? data.shopName : undefined,
        phone: data.phone, studentIdNo: data.role === 'STUDENT' ? data.studentIdNo : undefined,
        studentIdImageUrl: data.role === 'STUDENT' ? data.studentIdImageUrl : undefined,
        studentIdStorageKey: data.role === 'STUDENT' ? data.studentIdStorageKey : undefined,
        verificationMethod, verificationReason, reviewedAt: status === 'ACTIVE' ? new Date() : undefined,
        coinBalance: initialCoins,
        passwordHash: null,
        ...(initialCoins > 0 ? {
          coinTransactions: {
            create: {
              amount: initialCoins,
              type: 'WELCOME_BONUS',
              description: `Welcome bonus of ${initialCoins} listing coins credited!`,
            }
          },
          notifications: {
            create: {
              type: 'COIN',
              title: 'Welcome to Nova Marketplace!',
              body: `We've credited ${initialCoins} free Listing Coins to your account. You can now publish your first products!`,
              priority: 'NORMAL',
            }
          }
        } : {})
      },
      select: { id: true, status: true, coinBalance: true }
    });

    if (user.status === 'PENDING') {
      await notifyAdmins({
        type: 'ACCOUNT',
        title: 'Student account needs verification',
        body: `A student registration for ${data.fullName || email} needs manual ID review.`,
        priority: 'HIGH',
      });
    }

    return NextResponse.json({ ok: true, id: user.id, status: user.status, coinBalance: user.coinBalance, verificationMethod }, { status: 201 });
  } catch (error) {
    if (createdUid) { try { await firebaseAdmin().auth.deleteUser(createdUid); } catch { /* cleanup best effort */ } }
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Please check the required fields and password.' }, { status: 400 });
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? 'An account already uses this email or student ID.' : 'Unable to create account. Check Supabase database and Firebase configuration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
