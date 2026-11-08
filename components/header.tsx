'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Menu,
  X,
  LogOut,
  Heart,
  Coins,
  Store,
  PlusCircle,
  LifeBuoy,
  User,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-provider';

type Account = {
  id: string;
  role: string;
  status: string;
  fullName: string | null;
  shopName: string | null;
  email: string | null;
  coinBalance?: number;
  reservedCoinBalance?: number;
};

export function Header() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);

  const close = () => setOpen(false);

  useEffect(() => {
    let live = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (live) setUser(d.user || null);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const profileLabel = (user?.fullName || user?.shopName || user?.email || 'Profile').slice(0, 1).toUpperCase();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    close();
    window.location.href = '/';
  }

  const accountLinks = user ? (
    <>
      <Link href="/profile" onClick={close} className="mobile-nav-item">
        <span className="profile-avatar" style={{ width: 28, height: 28, fontSize: 13 }}>{profileLabel}</span>
        <span>My Profile Account</span>
      </Link>
      <button type="button" className="mobile-nav-item" onClick={signOut}>
        <LogOut size={17} />
        <span>Sign out</span>
      </button>
    </>
  ) : (
    <>
      <Link href="/login" onClick={close} className="mobile-nav-item">
        <User size={17} />
        <span>Sign in</span>
      </Link>
      <Link href="/register" onClick={close} className="mobile-nav-item" style={{ color: 'var(--purple2)' }}>
        <PlusCircle size={17} />
        <span>Create account</span>
      </Link>
    </>
  );

  return (
    <header className="topbar">
      <div className="shell row header-inner" style={{ minHeight: 72 }}>
        <Link href="/" className="row header-brand" onClick={close}>
          <img
            src="/icon-512.png"
            alt="Nova Campus Marketplace"
            className="brandmark-image"
          />
          <span style={{ display: 'grid', lineHeight: 1.2 }}>
            <b style={{ fontFamily: 'Manrope', fontSize: 16 }}>Nova</b>
            <small className="muted" style={{ fontSize: 10 }}>
              Campus Marketplace
            </small>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav row" aria-label="Main navigation">
          <Link className="muted" href="/">
            Home
          </Link>
          <Link className="muted" href="/explore">
            Explore
          </Link>
          <Link className="muted" href="/start-selling">
            Start Selling
          </Link>
          <Link className="muted" href="/support">
            About/Help
          </Link>
        </nav>

        {/* Right Header Controls */}
        <div className="row header-controls" style={{ gap: 8, alignItems: 'center' }}>
          <Link className="btn btn-ghost header-icon" style={{ padding: 10 }} href="/explore" aria-label="Search">
            <Search size={17} />
          </Link>

          <Link className="btn btn-ghost header-icon" style={{ padding: 10 }} href="/profile?section=favorites" aria-label="Saved products">
            <Heart size={17} />
          </Link>

          {/* User Coin Balance Badge in Topbar */}
          {loaded && user && ['STUDENT', 'MERCHANT'].includes(user.role) && (
            <Link
              href="/profile?section=coins"
              className="row"
              style={{
                background: 'var(--purple-soft)',
                border: '1px solid var(--purple)',
                padding: '5px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--purple2)',
                gap: 5,
                textDecoration: 'none',
              }}
              title="Your Listing Coins balance"
            >
              <Coins size={14} color="var(--purple2)" />
              <span>{Math.max(0, (user.coinBalance ?? 0) - (user.reservedCoinBalance ?? 0))}</span>
              <span className="desktop-nav" style={{ fontWeight: 600 }}>Coins</span>
            </Link>
          )}

          <ThemeToggle />

          {loaded && (
            user ? (
              <Link className="profile-avatar header-avatar" href="/profile" aria-label="Open profile">
                {profileLabel}
              </Link>
            ) : (
              <Link className="btn btn-primary header-signin" href="/login">
                Sign in
              </Link>
            )
          )}

          {/* Navbar Hamburger (Public / Site Navigation Only) */}
          <button
            type="button"
            className="btn btn-ghost mobile-menu"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Main Navbar Mobile Dropdown - Clean, stacked full-width rows */}
      {open && (
        <nav className="mobile-nav shell" aria-label="Main platform navigation">
          <Link href="/" onClick={close} className="mobile-nav-item">
            <Store size={17} />
            <span>Home</span>
          </Link>
          <Link href="/explore" onClick={close} className="mobile-nav-item">
            <Search size={17} />
            <span>Explore Marketplace</span>
          </Link>
          <Link href="/start-selling" onClick={close} className="mobile-nav-item">
            <PlusCircle size={17} />
            <span>Start Selling</span>
          </Link>
          <Link href="/support" onClick={close} className="mobile-nav-item">
            <LifeBuoy size={17} />
            <span>About & Help</span>
          </Link>
          {accountLinks}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <img
              src="/icon-512.png"
              alt="Nova Campus Marketplace"
              className="brandmark-image"
            />
            <b>Nova Campus Marketplace</b>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Direct campus marketplace for Woldia University & Weldiya town community.
          </p>
        </div>
        <div className="row" style={{ gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href="/safety">Safety Tips</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/support">Telegram Support</Link>
        </div>
        <small className="muted">
          © {new Date().getFullYear()} Nova Campus Marketplace · Woldia University, Ethiopia
        </small>
      </div>
    </footer>
  );
}