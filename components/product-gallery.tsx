'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react';

export function ProductGallery({ images, title }: { images: { imageUrl: string }[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  const list = images?.filter(x => x?.imageUrl) || [];
  const current = list[active]?.imageUrl;

  if (!list.length) return <div className="product-image" style={{ height: 390, fontSize: 90 }}>📦</div>;

  const move = (d: number) => setActive(v => (v + d + list.length) % list.length);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          height: 'min(68vw, 480px)',
          minHeight: 280,
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--surface2)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <img
          key={current}
          src={current}
          alt={`${title} image ${active + 1}`}
          onClick={() => setZoom(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            cursor: 'zoom-in',
            animation: 'modalPopIn 0.25s var(--ease-spring) backwards',
          }}
        />

        {list.length > 1 && (
          <>
            <button
              aria-label="Previous image"
              className="btn btn-ghost"
              onClick={() => move(-1)}
              style={{
                position: 'absolute',
                left: 10,
                top: '46%',
                background: 'var(--surface)',
                borderRadius: 99,
                padding: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Next image"
              className="btn btn-ghost"
              onClick={() => move(1)}
              style={{
                position: 'absolute',
                right: 10,
                top: '46%',
                background: 'var(--surface)',
                borderRadius: 99,
                padding: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        <button
          aria-label="Zoom image"
          className="btn btn-ghost"
          onClick={() => setZoom(true)}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            background: 'var(--surface)',
            borderRadius: 99,
            padding: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <ZoomIn size={16} />
        </button>

        <span
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            background: 'var(--surface)',
            padding: '5px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          {active + 1} / {list.length}
        </span>
      </div>

      {list.length > 1 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {list.map((im, i) => (
            <button
              key={im.imageUrl + i}
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              style={{
                padding: 2,
                border: active === i ? '2px solid var(--purple)' : '1px solid var(--border)',
                borderRadius: 12,
                background: 'var(--surface)',
                flex: '0 0 76px',
                height: 72,
                cursor: 'pointer',
                transition: 'all 0.18s var(--ease-spring)',
                transform: active === i ? 'scale(1.04)' : 'scale(1)',
              }}
            >
              <img
                src={im.imageUrl}
                alt={`${title} thumbnail ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }}
              />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(0,0,0,.92)',
            display: 'grid',
            placeItems: 'center',
            padding: 18,
          }}
        >
          <button
            className="btn btn-ghost"
            aria-label="Close zoom"
            onClick={() => setZoom(false)}
            style={{ position: 'absolute', right: 20, top: 20, background: '#fff', borderRadius: 99, padding: 8 }}
          >
            <X size={20} />
          </button>
          <img
            src={current}
            alt={title}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '96vw', maxHeight: '90vh', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
}
