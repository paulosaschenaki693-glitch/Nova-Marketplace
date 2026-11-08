'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Coins,
  Flag,
  Settings,
  Store,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Bell,
  Archive,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const primaryNav = [
  { href: '/admin/dashboard', label: 'Dashboard & Metrics', icon: LayoutDashboard },
  { href: '/admin/users', label: 'User Directory', icon: Users },
  { href: '/admin/coins', label: 'Coin Approvals', icon: Coins, highlight: true },
  { href: '/admin/listings', label: 'Listing Moderation', icon: ClipboardCheck },
  { href: '/admin/categories', label: 'Category & Templates', icon: Settings },
  { href: '/admin/reports', label: 'Safety & Reports', icon: Flag },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
];



export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pendingCoins, setPendingCoins] = useState(0);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [notifRes, metricRes] = await Promise.all([
          fetch('/api/admin/notifications', { cache: 'no-store' }),
          fetch('/api/admin/metrics', { cache: 'no-store' }),
        ]);
        if (notifRes.ok) {
          const rows = await notifRes.json();
          if (live) setUnread(Array.isArray(rows) ? rows.filter((n: any) => !n.readAt).length : 0);
        }
        if (metricRes.ok) {
          const m = await metricRes.json();
          if (live) setPendingCoins(m.pendingCoinsCount || 0);
        }
      } catch {}
    };
    load();
    const timer = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/login/admin';
  }

  return (
    <div className="admin-layout">
      {open && <button aria-label="Close admin navigation" className="admin-sidebar-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
        <button className="admin-sidebar-close" aria-label="Close navigation" onClick={() => setOpen(false)}>
          <X size={20} />
        </button>
        <Link href="/admin/dashboard" className="admin-brand">
          <img
            src="/icon-512.png"
            alt="Nova Campus Marketplace"
            className="brandmark-image"
          />
          <span>
            <b>Nova</b>
            <small>ADMIN CONTROL</small>
          </span>
        </Link>
        <div className="admin-nav-label">MANAGEMENT CONSOLE</div>
        <nav>
          {primaryNav.map(n => {
            const I = n.icon;
            const hasBadge = n.href === '/admin/coins' && pendingCoins > 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`admin-nav-link ${path === n.href ? 'active' : ''}`}
                style={n.highlight ? { color: 'var(--purple2)' } : undefined}
              >
                <I size={18} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {hasBadge && (
                  <span
                    style={{
                      background: 'var(--purple)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 12,
                    }}
                  >
                    {pendingCoins}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>


        <div className="admin-sidebar-bottom">
          <Link href="/" className="admin-nav-link">
            <Store size={18} />
            <span>View marketplace</span>
            <ExternalLink size={13} />
          </Link>
          <button className="admin-nav-link admin-logout" onClick={logout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="btn btn-ghost admin-menu-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle admin navigation">
            <Menu size={18} />
          </button>
          <div>
            <strong>Nova Campus Operations</strong>
            <p className="muted" style={{ margin: 0 }}>Woldia University Campus Marketplace</p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/admin/coins" className="admin-secure" style={{ background: 'var(--purple-soft)', borderColor: 'var(--purple)' }}>
              <Coins size={14} color="var(--purple2)" />
              <b style={{ color: 'var(--purple2)' }}>{pendingCoins}</b> Pending Coins
            </Link>
            <Link href="/admin/notifications" className="admin-secure admin-alert-link" aria-label={`Notifications, ${unread} unread`}>
              <Bell size={15} />
              {unread > 0 && <b className="admin-alert-count">{unread > 99 ? '99+' : unread}</b>} Notifications
            </Link>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
