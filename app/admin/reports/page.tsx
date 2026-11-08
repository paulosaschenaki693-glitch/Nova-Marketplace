'use client';

import { useEffect, useState } from 'react';
import { Flag, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function Reports() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('OPEN');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/admin/reports');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load reports');
      setRows(Array.isArray(d) ? d : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update(id: string, status: string) {
    setBusyId(id);
    try {
      const adminNote = notes[id] || '';
      const r = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, status, adminNote }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.error || 'Unable to update report');
        return;
      }
      await load();
      setNotes(prev => ({ ...prev, [id]: '' }));
    } catch {
      setError('Action failed');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = filter === 'ALL' ? rows : rows.filter(r => r.status === filter);

  return (
    <div className="shell section">
      <div style={{ marginBottom: 20 }}>
        <span className="pill">SAFETY & MODERATION</span>
        <h1 style={{ fontSize: 32, margin: '8px 0 4px' }}>Marketplace Safety Reports</h1>
        <p className="muted" style={{ margin: 0 }}>
          Review and resolve user complaints regarding prohibited items, scams, or inaccurate listings.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {['OPEN', 'RESOLVED', 'DISMISSED', 'ALL'].map(st => (
          <button
            key={st}
            className={`btn ${filter === st ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(st)}
            style={{ fontSize: 13, padding: '7px 14px' }}
          >
            {st === 'ALL' ? `All (${rows.length})` : `${st} (${rows.filter(r => r.status === st).length})`}
          </button>
        ))}
      </div>

      {error && <div className="surface2" style={{ padding: 12, color: 'var(--danger)', borderRadius: 8, marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <div className="surface" style={{ padding: 36, textAlign: 'center' }}>Loading reports…</div>
      ) : !filtered.length ? (
        <div className="surface" style={{ padding: 36, textAlign: 'center', borderRadius: 14 }}>
          <p className="muted" style={{ margin: 0 }}>No reports in this category.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.map(r => {
            const isBusy = busyId === r.id;
            return (
              <div className="surface" style={{ padding: 20, borderRadius: 14, display: 'grid', gap: 12 }} key={r.id}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <b style={{ fontSize: 16 }}>{r.product?.title || 'Reported user listing'}</b>
                    <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
                      Reason: <b style={{ color: 'var(--danger)' }}>{r.reason}</b> · Reported by{' '}
                      {r.reporter?.fullName || r.reporter?.shopName || r.reporter?.role} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`status ${r.status === 'RESOLVED' ? 'success' : r.status === 'OPEN' ? 'danger' : 'warn'}`}>
                    {r.status}
                  </span>
                </div>

                {r.details && (
                  <p style={{ margin: 0, fontSize: 14, background: 'var(--surface2)', padding: 12, borderRadius: 8, lineHeight: 1.6 }}>
                    "{r.details}"
                  </p>
                )}

                {r.adminNote && (
                  <div style={{ fontSize: 12, background: 'var(--bg)', padding: 8, borderRadius: 6 }}>
                    <span className="muted">Admin note:</span> {r.adminNote}
                  </div>
                )}

                {r.status === 'OPEN' && (
                  <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Add internal resolution note (optional)…"
                      value={notes[r.id] || ''}
                      onChange={e => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-ghost"
                        disabled={isBusy}
                        onClick={() => update(r.id, 'DISMISSED')}
                        style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
                      >
                        <XCircle size={15} /> Dismiss
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={isBusy}
                        onClick={() => update(r.id, 'RESOLVED')}
                        style={{ background: '#10b981', borderColor: '#10b981' }}
                      >
                        <CheckCircle2 size={15} /> Mark Resolved
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
