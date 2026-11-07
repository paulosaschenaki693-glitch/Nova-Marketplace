import 'server-only';

export function isAllowedProductImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return false;
  try {
    const expected = new URL(base);
    const candidate = new URL(value);
    return candidate.protocol === 'https:' && candidate.origin === expected.origin
      && candidate.pathname.startsWith(expected.pathname.replace(/\/$/, '') + '/');
  } catch {
    return false;
  }
}
