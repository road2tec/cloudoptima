// Workload patterns. Each simulated VM gets one pattern plus randomised parameters.
// utilizationAt() is a pure function of (pattern, params, seed, time), so historical
// back-fill and the live ticker always agree with each other.
import { hashNoise } from '../utils/rng.js';
import { clamp, DAY, HOUR } from '../utils/stats.js';

export const PATTERNS = ['steady', 'diurnal', 'weekly', 'spiky', 'growing', 'idle', 'oversized'];

const IST_OFFSET = 5.5 * HOUR;

function istClock(ts) {
  const d = new Date(ts + IST_OFFSET);
  return { hour: d.getUTCHours() + d.getUTCMinutes() / 60, dow: d.getUTCDay() };
}

// Smooth 0..1 curve that is high between 09:00 and 19:00 IST.
function businessCurve(hour) {
  const rise = 1 / (1 + Math.exp(-(hour - 9) * 1.4));
  const fall = 1 / (1 + Math.exp((hour - 19) * 1.4));
  return rise * fall;
}

// Draw random parameters for a pattern. `r` is a makeRandom() helper.
export function makeParams(pattern, r, now) {
  switch (pattern) {
    case 'steady':
      return { base: r.float(40, 56), noise: r.float(2, 4), memBase: r.float(38, 52), memCoupling: 0.15 };
    case 'diurnal':
      return { base: r.float(8, 16), amp: r.float(48, 58), noise: r.float(2.5, 4.5), memBase: r.float(30, 42), memCoupling: 0.3 };
    case 'weekly':
      return { base: r.float(18, 26), amp: r.float(38, 48), noise: r.float(2, 4), memBase: r.float(32, 44), memCoupling: 0.25 };
    case 'spiky':
      return { base: r.float(14, 24), noise: r.float(3, 5), spikeProb: r.float(0.08, 0.12), spikeLevel: r.float(78, 92), memBase: r.float(30, 40), memCoupling: 0.3 };
    case 'growing':
      return { base: r.float(24, 30), growthPerDay: r.float(0.65, 0.95), t0: now - 30 * DAY, amp: r.float(8, 14), noise: r.float(2, 4), memBase: r.float(34, 44), memCoupling: 0.25 };
    case 'idle':
      return { base: r.float(0.3, 1.0), noise: r.float(0.6, 1.6), memBase: r.float(9, 18), memCoupling: 0 };
    case 'oversized':
      return { base: r.float(4, 8), amp: r.float(6, 11), noise: r.float(1.5, 2.5), memBase: r.float(11, 17), memCoupling: 0.2 };
    default:
      return { base: 40, noise: 3, memBase: 40, memCoupling: 0.2 };
  }
}

/**
 * Utilization of a VM at timestamp `ts`.
 * `sim` = { pattern, params, seed, resizedAt, cpuScale, memScale }
 * Returns { cpu %, mem %, netIn MB/h, netOut MB/h }.
 */
export function utilizationAt(sim, ts) {
  const p = sim.params || {};
  const minute = Math.floor(ts / 60000);
  const hourIdx = Math.floor(ts / HOUR);
  const u = (ch) => hashNoise(sim.seed, minute, ch); // 0..1
  const n = (ch) => u(ch) * 2 - 1; // -1..1
  const { hour, dow } = istClock(ts);
  const biz = businessCurve(hour);
  const weekend = dow === 0 || dow === 6;
  let cpu;

  switch (sim.pattern) {
    case 'steady':
      cpu = p.base + n(1) * p.noise;
      break;
    case 'diurnal':
      cpu = p.base + p.amp * biz * (weekend ? 0.6 : 1) + n(1) * p.noise;
      break;
    case 'weekly':
      cpu = weekend ? p.base * 0.35 + n(1) * 1.5 : p.base + p.amp * biz + n(1) * p.noise;
      break;
    case 'spiky': {
      // A burst lasts for the whole hour; probability decided by hour-level hash.
      const burst = hashNoise(sim.seed, hourIdx, 7) < p.spikeProb;
      cpu = burst ? p.spikeLevel + n(2) * 5 : p.base + n(1) * p.noise;
      break;
    }
    case 'growing': {
      const days = (ts - p.t0) / DAY;
      cpu = p.base + p.growthPerDay * days + p.amp * biz + n(1) * p.noise;
      break;
    }
    case 'idle':
      cpu = p.base + u(1) * p.noise;
      break;
    case 'oversized':
      cpu = Math.min(24, p.base + p.amp * biz + n(1) * p.noise);
      break;
    default:
      cpu = 30 + n(1) * 3;
  }

  let mem = p.memBase + Math.max(0, cpu) * p.memCoupling + n(3) * 2.5;

  // After a simulated resize the same workload runs on a different size.
  if (sim.resizedAt && ts >= new Date(sim.resizedAt).getTime()) {
    cpu *= sim.cpuScale || 1;
    mem *= sim.memScale || 1;
  }

  cpu = clamp(cpu, 0.1, 100);
  mem = clamp(mem, 2, 99);
  const netIn = Math.max(0.5, (4 + cpu * 9) * (1 + 0.25 * n(4)));
  const netOut = Math.max(0.3, (3 + cpu * 7) * (1 + 0.25 * n(5)));
  return { cpu, mem, netIn, netOut };
}
