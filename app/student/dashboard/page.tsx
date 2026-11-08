import Link from 'next/link';
import { Header, Footer } from '@/components/header';
import { ShoppingBag, Heart, Store, Coins, Bell, LifeBuoy, PlusCircle } from 'lucide-react';

export default function StudentDashboard() {
  return (
    <>
      <Header />
      <main className="shell section">
        <span className="pill">WOLDIA UNIVERSITY · STUDENT SPACE</span>
        <h1 style={{ fontSize: 34, margin: '8px 0 4px' }}>Student Hub</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage your listings, buy discounted student coins, and shop directly from campus peers.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 24 }}>
          {[
            ['My Coins & Wallet', 'Buy coins with student discount (from 10 ETB)', '/profile?section=coins', Coins],
            ['Post New Item', 'Publish a textbook, laptop, or room item', '/student/listings/new', PlusCircle],
            ['My Published Items', 'Manage, edit, or restock your listings', '/student/listings', ShoppingBag],
            ['Explore Marketplace', 'Browse deals from Woldia campus peers', '/explore', Store],
            ['Saved Products', 'Items you have saved for later', '/profile?section=favorites', Heart],
            ['Notifications', 'Coin approval and listing updates', '/notifications', Bell],
          ].map(([t, d, u, I]: any) => (
            <Link href={u} className="surface" style={{ padding: 22, borderRadius: 14 }} key={t}>
              <I color="var(--purple2)" size={24} />
              <h3 style={{ margin: '12px 0 6px', fontSize: 17 }}>{t}</h3>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{d}</p>
              <span style={{ color: 'var(--purple2)', fontSize: 13, fontWeight: 700, marginTop: 14, display: 'block' }}>
                Open →
              </span>
            </Link>
          ))}
        </div>

        <div className="surface2" style={{ padding: 20, borderRadius: 14, marginTop: 24 }}>
          <b style={{ fontSize: 15 }}>🎓 Direct Campus Deals · 100% Zero Commission</b>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '4px 0 0' }}>
            As a student, you pay the displayed listing fee in coins after approval. Buyers call or message you directly. You keep your full selling price.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
