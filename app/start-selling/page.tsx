'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header, Footer } from '@/components/header';
export default function StartSellingPage() {
  const router = useRouter(); const [message, setMessage] = useState('Checking your account…');
  useEffect(() => { let active = true; fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).then(({ user }) => {
    if (!active) return;
    if (!user) { router.replace('/login?next=%2Fstart-selling'); return; }
    if (user.status === 'PENDING') { router.replace('/verification/pending'); return; }
    if (user.status !== 'ACTIVE') { router.replace('/profile?section=support'); return; }
    if (user.role === 'STUDENT') { router.replace('/student/listings'); return; }
    if (user.role === 'MERCHANT') { router.replace('/merchant/products'); return; }
    if (user.role === 'ADMIN') { router.replace('/admin/dashboard'); return; }
    setMessage('This account cannot access selling features.');
  }).catch(() => setMessage('Unable to verify your account. Please try again.')); return () => { active = false; }; }, [router]);
  return <><Header/><main className="shell section" style={{minHeight:'60vh'}}><div className="surface" style={{padding:24,maxWidth:520,margin:'auto'}}><h1>Start selling</h1><p className="muted">{message}</p><Link className="btn btn-ghost" href="/support">Contact support</Link></div></main><Footer/></>;
}
