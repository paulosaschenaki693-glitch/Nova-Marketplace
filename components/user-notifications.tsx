'use client';
import { useEffect, useState } from 'react';
import { Header, Footer } from '@/components/header';
import { Bell, CheckCheck } from 'lucide-react';

export function UserNotifications() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load notifications.');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function markRead(id: string) {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });
    if (!response.ok) {
      setError('Unable to mark notification as read.');
      return;
    }
    await load();
  }
  async function markAllRead() {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) {
      setError('Unable to mark notifications as read.');
      return;
    }
    await load();
  }
  return <><Header /><main className="shell section">
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div><h1>Notifications</h1><p className="muted">Payment decisions, listing reviews, and order updates from Nova.</p></div>
      {rows.some(row => !row.readAt) && <button className="btn btn-ghost" onClick={markAllRead}><CheckCheck size={15} /> Mark all read</button>}
    </div>
    {error && <div className="surface" style={{ padding: 14, color: 'var(--danger)' }}>{error}</div>}
    {loading ? <div className="surface" style={{ padding: 22 }}>Loading notifications…</div>
      : rows.length ? <div style={{ display: 'grid', gap: 10 }}>{rows.map(row =>
        <button key={row.id} className="surface" onClick={() => !row.readAt && markRead(row.id)}
          style={{ padding: 18, textAlign: 'left', color: 'var(--text)', cursor: row.readAt ? 'default' : 'pointer', borderColor: row.readAt ? 'var(--border)' : 'var(--purple)' }}>
          <div className="row"><span className="row" style={{ justifyContent: 'flex-start', gap: 8 }}><Bell size={15} color="var(--purple2)" /><b>{row.title}</b></span><small className="muted">{new Date(row.createdAt).toLocaleString()}</small></div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 0 }}>{row.body}</p>
        </button>)}</div>
      : <div className="surface" style={{ padding: 26, textAlign: 'center' }}><Bell size={26} color="var(--purple2)" /><h3>No notifications yet</h3><p className="muted">Updates from Nova will appear here.</p></div>}
  </main><Footer /></>;
}
