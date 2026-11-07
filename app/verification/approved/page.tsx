import Link from 'next/link';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function Approved() {
  return <main className="shell" style={{ padding: '12vh 0', maxWidth: 600, textAlign: 'center' }}>
    <div className="surface" style={{ padding: 35 }}>
      <div className="brandmark" style={{ width: 58, height: 58, fontSize: 26, margin: '0 auto 20px', background: 'linear-gradient(140deg,#9d7aff,#6c37ed)' }}><CheckCircle2 /></div>
      <span className="pill">ACCOUNT ACTIVE</span>
      <h1 style={{ fontSize: 32 }}>You're ready to go.</h1>
      <p className="muted" style={{ lineHeight: 1.8 }}>Your account is active. Sign in with the email and password you registered with to start using Nova Campus Marketplace.</p>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        <Link href="/login/student" className="btn btn-primary">Student sign in</Link>
        <Link href="/login/merchant" className="btn btn-ghost">Merchant sign in</Link>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 20 }}><ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Your verification details are kept private.</p>
    </div>
  </main>;
}
