'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Coins,
  ClipboardCheck,
  Users,
  Flag,
  Settings,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Bell,
  CheckCircle,
} from 'lucide-react';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>({
    pendingCoinsCount: 0,
    pendingListingsCount: 0,
    pendingStudentsCount: 0,
    activeStudentsCount: 0,
    activeMerchantsCount: 0,
    activeListingsCount: 0,
    openReportsCount: 0,
    totalCoinsSold: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/metrics', { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          if (live) setMetrics(d);
        }
      } catch {}
      if (live) setLoading(false);
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="shell section">
      <div>
        <span className="pill">ADMIN COMMAND CENTER</span>
        <h1 style={{ fontSize: 34, margin: '8px 0 4px' }}>Marketplace Operations</h1>
        <p className="muted" style={{ margin: 0 }}>
          Live metrics, seller coin verification, listing moderation, and user management for Woldia University.
        </p>
      </div>

      {/* Real-Time Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          margin: '24px 0',
        }}
      >
        {/* Pending Coins Card */}
        <Link
          href="/admin/coins"
          className="surface"
          style={{
            padding: 20,
            borderRadius: 14,
            borderLeft: metrics.pendingCoinsCount > 0 ? '4px solid var(--purple2)' : undefined,
            position: 'relative',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Pending Coins</span>
            <Coins size={20} color="var(--purple2)" />
          </div>
          <h2 style={{ fontSize: 32, margin: '10px 0 4px', color: 'var(--purple2)' }}>
            {loading ? '…' : metrics.pendingCoinsCount}
          </h2>
          <small className="muted">
            {metrics.pendingCoinsCount > 0 ? 'Urgent verification needed' : 'All coin proofs reviewed'}
          </small>
        </Link>

        {/* Pending Listings Card */}
        <Link
          href="/admin/listings"
          className="surface"
          style={{
            padding: 20,
            borderRadius: 14,
            borderLeft: metrics.pendingListingsCount > 0 ? '4px solid #f59e0b' : undefined,
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Pending Listings</span>
            <ClipboardCheck size={20} color="#f59e0b" />
          </div>
          <h2 style={{ fontSize: 32, margin: '10px 0 4px', color: '#f59e0b' }}>
            {loading ? '…' : metrics.pendingListingsCount}
          </h2>
          <small className="muted">Products waiting for approval</small>
        </Link>

        {/* Pending Students Card */}
        <Link
          href="/admin/users"
          className="surface"
          style={{
            padding: 20,
            borderRadius: 14,
            borderLeft: metrics.pendingStudentsCount > 0 ? '4px solid #3b82f6' : undefined,
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Pending Student IDs</span>
            <Users size={20} color="#3b82f6" />
          </div>
          <h2 style={{ fontSize: 32, margin: '10px 0 4px', color: '#3b82f6' }}>
            {loading ? '…' : metrics.pendingStudentsCount}
          </h2>
          <small className="muted">Awaiting ID photo review</small>
        </Link>

        {/* Total Revenue Generated */}
        <div className="surface" style={{ padding: 20, borderRadius: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Total Coin Revenue</span>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <h2 style={{ fontSize: 30, margin: '10px 0 4px', color: '#10b981' }}>
            ETB {loading ? '…' : Number(metrics.totalRevenue).toLocaleString()}
          </h2>
          <small className="muted">
            {metrics.totalCoinsSold} total coins purchased
          </small>
        </div>
      </div>

      {/* Operational Modules Grid */}
      <h3 style={{ fontSize: 20, margin: '28px 0 16px' }}>Operational Modules</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {[
          {
            title: 'Coin Purchase Approvals',
            desc: 'Verify bank receipts and credit listing coins to students and merchants.',
            href: '/admin/coins',
            icon: Coins,
            badge: metrics.pendingCoinsCount > 0 ? `${metrics.pendingCoinsCount} pending` : null,
          },
          {
            title: 'User Management & Directory',
            desc: 'Browse, filter, inspect full user profiles, and manually adjust coin balances.',
            href: '/admin/users',
            icon: Users,
            badge: metrics.pendingStudentsCount > 0 ? `${metrics.pendingStudentsCount} to verify` : null,
          },
          {
            title: 'Product Listing Moderation',
            desc: 'Review published products, inspect photos, and verify contact details.',
            href: '/admin/listings',
            icon: ClipboardCheck,
            badge: metrics.pendingListingsCount > 0 ? `${metrics.pendingListingsCount} to review` : null,
          },
          {
            title: 'Categories & Listing Templates',
            desc: 'Define custom listing attribute fields for electronics, books, clothing, etc.',
            href: '/admin/categories',
            icon: Settings,
          },
          {
            title: 'Reports & Campus Safety',
            desc: 'Handle user reports against prohibited items, suspicious sellers, or scams.',
            href: '/admin/reports',
            icon: Flag,
            badge: metrics.openReportsCount > 0 ? `${metrics.openReportsCount} open` : null,
          },
          {
            title: 'Admin Notifications',
            desc: 'High-priority alerts for new student registrations, listing reviews, and coin purchase requests.',
            href: '/admin/notifications',
            icon: Bell,
          },
        ].map(mod => {
          const I = mod.icon;
          return (
            <Link
              key={mod.title}
              href={mod.href}
              className="surface"
              style={{
                padding: 22,
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <I size={24} color="var(--purple2)" />
                  {mod.badge && <span className="pill" style={{ background: 'var(--purple-soft)', color: 'var(--purple2)' }}>{mod.badge}</span>}
                </div>
                <h3 style={{ fontSize: 18, margin: '14px 0 6px' }}>{mod.title}</h3>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {mod.desc}
                </p>
              </div>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--purple2)',
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 18,
                }}
              >
                Open console <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Community Stats Footer */}
      <div className="surface2" style={{ padding: 20, borderRadius: 14, marginTop: 28, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <span className="muted" style={{ fontSize: 12 }}>Campus Active Students</span>
          <h4 style={{ margin: '4px 0 0', fontSize: 18 }}>{metrics.activeStudentsCount} Verified Students</h4>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div>
          <span className="muted" style={{ fontSize: 12 }}>Town Merchants</span>
          <h4 style={{ margin: '4px 0 0', fontSize: 18 }}>{metrics.activeMerchantsCount} Approved Shops</h4>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
        <div>
          <span className="muted" style={{ fontSize: 12 }}>Active Marketplace Listings</span>
          <h4 style={{ margin: '4px 0 0', fontSize: 18 }}>{metrics.activeListingsCount} Published Products</h4>
        </div>
      </div>
    </div>
  );
}
