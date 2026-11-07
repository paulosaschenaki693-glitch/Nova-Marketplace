import 'server-only';
import { prisma } from '@/lib/prisma';

export async function notifyAdmins(input: {
  type: 'ORDER'|'PAYMENT'|'LISTING'|'ACCOUNT'|'SYSTEM';
  title: string;
  body: string;
  priority?: 'NORMAL'|'HIGH'|'URGENT';
  path?: string;
}) {
  // Notifications are deliberately best-effort: an alert failure must never make
  // an already-committed order/payment appear to have failed to the user.
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true, email: true },
    });
    if (!admins.length) return;

    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const records: { id: string }[] = [];
    for (const admin of admins) {
      const existing = await prisma.notification.findFirst({
        where: { userId: admin.id, type: input.type, title: input.title, body: input.body, createdAt: { gte: cutoff } },
      });
      if (!existing) {
        records.push(await prisma.notification.create({
          data: { userId: admin.id, type: input.type, title: input.title, body: input.body, priority: input.priority || 'NORMAL' },
        }));
      }
    }
    if (!records.length) return;

    const key = process.env.RESEND_API_KEY;
    const to = process.env.ADMIN_NOTIFICATION_EMAIL;
    const from = process.env.ADMIN_NOTIFICATION_FROM;
    if (!key || !to || !from) return;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `[Nova ${input.priority || 'NORMAL'}] ${input.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>${escapeHtml(input.title)}</h2><p>${escapeHtml(input.body)}</p><p>Open the Nova admin dashboard to review this item.</p></div>`,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      await prisma.notification.updateMany({ where: { id: { in: records.map(record => record.id) } }, data: { emailSentAt: new Date() } });
    } else {
      console.error('[admin-notifications] Email provider rejected notification:', response.status);
    }
  } catch (error) {
    console.error('[admin-notifications] Notification delivery failed:', error);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] || character));
}
