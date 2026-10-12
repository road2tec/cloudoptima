// Small numeric helpers used by the engines and controllers.
export const sum = (arr) => arr.reduce((s, v) => s + v, 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

export function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((v) => (v - m) ** 2)) / (arr.length - 1));
}

// Percentile with linear interpolation (p in 0..100).
export function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;
export const HOURS_PER_MONTH = 730;

export const startOfUtcDay = (ts) => {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
export const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);
