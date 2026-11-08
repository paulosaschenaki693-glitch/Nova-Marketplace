import Link from 'next/link';
import { ArrowRight, Phone, ShieldCheck, Coins, Search, Sparkles } from 'lucide-react';
import { Header, Footer } from '@/components/header';
import { HomeCategories, HomeProducts, WelcomeToast } from '@/components/home-marketplace';

export default function Home() {
  return (
    <>
      <Header />
      <WelcomeToast />
      <main className="shell">
        <section className="section">
          <div className="hero">
            <span className="pill">WOLDIA UNIVERSITY & WELDIYA TOWN</span>
            <h1
              style={{
                fontSize: 'clamp(38px, 6vw, 66px)',
                lineHeight: 1.04,
                maxWidth: 620,
                margin: '22px 0 16px',
              }}
            >
              Your campus.
              <br />
              <span
                style={{
                  background: 'linear-gradient(90deg, #b79bff, #8150ff)',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Direct marketplace.
              </span>
            </h1>
            <p className="muted" style={{ fontSize: 17, lineHeight: 1.7, maxWidth: 510 }}>
              Connect directly with students and local merchants. Sellers pay transparent listing fees with prepaid coins; buyers contact sellers directly and arrange their own deals.
            </p>

            <form action="/explore" className="row surface home-search">
              <Search size={20} className="muted" style={{ marginLeft: 10 }} />
              <input
                name="q"
                placeholder="Search laptops, books, phones, clothes…"
                aria-label="Search products"
                className="input"
                style={{ border: 0, background: 'transparent' }}
              />
              <button className="btn btn-primary">Search</button>
            </form>

            <div className="row hero-trust">
              <span className="muted row">
                <ShieldCheck size={16} color="#a88aff" /> Verified Student IDs
              </span>
              <span className="muted row">
                <Phone size={16} color="#a88aff" /> Direct Phone & Telegram
              </span>
              <span className="muted row">
                <Coins size={16} color="#a88aff" /> 0% Sales Commission
              </span>
            </div>
          </div>
        </section>

        <HomeCategories />
        <HomeProducts />

        <section className="section">
          <div className="surface how-it-works">
            {[
              ['01', 'Discover Deals', 'Find laptops, books, stationery, and clothes from campus students and local Weldiya shops.'],
              ['02', 'Contact Directly', 'One-click call or Telegram chat with the seller. Ask questions and negotiate in real time.'],
              ['03', 'Meet on Campus', 'Meet in a safe campus spot (Library, Student Lounge, Cafeteria), inspect your item, and pay.'],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span className="pill">{n}</span>
                <h3 style={{ fontSize: 18, margin: '13px 0 6px' }}>{t}</h3>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                  {d}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="surface2 row selling-cta">
            <div>
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Sparkles size={20} color="var(--purple2)" />
                <h2 style={{ margin: 0, fontSize: 22 }}>Have something to sell on campus?</h2>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Register now and receive <b>3 Free Listing Coins</b> to post your first items immediately!
              </p>
            </div>
            <Link href="/start-selling" className="btn btn-primary">
              Start selling free <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
