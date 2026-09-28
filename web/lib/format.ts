/** Human-friendly formatting: relative timestamps + dual-currency money. */

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 10) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function exactUtc(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace('Z', ' UTC');
}

/** Display-only FX rate (not for settlement). */
export const USD_PER_INR = 1 / 83.0;

export type Currency = 'INR' | 'USD';

/** Amounts are stored in paise (Razorpay convention). */
export function formatMoney(paise: number, currency: Currency): string {
  if (currency === 'USD') {
    const usd = (paise / 100) * USD_PER_INR;
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
