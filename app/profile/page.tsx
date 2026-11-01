import { Suspense } from 'react';
import ProfileHub from '@/components/profile-hub';
export default function ProfilePage(){return <Suspense fallback={<main className="shell section">Loading profile…</main>}><ProfileHub/></Suspense>}
