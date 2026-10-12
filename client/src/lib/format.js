// Formatting helpers. Money is always stored in USD; conversion happens at display time.

export function formatMoney(usd, { currency = 'USD', rate = 83.5, compact = false, decimals } = {}) {
  if (usd == null || Number.isNaN(usd)) return '—';
  const value = currency === 'INR' ? usd * rate : usd;
  const abs = Math.abs(value);
  const digits = decimals ?? (compact ? (abs >= 1000 ? 1 : 0) : abs < 100 ? 2 : 0);
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    notation: compact && abs >= 1000 ? 'compact' : 'standard',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export const formatPct = (v, d = 1) => (v == null ? '—' : `${Number(v).toFixed(d)}%`);
export const formatNumber = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
export const signed = (v, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}%`);

export function timeAgo(date) {
  if (!date) return 'never';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const dateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const hourLabel = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit' });

export const initials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Shorten long native IDs (Azure ARM ids) for display.
export function shortId(id = '') {
  if (id.length <= 28) return id;
  if (id.includes('/')) return `…/${id.split('/').slice(-2).join('/')}`;
  return `${id.slice(0, 14)}…${id.slice(-8)}`;
}

export const titleCase = (s = '') => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
