'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components/header';
import { Edit3, Archive, Plus, X, ImagePlus } from 'lucide-react';

type Role = 'STUDENT' | 'MERCHANT';
type TemplateField = { key: string; label: string; required?: boolean; placeholder?: string };
type Listing = {
  id: string; title: string; description: string; price: number | string; quantity: number;
  condition: string; locationText?: string; status: string; categoryId: string;
  category?: { nameEn: string }; images: { id: string; imageUrl: string; sortOrder: number }[]; moderationNote?: string | null;
};

export function MyListings({ role }: { role: Role }) {
  const merchant = role === 'MERCHANT';
  const [rows, setRows] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Listing | null>(null);
  const [form, setForm] = useState({ title: '', description: '', price: '', quantity: '1', condition: 'GOOD', locationText: 'Woldiya University', categoryId: '' });
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch('/api/my-products', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);
      const products = await productsResponse.json();
      const categoryRows = await categoriesResponse.json();
      if (!productsResponse.ok) throw new Error(products.error || 'Unable to load your listings.');
      setRows(Array.isArray(products) ? products : []);
      setCategories(Array.isArray(categoryRows) ? categoryRows : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your listings.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === form.categoryId),
    [categories, form.categoryId],
  );
  const template = Array.isArray(selectedCategory?.listingTemplate) ? selectedCategory.listingTemplate as TemplateField[] : [];

  function beginEdit(product: Listing) {
    const currentCategory = categories.find(category => category.id === product.categoryId);
    const fields = Array.isArray(currentCategory?.listingTemplate) ? currentCategory.listingTemplate as TemplateField[] : [];
    const lines = String(product.description || '').split('\n');
    const values: Record<string, string> = {};
    for (const field of fields) {
      const prefix = `${field.label}:`;
      const line = lines.find(value => value.startsWith(prefix));
      values[field.key] = line ? line.slice(prefix.length).trim() : '';
    }
    const generalDescription = lines.filter(line => !fields.some(field => line.startsWith(`${field.label}:`))).join('\n').trim();
    setEditing(product);
    setTemplateValues(values);
    setFiles([]);
    setForm({
      title: product.title,
      description: generalDescription,
      price: String(product.price),
      quantity: String(product.quantity),
      condition: product.condition || 'GOOD',
      locationText: product.locationText || 'Woldiya University',
      categoryId: product.categoryId,
    });
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (files.length > 3) { setError('Choose up to three images.'); return; }
    setBusy(true);
    setError('');
    try {
      const uploadedImages: string[] = [];
      for (const file of files) {
        const data = new FormData();
        data.append('file', file);
        const response = await fetch('/api/uploads/product-image', { method: 'POST', body: data });
        const upload = await response.json();
        if (!response.ok) throw new Error(upload.error || 'Image upload failed.');
        uploadedImages.push(upload.url);
      }
      const description = [
        ...template.map(field => `${field.label}: ${templateValues[field.key] || ''}`).filter(line => !line.endsWith(': ')),
        form.description.trim(),
      ].filter(Boolean).join('\n');
      const body: Record<string, unknown> = {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
        description,
        templateValues,
      };
      if (uploadedImages.length) body.images = uploadedImages;
      const response = await fetch(`/api/my-products/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update listing.');
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update listing.');
    } finally {
      setBusy(false);
    }
  }

  async function archive(product: Listing) {
    if (!window.confirm(`Archive “${product.title}”? It will no longer appear in the marketplace.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/my-products/${product.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'This listing cannot be archived.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to archive listing.');
    }
  }

  return <><Header /><main className="shell section">
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div><h1>{merchant ? 'My products' : 'My listings'}</h1><p className="muted">Edit your listings, manage stock, and track review status.</p></div>
      <Link href={merchant ? '/merchant/products/new' : '/student/listings/new'} className="btn btn-primary"><Plus size={16} /> Add product</Link>
    </div>
    {error && <div className="surface" style={{ padding: 14, color: 'var(--danger)', marginBottom: 14 }}>{error}</div>}
    {loading ? <div className="surface" style={{ padding: 22 }}>Loading your listings…</div>
      : rows.length ? <div style={{ display: 'grid', gap: 12 }}>{rows.map(product =>
        <article className="surface" key={product.id} style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
              {product.images?.[0]?.imageUrl && <img src={product.images[0].imageUrl} alt={product.title} style={{ width: 88, height: 78, objectFit: 'contain', borderRadius: 10, background: 'var(--surface2)' }} />}
              <div><b>{product.title}</b><p className="muted" style={{ fontSize: 12, margin: '5px 0' }}>{product.category?.nameEn || 'Other'} · ETB {Number(product.price).toLocaleString()} · Stock {product.quantity}</p><span className="status">{product.status.replaceAll('_', ' ')}</span></div>
            </div>
            <div className="row" style={{ gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => beginEdit(product)}><Edit3 size={14} /> Edit</button>
              <button className="btn btn-ghost" disabled={product.status === 'SOLD' || product.status === 'ARCHIVED'} onClick={() => archive(product)}><Archive size={14} /> Archive</button>
            </div>
          </div>
          {product.moderationNote && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{product.moderationNote}</p>}
        </article>)}</div>
      : <div className="surface" style={{ padding: 28, textAlign: 'center' }}><ImagePlus size={28} color="var(--purple2)" /><h3>No listings yet</h3><p className="muted">Your submitted products will appear here.</p><Link href={merchant ? '/merchant/products/new' : '/student/listings/new'} className="btn btn-primary">Create your first listing</Link></div>}
  </main><Footer />
    {editing && <div role="dialog" aria-modal="true" aria-label="Edit product listing" onClick={() => !busy && setEditing(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.68)', display: 'grid', placeItems: 'center', padding: 14 }}>
      <form className="surface" onSubmit={save} onClick={event => event.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '92vh', overflowY: 'auto', padding: 20, display: 'grid', gap: 13 }}>
        <div className="row"><div><h2 style={{ margin: 0 }}>Edit listing</h2><p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>Changes to listing details are screened again and may return to review.</p></div><button type="button" className="btn btn-ghost" aria-label="Close editor" disabled={busy} onClick={() => setEditing(null)}><X size={17} /></button></div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>{editing.images?.map(image => <img key={image.id} src={image.imageUrl} alt={editing.title} style={{ width: 76, height: 68, objectFit: 'contain', borderRadius: 8, background: 'var(--surface2)' }} />)}</div>
        <Field label="Product title"><input className="input" required maxLength={140} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></Field>
        <Field label="Category"><select className="input" required value={form.categoryId} onChange={event => { setForm({ ...form, categoryId: event.target.value }); setTemplateValues({}); }}><option value="">Choose category</option>{categories.filter(category => category.isActive).map(category => <option key={category.id} value={category.id}>{category.nameEn}</option>)}</select></Field>
        {template.map(field => <Field key={field.key} label={field.label}><input className="input" required={Boolean(field.required)} value={templateValues[field.key] || ''} onChange={event => setTemplateValues({ ...templateValues, [field.key]: event.target.value })} placeholder={field.placeholder || field.label} /></Field>)}
        <Field label="Additional description (optional)"><textarea className="input" rows={4} maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></Field>
        <div className="row" style={{ gap: 12 }}><Field label="Price (ETB)"><input className="input" type="number" min="0.01" step="0.01" required value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></Field><Field label="Quantity"><input className="input" type="number" min="0" max="100000" required value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></Field></div>
        <Field label="Condition"><select className="input" value={form.condition} onChange={event => setForm({ ...form, condition: event.target.value })}><option value="NEW">New</option><option value="LIKE_NEW">Like new</option><option value="GOOD">Good</option><option value="FAIR">Fair</option></select></Field>
        <Field label="General location"><input className="input" maxLength={120} value={form.locationText} onChange={event => setForm({ ...form, locationText: event.target.value })} /></Field>
        <Field label="Replace product images (optional, up to 3)"><input className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 3))} /><small className="muted">{files.length ? `${files.length} replacement image(s) selected.` : 'Leave empty to keep the current images.'}</small></Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field" style={{ flex: 1, minWidth: 0 }}><label>{label}</label>{children}</div>;
}
