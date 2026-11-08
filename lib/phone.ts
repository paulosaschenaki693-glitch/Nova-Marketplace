/** Accept Ethiopian mobile numbers and store them in international +251 format. */
export function normalizeEthiopianPhone(value: string): string | null {
  const compact = String(value || '').trim().replace(/[\s()-]/g, '');
  if (/^\+251[79]\d{8}$/.test(compact)) return compact;
  if (/^0[79]\d{8}$/.test(compact)) return `+251${compact.slice(1)}`;
  if (/^[79]\d{8}$/.test(compact)) return `+251${compact}`;
  return null;
}
