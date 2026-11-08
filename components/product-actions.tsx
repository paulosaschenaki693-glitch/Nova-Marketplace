'use client';

import { Heart, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Props = {
  product: {
    id: string;
    title: string;
    price: number;
    emoji?: string;
    imageUrl?: string;
    sellerType?: 'STUDENT' | 'MERCHANT';
    quantity?: number;
    contactPhone?: string;
  };
  compact?: boolean;
};

export function ProductActions({ product }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/favorites', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive && Array.isArray(d)) {
          setSaved(d.some((x: any) => x.productId === product.id || x.product?.id === product.id));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [product.id]);

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(next ? '/api/favorites' : `/api/favorites?productId=${encodeURIComponent(product.id)}`, {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        ...(next ? { body: JSON.stringify({ productId: product.id }) } : {}),
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    }
  }

  return (
    <div className="product-actions">
      <button
        type="button"
        className="favorite-icon"
        aria-label={saved ? 'Remove from saved items' : 'Save item'}
        title={saved ? 'Saved' : 'Save item'}
        onClick={toggleFavorite}
      >
        <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
      </button>

      <Link
        href={`/product/${product.id}`}
        className="btn btn-primary contact-seller-btn"
      >
        <Phone size={13} style={{ flexShrink: 0 }} />
        <span>Contact Seller</span>
      </Link>
    </div>
  );
}
