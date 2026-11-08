import { AdminQueue } from '@/components/admin-queue';

export default function AdminCoinsPage() {
  return (
    <div className="shell section">
      <div style={{ marginBottom: 20 }}>
        <span className="pill">FINANCIAL OPERATIONS</span>
        <h1 style={{ fontSize: 32, margin: '8px 0 4px' }}>Listing Coin Purchases</h1>
        <p className="muted" style={{ margin: 0 }}>
          Verify incoming TeleBirr, CBE, and BOA payments from students and merchants, then approve listing coins with one click.
        </p>
      </div>
      <AdminQueue kind="coins" />
    </div>
  );
}
