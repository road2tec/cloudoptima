// Deterministic random helpers so the simulated clouds are reproducible.

// mulberry32: tiny seeded PRNG returning floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stateless hash noise: same (seed, index, channel) always gives the same value in [0, 1).
export function hashNoise(seed, index, channel = 0) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (index >>> 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ Math.imul(channel + 1, 0x27d4eb2d), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ (index / 4294967296), 0x165667b1);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRandom(rng) {
  const r = {
    next: rng,
    float: (min, max) => min + rng() * (max - min),
    int: (min, max) => Math.floor(min + rng() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    chance: (p) => rng() < p,
    // pairs: [[value, weight], ...]
    weighted(pairs) {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = rng() * total;
      for (const [v, w] of pairs) {
        if ((x -= w) <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    hex: (len) => Array.from({ length: len }, () => Math.floor(rng() * 16).toString(16)).join(''),
    digits: (len) => Array.from({ length: len }, (_, i) => (i === 0 ? 1 + Math.floor(rng() * 9) : Math.floor(rng() * 10))).join(''),
    uuid() {
      const h = r.hex(32);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
    },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return r;
}
