import Link from 'next/link';
import { Header, Footer } from '@/components/header';
import { Store, PlusCircle, Coins, Bell, ShoppingBag, LifeBuoy } from 'lucide-react';

export default function MerchantDashboard() {
  return (
    <>
      <Header />
      <main className="shell section">
        <span className="pill">WELDIYA TOWN · MERCHANT SPACE</span>
        <h1 style={{ fontSize: 34, margin: '8px 0 4px' }}>Shop Management</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage your products, purchase listing coins, and reach thousands of Woldia University students.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 24 }}>
          {[
            ['Shop Coins & Wallet', 'Purchase listing packs to publish products', '/profile?section=coins', Coins],
            ['Add New Product', 'Create a new listing for students to browse', '/merchant/products/new', PlusCircle],
            ['My Shop Products', 'Manage inventory, edit details, or restock', '/merchant/products', Store],
            ['Browse Marketplace', 'See how your products look on campus', '/explore', ShoppingBag],
            ['Notifications', 'Coin approval and account updates', '/notifications', Bell],
            ['Merchant Support', 'Contact the Nova operations team', '/support', LifeBuoy],
          ].map(([t, d, u, I]: any) => (
            <Link href={u} className="surface" style={{ padding: 22, borderRadius: 14 }} key={t}>
              <I color="#10b981" size={24} />
              <h3 style={{ margin: '12px 0 6px', fontSize: 17 }}>{t}</h3>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{d}</p>
              <span style={{ color: '#10b981', fontSize: 13, fontWeight: 700, marginTop: 14, display: 'block' }}>
                Open →
              </span>
            </Link>
          ))}
        </div>

        <div className="surface2" style={{ padding: 20, borderRadius: 14, marginTop: 24, border: '1px solid #10b98140' }}>
          <b style={{ fontSize: 15 }}>🏪 Sell Direct to Woldia University Students</b>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '4px 0 0' }}>
            No percentage commission is deducted from your sales. Your listing fee is paid in coins after approval. Buyers contact your shop directly and arrange payment and pickup with you.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
