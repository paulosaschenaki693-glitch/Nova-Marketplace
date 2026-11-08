'use client';

import { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  UserX,
  PauseCircle,
  RotateCcw,
  Coins,
  Plus,
  Minus,
  ExternalLink,
  ShieldAlert,
  Image as ImageIcon,
  Clock,
  Package,
} from 'lucide-react';

type Props = {
  userId: string | null;
  onClose: () => void;
  onUserUpdated: () => void;
};

export function AdminUserDrawer({ userId, onClose, onUserUpdated }: Props) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [coinAmount, setCoinAmount] = useState('1');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }
    setLoading(true);
    setError('');
    fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load user.');
        setUser(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  async function handleDecision(decision: string) {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, decision, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed.');
      onUserUpdated();
      // Reload user
      const refresh = await fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`).then(r => r.json());
      setUser(refresh);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCoinAdjustment(direction: 'ADD' | 'DEDUCT') {
    if (!user) return;
    const amount = parseInt(coinAmount, 10);
    if (!amount || amount <= 0) {
      setError('Please enter a valid positive number of coins.');
      return;
    }
    const delta = direction === 'ADD' ? amount : -amount;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          decision: 'ADJUST_COINS',
          coinAdjustment: delta,
          note: note || `Manual ${direction === 'ADD' ? 'credit' : 'deduction'} by admin`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Coin adjustment failed.');
      onUserUpdated();
      const refresh = await fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`).then(r => r.json());
      setUser(refresh);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Coin adjustment failed.');
    } finally {
      setBusy(false);
    }
  }

  const resolveImage = (src?: string) =>
    src?.startsWith('private://')
      ? `/api/private-files/${src.slice('private://'.length)}`
      : src?.startsWith('private-payment://')
      ? `/api/private-payment/${src.slice('private-payment://'.length)}`
      : src || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'var(--bg)',
          height: '100vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="pill">USER PROFILE & CONTROLS</span>
            <h2 style={{ fontSize: 22, margin: '6px 0 0' }}>Manage User Details</h2>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close drawer" style={{ padding: 8 }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="surface2" style={{ padding: 12, color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>
            <ShieldAlert size={16} style={{ display: 'inline', marginRight: 6 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="surface" style={{ padding: 40, textAlign: 'center' }}>Loading user details…</div>
        ) : !user ? (
          <div className="surface" style={{ padding: 30, textAlign: 'center' }}>No user details available.</div>
        ) : (
          <>
            {/* Identity Banner */}
            <div className="surface" style={{ padding: 18, borderRadius: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div
                className="brandmark"
                style={{
                  width: 54,
                  height: 54,
                  fontSize: 22,
                  borderRadius: 16,
                  background: user.role === 'MERCHANT' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {(user.fullName || user.shopName || user.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 18 }}>{user.fullName || user.shopName || 'Campus User'}</b>
                  <span className={`status ${user.status === 'ACTIVE' ? 'success' : user.status === 'PENDING' ? 'warn' : 'danger'}`}>
                    {user.status}
                  </span>
                </div>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Role: <b>{user.role === 'MERCHANT' ? '🏪 Town Merchant' : '🎓 University Student'}</b>
                  {user.studentIdNo && ` · ID: ${user.studentIdNo}`}
                </p>
                <small className="muted" style={{ fontSize: 11 }}>
                  Registered {new Date(user.createdAt).toLocaleDateString()} · UID: {user.id.slice(0, 14)}…
                </small>
              </div>
            </div>

            {/* Coin Wallet Section */}
            <div className="surface2" style={{ padding: 18, borderRadius: 12, border: '1px solid var(--purple)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <Coins size={22} color="var(--purple2)" />
                  <div>
                    <span className="muted" style={{ fontSize: 12 }}>Coin Wallet Balance</span>
                    <h3 style={{ margin: 0, fontSize: 24, color: 'var(--purple2)' }}>{user.coinBalance} Coins</h3>
                  </div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={coinAmount}
                    onChange={e => setCoinAmount(e.target.value)}
                    className="input"
                    style={{ width: 68, padding: '6px 8px', textAlign: 'center' }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => handleCoinAdjustment('ADD')}
                    title="Credit coins to this user"
                    style={{ padding: '7px 12px', fontSize: 12 }}
                  >
                    <Plus size={14} /> Add
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy || user.coinBalance <= 0}
                    onClick={() => handleCoinAdjustment('DEDUCT')}
                    title="Deduct coins"
                    style={{ padding: '7px 12px', fontSize: 12 }}
                  >
                    <Minus size={14} /> Deduct
                  </button>
                </div>
              </div>
            </div>

            {/* Contact & Verification Info */}
            <div className="surface" style={{ padding: 18, borderRadius: 12, display: 'grid', gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>Identity & Contact Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div><span className="muted">Email:</span> <b>{user.email || '—'}</b></div>
                <div><span className="muted">Phone:</span> <b>{user.phone || '—'}</b></div>
                <div><span className="muted">Verification:</span> <b>{user.verificationMethod || 'Pending'}</b></div>
                <div><span className="muted">Reviewed By:</span> <b>{user.reviewedById ? 'Admin' : '—'}</b></div>
              </div>
              {user.verificationReason && (
                <div style={{ fontSize: 12, background: 'var(--surface2)', padding: 10, borderRadius: 8 }}>
                  <span className="muted">Verification Notes:</span> {user.verificationReason}
                </div>
              )}
              {user.studentIdImageUrl && (
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setPreviewImage(resolveImage(user.studentIdImageUrl))}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <ImageIcon size={16} /> View Uploaded Student ID Card
                  </button>
                </div>
              )}
            </div>

            {/* User Activity Snapshot */}
            <div className="surface" style={{ padding: 18, borderRadius: 12, display: 'grid', gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Product Listings ({user.products?.length || 0})</h4>
                <span className="muted" style={{ fontSize: 12 }}>Recent items</span>
              </div>
              {user.products?.length ? (
                <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {user.products.map((p: any) => (
                    <div key={p.id} className="surface2 row" style={{ padding: 10, borderRadius: 8, alignItems: 'center', gap: 10 }}>
                      {p.images?.[0]?.imageUrl ? (
                        <img src={p.images[0].imageUrl} alt={p.title} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--border)', display: 'grid', placeItems: 'center' }}>
                          <Package size={18} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</b>
                        <small className="muted">ETB {Number(p.price).toLocaleString()} · Stock: {p.quantity}</small>
                      </div>
                      <span className={`status ${p.status === 'ACTIVE' ? 'success' : p.status === 'PENDING_REVIEW' ? 'warn' : 'danger'}`} style={{ fontSize: 11 }}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>This user has not published any products yet.</p>
              )}
            </div>

            {/* Coin Transaction History */}
            {user.coinTransactions?.length > 0 && (
              <div className="surface" style={{ padding: 18, borderRadius: 12, display: 'grid', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Coin Ledger History</h4>
                <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto', fontSize: 12 }}>
                  {user.coinTransactions.map((tx: any) => (
                    <div key={tx.id} className="row surface2" style={{ padding: 8, borderRadius: 6, justifyContent: 'space-between' }}>
                      <div>
                        <b>{tx.type}</b>
                        <p style={{ margin: '2px 0 0' }} className="muted">{tx.description}</p>
                      </div>
                      <b style={{ color: tx.amount > 0 ? '#10b981' : '#f43f5e' }}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} Coins
                      </b>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Administrative Actions */}
            <div className="surface" style={{ padding: 18, borderRadius: 12, display: 'grid', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>Account Moderation Controls</h4>
              <textarea
                className="input"
                rows={2}
                placeholder="Internal administrative note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {user.status !== 'ACTIVE' && (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => handleDecision('ACTIVE')}
                    style={{ flex: 1, minWidth: 140, background: '#10b981', borderColor: '#10b981' }}
                  >
                    <UserCheck size={16} /> Approve & Activate
                  </button>
                )}
                {user.status === 'ACTIVE' && (
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => handleDecision('SUSPENDED')}
                    style={{ flex: 1, minWidth: 140, color: '#f59e0b', borderColor: '#f59e0b' }}
                  >
                    <PauseCircle size={16} /> Suspend Account
                  </button>
                )}
                {user.status === 'PENDING' && (
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => handleDecision('REJECTED')}
                    style={{ flex: 1, minWidth: 140, color: '#f43f5e', borderColor: '#f43f5e' }}
                  >
                    <UserX size={16} /> Reject Application
                  </button>
                )}
                {user.deletedAt && (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => handleDecision('RESTORE')}
                    style={{ flex: 1, minWidth: 140 }}
                  >
                    <RotateCcw size={16} /> Restore User
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ID Card Full Zoom Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
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
            onClick={() => setPreviewImage(null)}
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
            src={previewImage}
            alt="Full-size student ID document"
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
    </div>
  );
}
