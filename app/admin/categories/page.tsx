'use client';

import { useEffect, useState } from 'react';
import { Plus, Power, Settings2, X, Check, Trash2, Edit2 } from 'lucide-react';

type TemplateField = {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
};

type Category = {
  id: string;
  nameEn: string;
  nameAm: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  listingTemplate?: TemplateField[];
};

export default function AdminCategories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [nameEn, setNameEn] = useState('');
  const [nameAm, setNameAm] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Template editor modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newRequired, setNewRequired] = useState(false);

  async function load() {
    const r = await fetch('/api/categories');
    if (r.ok) {
      const d = await r.json();
      setRows(d);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameEn, nameAm, slug }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error || 'Unable to create category');
      return;
    }
    setNameEn('');
    setNameAm('');
    setSlug('');
    await load();
  }

  async function toggle(c: Category) {
    const r = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, isActive: !c.isActive }),
    });
    if (r.ok) await load();
    else setError('Could not update category status.');
  }

  function openTemplateEditor(c: Category) {
    setEditingCategory(c);
    setTemplateFields(Array.isArray(c.listingTemplate) ? [...c.listingTemplate] : []);
    setNewKey('');
    setNewLabel('');
    setNewPlaceholder('');
    setNewRequired(false);
  }

  function addField() {
    if (!newKey.trim() || !newLabel.trim()) return;
    const cleanKey = newKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (templateFields.some(f => f.key === cleanKey)) {
      alert('A field with this key already exists.');
      return;
    }
    setTemplateFields([
      ...templateFields,
      {
        key: cleanKey,
        label: newLabel.trim(),
        placeholder: newPlaceholder.trim() || undefined,
        required: newRequired,
      },
    ]);
    setNewKey('');
    setNewLabel('');
    setNewPlaceholder('');
    setNewRequired(false);
  }

  function removeField(key: string) {
    setTemplateFields(templateFields.filter(f => f.key !== key));
  }

  async function saveTemplate() {
    if (!editingCategory) return;
    setBusy(true);
    try {
      const r = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCategory.id, listingTemplate: templateFields }),
      });
      if (!r.ok) throw new Error('Could not save template.');
      setEditingCategory(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error saving template');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell section">
      <div style={{ marginBottom: 20 }}>
        <span className="pill">CATALOG MANAGEMENT</span>
        <h1 style={{ fontSize: 32, margin: '8px 0 4px' }}>Categories & Listing Templates</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage marketplace categories and configure custom specification fields that sellers fill out for each category.
        </p>
      </div>

      {/* Add Category Card */}
      <form
        className="surface"
        style={{
          padding: 20,
          borderRadius: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
        onSubmit={create}
      >
        <div className="field">
          <label style={{ fontSize: 13, fontWeight: 600 }}>Category Name (English)</label>
          <input
            className="input"
            required
            value={nameEn}
            onChange={e => {
              setNameEn(e.target.value);
              setSlug(
                e.target.value
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              );
            }}
            placeholder="e.g. Sports & Fitness"
          />
        </div>

        <div className="field">
          <label style={{ fontSize: 13, fontWeight: 600 }}>Amharic Translation (Optional)</label>
          <input
            className="input"
            value={nameAm}
            onChange={e => setNameAm(e.target.value)}
            placeholder="e.g. ስፖርት"
          />
        </div>

        <div className="field">
          <label style={{ fontSize: 13, fontWeight: 600 }}>URL Slug</label>
          <input className="input" required value={slug} onChange={e => setSlug(e.target.value)} placeholder="sports" />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn btn-primary" disabled={busy} style={{ width: '100%', height: 42, justifyContent: 'center' }}>
            <Plus size={16} /> {busy ? 'Adding…' : 'Add Category'}
          </button>
        </div>

        {error && <p style={{ color: 'var(--danger)', gridColumn: '1/-1', margin: 0, fontSize: 13 }}>{error}</p>}
      </form>

      {/* Categories Table */}
      <div className="surface" style={{ padding: 10, borderRadius: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr>
              {['Category (EN)', 'Amharic (AM)', 'Slug', 'Status', 'Dynamic Fields', 'Actions'].map(x => (
                <th key={x} style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13 }} className="muted">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(c => {
              const fieldCount = Array.isArray(c.listingTemplate) ? c.listingTemplate.length : 0;
              return (
                <tr key={c.id}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                    {c.nameEn}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }} className="muted">
                    {c.nameAm || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12 }}>
                    {c.slug}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <span className={`status ${c.isActive ? 'success' : 'warn'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px' }}
                      onClick={() => openTemplateEditor(c)}
                    >
                      <Settings2 size={14} color="var(--purple2)" />
                      <span>{fieldCount} custom fields</span>
                    </button>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <button
                      className={`btn ${c.isActive ? 'btn-ghost' : 'btn-primary'}`}
                      style={{
                        fontSize: 12,
                        padding: '6px 12px',
                        color: c.isActive ? '#f43f5e' : undefined,
                        borderColor: c.isActive ? '#f43f5e30' : undefined,
                      }}
                      onClick={() => toggle(c)}
                    >
                      <Power size={13} />
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="muted" style={{ padding: 24, textAlign: 'center' }}>No categories created yet.</p>}
      </div>

      {/* VISUAL TEMPLATE FIELD BUILDER MODAL */}
      {editingCategory && (
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
          onClick={() => setEditingCategory(null)}
        >
          <div
            className="surface"
            style={{
              width: '100%',
              maxWidth: 600,
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
                <span className="pill">LISTING TEMPLATE BUILDER</span>
                <h3 style={{ margin: '6px 0 0', fontSize: 20 }}>Fields for {editingCategory.nameEn}</h3>
              </div>
              <button className="btn btn-ghost" onClick={() => setEditingCategory(null)} style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            {/* Existing Fields List */}
            <div>
              <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Current Category Specification Fields</h4>
              {templateFields.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {templateFields.map(f => (
                    <div
                      key={f.key}
                      className="surface2 row"
                      style={{ padding: '10px 14px', borderRadius: 8, justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <b>{f.label}</b>{' '}
                        <code style={{ fontSize: 11, background: 'var(--border)', padding: '2px 5px', borderRadius: 4 }}>
                          {f.key}
                        </code>
                        {f.required && <span className="status warn" style={{ fontSize: 10, marginLeft: 8 }}>Required</span>}
                        {f.placeholder && <p style={{ margin: '2px 0 0', fontSize: 11 }} className="muted">Placeholder: {f.placeholder}</p>}
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: 6, color: 'var(--danger)' }}
                        onClick={() => removeField(f.key)}
                        title="Delete field"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>No custom specification fields configured for this category.</p>
              )}
            </div>

            {/* Add New Field Box */}
            <div className="surface2" style={{ padding: 16, borderRadius: 12, display: 'grid', gap: 10 }}>
              <b style={{ fontSize: 13 }}>+ Add a New Specification Field</b>
              <div className="template-field-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  className="input"
                  placeholder="Key (e.g. brand, ram, author)"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Label (e.g. Brand, RAM, Author)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                />
              </div>
              <input
                className="input"
                placeholder="Placeholder prompt (e.g. HP, Dell, Samsung)"
                value={newPlaceholder}
                onChange={e => setNewPlaceholder(e.target.value)}
              />
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="row" style={{ gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={e => setNewRequired(e.target.checked)}
                    style={{ accentColor: 'var(--purple)' }}
                  />
                  <span>Required field for sellers</span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addField}
                  disabled={!newKey.trim() || !newLabel.trim()}
                  style={{ fontSize: 12 }}
                >
                  <Plus size={14} /> Add to Template
                </button>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEditingCategory(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveTemplate} disabled={busy}>
                {busy ? 'Saving…' : 'Save Template Fields'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
