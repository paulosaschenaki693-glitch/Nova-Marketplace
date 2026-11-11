'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header, Footer } from '@/components/header';
import {
  ArrowLeft,
  Heart,
  Phone,
  Send,
  MapPin,
  CheckCircle2,
  Flag,
  MessageSquare,
} from 'lucide-react';
import { ProductGallery } from '@/components/product-gallery';
import { ProfileAvatar } from '@/components/profile-avatar';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/products/${id}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error('Product not found');
        return r.json();
      })
      .then(data => {
        setProduct(data);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));

    // Check favorite status
    fetch('/api/favorites', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then(favs => {
        if (Array.isArray(favs)) {
          setSaved(favs.some((x: any) => x.productId === id || x.product?.id === id));
        }
      })
      .catch(() => {});
  }, [id]);

  async function toggleFavorite() {
    if (!product) return;
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(next ? '/api/favorites' : `/api/favorites?productId=${encodeURIComponent(product.id)}`, {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        ...(next ? { body: JSON.stringify({ productId: product.id }) } : {}),
      });
      if (!res.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportReason.trim() || !product) return;
    try {
      const r = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, reason: reportReason }),
      });
      if (r.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
          setReportReason('');
        }, 2000);
      }
    } catch {}
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="shell section" style={{ minHeight: '60vh' }}>
          <div className="surface" style={{ padding: 40, textAlign: 'center' }}>
            Loading product details…
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="shell section">
          <Link className="muted row" style={{ justifyContent: 'flex-start', marginBottom: 20 }} href="/explore">
            <ArrowLeft size={15} /> Back to explore
          </Link>
          <div className="surface" style={{ padding: 40, textAlign: 'center', borderRadius: 14 }}>
            <h2>Product Not Found</h2>
            <p className="muted">This listing may have been sold, archived, or is currently pending review.</p>
            <Link href="/explore" className="btn btn-primary" style={{ marginTop: 12 }}>
              Browse Marketplace Listings
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const phone = product.contactPhonePublic !== false ? (product.contactPhone || '') : '';
  const telegram = product.telegramHandle ? product.telegramHandle.replace(/^@+/, '') : null;
  const isMerchant = product.seller?.role === 'MERCHANT';

  return (
    <>
      <Header />
      <main className="shell section" style={{ maxWidth: 1040 }}>
        <Link className="muted row" style={{ justifyContent: 'flex-start', marginBottom: 18 }} href="/explore">
          <ArrowLeft size={15} /> Back to all listings
        </Link>

        <div className="product-detail-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, alignItems: 'start' }}>
          {/* Gallery Column */}
          <div className="surface" style={{ padding: 16, borderRadius: 18 }}>
            <ProductGallery images={product.images || []} title={product.title} />
          </div>

          {/* Details Column */}
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Header / Price info */}
            <div>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="pill">{product.category?.nameEn || 'Campus Item'}</span>
                <span className={`status ${product.condition === 'NEW' ? 'success' : 'warn'}`}>
                  {product.condition?.replaceAll('_', ' ')}
                </span>
                <span
                  className="pill"
                  style={{
                    background: isMerchant ? '#10b98118' : 'var(--purple-soft)',
                    color: isMerchant ? '#10b981' : 'var(--purple2)',
                  }}
                >
                  {isMerchant ? '🏪 Weldiya Merchant' : '🎓 Woldia Student'}
                </span>
              </div>

              <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', margin: '6px 0 10px', lineHeight: 1.25 }}>
                {product.title}
              </h1>

              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 32, margin: 0, color: 'var(--purple2)', fontWeight: 800 }}>
                  ETB {Number(product.price).toLocaleString()}
                </h2>
                <button
                  type="button"
                  className="favorite-icon"
                  onClick={toggleFavorite}
                  aria-label={saved ? 'Remove favorite' : 'Save product'}
                  style={{ width: 42, height: 42 }}
                >
                  <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            {/* 1. CONTACT INFORMATION CONTAINER */}
            <div
              className="surface"
              style={{
                padding: 18,
                borderRadius: 16,
                border: '1.5px solid var(--purple)',
                background: 'var(--surface2)',
                display: 'grid',
                gap: 12,
              }}
            >
              <div>
                <b style={{ fontSize: 16, display: 'block' }}>Contact Seller Directly</b>
                <small className="muted">Direct campus deal · Call or message the seller right now</small>
              </div>

              <div style={{ display: 'grid', gap: 9 }}>
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="btn btn-primary"
                    style={{
                      padding: '12px 16px',
                      fontSize: 15,
                      fontWeight: 700,
                      justifyContent: 'center',
                      background: '#10b981',
                      borderColor: '#10b981',
                    }}
                    title="Call seller immediately"
                  >
                    <Phone size={17} /> Call Seller ({phone})
                  </a>
                )}

                {telegram && (
                  <a
                    href={`https://t.me/${telegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{
                      padding: '11px 16px',
                      fontSize: 14,
                      fontWeight: 700,
                      justifyContent: 'center',
                      background: '#0088cc',
                      color: '#fff',
                      borderRadius: 11,
                    }}
                    title="Message seller on Telegram"
                  >
                    <Send size={16} /> Chat on Telegram (@{telegram})
                  </a>
                )}

                {phone && (
                  <a
                    href={`sms:${phone}`}
                    className="btn btn-ghost"
                    style={{
                      padding: '10px 14px',
                      fontSize: 14,
                      justifyContent: 'center',
                      background: 'var(--surface)',
                    }}
                    title="Send SMS text message"
                  >
                    <MessageSquare size={16} /> Send SMS Text
                  </a>
                )}
              </div>
            </div>

            {/* 2. PRODUCT DESCRIPTION CONTAINER (Directly next to / below Contact Info) */}
            <div className="surface" style={{ padding: 22, borderRadius: 16, display: 'grid', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Product Description</h3>

              <p
                style={{
                  margin: 0,
                  lineHeight: 1.8,
                  fontSize: 15,
                  whiteSpace: 'pre-line',
                  color: 'var(--text)',
                }}
              >
                {product.description}
              </p>

              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 14,
                  fontSize: 13,
                }}
              >
                <div className="row" style={{ gap: 6, alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                  <MapPin size={16} className="muted" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span className="muted" style={{ display: 'block', fontSize: 11 }}>Location</span>
                    <b>{product.locationText || 'Woldiya, Ethiopia'}</b>
                  </div>
                </div>

                <div>
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>Quantity</span>
                  <b>{product.quantity} in stock</b>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="muted" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>Seller</span>
                  <div className="row" style={{ justifyContent: 'flex-start', gap: 9 }}>
                    <ProfileAvatar name={product.seller?.fullName || product.seller?.shopName} imageUrl={product.seller?.profileImageUrl} verified={Boolean(product.seller?.verifiedSeller)} size={38} />
                    <div>
                      <b>{product.seller?.shopName || product.seller?.fullName || 'Nova Seller'}</b>
                      {product.seller?.bio && <small className="muted" style={{ display: 'block' }}>{product.seller.bio}</small>}
                      {product.seller?.publicLocation && <small className="muted" style={{ display: 'block' }}>{product.seller.publicLocation}</small>}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>Condition</span>
                  <b>{product.condition?.replaceAll('_', ' ')}</b>
                </div>
              </div>
            </div>

            {/* 3. BOTTOM ACTIONS: Report Listing & Support */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowReportModal(true)}
                style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 10px' }}
              >
                <Flag size={13} /> Report suspicious listing
              </button>

              <Link href="/support" className="muted" style={{ fontSize: 12 }}>
                Need help? Contact support →
              </Link>
            </div>
          </div>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              background: 'rgba(0,0,0,0.65)',
              display: 'grid',
              placeItems: 'center',
              padding: 20,
            }}
            onClick={() => setShowReportModal(false)}
          >
            <div
              className="surface"
              style={{
                width: '100%',
                maxWidth: 440,
                padding: 24,
                borderRadius: 16,
                display: 'grid',
                gap: 14,
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ margin: 0 }}>Report Listing</h3>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Help us keep Nova Campus Marketplace safe. Tell us why you're reporting this listing:
              </p>

              {reportSuccess ? (
                <div className="surface2" style={{ padding: 18, borderRadius: 10, color: '#10b981', textAlign: 'center' }}>
                  <CheckCircle2 size={28} style={{ margin: '0 auto 6px' }} />
                  <b>Report submitted to the Nova safety team.</b>
                </div>
              ) : (
                <form onSubmit={submitReport} style={{ display: 'grid', gap: 12 }}>
                  <textarea
                    required
                    className="input"
                    rows={3}
                    placeholder="e.g. Prohibited item, fake product, scam phone number…"
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                  />
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowReportModal(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit">
                      Submit Report
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
