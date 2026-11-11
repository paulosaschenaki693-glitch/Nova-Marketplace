'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header, Footer } from '@/components/header';
import {
  Shield,
  Package,
  PackageX,
  LifeBuoy,
  UserRound,
  ExternalLink,
  Heart,
  Coins,
  CheckCircle2,
  Upload,
  ArrowRight,
  Clock,
  Sparkles,
  X,
  PanelLeft,
} from 'lucide-react';
import { COIN_PACKAGES, CUSTOM_COIN_RATES, calculateCoinsCost } from '@/lib/coins';
import { ProfileAvatar } from '@/components/profile-avatar';

const sections = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'coins', label: 'My Coins & Wallet', icon: Coins },
  { id: 'products', label: 'My Products', icon: Package },
  { id: 'soldout', label: 'Sold-out Products', icon: PackageX },
  { id: 'favorites', label: 'Saved Products', icon: Heart },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'support', label: 'Support', icon: LifeBuoy },
];

export default function ProfileHub() {
  const params = useSearchParams();
  const active = sections.some(s => s.id === params.get('section')) ? params.get('section')! : 'overview';

  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [coinData, setCoinData] = useState<any>({ purchases: [], transactions: [] });
  const [accounts, setAccounts] = useState<any>({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Coin Purchase Modal state
  const [selectedCoins, setSelectedCoins] = useState<number | null>(null);
  const [customCoins, setCustomCoins] = useState('10');
  const [paymentMethod, setPaymentMethod] = useState<'TELEBIRR' | 'CBE' | 'BOA'>('TELEBIRR');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [buyBusy, setBuyBusy] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyError, setBuyError] = useState('');

  async function load() {
    try {
      const me = await fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json());
      if (!me.user) {
        window.location.href = '/login';
        return;
      }
      setUser(me.user);

      if (me.user.status === 'ACTIVE' && ['STUDENT', 'MERCHANT'].includes(me.user.role)) {
        const [p, fav, coins, acc] = await Promise.all([
          fetch('/api/my-products').then(r => (r.ok ? r.json() : [])),
          fetch('/api/favorites', { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])),
          fetch('/api/coins/purchase', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { purchases: [], transactions: [] })),
          fetch('/api/payment-settings', { cache: 'no-store' }).then(r => (r.ok ? r.json() : {})),
        ]);
        setProducts(Array.isArray(p) ? p : []);
        setFavorites(Array.isArray(fav) ? fav : []);
        setCoinData(coins);
        setAccounts(acc);
      }
    } catch {
      setError('Unable to load your account information.');
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, []);

  async function renewProduct(product: any) {
    setBusyId(product.id);
    setError('');
    try {
      const response = await fetch(`/api/my-products/${product.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'renew' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to renew listing.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to renew listing.');
    } finally { setBusyId(''); }
  }

  async function restock(product: any) {
    const raw = window.prompt(`New stock quantity for “${product.title}”`, String(Math.max(1, product.quantity || 1)));
    if (raw === null) return;
    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Enter a whole number greater than zero.');
      return;
    }
    setBusyId(product.id);
    setError('');
    try {
      const r = await fetch(`/api/my-products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not restock product.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restock product.');
    } finally {
      setBusyId('');
    }
  }

  async function submitCoinPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCoins || selectedCoins <= 0) {
      setBuyError('Choose a valid coin package.');
      return;
    }
    if (!receiptFile) {
      setBuyError('Please upload your transfer screenshot receipt.');
      return;
    }

    setBuyBusy(true);
    setBuyError('');
    try {
      const fd = new FormData();
      fd.append('file', receiptFile);
      const up = await fetch('/api/uploads/payment-proof', { method: 'POST', body: fd });
      const ud = await up.json();
      if (!up.ok) throw new Error(ud.error || 'Receipt upload failed.');

      const res = await fetch('/api/coins/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinsCount: selectedCoins,
          method: paymentMethod,
          storageKey: ud.storageKey,
          transactionReference: transactionRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit coin order.');

      setBuySuccess(true);
      await load();
      setTimeout(() => {
        setSelectedCoins(null);
        setBuySuccess(false);
        setReceiptFile(null);
        setTransactionRef('');
      }, 2500);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Failed to submit payment proof.');
    } finally {
      setBuyBusy(false);
    }
  }

  const isStudent = user?.role === 'STUDENT';
  const customCoinsCount = Math.max(1, parseInt(customCoins, 10) || 1);
  const customCost = calculateCoinsCost(customCoinsCount, user?.role || 'STUDENT');

  const mine = products.filter(p => p.quantity > 0 && !['SOLD', 'ARCHIVED'].includes(p.status));
  const sold = products.filter(p => p.quantity <= 0 || p.status === 'SOLD');
  const visibleSections = sections.filter(
    s => !['products', 'soldout', 'coins'].includes(s.id) || ['STUDENT', 'MERCHANT'].includes(user?.role)
  );
  const heading = sections.find(s => s.id === active)?.label || 'Overview';

  return (
    <>
      <Header />
      <main className="shell section">
        <div className="profile-layout">
          {/* Frosted Backdrop for Left Corner Drawer */}
          <button
            type="button"
            className="profile-sidebar-backdrop"
            aria-label="Close profile navigation"
            aria-hidden={!sidebarOpen}
            tabIndex={sidebarOpen ? 0 : -1}
            onClick={() => setSidebarOpen(false)}
            hidden={!sidebarOpen}
          />

          {/* Left Corner Hidden Drawer (Slides out from left corner) */}
          <aside className={`surface profile-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="profile-sidebar-close"
              aria-label="Close navigation"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>

            <div className="profile-user">
              <ProfileAvatar name={user?.fullName || user?.shopName || user?.email} imageUrl={user?.profileImageUrl} verified={Boolean(user?.verifiedSeller)} size={48} />
              <div>
                <b>{user?.fullName || user?.shopName || 'Your account'}</b>
                <small className="muted">
                  {user?.role === 'MERCHANT' ? '🏪 Weldiya Merchant' : user?.role === 'STUDENT' ? '🎓 Woldia Student' : user?.role}
                </small>
              </div>
            </div>

            <nav aria-label="Profile sections">
              {visibleSections.map(s => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.id}
                    className={`profile-nav-link ${active === s.id ? 'active' : ''}`}
                    href={s.id === 'overview' ? '/profile' : `/profile?section=${s.id}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={17} />
                    <span>{s.label}</span>
                    {s.id === 'coins' && user?.coinBalance !== undefined && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          background: 'var(--purple-soft)',
                          color: 'var(--purple2)',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        <Coins size={11} color="var(--purple2)" style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {user.coinBalance}
                      </span>
                    )}
                  </Link>
                );
              })}
              {user?.role === 'ADMIN' && (
                <Link className="profile-nav-link" href="/admin/dashboard" onClick={() => setSidebarOpen(false)}>
                  <ExternalLink size={17} />
                  Admin Dashboard
                </Link>
              )}
            </nav>

            <button
              className="btn btn-ghost profile-logout"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
              }}
            >
              Sign out
            </button>
          </aside>

          {/* Main Content Area */}
          <section className="profile-content">
            {/* Top Bar with Dedicated Left Corner Drawer Toggle Button */}
            <div className="profile-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button
                type="button"
                className="profile-left-toggle-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open profile features drawer from left corner"
              >
                <PanelLeft size={18} color="var(--purple2)" />
                <span>Account Features</span>
                <span className="pill" style={{ marginLeft: 4, fontSize: 11 }}>{heading}</span>
              </button>

              {user && ['STUDENT', 'MERCHANT'].includes(user.role) && (
                <Link
                  href="/profile?section=coins"
                  className="pill row"
                  style={{
                    background: 'var(--purple-soft)',
                    color: 'var(--purple2)',
                    fontWeight: 700,
                    gap: 6,
                    padding: '6px 12px',
                    textDecoration: 'none',
                  }}
                >
                  <Coins size={14} color="var(--purple2)" />
                  <span>{user.coinBalance ?? 0} Coins</span>
                </Link>
              )}
            </div>

            <div className="profile-heading">
              <div>
                <p className="pill">ACCOUNT & WALLET</p>
                <h1>{heading}</h1>
                <p className="muted">Manage your Nova Marketplace profile, listings, and coin wallet.</p>
              </div>
            </div>

            {error && <div className="surface2 profile-error">{error}</div>}

            {/* OVERVIEW SECTION */}
            {active === 'overview' && (
              <>
                <div className="surface profile-welcome">
                  <h2>Welcome{user?.fullName ? ' back, ' + user.fullName.split(' ')[0] : ''}!</h2>
                  <p className="muted">Direct campus marketplace overview and shortcuts.</p>
                  <div className="profile-stats">
                    <div>
                      <small className="muted">Account status</small>
                      <b>{user?.status || 'Loading…'}</b>
                    </div>
                    {['STUDENT', 'MERCHANT'].includes(user?.role) && (
                      <div>
                        <small className="muted">Listing Coins</small>
                        <b style={{ color: 'var(--purple2)' }}>
                          <Coins size={15} color="var(--purple2)" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                          {user?.coinBalance ?? 0} Coins
                        </b>
                      </div>
                    )}
                    {['STUDENT', 'MERCHANT'].includes(user?.role) && (
                      <div>
                        <small className="muted">Active listings</small>
                        <b>{mine.length}</b>
                      </div>
                    )}
                  </div>
                </div>

                <div className="profile-shortcuts">
                  {visibleSections
                    .filter(s => s.id !== 'overview')
                    .map(s => {
                      const Icon = s.icon;
                      return (
                        <Link key={s.id} href={`/profile?section=${s.id}`} className="surface profile-shortcut">
                          <Icon size={20} />
                          <b>{s.label}</b>
                          <span className="muted">Open section →</span>
                        </Link>
                      );
                    })}
                </div>

                <div className="surface profile-details">
                  <div className="row" style={{justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><h3>Account information</h3><Link href="/profile/edit" className="btn btn-primary">Edit profile</Link></div>
                  <Link href="/profile/verified" className="btn btn-ghost" style={{marginBottom:12}}>Nova Verified Seller</Link>
                  <Info label="Name / shop" value={user?.fullName || user?.shopName} />
                  <Info label="Email" value={user?.email} />
                  <Info label="Phone" value={user?.phone} />
                  {user?.studentIdNo && <Info label="Student ID" value={user?.studentIdNo} />}
                  <Info label="Role" value={user?.role === 'MERCHANT' ? 'Merchant (Weldiya town)' : 'Woldia University Student'} />
                </div>
              </>
            )}

            {/* MY COINS & WALLET SECTION */}
            {active === 'coins' && (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Balance Hero Card */}
                <div
                  className="surface"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: '2px solid var(--purple)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <div className="row" style={{ gap: 14, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: 'var(--purple-soft)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Coins size={30} color="var(--purple2)" />
                    </div>
                    <div>
                      <span className="muted" style={{ fontSize: 13 }}>Your Available Balance</span>
                      <h2 style={{ fontSize: 32, margin: '2px 0 0', color: 'var(--purple2)' }}>
                        {Math.max(0, (user?.coinBalance ?? 0) - (user?.reservedCoinBalance ?? 0))} Available Coins
                      </h2>
                    </div>
                  </div>

                  <p className="muted" style={{ fontSize: 12, margin: '6px 0 12px' }}>
                    {user?.reservedCoinBalance ? `${user.reservedCoinBalance} coins are reserved for listings awaiting review.` : 'No coins are currently reserved.'}
                  </p>
                  <div>
                    <span className="pill" style={{ background: isStudent ? '#6366f120' : '#10b98120', color: isStudent ? '#6366f1' : '#10b981' }}>
                      {isStudent ? '🎓 Student Discount Applied' : '🏪 Merchant Standard Rates'}
                    </span>
                  </div>
                </div>

                {/* Coin Packages Grid */}
                <div>
                  <h3 style={{ fontSize: 20, margin: '10px 0 6px' }}>Purchase Listing Coins</h3>
                  <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>
                    Coins are charged only when a listing becomes active. You keep 100% of your selling price with no post-sale commissions.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
                    {COIN_PACKAGES.map(pack => {
                      const cost = isStudent ? pack.studentPrice : pack.merchantPrice;
                      return (
                        <div
                          key={pack.id}
                          className="surface"
                          style={{
                            padding: 20,
                            borderRadius: 14,
                            border: pack.isPopular ? '2px solid var(--purple2)' : '1px solid var(--border)',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          {pack.isPopular && (
                            <span
                              style={{
                                position: 'absolute',
                                top: -10,
                                right: 16,
                                background: 'var(--purple2)',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 10,
                              }}
                            >
                              MOST POPULAR
                            </span>
                          )}

                          <div>
                            <span className="pill" style={{ fontSize: 12 }}>{pack.label}</span>
                            <h2 style={{ fontSize: 28, margin: '14px 0 4px', color: 'var(--purple2)' }}>
                              {pack.coins} {pack.coins === 1 ? 'Coin' : 'Coins'}
                            </h2>
                            <p style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
                              ETB {cost}
                            </p>
                            <small className="muted" style={{ fontSize: 12 }}>
                              ~{(cost / pack.coins).toFixed(1)} ETB per coin
                            </small>
                          </div>

                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}
                            onClick={() => setSelectedCoins(pack.coins)}
                          >
                            Buy {pack.coins} Coins
                          </button>
                        </div>
                      );
                    })}

                    {/* Custom Coins Card */}
                    <div
                      className="surface"
                      style={{
                        padding: 20,
                        borderRadius: 14,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span className="pill" style={{ fontSize: 12 }}>Custom Pack</span>
                        <h4 style={{ fontSize: 16, margin: '12px 0 8px' }}>Choose Amount</h4>
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={customCoins}
                            onChange={e => setCustomCoins(e.target.value)}
                            className="input"
                            style={{ width: 90, padding: '8px 10px', fontSize: 16, fontWeight: 700 }}
                          />
                          <span style={{ fontSize: 14, fontWeight: 600 }}>Coins</span>
                        </div>
                        <p style={{ fontSize: 22, fontWeight: 800, margin: '12px 0 0' }}>
                          ETB {customCost}
                        </p>
                        <small className="muted" style={{ fontSize: 11 }}>
                          Rate: {isStudent ? '12' : '22'} ETB/coin
                        </small>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}
                        onClick={() => setSelectedCoins(customCoinsCount)}
                      >
                        Buy {customCoinsCount} Coins
                      </button>
                    </div>
                  </div>
                </div>

                {/* Coin Purchases History */}
                <div className="surface" style={{ padding: 20, borderRadius: 14 }}>
                  <h4 style={{ fontSize: 16, margin: '0 0 12px' }}>Your Coin Purchase Requests</h4>
                  {coinData.purchases?.length ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {coinData.purchases.map((pur: any) => (
                        <div key={pur.id} className="surface2 row" style={{ padding: 12, borderRadius: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <b>{pur.coinsCount} Listing Coins</b>
                            <p style={{ margin: '3px 0 0', fontSize: 12 }} className="muted">
                              ETB {Number(pur.amountPaid).toLocaleString()} via {pur.paymentMethod} · {new Date(pur.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`status ${pur.status === 'APPROVED' ? 'success' : pur.status === 'UNDER_REVIEW' ? 'warn' : 'danger'}`}>
                            {pur.status?.replaceAll('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>No coin purchases submitted yet.</p>
                  )}
                </div>

                {/* Coin Transactions Ledger */}
                {coinData.transactions?.length > 0 && (
                  <div className="surface" style={{ padding: 20, borderRadius: 14 }}>
                    <h4 style={{ fontSize: 16, margin: '0 0 12px' }}>Coin Ledger Log</h4>
                    <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                      {coinData.transactions.map((tx: any) => (
                        <div key={tx.id} className="surface2 row" style={{ padding: 10, borderRadius: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <b>{tx.type}</b>
                            <p style={{ margin: '2px 0 0', fontSize: 12 }} className="muted">{tx.description}</p>
                          </div>
                          <b style={{ color: tx.amount > 0 ? '#10b981' : '#f43f5e' }}>
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount} Coins
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MY PRODUCTS */}
            {active === 'products' && (
              <>
                <div className="row profile-actions">
                  <p className="muted">Manage your published campus listings.</p>
                  <Link className="btn btn-primary" href={user?.role === 'MERCHANT' ? '/merchant/products/new' : '/student/listings/new'}>
                    + Add New Product
                  </Link>
                </div>
                <div className="profile-list">
                  {mine.length ? (
                    mine.map(p => (
                      <article className="surface profile-item" key={p.id}>
                        <div>
                          <b>{p.title}</b>
                          <p className="muted">
                            {p.category?.nameEn} · Stock: {p.quantity} · {p.status} · Cost: {p.coinCost || 1} Coins
                          </p>
                        </div>
                        <div className="profile-item-right">
                          <b>ETB {Number(p.price).toLocaleString()}</b>
                          {p.status === 'ACTIVE' ? <Link className="muted" href={`/product/${p.id}`}>View listing →</Link> : <small className="muted">Not publicly visible</small>}
                          {p.status === 'EXPIRED' && <button className="btn btn-primary" disabled={busyId === p.id} onClick={() => renewProduct(p)}>{busyId === p.id ? 'Renewing…' : `Renew · ${p.coinCost || 1} coins`}</button>}
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty text="You have no in-stock products published." />
                  )}
                </div>
              </>
            )}

            {/* SOLDOUT PRODUCTS */}
            {active === 'soldout' && (
              <div className="profile-list">
                {sold.length ? (
                  sold.map(p => (
                    <article className="surface profile-item" key={p.id}>
                      <div>
                        <b>{p.title}</b>
                        <p className="muted">
                          {p.category?.nameEn} · {p.status === 'SOLD' ? 'Marked sold' : 'Out of stock'} · Stock: {p.quantity}
                        </p>
                      </div>
                      <div className="profile-item-right">
                        <b>ETB {Number(p.price).toLocaleString()}</b>
                        <button className="btn btn-primary" disabled={busyId === p.id} onClick={() => restock(p)}>
                          {busyId === p.id ? 'Saving…' : 'Restock'}
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <Empty text="You have no sold-out products." />
                )}
              </div>
            )}

            {/* SAVED FAVORITES */}
            {active === 'favorites' && (
              <div className="grid-products">
                {favorites.length ? (
                  favorites.map((fav: any) => {
                    const p = fav.product;
                    return (
                      <article className="surface product-card" key={p.id}>
                        <Link href={`/product/${p.id}`}>
                          <div className="product-image">
                            {p.images?.[0]?.imageUrl ? <img src={p.images[0].imageUrl} alt={p.title} /> : <span>📦</span>}
                          </div>
                          <h3>{p.title}</h3>
                          <b>ETB {Number(p.price).toLocaleString()}</b>
                        </Link>
                        <button
                          className="btn btn-ghost"
                          onClick={async () => {
                            await fetch(`/api/favorites?productId=${encodeURIComponent(p.id)}`, { method: 'DELETE' });
                            setFavorites(v => v.filter(x => x.productId !== p.id));
                          }}
                        >
                          Remove from saved
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <Empty text="Products you save will appear here." />
                )}
              </div>
            )}

            {/* SECURITY */}
            {active === 'security' && (
              <div className="surface profile-details">
                <h2>Security & Sign-in</h2>
                <p className="muted">Your account authentication is secured by Firebase.</p>
                <Info label="Sign-in email" value={user?.email} />
                <p className="muted">For password recovery or account help, contact Nova support.</p>
                <Link className="btn btn-primary" href="/support">
                  Get Support
                </Link>
              </div>
            )}

            {/* SUPPORT */}
            {active === 'support' && (
              <div className="surface profile-details">
                <h2>Need help?</h2>
                <p className="muted">Contact the Nova team for student ID approval, coin verification, or listing assistance.</p>
                <div style={{ marginTop: 14 }}>
                  <p>
                    Official Hotline:{' '}
                    <a href="tel:+251938907433" style={{ color: 'var(--purple2)', fontWeight: 800 }}>
                      +251938907433
                    </a>
                  </p>
                  <Link className="btn btn-primary" href="/support">
                    Open Support Page
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* COIN PAYMENT & RECEIPT UPLOAD MODAL */}
        {selectedCoins !== null && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              background: 'rgba(0,0,0,0.7)',
              display: 'grid',
              placeItems: 'center',
              padding: 20,
            }}
            onClick={() => setSelectedCoins(null)}
          >
            <div
              className="surface coin-modal"
              style={{
                width: '100%',
                maxWidth: 520,
                padding: 24,
                borderRadius: 16,
                display: 'grid',
                gap: 16,
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="pill">TRANSFER & VERIFICATION</span>
                  <h3 style={{ margin: '6px 0 0', fontSize: 20 }}>
                    Buy {selectedCoins} Listing Coins (ETB {calculateCoinsCost(selectedCoins, user?.role || 'STUDENT')})
                  </h3>
                </div>
                <button className="btn btn-ghost" onClick={() => setSelectedCoins(null)} style={{ padding: 6 }}>
                  <X size={18} />
                </button>
              </div>

              {buySuccess ? (
                <div className="surface2" style={{ padding: 24, textAlign: 'center', borderRadius: 12 }}>
                  <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                  <b>Payment Proof Submitted!</b>
                  <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                    The Nova team will verify the transfer and credit your {selectedCoins} coins shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitCoinPurchase} style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Choose Payment Method:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {(['TELEBIRR', 'CBE', 'BOA'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ fontSize: 12, padding: '8px 4px', justifyContent: 'center' }}
                          onClick={() => setPaymentMethod(m)}
                        >
                          {m === 'TELEBIRR' ? 'TeleBirr' : m === 'CBE' ? 'CBE Bank' : 'BOA Bank'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="surface2" style={{ padding: 14, borderRadius: 10, fontSize: 13, display: 'grid', gap: 6 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">Account Name:</span>
                      <b>{paymentMethod === 'TELEBIRR' ? accounts.PAYMENT_TELEBIRR_ACCOUNT_NAME || 'Nova Campus Marketplace' : paymentMethod === 'CBE' ? accounts.PAYMENT_CBE_ACCOUNT_NAME || 'Nova Campus Marketplace' : accounts.PAYMENT_BOA_ACCOUNT_NAME || 'Nova Campus Marketplace'}</b>
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">Account / Phone:</span>
                      <b style={{ color: 'var(--purple2)' }}>
                        {paymentMethod === 'TELEBIRR'
                          ? accounts.PAYMENT_TELEBIRR_NUMBER || 'Not configured'
                          : paymentMethod === 'CBE'
                          ? accounts.PAYMENT_CBE_ACCOUNT_NUMBER || 'Not configured'
                          : accounts.PAYMENT_BOA_ACCOUNT_NUMBER || 'Not configured'}
                      </b>
                    </div>
                    <small className="muted" style={{ fontSize: 11 }}>
                      Transfer exactly ETB {calculateCoinsCost(selectedCoins, user?.role || 'STUDENT')}
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Upload Transfer Screenshot (Receipt):
                    </label>
                    <label
                      className="surface2"
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        border: '2px dashed var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <Upload size={22} color="var(--purple2)" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {receiptFile ? receiptFile.name : 'Tap to select receipt image'}
                        </b>
                        <small className="muted">JPG, PNG, WebP · max 5 MB</small>
                      </div>
                      <input
                        type="file"
                        hidden
                        accept="image/jpeg,image/png,image/webp"
                        required
                        onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Transaction Reference / ID (Required):
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter the bank or TeleBirr transaction reference"
                      value={transactionRef}
                      required
                      minLength={4}
                      maxLength={120}
                      onChange={e => setTransactionRef(e.target.value)}
                    />
                  </div>

                  {buyError && (
                    <div style={{ color: 'var(--danger)', fontSize: 13 }}>{buyError}</div>
                  )}

                  {!(paymentMethod === 'TELEBIRR' ? accounts.PAYMENT_TELEBIRR_NUMBER : paymentMethod === 'CBE' ? accounts.PAYMENT_CBE_ACCOUNT_NUMBER : accounts.PAYMENT_BOA_ACCOUNT_NUMBER) && (
                    <p role="alert" style={{ color: 'var(--danger)', fontSize: 12, margin: 0 }}>This payment method is not configured yet. Please contact Nova support instead of transferring money.</p>
                  )}
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setSelectedCoins(null)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={buyBusy || !receiptFile || transactionRef.trim().length < 4 || !(paymentMethod === 'TELEBIRR' ? accounts.PAYMENT_TELEBIRR_NUMBER : paymentMethod === 'CBE' ? accounts.PAYMENT_CBE_ACCOUNT_NUMBER : accounts.PAYMENT_BOA_ACCOUNT_NUMBER)}>
                      {buyBusy ? 'Submitting…' : 'Submit for Admin Verification'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="profile-info-row">
      <span className="muted">{label}</span>
      <b>{value || '—'}</b>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="surface profile-empty">
      <p className="muted">{text}</p>
    </div>
  );
}
