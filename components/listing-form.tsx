'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Coins, Phone, Send, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getRequiredCoinsForPrice } from '@/lib/coins';

export function ListingForm() {
  const router = useRouter();
  const pathname = usePathname();
  const merchant = pathname.startsWith('/merchant');

  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    categoryId: '',
    description: '',
    price: '',
    quantity: '1',
    condition: 'GOOD',
    locationText: 'Woldiya University',
    contactPhone: '',
    telegramHandle: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [phonePublicConsent, setPhonePublicConsent] = useState(false);

  const selectedCategory = categories.find(c => c.id === form.categoryId);
  const template = Array.isArray(selectedCategory?.listingTemplate) ? selectedCategory.listingTemplate : [];

  useEffect(() => {
    // Load categories & user profile with coin balance
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ])
      .then(([cats, me]) => {
        if (Array.isArray(cats)) {
          setCategories(cats);
          if (cats[0]) setForm(f => ({ ...f, categoryId: cats[0].id }));
        }
        if (me?.user) {
          setUser(me.user);
          setForm(f => ({ ...f, contactPhone: me.user.phone || '' }));
        }
      })
      .catch(() => {});
  }, []);

  const priceNum = Number(form.price) || 0;
  const requiredCoins = getRequiredCoinsForPrice(priceNum);
  const userBalance = Math.max(0, (user?.coinBalance ?? 0) - (user?.reservedCoinBalance ?? 0));
  const hasEnoughCoins = userBalance >= requiredCoins;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phonePublicConsent) { setError('Confirm that buyers may see and use your phone number to contact you.'); return; }
    if (!hasEnoughCoins) {
      setError(`You need ${requiredCoins} Listing Coins to post this item. Your balance is ${userBalance} Coins.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const images: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const upload = await fetch('/api/uploads/product-image', { method: 'POST', body: fd });
        const ud = await upload.json();
        if (!upload.ok) throw new Error(ud.error || 'Image upload failed');
        images.push(ud.url);
      }

      const r = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phonePublicConsent,
          templateValues,
          description: [
            ...template
              .map((f: any) => `${f.label}: ${templateValues[f.key] || ''}`)
              .filter((x: string) => !x.endsWith(': ')),
            form.description,
          ]
            .filter(Boolean)
            .join('\n'),
          images,
          price: Number(form.price),
          quantity: Number(form.quantity),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to submit listing');
      router.push(merchant ? '/merchant/products?submitted=1' : '/student/listings?submitted=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit listing');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="surface" style={{ padding: 24, borderRadius: 14, display: 'grid', gap: 16, maxWidth: 720 }} onSubmit={submit}>
      {/* Coin Balance Status Banner */}
      <div
        className="surface2"
        style={{
          padding: 16,
          borderRadius: 12,
          border: hasEnoughCoins ? '1px solid var(--purple)' : '1px solid #f43f5e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <Coins size={24} color="var(--purple2)" />
          <div>
            <b style={{ fontSize: 15 }}>
              Listing Cost: <span style={{ color: 'var(--purple2)' }}>{requiredCoins} Coins</span>
            </b>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
              Your current balance: <b>{userBalance} Coins</b> (Tier: {priceNum <= 500 ? 'Under 500 ETB' : priceNum <= 2500 ? '501–2,500 ETB' : priceNum <= 10000 ? '2,501–10,000 ETB' : 'Above 10,000 ETB'})
            </p>
          </div>
        </div>

        {!hasEnoughCoins && (
          <Link
            href="/profile?section=coins"
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '7px 14px' }}
          >
            Buy Coins <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <Field label="Product title">
        <input
          className="input"
          required
          maxLength={140}
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. HP Pavilion 15 Laptop / Physics 101 Textbook"
        />
      </Field>

      <Field label="Category">
        <select
          className="input"
          required
          value={form.categoryId}
          onChange={e => setForm({ ...form, categoryId: e.target.value })}
        >
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.nameEn}</option>
          ))}
        </select>
      </Field>

      {/* Dynamic Category Template Fields */}
      {template.map((field: any) => (
        <Field key={field.key} label={field.label}>
          <input
            className="input"
            required={Boolean(field.required)}
            value={templateValues[field.key] || ''}
            onChange={e => setTemplateValues(v => ({ ...v, [field.key]: e.target.value }))}
            placeholder={field.placeholder || field.label}
          />
        </Field>
      ))}

      <div className="listing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Price (ETB)">
          <input
            className="input"
            type="number"
            min="1"
            step="0.01"
            required
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            placeholder="e.g. 850"
          />
        </Field>
        <Field label="Available Quantity">
          <input
            className="input"
            type="number"
            min="1"
            max="1000"
            required
            value={form.quantity}
            onChange={e => setForm({ ...form, quantity: e.target.value })}
          />
        </Field>
      </div>

      {/* DIRECT SELLER CONTACT FIELDS */}
      <div className="surface2" style={{ padding: 16, borderRadius: 12, display: 'grid', gap: 12 }}>
        <div>
          <b style={{ fontSize: 14 }}>Direct Buyer Contact Information</b>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
            Buyers will click these to contact and negotiate directly with you.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <Field label="Contact Phone Number">
            <div className="row surface" style={{ padding: '0 8px', borderRadius: 8 }}>
              <Phone size={16} className="muted" />
              <input
                className="input"
                style={{ border: 0, background: 'transparent' }}
                required
                value={form.contactPhone}
                onChange={e => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="09XXXXXXXX"
              />
            </div>
          </Field>

          <label className="row" style={{ gridColumn: '1 / -1', justifyContent: 'flex-start', alignItems: 'flex-start', fontSize: 12, gap: 8 }}>
            <input type="checkbox" checked={phonePublicConsent} onChange={e => setPhonePublicConsent(e.target.checked)} required />
            <span>I agree that this phone number will be visible to buyers on my active listing so they can contact me directly.</span>
          </label>
          <Field label="Telegram Username (Optional)">
            <div className="row surface" style={{ padding: '0 8px', borderRadius: 8 }}>
              <Send size={16} color="#0088cc" />
              <input
                className="input"
                style={{ border: 0, background: 'transparent' }}
                value={form.telegramHandle}
                onChange={e => setForm({ ...form, telegramHandle: e.target.value })}
                placeholder="username (without @)"
              />
            </div>
          </Field>
        </div>
      </div>

      <Field label="Product description">
        <textarea
          className="input"
          rows={4}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Describe condition, specifications, accessories, or campus pickup spot."
        />
      </Field>

      <Field label="Product images (Up to 3)">
        <input
          className="input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 3))}
        />
        <small className="muted">{files.length} image(s) selected · max 10 MB each · up to 3 images</small>
      </Field>

      <div className="listing-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Condition">
          <select
            className="input"
            value={form.condition}
            onChange={e => setForm({ ...form, condition: e.target.value })}
          >
            <option value="NEW">Brand New</option>
            <option value="LIKE_NEW">Like New</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
          </select>
        </Field>
        <Field label="Campus / Town Location">
          <input
            className="input"
            value={form.locationText}
            onChange={e => setForm({ ...form, locationText: e.target.value })}
            placeholder="e.g. Woldia University Main Campus"
          />
        </Field>
      </div>

      {error && (
        <div className="surface2" style={{ padding: 12, color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6 }} />
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        disabled={busy || !hasEnoughCoins}
        style={{ width: '100%', padding: '12px 18px', fontSize: 15 }}
      >
        {busy ? 'Publishing…' : !hasEnoughCoins ? `Need ${requiredCoins} Coins to Publish` : `Publish Product (${requiredCoins} Coins)`}
      </button>

      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>
        The listing fee is 1–5 coins based on the product price. Coins are charged only when the listing becomes active. Every listing lasts 30 days. Buyers contact you directly; Nova takes no percentage sales commission.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
