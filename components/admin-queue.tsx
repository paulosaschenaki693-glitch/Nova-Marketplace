'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Coins,
  UserCheck,
  UserX,
  PauseCircle,
  RotateCcw,
  Search,
  ExternalLink,
  ShieldCheck,
  Phone,
  Send,
  Package,
} from 'lucide-react';
import { AdminUserDrawer } from '@/components/admin-user-drawer';

type Kind = 'listings' | 'users' | 'coins';

export function AdminQueue({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const url = kind === 'coins' ? '/api/admin/coins' : kind === 'listings' ? '/api/admin/products' : '/api/admin/users';

  async function load() {
    try {
      const qUrl =
        kind === 'users' && showDeleted
          ? `${url}?includeDeleted=true`
          : url;
      const r = await fetch(qUrl, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to load');
      setRows(Array.isArray(d) ? d : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [url, kind, showDeleted]);

  const states = kind === 'coins'
    ? ['UNDER_REVIEW', 'APPROVED', 'REJECTED']
    : kind === 'listings'
    ? ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED', 'DRAFT']
    : ['STUDENT', 'MERCHANT', 'PENDING', 'ACTIVE', 'SUSPENDED'];

  const filtered = useMemo(() => {
    let result = rows;
    if (kind === 'users') {
      if (filter === 'STUDENT') result = result.filter(r => r.role === 'STUDENT');
      else if (filter === 'MERCHANT') result = result.filter(r => r.role === 'MERCHANT');
      else if (filter !== 'ALL') result = result.filter(r => r.status === filter);
    } else if (filter !== 'ALL') {
      result = result.filter(r => r.status === filter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(r => {
        if (kind === 'users') {
          return (
            (r.fullName || '').toLowerCase().includes(s) ||
            (r.shopName || '').toLowerCase().includes(s) ||
            (r.email || '').toLowerCase().includes(s) ||
            (r.phone || '').includes(s) ||
            (r.studentIdNo || '').toLowerCase().includes(s)
          );
        }
        if (kind === 'coins') {
          return (
            (r.user?.fullName || '').toLowerCase().includes(s) ||
            (r.user?.shopName || '').toLowerCase().includes(s) ||
            (r.transactionReference || '').toLowerCase().includes(s) ||
            (r.paymentMethod || '').toLowerCase().includes(s)
          );
        }
        if (kind === 'listings') {
          return (
            (r.title || '').toLowerCase().includes(s) ||
            (r.description || '').toLowerCase().includes(s) ||
            (r.category?.nameEn || '').toLowerCase().includes(s)
          );
        }
        return true;
      });
    }

    return result;
  }, [rows, filter, search, kind]);

  async function act(row: any, decision: string) {
    setActionBusyId(row.id);
    try {
      const body = kind === 'coins'
        ? { purchaseId: row.id, decision, note: note[row.id] }
        : kind === 'listings'
        ? { productId: row.id, decision, note: note[row.id] }
        : { userId: row.id, decision, note: note[row.id] };

      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Action failed');
        return;
      }
      await load();
      setNote(prev => ({ ...prev, [row.id]: '' }));
    } catch {
      setError('Action failed');
    } finally {
      setActionBusyId(null);
    }
  }

  const image = (src: string | undefined) =>
    src?.startsWith('private://')
      ? `/api/private-files/${src.slice('private://'.length)}`
      : src?.startsWith('private-payment://')
      ? `/api/private-payment/${src.slice('private-payment://'.length)}`
      : src || '';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Top Search & Filter Bar */}
      <div className="surface" style={{ padding: 14, borderRadius: 12, display: 'grid', gap: 12 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <div className="row" style={{ flex: 1, background: 'var(--surface2)', padding: '6px 12px', borderRadius: 8 }}>
            <Search size={16} className="muted" />
            <input
              type="text"
              placeholder={`Search in ${kind}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
              style={{ border: 0, background: 'transparent', padding: '4px 8px' }}
            />
            {search && (
              <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            Showing <b>{filtered.length}</b> of {rows.length}
          </span>
        </div>

        {/* Filter Chips */}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {kind === 'users' && (
            <button
              className={`btn ${showDeleted ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setShowDeleted(v => !v);
                setFilter('ALL');
                setLoading(true);
              }}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              {showDeleted ? 'Viewing Deactivated' : 'Show Deactivated Users'}
            </button>
          )}

          <button
            className={`btn ${filter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('ALL')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            All ({rows.length})
          </button>

          {states.map(s => {
            const count =
              kind === 'users'
                ? s === 'STUDENT'
                  ? rows.filter(r => r.role === 'STUDENT').length
                  : s === 'MERCHANT'
                  ? rows.filter(r => r.role === 'MERCHANT').length
                  : rows.filter(r => r.status === s).length
                : rows.filter(r => r.status === s).length;

            return (
              <button
                key={s}
                className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(s)}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                {s.replaceAll('_', ' ')} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="surface2" style={{ padding: 12, color: 'var(--danger)', borderRadius: 8 }}>{error}</div>}

      {/* Rows Feed */}
      {loading ? (
        <div className="surface" style={{ padding: 40, textAlign: 'center' }}>Loading records…</div>
      ) : !filtered.length ? (
        <div className="surface" style={{ padding: 40, textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>No records match your selected filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.map(row => {
            const isBusy = actionBusyId === row.id;

            return (
              <article className="surface" style={{ padding: 20, borderRadius: 14, display: 'grid', gap: 14 }} key={row.id}>
                {/* Header Row */}
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    {/* Coin Purchase Header */}
                    {kind === 'coins' && (
                      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                        <Coins size={22} color="var(--purple2)" />
                        <div>
                          <b style={{ fontSize: 17 }}>
                            {row.coinsCount} Listing Coins · ETB {Number(row.amountPaid).toLocaleString()}
                          </b>
                          <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                            Requested by <b>{row.user?.fullName || row.user?.shopName || 'User'}</b> ({row.user?.role}) · Phone: {row.user?.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Listings Header */}
                    {kind === 'listings' && (
                      <div>
                        <b style={{ fontSize: 17 }}>{row.title}</b>
                        <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                          {row.category?.nameEn} · <b>ETB {Number(row.price).toLocaleString()}</b> · Cost: {row.coinCost || 1} Coins
                        </p>
                      </div>
                    )}

                    {/* Users Header */}
                    {kind === 'users' && (
                      <div>
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <b style={{ fontSize: 17 }}>{row.fullName || row.shopName || row.email}</b>
                          <span className="pill" style={{ fontSize: 11 }}>
                            {row.role === 'MERCHANT' ? '🏪 Merchant' : '🎓 Student'}
                          </span>
                        </div>
                        <p className="muted" style={{ margin: '3px 0 0', fontSize: 13 }}>
                          Phone: {row.phone} · Balance: <b>🪙 {row.coinBalance || 0} Coins</b> · Products: {row._count?.products || 0}
                        </p>
                      </div>
                    )}


                  </div>

                  <span className={`status ${row.status === 'APPROVED' || row.status === 'ACTIVE' ? 'success' : row.status === 'UNDER_REVIEW' || row.status === 'PENDING_REVIEW' || row.status === 'PENDING' ? 'warn' : 'danger'}`}>
                    {String(row.status).replaceAll('_', ' ')}
                  </span>
                </div>

                {/* Specific Body Content */}

                {/* COINS Specific Body */}
                {kind === 'coins' && (
                  <div className="surface2" style={{ padding: 14, borderRadius: 10, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 13 }}>
                      <div><span className="muted">Method:</span> <b>{row.paymentMethod}</b></div>
                      <div><span className="muted">Ref Number:</span> <b>{row.transactionReference || '—'}</b></div>
                      <div><span className="muted">Submitted:</span> <b>{new Date(row.createdAt).toLocaleString()}</b></div>
                    </div>
                    {row.screenshotUrl && (
                      <div className="row" style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setPreview(image(row.screenshotUrl))}
                          style={{ padding: '6px 12px', fontSize: 13 }}
                        >
                          <ImageIcon size={16} /> View Payment Receipt Screenshot
                        </button>
                      </div>
                    )}
                    {row.adminNote && (
                      <div style={{ fontSize: 12, background: 'var(--bg)', padding: 8, borderRadius: 6 }}>
                        <span className="muted">Admin Note:</span> {row.adminNote}
                      </div>
                    )}
                  </div>
                )}

                {/* LISTINGS Specific Body */}
                {kind === 'listings' && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{row.description}</p>
                    {row.images?.length > 0 && (
                      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
                        {row.images.map((im: any) => (
                          <img
                            key={im.id}
                            src={im.imageUrl}
                            alt={row.title}
                            onClick={() => setPreview(im.imageUrl)}
                            style={{
                              width: 120,
                              height: 100,
                              objectFit: 'cover',
                              borderRadius: 8,
                              cursor: 'pointer',
                              border: '1px solid var(--border)',
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="surface2" style={{ padding: 12, borderRadius: 8, fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <Phone size={14} color="var(--purple2)" />
                        <span>Contact: <b>{row.contactPhone || row.seller?.phone || '—'}</b></span>
                      </div>
                      {row.telegramHandle && (
                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          <Send size={14} color="#0088cc" />
                          <span>Telegram: <b>@{row.telegramHandle}</b></span>
                        </div>
                      )}
                      <div>Seller: <b>{row.seller?.fullName || row.seller?.shopName}</b> ({row.seller?.role})</div>
                      <div>Stock: <b>{row.quantity}</b> · Condition: <b>{row.condition}</b></div>
                    </div>
                  </div>
                )}

                {/* USERS Specific Body */}
                {kind === 'users' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 13 }}>
                      <div><span className="muted">Email:</span> {row.email || '—'}</div>
                      <div><span className="muted">Student ID:</span> {row.studentIdNo || '—'}</div>
                      <div><span className="muted">Verification:</span> {row.verificationMethod || 'Pending'}</div>
                    </div>
                    {row.studentIdImageUrl && (
                      <div style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setPreview(image(row.studentIdImageUrl))}
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          <ImageIcon size={14} /> Inspect Student ID Card
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Internal Admin Note Field */}
                <input
                  type="text"
                  placeholder="Add administrative review note (optional)…"
                  className="input"
                  style={{ fontSize: 13, padding: '7px 12px' }}
                  value={note[row.id] || ''}
                  onChange={e => setNote({ ...note, [row.id]: e.target.value })}
                />

                {/* COLOR-CODED ONE-CLICK ACTION BUTTONS */}
                <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* COIN APPROVAL BUTTONS */}
                  {kind === 'coins' && row.status === 'UNDER_REVIEW' && (
                    <>
                      <button
                        className="btn btn-primary"
                        disabled={isBusy}
                        onClick={() => act(row, 'APPROVED')}
                        style={{ background: '#10b981', borderColor: '#10b981' }}
                      >
                        <CheckCircle2 size={16} /> Approve & Credit {row.coinsCount} Coins
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={isBusy}
                        onClick={() => act(row, 'REJECTED')}
                        style={{ color: '#f43f5e', borderColor: '#f43f5e' }}
                      >
                        <XCircle size={16} /> Reject Proof
                      </button>
                    </>
                  )}

                  {/* LISTING MODERATION BUTTONS */}
                  {kind === 'listings' && row.status === 'PENDING_REVIEW' && (
                    <>
                      <button
                        className="btn btn-primary"
                        disabled={isBusy}
                        onClick={() => act(row, 'ACTIVE')}
                        style={{ background: '#10b981', borderColor: '#10b981' }}
                      >
                        <CheckCircle2 size={16} /> Approve & Publish Listing
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={isBusy}
                        onClick={() => act(row, 'REJECTED')}
                        style={{ color: '#f43f5e', borderColor: '#f43f5e' }}
                      >
                        <XCircle size={16} /> Reject Listing
                      </button>
                    </>
                  )}

                  {/* USER DIRECTORY BUTTONS */}
                  {kind === 'users' && (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => setSelectedUserId(row.id)}
                        style={{ background: 'var(--purple)', borderColor: 'var(--purple)' }}
                      >
                        Manage User & Coins →
                      </button>

                      {row.status === 'PENDING' && (
                        <button
                          className="btn btn-ghost"
                          disabled={isBusy}
                          onClick={() => act(row, 'ACTIVE')}
                          style={{ color: '#10b981', borderColor: '#10b981' }}
                        >
                          <UserCheck size={15} /> Quick Approve
                        </button>
                      )}

                      {row.status === 'ACTIVE' && (
                        <button
                          className="btn btn-ghost"
                          disabled={isBusy}
                          onClick={() => act(row, 'SUSPENDED')}
                          style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                        >
                          <PauseCircle size={15} /> Suspend
                        </button>
                      )}

                      {showDeleted && (
                        <button
                          className="btn btn-ghost"
                          disabled={isBusy}
                          onClick={() => act(row, 'RESTORE')}
                        >
                          <RotateCcw size={15} /> Restore
                        </button>
                      )}
                    </>
                  )}


                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Full-Screen Image Preview Modal */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(0,0,0,0.85)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <button
            aria-label="Close image"
            onClick={() => setPreview(null)}
            style={{
              position: 'absolute',
              right: 24,
              top: 24,
              background: '#fff',
              border: 0,
              borderRadius: 99,
              padding: 10,
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
          <img
            src={preview}
            alt="Full size verification view"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 8,
              background: '#fff',
            }}
          />
        </div>
      )}

      {/* User Management Slide-Over Drawer */}
      {selectedUserId && (
        <AdminUserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUserUpdated={load}
        />
      )}
    </div>
  );
}
